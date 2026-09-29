import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'

// 目标：产出「单文件、全内联、无网络依赖」的 index.html，
// 供 scripts/gen-lua.mjs 包装进 脚本/ui/h5_page.lua，再由 h5_bridge 写到设备 /sdcard 用 file:// 加载。
export default defineConfig({
  base: './',
  plugins: [vue(), viteSingleFile()],
  build: {
    target: 'chrome94',          // 实测设备 WebView = Chrome 94
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100000000, // 一切资源内联
    minify: 'esbuild',
    reportCompressedSize: false
  }
})
