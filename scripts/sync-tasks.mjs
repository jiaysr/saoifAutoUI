// scripts/sync-tasks.mjs
// 从懒人精灵 Lua 源码同步「任务/配置目录」→ src/generated/catalog.json
//   · 新结构: 脚本/tasks/<名>/vars.lua      （纯数据表 return {...}）
//   · 旧结构: 脚本/tasks/<名>.lua           （从 M.schema / M.defaults 切表字面量）
//   · 全局配置: 脚本/config/*.lua           （return {...}）
// 用 fengari 真解释执行表字面量再转 JSON，避免正则解析 Lua 的坑。
// 用法: npm run sync   （dev/build 会自动先跑；watch 由 vite 插件触发）

import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'
import { lua, lauxlib, lualib, to_luastring, to_jsstring } from 'fengari'

const here = path.dirname(url.fileURLToPath(import.meta.url))
const ROOT = process.env.SAOIF_SCRIPT_DIR || 'D:/project/saoifAuto/脚本'
const OUT = path.resolve(here, '..', 'src', 'generated', 'catalog.json')
const JSON_LUA = fs
  .readFileSync(path.join(here, 'lua_json.lua'), 'utf8')
  .replace(/return\s+json\s*$/, '') // 去掉末尾 return，否则后续代码报 <eof> expected

// ---------- 从 Lua 源码里切出表字面量（跳过字符串/注释，按括号配平） ----------
function sliceTable(src, key) {
  const i = src.indexOf(key)
  if (i < 0) return null
  const b = src.indexOf('{', i)
  if (b < 0) return null
  let depth = 0, j = b, inStr = null, inLong = false
  for (; j < src.length; j++) {
    const c = src[j]
    if (inLong) { if (c === ']' && src[j + 1] === ']') { inLong = false; j++ } continue }
    if (inStr) { if (c === '\\') { j++; continue } if (c === inStr) inStr = null; continue }
    if (c === '-' && src[j + 1] === '-') {
      if (src[j + 2] === '[' && src[j + 3] === '[') { inLong = true; j += 3; continue }
      const nl = src.indexOf('\n', j); j = nl < 0 ? src.length : nl; continue
    }
    if (c === '"' || c === "'") { inStr = c; continue }
    if (c === '{') depth++
    else if (c === '}') { depth--; if (depth === 0) return src.slice(b, j + 1) }
  }
  return null
}

// ---------- fengari: 执行表字面量 → JS 对象 ----------
function luaToJson(literal) {
  const L = lauxlib.luaL_newstate()
  lualib.luaL_openlibs(L)
  const st = lauxlib.luaL_dostring(L, to_luastring(`${JSON_LUA}\nOUT = json.encode((${literal}))\n`))
  if (st !== lua.LUA_OK) {
    const err = to_jsstring(lua.lua_tostring(L, -1))
    lua.lua_close(L)
    throw new Error(err)
  }
  lua.lua_getglobal(L, to_luastring('OUT'))
  const s = to_jsstring(lua.lua_tostring(L, -1))
  lua.lua_close(L)
  return JSON.parse(s)
}

const firstMatch = (src, re, def = '') => { const m = src.match(re); return m ? m[1] : def }

// ---------- 任务: 新结构（文件夹 + vars.lua） ----------
function readTaskFolder(dir) {
  const vars = path.join(dir, 'vars.lua')
  if (!fs.existsSync(vars)) return null
  const src = fs.readFileSync(vars, 'utf8')
  const lit = sliceTable(src, 'return')
  if (!lit) throw new Error(`${vars} 里找不到 return {...}`)
  const d = luaToJson(lit)
  const id = path.basename(dir)
  return {
    id,
    name: d.name || id,
    desc: d.desc || '',
    order: Number(d.order) || 100,
    schema: d.schema || [],
    defaults: d.defaults || {},
    source: `tasks/${id}/vars.lua`,
  }
}

// ---------- 任务: 旧结构（扁平 .lua，切 M.schema / M.defaults） ----------
function readTaskFile(file) {
  const src = fs.readFileSync(file, 'utf8')
  const id = path.basename(file, '.lua')
  const schLit = sliceTable(src, 'M.schema')
  const defLit = sliceTable(src, 'M.defaults')
  return {
    id,
    name: firstMatch(src, /name\s*=\s*"([^"]*)"/, id),
    desc: firstMatch(src, /M\.desc\s*=\s*"([^"]*)"/),
    order: 100,
    schema: schLit ? luaToJson(schLit) : [],
    defaults: defLit ? luaToJson(defLit) : {},
    source: `tasks/${id}.lua`,
  }
}

// ---------- 全局配置: 脚本/config/*.lua ----------
function readConfigFile(file) {
  const src = fs.readFileSync(file, 'utf8')
  const lit = sliceTable(src, 'return')
  if (!lit) return null
  const d = luaToJson(lit)
  const id = d.id || path.basename(file, '.lua')
  return {
    id,
    group: d.group || '全局',
    name: d.name || id,
    desc: d.desc || '',
    order: Number(d.order) || 100,
    schema: d.schema || [],
    defaults: d.defaults || {},
    source: `config/${path.basename(file)}`,
  }
}

// ---------- 扫描 ----------
const TASKS_DIR = path.join(ROOT, 'tasks')
const CONFIG_DIR = path.join(ROOT, 'config')
const tasks = []
const configs = []
const errors = []

if (fs.existsSync(TASKS_DIR)) {
  for (const ent of fs.readdirSync(TASKS_DIR, { withFileTypes: true })) {
    const full = path.join(TASKS_DIR, ent.name)
    try {
      if (ent.isDirectory()) {
        const t = readTaskFolder(full)
        if (t) tasks.push(t)
      } else if (ent.isFile() && ent.name.endsWith('.lua') && ent.name !== 'index.lua') {
        tasks.push(readTaskFile(full))
      }
    } catch (e) {
      errors.push(`${ent.name}: ${e.message}`)
    }
  }
}

if (fs.existsSync(CONFIG_DIR)) {
  for (const f of fs.readdirSync(CONFIG_DIR).filter((n) => n.endsWith('.lua'))) {
    try {
      const c = readConfigFile(path.join(CONFIG_DIR, f))
      if (c) configs.push(c)
    } catch (e) {
      errors.push(`config/${f}: ${e.message}`)
    }
  }
}

tasks.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
configs.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))

const out = { generatedAt: new Date().toLocaleString('sv-SE'), scriptDir: ROOT, tasks, configs, errors }
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8')

console.log(`[sync] ${ROOT}`)
for (const t of tasks) console.log(`  任务  ${t.name.padEnd(10, '　')} ${String(t.schema.length).padStart(2)} 字段  ← ${t.source}`)
for (const c of configs) console.log(`  配置  ${c.name.padEnd(10, '　')} ${String(c.schema.length).padStart(2)} 字段  ← ${c.source}`)
if (errors.length) { console.log('  ⚠ 解析失败:'); for (const e of errors) console.log('    ' + e) }
console.log(`[sync] 共 ${tasks.length} 任务 / ${configs.length} 配置 → ${path.relative(process.cwd(), OUT)}`)
