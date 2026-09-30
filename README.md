# SaoifAutoUI — SAOIF 自动助手 H5 界面

懒人精灵（lrjl）脚本项目的 H5 配置界面：**Vue 3 + Vite + vite-plugin-singlefile**。
构建产物是一个全内联、无网络依赖的单文件 HTML，被自动包装成 Lua 模块写入脚本项目的 `脚本/ui/h5_page.lua`，
再由 `ui/h5_bridge.lua` 写到设备 `/sdcard/saoif_h5_page.html` 用 WebView（file://）加载。

> 实测设备 WebView = **Chrome 94**（Android 10），Vue 3.5 / ES2015+ / Proxy 全部可用。

## 目录

```
ui-src → 本仓库
├── src/
│   ├── main.js              createApp + reactive(store) + 报文分发（hint/error/pong）
│   ├── App.vue              功能 / 设置 两分区、DEV 角标、hint 提示、dev 提交预览、APP.autoTest
│   ├── bridge.js            通道封装：Base64(JSON) 协议 + 协议消息发送器
│   ├── data/source.js       数据源抽象：真机=桥 / dev=目录 JSON（localStorage 存值）
│   ├── components/FieldRenderer.vue   schema 驱动表单渲染器（int/number/enum/bool/text）
│   ├── styles.css
│   └── generated/catalog.json        由 sync 生成（git 提交，便于直接 dev）
├── scripts/
│   ├── sync-tasks.mjs       用 fengari 执行 Lua 表字面量 → catalog.json
│   ├── lua_json.lua         Lua → JSON 编码器（在 fengari 内运行）
│   └── gen-lua.mjs          dist/index.html → <saoifAuto>/脚本/ui/h5_page.lua
├── vite.config.mjs          chrome94 / 单文件全内联 / luaCatalogWatch 插件
└── package.json
```

## 命令

```bash
npm install            # 首次（国内建议 --registry=https://registry.npmmirror.com，3 秒装完）
npm run dev            # 同步目录 + 启动 dev server（浏览器打开即可调界面）
npm run build          # 同步目录 + 打包 + 生成 脚本/ui/h5_page.lua
npm run sync           # 只同步目录（生成 src/generated/catalog.json）
```

- **`npm run dev` 不需要设备**：数据来自 `sync` 出来的目录 JSON，界面显示 `DEV(本地数据)` 角标；
  改参数存 localStorage，点「保存并运行」会弹出「将要提交的 JSON」预览（不会真跑）
- **改 Lua 侧变量自动刷新**：`luaCatalogWatch` 插件监听 `<saoifAuto>/脚本/{tasks,config}`，
  改动 → 自动 `sync` → 页面 full-reload（加字段、改标签立即在浏览器里看到）
- 路径用环境变量覆盖：`SAOIF_SCRIPT_DIR`（Lua 脚本目录，默认 `D:/project/saoifAuto/脚本`）、
  `H5_LUA_OUT`（生成的 Lua 模块路径，默认 `<SAOIF_SCRIPT_DIR>/ui/h5_page.lua`）

## 数据来源

| | 真机 | dev |
|---|---|---|
| 任务/配置目录 | Lua `init` 报文下发 | `catalog.json`（sync 生成） |
| 参数初值 | `/sdcard/saoif_h5_config.json` ← 各任务 `defaults` | localStorage ← `defaults` |
| 参数校验 | Lua 侧 `validate` + `hint/error` 回传 | 前端按 schema 的 min/max/step 近似校验 |
| 提交 | `submit` 报文 → 入口分发任务 | 弹出提交预览 |

## 通道协议（与 `脚本/ui/h5_bridge.lua` 一致）

```
JS  → Lua : window.bridge.callLua("__h5_onMessage('<base64(JSON)>')")
Lua → JS : ui.callJs(WEB, "javascript:APP.recv('<base64(JSON)>')")

JS→Lua  { ready | ack | change | submit | cancel | ping | jserror }
Lua→JS  { init | hint | error | pong }
init 结构: { type:"init", data:{ ver, sid, tasks, configs, values } }
其它:      { type:"hint", data:{ level:"ok|warn|err", text } } / { type:"error", data:{ text } }
```

页面必须实现：`APP.recv(b64)` / `APP.probe(tag,sid)`（**回 ping，不能回 ready**，否则与 Lua 的 init 重发形成死循环）/ `APP.autoTest()`（连通自检：改一个参数 → 提交）。

