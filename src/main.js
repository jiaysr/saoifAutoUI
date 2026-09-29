// src/main.js
import { createApp, reactive } from 'vue'
import App from './App.vue'
import './styles.css'
import { installErrorHook } from './bridge.js'
import { boot, api, IS_DEV } from './data/source.js'

installErrorHook()

// 全局状态（必须 reactive，否则 init 到达后模板不刷新）
export const store = reactive({
  dev: IS_DEV,
  ver: '',
  tasks: [],     // [{ id,name,desc,schema,defaults }]
  configs: [],   // [{ id,group,name,desc,schema,defaults }]
  values: {},    // { key: value }（含 func=当前功能 / cfgGroup=当前设置分区）
  hint: null,    // { level:'ok'|'warn'|'err', text }
  submitPreview: null,  // dev 模式下"将要提交的 JSON"
})

let autoTestHook = null
export function onAutoTest(fn) { autoTestHook = fn }

function handler(msg) {
  if (!msg || !msg.type) return
  const d = msg.data || {}
  switch (msg.type) {
    case 'init':
      store.ver = d.ver || ''
      store.tasks = d.tasks || []
      store.configs = d.configs || []
      for (const k in (d.values || {})) {
        if (!(k in store.values)) store.values[k] = d.values[k]
      }
      break
    case 'hint':
      store.hint = { level: d.level || 'ok', text: d.text || '' }
      break
    case 'error':
      store.hint = { level: 'err', text: d.text || '参数校验失败' }
      break
    default:
      break
  }
}

const rt = boot(handler, () => (typeof autoTestHook === 'function' ? autoTestHook() : false))
export const runtime = rt

export function emitChange(key, value) {
  store.hint = null
  api.change(store.values.func, key, value, JSON.parse(JSON.stringify(store.values)))
}
export function emitSubmit() {
  store.hint = null
  const res = api.submit(store.values.func, JSON.parse(JSON.stringify(store.values)))
  if (res && res.dev) store.submitPreview = JSON.stringify(res.payload, null, 2)
}

createApp(App).mount('#app')
