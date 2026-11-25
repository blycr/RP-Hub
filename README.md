# Roleplay Hub

**简体中文** | [English](./README.en.md)

[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)
[![Vue](https://img.shields.io/badge/Vue-3-4FC08D.svg?logo=vue.js)](https://vuejs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![DaisyUI](https://img.shields.io/badge/DaisyUI-5A0EF8?logo=daisyui&logoColor=white)](https://daisyui.com/)

基于 [`STA1N156/RP-Hub`](https://github.com/STA1N156/RP-Hub)（当前基线：上游 `2.0.6` / `9124647`）的纯前端定制站点，数据保存在浏览器本地 IndexedDB，在线地址：[https://rp.blycr.xyz/](https://rp.blycr.xyz/)。

> 变更记录见 [CHANGELOG.md](./CHANGELOG.md)。

## 核心特性

### 站点能力
- **本地优先**：角色卡、世界书、正则脚本、多用户资料与聊天记录均存于本地浏览器。
- **多模态与记忆系统**：聊天主模型直读图片；支持基础总结记忆、增强向量召回（相似度 ≥ 48%、最多 10 条）、二次压缩、后台补录及正文记忆引用溯源。
- **剧情分支与 UI 模板**：支持分支创建、切换、回档、完整导入导出，以及可交互状态面板（清空聊天或切换分支时自动挂载初始模板面板）。
- **工具调用与兼容模式**：支持关键词检索、Tavily 联网搜索、随机生成、Gemini 抗截断（`output_reply`）及自动 Gemini 输入混淆（`read_user_input`，自动跳过图片数组消息）。
- **内置创作工具**：角色卡工坊（`/character/`）、小说创作页“墨韵 · 造梦”（`/novel/`）与万相广场一键导入。

### 相对上游的定制扩展
- **无限自定义供应商与协议路由**：按「供应商 ID + 模型 ID」独立绑定主聊天、UI 模板、记忆总结与向量模型，支持 `Chat Completions`、`Responses` 和 `OpenAI Embeddings`；支持 OpenCode Go 会话隔离（`x-opencode-session`）。
- **全本地静态交付**：Vue、marked、DOMPurify、SortableJS、localForage 与预编译 Tailwind CSS 均锁定并提交至 `assets/vendor/`，消除移动端公共 CDN 波动白屏；配备 `assets/js/boot.js` 启动看门狗与本地缓存恢复入口。
- **隐私与精简**：未接入上游明文云备份，禁用远程在线人数/更新检查心跳（保留上游惰性文件以降低同步冲突）。

## 快速开始

### 线上使用

直接打开 [https://rp.blycr.xyz/](https://rp.blycr.xyz/)：

1. 打开「设置」→「API 提供商」，配置供应商的 `API URL`、`API Key` 与协议（填基础地址或 `/v1`，勿附带 `/chat/completions`）。
2. 为主聊天、UI 模板、总结记忆、向量记忆分别绑定供应商与模型（支持搜索或手动输入模型 ID）。
3. 在「角色管理」导入 PNG / JSON 角色卡或使用角色卡工坊创建角色，返回对话页即可开始。

> 说明：浏览器直连模型接口要求目标 API 允许当前域名 CORS 跨域。

### 本地运行与构建

环境要求：**Node.js >= 22**。

```bash
# 1. 安装锁定依赖
npm ci

# 2. 构建静态资源并执行静态检查与单元测试
npm run verify

# 3. 启动任意本地静态服务器预览（不支持 file:// 直接打开）
npx serve .
# 或：python3 -m http.server 8080
```

### 移动端慢网冒烟测试（可选）

使用 Playwright Chromium 在 `390×844`、慢网与 4× CPU 限速下验证首页、工坊与小说页挂载：

```bash
npx playwright-core install chromium
RPHUB_CHROMIUM_PATH=$(find ~/.cache/ms-playwright -path '*/chrome-linux*/chrome' -type f -print -quit) npm run test:mobile
```

## 目录结构

```text
RP-Hub/
├── index.html                        # 主对话页面入口
├── character/index.html              # 角色卡工坊
├── novel/index.html                  # 墨韵 · 造梦（小说工具）
├── favicon.svg                       # 站点图标
├── CNAME                             # GitHub Pages 自定义域名（rp.blycr.xyz）
├── assets/
│   ├── vendor/                       # 构建锁定并提交的前端依赖与编译后 tailwind.css
│   ├── css/
│   │   ├── styles.css                # 主页面样式
│   │   ├── tailwind-source.css       # Tailwind 构建输入
│   │   └── theme.css                 # 三页共享主题变量与暗色模式
│   └── js/
│       ├── boot.js                   # 启动看门狗与缓存恢复
│       ├── tailwind-theme.js         # 主题配置辅助
│       ├── theme.js                  # 主题持久化与内嵌页同步
│       ├── built-in-content.js       # 默认预设、提示词、画师串与更新公告
│       ├── core-utils.js             # 通用工具与角色卡解析
│       ├── api-utils.js              # 原生请求客户端、工具调用与 Responses/OpenCode 路由
│       ├── rphub-api-adapters.js     # Chat Completions / Responses / Embeddings 协议适配器
│       ├── data-services.js          # 存储、记忆、上下文、分支与 UI 模板状态
│       ├── runtime-services.js       # 消息渲染、用量统计与空间管理
│       ├── presence.js               # 上游惰性文件（已禁用）
│       ├── update-check.js           # 上游惰性文件（已禁用）
│       ├── ui-components.js          # 选择器、侧边栏与弹窗组件
│       └── app.js                    # 主应用入口、供应商注册表与业务状态
├── scripts/
│   ├── build-static.mjs              # 生成 assets/vendor/ 与编译 Tailwind CSS
│   └── check-static.mjs              # 校验无外部关键 CDN / document.write / 不稳定缓存参数
├── tests/                            # 契约、兼容性、UI 模板、性能预算与移动端测试
├── gateway/                          # 独立可选的受控 Cloudflare Worker 源码（主站不加载）
├── presence-server/                  # 上游可选更新检查服务（主站默认关闭，不参与构建）
├── tailwind.config.cjs
├── package.json
├── CHANGELOG.md
├── LICENSE                           # CC BY-NC 4.0
├── README.en.md
└── README.md
```

> 页面按 `index.html` 中声明顺序加载 `assets/js/*.js`，请勿随意调整脚本顺序。修改依赖、页面类名或样式后运行 `npm run verify` 并提交生成的 `assets/vendor/` 与 `package-lock.json`。

## 可选独立组件

- **`gateway/`**：独立的受控模型请求 Cloudflare Worker 源码，主页面默认不加载也不自动路由，详见 [`gateway/README.md`](./gateway/README.md)。
- **`presence-server/`**：上游自带的可选版本检查服务（不存储聊天或密钥），详见 [`presence-server/README.md`](./presence-server/README.md)。

## 许可协议

本项目继承并严格遵守上游开源协议 **[Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)](./LICENSE)**：

- **允许**：以任何媒介或形式共享、复制、修改与基于本项目演绎创作。
- **必须遵守**：
  - **署名（Attribution）**：保留原作者署名与本协议链接，并说明修改之处。
  - **非商业性使用（NonCommercial）**：**严禁任何形式的商业化使用**（包括付费服务、商业打包售卖或广告盈利）。
- 如需商业授权，请直接联系上游原作者。