## WebView 区域与横竖屏适配（实测）

宿主窗口由 `ui/h5_bridge.lua` 全屏创建（`newLayout(-1,-1)`），引擎会在用户布局外再包一层
标题栏 + ScrollView。**WebView 宽度是 `-1` 填满，高度必须传显式像素值**——高度传 `-1` 会被
ScrollView 包裹层塌缩成自适应内容（曾实测塌缩到 370px）。

实测基准设备：云手机 720×1280，density 2.0（WebView = Chrome 94）：

| 方向 | WebView 控件（物理 px） | H5 CSS 视口（÷2） | 页面锚点 |
|---|---|---|---|
| 竖屏 | **657 × 1150**，位于 [31, 87] | **329 × 575** | 顶部贴标题栏，底部留 43px |
| 横屏 | **1217 × 590**，位于 [31, 87] | **608 × 295** | 同上 |

换算公式（其他分辨率设备通用，`getDisplaySize()` 返回的是**未旋转**的原始分辨率，
横屏需按 `getDisplayRotate()` 为奇数交换宽高）：

```
WebView 高度 = 当前方向屏幕高 − 130      （高度上限 −118，留 12px 安全余量）
WebView 宽度 = 当前方向屏宽 − 55（填满）

130 = 顶部 28（窗口边距）+ 55（引擎标题栏）+ 4（内容框上边距）
    + 底部 27（窗口边距）+ 4（内容框下边距）+ 12（安全余量）
```

H5 侧适配约定：

1. 视口 meta 为 `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no`，
   CSS 宽度自动等于 WebView 宽 ÷ density；**`100vh` = WebView 高度**（竖屏 575 / 横屏 295 CSS px）。
2. 根容器 `.wrap` 为 `height:100vh` 的 flex 列，`.panel` 区 `flex:1 + overflow:auto` 内部滚动——
   **横屏时 .panel 仅约 160 CSS px 高，面板内滚动体验是横屏适配重点**。
3. 竖屏 CSS 宽仅 329，表单元素不要写固定像素宽度（label + input 行按窄版弹性布局）。
4. **窗口开着旋转屏幕时 WebView 会销毁重建**（Lua 端检测方向变化后重建窗口）：页面重新加载、
   重新走 ready → init 流程并重放 `values`。H5 侧不要依赖跨旋转的内存状态，状态一律以 init 下发为准。
5. **禁用依赖原生弹层的控件**：悬浮窗没有 Activity window token，WebView 的原生 `<select>`
   下拉弹不出来（实测只拿到焦点框、不出现列表），`alert/confirm/prompt`、原生日期选择等同理。
   enum 字段已在 `FieldRenderer.vue` 用自绘下拉实现（`Teleport` 到 body + `fixed` 定位，
   空间不足向上翻转、点外部或滚动收起）；新增字段类型时同样要自绘，不要引入原生弹层控件。
6. **字段提示文字（`tip`）布局**：放在控件下方独占一行（`.field` 开 `flex-wrap`，
   `.tip` 缩进 116px 对齐控件起始位置），不要和控件挤同一行——竖屏 CSS 宽 329 放不下。
7. **构建部署自查**：`npm run build` 由 gen-lua 直写 `脚本/ui/h5_page.lua`，但 IDE 可能仍持有
   编辑器缓冲里的旧版并用它编译（lua 文件是新的、跑的却是旧页面）。运行后核对设备日志
   `[H5] 页面已写入 …（N 字节）` 是否等于 `dist/index.html` 的大小，不一致就再运行一次
   （IDE 重新加载文件后即生效）。改 Lua 侧项目文件同理，优先走 IDE 通道保存。

## 依赖的 Lua 侧约定

- `脚本/tasks/<id>/vars.lua`：纯数据表（`id/name/desc/order/defaults/schema`），sync 直接执行它
- `脚本/tasks/<id>/main.lua`：逻辑（`readConfig/run`），name/desc/schema/defaults 从 vars 取
- `脚本/config/<name>.lua`：同结构 + 可选 `apply(v)`（启动时灌回对应模块）
- **vars/config 里不要写函数或 require**（fengari 求值会失败，sync 会明确报错）
- 配置值是扁平存储，跨任务避免同名字段

详细约定见脚本仓库 `saoifAuto` 的 README「脚本目录约定」一节。
