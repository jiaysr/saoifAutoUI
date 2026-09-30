import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'
import Components from 'unplugin-vue-components/vite'
import { VantResolver } from 'unplugin-vue-components/resolvers'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import url from 'node:url'

const here = path.dirname(url.fileURLToPath(import.meta.url))
const SAOIF_SCRIPT_DIR = process.env.SAOIF_SCRIPT_DIR || 'D:/project/saoifAuto/脚本'

// dev 专用：监听 Lua 侧的任务/配置目录，一改动就重新 sync 并刷新页面
// （效果：改 vars.lua → 浏览器里的表单立刻跟着变）
function luaCatalogWatch() {
  return {
    name: 'lua-catalog-watch',
    apply: 'serve',
    configureServer(server) {
      const watch = (p) => { try { server.watcher.add(p) } catch (e) { /* 目录不存在时忽略 */ } }
      watch(path.join(SAOIF_SCRIPT_DIR, 'tasks'))
      watch(path.join(SAOIF_SCRIPT_DIR, 'config'))

      let timer = null
      const onChange = (file) => {
        if (!file.replace(/\\/g, '/').startsWith(SAOIF_SCRIPT_DIR.replace(/\\/g, '/'))) return
        if (!file.endsWith('.lua')) return
        clearTimeout(timer)
        timer = setTimeout(() => {
          try {
            execFileSync(process.execPath, [path.join(here, 'scripts', 'sync-tasks.mjs')], { stdio: 'inherit' })
            server.ws.send({ type: 'full-reload' })
            console.log('[watch] 目录已同步，页面刷新')
          } catch (e) {
            console.error('[watch] sync 失败:', e.message)
          }
        }, 200)
      }
      server.watcher.on('change', onChange)
      server.watcher.on('add', onChange)
      server.watcher.on('unlink', onChange)
    }
  }
}

// 目标：产出「单文件、全内联、无网络依赖」的 index.html，
// 供 scripts/gen-lua.mjs 包装进 saoifAuto/脚本/ui/h5_page.lua，由 h5_bridge 写到设备用 file:// 加载
export default defineConfig({
  base: './',
  plugins: [
    vue(),
    viteSingleFile(),
    luaCatalogWatch(),
    // Vant 按需引入：模板里的 <van-*> 自动带样式，未用到的组件不打包
    Components({ resolvers: [VantResolver()], dirs: [], dts: false }),
  ],
  build: {
    target: 'chrome94',            // 实测设备 WebView = Chrome 94
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,  // 一切资源内联
    minify: 'esbuild',
    reportCompressedSize: false
  }
})
