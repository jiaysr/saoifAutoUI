// src/bridge.js
// 懒人精灵 WebView ↔ Lua 通道封装（与 脚本/ui/h5_bridge.lua 的协议一致）
//   JS  -> Lua : window.bridge.callLua("__h5_onMessage('<base64(JSON)>')")
//   Lua -> JS : ui.callJs(WEB, "javascript:APP.recv('<base64(JSON)>')")
//   消息类型: JS→Lua {ready|ack|change|submit|cancel|ping|jserror}
//             Lua→JS {init|hint|error|pong}

// UTF-8 安全的 base64（分块避免 String.fromCharCode 爆栈）
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
  } catch (e) {
    /* 桥不可用时不抛 */
  }
  return null
}

export function hasBridge() {
  return !!(window.bridge && typeof window.bridge.callLua === 'function')
}

// 发送一条消息给 Lua
export function send(msg) {
  callLua("__h5_onMessage('" + b64encode(JSON.stringify(msg)) + "')")
}

// 注册页面接收器；Lua 侧通过 APP.recv(b64) / APP.probe(tag,sid) / APP.autoTest() 调用
// handler(msg) 处理 init / hint / error / pong
export function installReceiver(handler) {
  window.APP = {
    recv(b64) {
      try {
        handler(JSON.parse(b64decode(b64)))
      } catch (e) {
        send({ type: 'jserror', error: String(e) })
      }
    },
    // Lua 侧短报文探针：确认 callJs 能到达当前活动的 WebView 实例
    // ⚠ 这里必须回 ping（Lua 侧只回 pong，无害）；
    //    不能回 ready —— Lua 收到 ready 会重发 init，与探针形成死循环。
    probe(tag, sid) {
      send({ type: 'ping', sid: sid || '', probe: tag || '' })
    },
    // 连通性自检（由 Lua 侧在自检模式下触发；这里留空实现，按需扩展）
    autoTest() {
      send({ type: 'jserror', error: 'autoTest 未实现' })
    }
  }
}

// 全局 JS 错误也回报给 Lua，便于日志排查
export function installErrorHook() {
  window.onerror = function (m, src, line, col) {
    send({ type: 'jserror', error: String(m) + ' @' + (src || '') + ':' + line + ':' + col })
  }
}
