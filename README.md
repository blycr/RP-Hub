# Roleplay Hub

[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)
[![Vue](https://img.shields.io/badge/Vue-3-4FC08D.svg?logo=vue.js)](https://vuejs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![DaisyUI](https://img.shields.io/badge/DaisyUI-5A0EF8?logo=daisyui&logoColor=white)](https://daisyui.com/)

> **一款纯前端运行的本地角色扮演（Roleplay）对话和角色卡生成工具。**

> **这是基于 [`STA1N156/RP-Hub`](https://github.com/STA1N156/RP-Hub) 的定制站点正式仓库，采用独立的干净 Git 历史。** `rp.blycr.xyz` 已由本仓库发布。本站直接修改页面、模型状态和 API 请求代码，实现多供应商、自由选模、兼容协议推理服务，以及原生同步和可选请求网关。维护边界见[维护说明](MAINTENANCE.md)。

正式地址：[https://rp.blycr.xyz/](https://rp.blycr.xyz/)。原生同步已通过隔离浏览器与真实 GitHub 临时分支测试；现有用户数据与真实模型流式调用仍需验收。已安装的用户脚本继续保留原有同步与跨域请求能力，暂时不要卸载。

**【免责与授权声明】**  
本项目基于 **[CC BY-NC 4.0（知识共享-署名-非商业性使用 4.0 国际许可协议）](./LICENSE)** 开源。**明确禁止任何形式的商业化使用（包括但不限于：作为收费服务提供、打包在付费产品中售卖、在产品内植入广告盈利等）。** 任何使用者必须遵守该协议，尊重原作者的署名权。对于违反协议的商业行为，保留追究法律责任的权利。

---

## 核心特性 (Features)

Roleplay Hub 致力于提供流畅、私密且功能强大的本地化AI Roleplay体验。

- 角色卡、世界书、正则脚本和多用户资料管理
- 总结记忆与向量记忆，可按角色和剧情分支独立保存
- 剧情分支创建、切换、回档、重命名和完整导入导出
- UI 模板变量分析与对话状态展示
- 自动生图、单张重新生成和多套内置画师风格
- 角色卡生成、万相广场与“墨韵 · 造梦”在线工具

## 本定制版相对上游的改动

以下功能已经写入**本仓库的网站代码**，并由 `rp.blycr.xyz` 提供。

| 功能 | 本仓库中的主要文件 |
| --- | --- |
| 不限数量的 API 供应商，按“供应商 + 模型 ID”保存聊天、UI 模板、总结记忆、向量记忆和识图模型绑定 | `assets/js/app.js`、`index.html`、`assets/js/ui-components.js` |
| Chat Completions、Responses 与 Embeddings 路由；在上游 1.9 的原生工具调用中保留工具 ID 和续接结果 | `assets/js/api-utils.js`、`assets/js/app.js`、`assets/js/rphub-api-adapters.js` |
| 角色卡工坊与小说页使用选定供应商，并通过受限的父子页面消息桥接配置 | `character/index.html`、`novel/index.html`、`assets/js/app.js` |
| 支持广场官方的一键导入消息桥接；可接收来源标识并保存 `plazaId`，供角色卡生命周期管理使用；关闭不需要的远程版本提醒入口 | `assets/js/app.js`、`index.html` |
| 网站图标、原生同步预览与可选模型请求网关 | `favicon.svg`、`assets/js/rphub-sync-*.js`、`gateway/` |

`RP-Hub-Card` 是另一个局域网资源服务仓库，不在本网站的构建链内。同步用户脚本也不包含在本仓库；更新网站不会自动更新浏览器里已安装的脚本。完整文件差异与发布边界见[维护说明](MAINTENANCE.md)。

### 架构迁移进度

正式站已有可选的 Cloudflare Worker 模型请求服务（`gateway/`）和设置页接线：只转发所选供应商的模型请求，共享网关口令仅存于当前标签页会话。Worker 仍在独立预览地址。浏览器原生同步已有独立设置面板、GitHub API、加解密、分片与本地备份模块；隔离浏览器与真实 GitHub 临时分支测试已通过，现有用户数据、实际设备和真实模型流式调用仍待验收。**原有用户脚本仍可使用；迁移现有数据前不要卸载或删除远端快照。**发布边界以[维护说明](MAINTENANCE.md)为准；独立请求服务只允许明确配置的供应商目标。

## 快速开始 (Quick Start)

本项目无需复杂的 Node.js 环境或依赖安装，即开即用！

### 1. 下载与运行
1. 点击项目主页绿色的 `Code` 按钮，选择 `Download ZIP`。
2. 将下载的 ZIP 压缩包解压到您的本地任意文件夹中。
3. 双击打开 `index.html` 文件，可使用本地角色管理等功能；需要原生 GitHub 同步或模型网关时，请使用可信的 HTTPS 站点地址。

*(注：本地文件的 `null` Origin 不能用于需要精确 CORS 许可的 GitHub 同步或模型网关；本地服务器也不会自动获得生产服务的跨域许可。)*

### 2. 初始化设置
1. 打开应用后，点击侧边栏（或顶部菜单）的**设置 (Settings)** 选项。
2. 在 API 供应商设置中添加所需节点，分别配置 `API URL`、`API Key` 与支持的协议；可添加多个供应商。
3. 为聊天、UI 模板、记忆或识图用途选择供应商与模型，也可手动输入模型 ID；支持推理的模型可设置推理强度。
4. 在**角色管理**界面，导入您的角色卡文件（或点击新建角色并手动填写设定）。
5. 回到对话界面，开始属于您的 Roleplay 旅程

---

## 目录结构 (Directory Structure)

```text
Roleplay-Hub/
├── index.html                     # 主界面与脚本加载入口
├── character/                     # 角色卡生成工具
│   └── index.html
├── novel/                         # 墨韵 · 造梦
│   └── index.html
├── assets/
│   ├── css/
│   │   └── styles.css             # 全局样式
│   └── js/
│       ├── built-in-content.js    # 默认预设、模式提示词、画师串与更新公告
│       ├── core-utils.js          # 通用工具、角色卡处理与基础配置
│       ├── api-utils.js           # 上游原生请求客户端，扩展了 Responses 与工具调用路由
│       ├── data-services.js       # 存储、记忆、上下文、分支与 UI 状态
│       ├── runtime-services.js    # API 请求、消息渲染与运行状态
│       ├── update-check.js        # 上游更新检查客户端；本定制版未配置其远程入口
│       ├── ui-components.js       # 选择器、侧边栏、弹窗与页面组件
│       ├── rphub-api-adapters.js  # 本定制版的协议适配器
│       ├── rphub-sync-github.js   # 原生同步 GitHub 客户端（预览）
│       ├── rphub-sync-crypto.js   # 旧快照兼容的加解密组件（预览）
│       ├── rphub-sync-snapshot.js # 加密分片准备与校验（预览）
│       ├── rphub-sync-native.js   # 原生同步设置面板、本地备份与恢复（预览）
│       └── app.js                 # 主业务入口、供应商注册表与模型状态
├── gateway/                      # Cloudflare Worker 请求服务（独立预览已部署）
├── tests/                        # 迁移组件的契约测试
├── MAINTENANCE.md                # 本定制版代码与发布流程
└── README.md                      # 项目说明
```

### 代码组织说明

页面会按照上方顺序加载 JavaScript 文件，请不要随意调整依赖顺序。

- 修改默认预设、各模式提示词、生图画师串或工具说明时，统一编辑 `built-in-content.js`。
- 更新公告固定放在 `built-in-content.js` 最底部，方便查找和替换。
- 可复用界面统一放在 `ui-components.js`，业务数据处理放在 `data-services.js`。
- 项目没有构建步骤，修改后刷新浏览器即可验证。

---

## 协议与许可 (License)

本项目严格遵守以下开源协议：

**[Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/deed.zh-hans)**

* **您可以**：自由地共享（在任何媒介以任何形式复制、发行本作品）与演绎（修改、转换或以本作品为基础进行创作）。
* **您必须**：
  * **署名 (Attribution)**：给出适当的署名，提供指向本许可协议的链接，同时标明是否对原始作品作了修改。
  * **非商业性使用 (NonCommercial)**：**您不得将本作品或演绎作品用于任何商业目的。** 禁止任何形式的售卖、付费订阅集成或利用本项目进行广告牟利。
* 若要获取本项目的商业授权，请直接联系项目原作者。

详细许可条款请参见根目录下的 [`LICENSE`](./LICENSE) 文件。
