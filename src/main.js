// src/main.js
// 配置值采用【命名空间】：'task:<id>.<key>' / 'cfg:<id>.<key>'（另有 'func' 指向当前功能）
//  · 彻底消除不同任务/配置之间的同名字段联动
//  · 提交给 Lua 时再拍平成扁平表（tasks 读的仍是 cfg.durationS 这种键）→ Lua 侧零改动
import { createApp, reactive } from 'vue'
import App from './App.vue'
import './styles.css'
import { installErrorHook, sendDiag, sendJsErr } from './bridge.js'
import { boot, api, IS_DEV } from './data/source.js'

installErrorHook()

export const store = reactive({
  dev: IS_DEV,
  ver: '',
  tasks: [],           // [{ id,name,desc,schema,defaults }]
  configs: [],         // [{ id,group,name,desc,schema,defaults }]
  values: {},          // ★ 命名空间键（含 'func'）
  hint: null,
  submitPreview: null,
})

export const scopeOfTask = (t) => 'task:' + t.id
export const scopeOfConfig = (c) => 'cfg:' + c.id
export const pathOf = (scope, key) => scope + '.' + key

// 扁平值(Lua init/localStorage) → 命名空间值
function seedScoped(tasks, configs, flat) {
  const v = {}
  for (const t of tasks) for (const f of (t.schema || [])) {
    const k = pathOf(scopeOfTask(t), f.key)
    v[k] = (flat[f.key] !== undefined) ? flat[f.key] : (t.defaults || {})[f.key]
  }
  for (const c of configs) for (const f of (c.schema || [])) {
    const k = pathOf(scopeOfConfig(c), f.key)
    v[k] = (flat[f.key] !== undefined) ? flat[f.key] : (c.defaults || {})[f.key]
  }
  v.func = flat.func || (tasks[0] && tasks[0].id) || ''
  return v
}

// 命名空间值 → 扁平值（先配置后任务 ⇒ 万一重名以任务为准）
function flattenScoped(tasks, configs, v) {
  const flat = { func: v.func }
  for (const c of configs) for (const f of (c.schema || [])) {
    const x = v[pathOf(scopeOfConfig(c), f.key)]
    if (x !== undefined) flat[f.key] = x
  }
  for (const t of tasks) for (const f of (t.schema || [])) {
    const x = v[pathOf(scopeOfTask(t), f.key)]
    if (x !== undefined) flat[f.key] = x
  }
  return flat
}
export const flatValues = () => flattenScoped(store.tasks, store.configs, store.values)

let autoTestHook = null
export function onAutoTest(fn) { autoTestHook = fn }

function handler(msg) {
  if (!msg || !msg.type) return
  const d = msg.data || {}
  switch (msg.type) {
    case 'init': {
      store.ver = d.ver || ''
      store.tasks = d.tasks || []
      store.configs = d.configs || []
      const seeded = seedScoped(store.tasks, store.configs, d.values || {})
      // 保留本地已改动的值（真机重发 init 时不覆盖用户编辑）
      for (const k in seeded) if (!(k in store.values)) store.values[k] = seeded[k]
      if (!store.values.func) store.values.func = seeded.func
      // 布局自检：800ms 后回传滚动容器尺寸 + 程序化滚动测试（排查"无法滚动"到底卡在哪一层）
      setTimeout(() => {
        try {
          const el = document.scrollingElement || document.documentElement
          const p = document.querySelector('.panel')
          const fmt = (x) => x ? (x.scrollHeight + '/' + x.clientHeight + '@' + Math.round(x.getBoundingClientRect().height)) : 'null'
          const test = (x) => { if (!x) return 'null'; const a = x.scrollTop; x.scrollTop = a + 120; const b = x.scrollTop; x.scrollTop = a; return a + '->' + b }
          sendDiag('win=' + window.innerWidth + 'x' + window.innerHeight
            + ' doc=' + fmt(el) + ' docTest=' + test(el) + ' bodyOv=' + getComputedStyle(document.body).overflow
            + ' panel=' + fmt(p) + ' panelTest=' + test(p))
        } catch (e) { sendJsErr('diag: ' + e) }
      }, 800)
      break
    }
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

export const runtime = boot(handler, () => (typeof autoTestHook === 'function' ? autoTestHook() : false))

export function emitChange(key, value) {
  store.hint = null
  api.change(store.values.func, key, value, flatValues())
}
export function emitSubmit() {
  store.hint = null
  const res = api.submit(store.values.func, flatValues())
  if (res && res.dev) store.submitPreview = JSON.stringify(res.payload, null, 2)
}

createApp(App).mount('#app')

// 触摸兜底滚动：部分设备/悬浮窗会吃掉 WebView 的原生滚动手势
// （实测拖拽完全不动，但点击类事件正常）。这里自己接管 touchmove：
// 找到手指下的滚动容器，直接改 scrollTop，并 preventDefault 防止与原生滚动叠加。
function installTouchScroll() {
  let sc = null, y0 = 0, st0 = 0
  const scrollerAt = (el) => {
    while (el && el.nodeType === 1 && el !== document.body) {
      const cs = getComputedStyle(el)
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 2) return el
      el = el.parentElement
    }
    const d = document.scrollingElement || document.documentElement
    return d.scrollHeight > d.clientHeight + 2 ? d : null
  }
  addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { sc = null; return }
    sc = scrollerAt(e.target)
    if (!sc) return
    y0 = e.touches[0].clientY
    st0 = sc.scrollTop
  }, { passive: true })
  addEventListener('touchmove', (e) => {
    if (!sc) return
    const dy = e.touches[0].clientY - y0
    if (Math.abs(dy) < 3) return
    sc.scrollTop = st0 - dy
    if (e.cancelable) e.preventDefault()
  }, { passive: false })
  addEventListener('touchend', () => { sc = null }, { passive: true })
  addEventListener('touchcancel', () => { sc = null }, { passive: true })
}
try { installTouchScroll() } catch (e) { /* 忽略 */ }
