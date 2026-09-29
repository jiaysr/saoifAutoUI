// src/main.js
import { createApp, reactive } from 'vue'
import App from './App.vue'
import './styles.css'
import { installReceiver, installErrorHook, send } from './bridge.js'

installErrorHook()

// 全局状态：由 Lua 的 init 消息填充
// ⚠ 必须用 reactive()，否则 init 到达后模板不会重新渲染
// 报文结构（见 脚本/ui/h5_bridge.lua）：{ type:"init", data:{ ver, sid, tasks, values } }
export const store = reactive({
  sid: '',
  ver: '',
  tasks: [],   // [{ name, desc, schema:[{key,label,type,...}] }]
  values: {}   // { key: value } 各功能参数初值（含 func=上次选择的功能）
})

installReceiver((msg) => {
  if (!msg || !msg.type) return
  const d = msg.data || {}
  if (d.sid && !store.sid) store.sid = d.sid

  if (msg.type === 'init') {
    if (d.sid) store.sid = d.sid
    store.ver = d.ver || ''
    store.tasks = d.tasks || []
    // 保留本地已改动的值，仅补齐 Lua 下发的初值
    for (const k in (d.values || {})) {
      if (!(k in store.values)) store.values[k] = d.values[k]
    }
    // 确认收到初值（Lua 侧未收到 ack 前会重发）
    send({ type: 'ack', sid: store.sid })
  }
})

createApp(App).mount('#app')
