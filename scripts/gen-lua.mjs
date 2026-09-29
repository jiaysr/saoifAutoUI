// scripts/gen-lua.mjs
// 把 Vite 构建产物 dist/index.html 包装成懒人精灵可用的 Lua 模块：
//   脚本/ui/h5_page.lua  （含 _M.html 字符串，由 ui/h5_bridge.lua 写到设备后加载）
//
// 用法：npm run build （= vite build && node scripts/gen-lua.mjs）
// 只重打包不生成：npm run build:only
//
// 想换输出位置：改 OUT_LUA，或用环境变量 H5_LUA_OUT 覆盖。

import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const here = path.dirname(url.fileURLToPath(import.meta.url))
const DIST_HTML = path.resolve(here, '..', 'dist', 'index.html')
const OUT_LUA = process.env.H5_LUA_OUT
  ? path.resolve(process.env.H5_LUA_OUT)
  : path.resolve('D:/project/saoifAuto/脚本/ui/h5_page.lua')

if (!fs.existsSync(DIST_HTML)) {
  console.error(`[gen-lua] 找不到 ${DIST_HTML}，请先执行 vite build`)
  process.exit(1)
}

const html = fs.readFileSync(DIST_HTML, 'utf8')

// 选一个不会被 HTML 内容碰到的 Lua 长括号层级
function pickDelim(s) {
  for (let lv = 2; lv <= 8; lv++) {
    const d = '='.repeat(lv)
    if (!s.includes(']' + d + ']')) return d
  }
  throw new Error('HTML 内含所有层级的 ]==...==]，请改用转义方案')
}

const d = pickDelim(html)
const stamp = new Date().toLocaleString('sv-SE')   // YYYY-MM-DD HH:mm:ss
const bytes = Buffer.byteLength(html, 'utf8')

const lua = `-- 脚本/ui/h5_page.lua
-- ⚠ 本文件由构建自动生成，请勿手改！
--   源码：ui-src/（Vue3 + Vite + vite-plugin-singlefile）
--   生成：cd ui-src && npm run build
--   时间：${stamp}
--   产物：dist/index.html ${bytes} 字节（全内联、无网络依赖）
local _M = {}

_M.buildTime = "${stamp}"
_M.bytes = ${bytes}
_M.html = [${d}[
${html}]${d}]

return _M
`

fs.mkdirSync(path.dirname(OUT_LUA), { recursive: true })
fs.writeFileSync(OUT_LUA, lua, 'utf8')

const rel = (p) => path.relative(process.cwd(), p)
console.log(`[gen-lua] dist/index.html ${bytes} B  ->  ${rel(OUT_LUA)} ${Buffer.byteLength(lua, 'utf8')} B  (长括号 [${d}[)`)
