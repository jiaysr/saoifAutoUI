// src/data/source.js
// 数据源抽象：真机走 Lua 桥（init 消息），浏览器(npm run dev)走 sync 出来的目录 JSON。
// 两种模式对外接口一致，UI 代码完全不感知差异。
import catalog from '../generated/catalog.json'
import {
  hasBridge, installReceiver, sendReady, sendAck, sendChange, sendSubmit, sendCancel,
} from '../bridge.js'

export const IS_DEV = !hasBridge()
export const CATALOG = catalog

const LS_KEY = 'saoif_dev_values'
let sid = ''
let devValues = {}

function loadLocal() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch (e) { return {} }
}
function saveLocal(v) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(v)) } catch (e) { /* 忽略 */ }
}

function flattenDefaults(cat) {
  const d = {}
  for (const t of cat.tasks || []) for (const k in (t.defaults || {})) d[k] = t.defaults[k]
  for (const c of cat.configs || []) for (const k in (c.defaults || {})) d[k] = c.defaults[k]
  return d
}

// 启动：真机发 ready 等 init；dev 直接用目录 JSON 造一条 init
export function boot(handler, autoTestHook) {
  if (IS_DEV) {
    devValues = Object.assign(flattenDefaults(catalog), loadLocal())
    handler({
      type: 'init',
      data: {
        ver: `dev(${catalog.generatedAt})`,
        sid: 'dev',
        tasks: catalog.tasks,
        configs: catalog.configs,
        values: devValues,
      },
    })
    if (!catalog.tasks.length) {
      handler({ type: 'hint', data: { level: 'warn', text: 'catalog.json 为空：先在 saoif-h5 执行 npm run sync' } })
    }
    return { dev: true, autoTest: () => typeof autoTestHook === 'function' && autoTestHook() }
  }

  installReceiver((msg) => {
    const d = msg && msg.data ? msg.data : {}
    if (d.sid) sid = d.sid
    handler(msg)
    if (msg && msg.type === 'init') sendAck(sid)
  }, autoTestHook)
  sendReady('')
  return { dev: false }
}

export const api = {
  change(scope, key, value, values) {
    if (IS_DEV) { saveLocal(values); return }
    sendChange(sid, scope, key, value, values)
  },
  submit(scope, values) {
    if (IS_DEV) {
      saveLocal(values)
      return { dev: true, payload: Object.assign({ func: scope }, values) }
    }
    sendSubmit(sid, scope, values)
    return null
  },
  cancel() { if (!IS_DEV) sendCancel(sid) },
}
