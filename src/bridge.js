// src/bridge.js
// 懒人精灵 WebView ↔ Lua 通道封装（协议见 脚本/ui/h5_bridge.lua）
//   JS  -> Lua : window.bridge.callLua("__h5_onMessage('<base64(JSON)>')")
//   Lua -> JS : ui.callJs(WEB, "javascript:APP.recv('<base64(JSON)>')")
//   消息类型: JS→Lua {ready|ack|change|submit|cancel|ping|jserror}
//             Lua→JS {init|hint|error|pong}    （init 结构: {type, data:{ver,sid,tasks,values}}）

export function b64encode(str) {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  const CH = 0x8000
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH))
  }
  return btoa(bin)
}

export function b64decode(b64) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

export function callLua(code) {
  try {
    if (window.bridge && typeof window.bridge.callLua === 'function') {
      return window.bridge.callLua(code)
    }
  } catch (e) { /* 桥不可用时静默 */ }
  return null
}

export function hasBridge() {
  return !!(window.bridge && typeof window.bridge.callLua === 'function')
}

export function send(msg) {
  callLua("__h5_onMessage('" + b64encode(JSON.stringify(msg)) + "')")
}

// ---- 当前会话 sid（传输层状态：init 到达后由页面写入，所有上行报文都要带）----
// ⚠ 必须带 sid：ui/h5_bridge.lua 会话校验会丢弃 sid 不匹配的报文（含 jserror）
let curSid = ''
export function setSid(sid) { curSid = sid || '' }
export function getSid() { return curSid }

// ---- 协议消息 ----
export const sendReady  = (sid) => send({ type: 'ready', sid: sid || '' })
export const sendAck    = (sid) => send({ type: 'ack', sid })
export const sendCancel = (sid) => send({ type: 'cancel', sid })
export const sendPing   = (sid, probe) => send({ type: 'ping', sid, probe: probe || '' })
// 字段名用 text：Lua 侧 __h5_onMessage 读的是 msg.text
export const sendJsErr  = (err) => send({ type: 'jserror', sid: curSid, text: String(err) })

export function sendChange(sid, func, key, value, values) {
  // 同时给出 key/value 与全量 values，兼容 Lua 侧两种取法
  send({
    type: 'change', sid, func, key, value,
    values: values,
    data: { key, value, values: values },
  })
}

export function sendSubmit(sid, func, values) {
  send(Object.assign({ type: 'submit', sid, func }, values))
}

// 注册页面接收器；Lua 侧通过 APP.recv(b64) / APP.probe(tag,sid) / APP.autoTest() 调用
// handler(msg) 处理 init / hint / error / pong
// autoTestHook(): 连通自检时由 Lua 触发，页面模拟"改参数 → 保存并运行"
export function installReceiver(handler, autoTestHook) {
  window.APP = {
    recv(b64) {
      try { handler(JSON.parse(b64decode(b64))) } catch (e) { sendJsErr(e) }
    },
    // ⚠ 必须回 ping（Lua 侧只回 pong，无害）；回 ready 会让 Lua 重发 init 形成死循环
    probe(tag, sid) { sendPing(sid, tag) },
    autoTest() {
      if (typeof autoTestHook === 'function') return autoTestHook()
      sendJsErr('autoTest 未注册')
    }
  }
}

export function installErrorHook() {
  window.onerror = (m, src, line, col) => sendJsErr(String(m) + ' @' + (src || '') + ':' + line + ':' + col)
  // Promise 链里的异常不会走 window.onerror
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason
    sendJsErr('promise: ' + ((r && (r.stack || r.message)) || String(r)))
  })
}
