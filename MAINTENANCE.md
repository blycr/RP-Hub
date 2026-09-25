# RP-Hub 定制站点维护说明

本仓库是基于 [`STA1N156/RP-Hub`](https://github.com/STA1N156/RP-Hub) 的**独立历史产品预览仓库**，不属于上游 fork 网络。当前 `https://rp.blycr.xyz/` 仍由旧 `blycr/RP-Hub` 仓库发布；本仓库尚未绑定正式域名。`assets/js/app.js`、`assets/js/api-utils.js` 等是本站的实际产品代码。过渡期的补丁源、用户脚本和协调测试位于私有 [`blycr/RP-Hub-Sync`](https://github.com/blycr/RP-Hub-Sync)。

## 三个仓库的边界

| 仓库 | 职责 |
| --- | --- |
| `RP-Hub-Next` | 干净历史的定制站点预览；完成验收后接替旧 `RP-Hub` 名称与域名 |
| 旧 `RP-Hub` | 当前线上站点的历史 fork；迁移完成前继续运行 |
| `RP-Hub-Sync` | 用户脚本、动态供应商与协议路由补丁、测试、workflow 备份及主要文档 |
| `RP-Hub-Card` | 独立的局域网角色卡资源服务，只通过 `/api/status`、`/api/manifest`、`/api/image/*` 与用户脚本通信 |

本定制站点增加不限数量的 API 供应商，可选择兼容协议的推理服务并按供应商绑定聊天、UI 模板、记忆和识图模型。它支持 Chat Completions、Responses 与 Embeddings 路由；上游 1.9 的原生工具调用保留在 `assets/js/api-utils.js` 中。`RP-Hub-Card` 不参与站点构建或上游代码合并；2026-09-24 的白屏修复也未改动其 LAN API 契约。

## 相对上游的实际文件改动

以下以 2026-09-24 的上游提交 `a8466dc` 为基线列出；上游继续更新时，应重新核对差异并维护此表：

| 文件 | 本仓库的改动 |
| --- | --- |
| `assets/js/app.js` | 增加供应商注册表、模型和记忆供应商绑定、请求路由、广场 `plazaId` 注入及安全的嵌入页消息桥接；保留上游的模型状态与工具调用入口 |
| `assets/js/api-utils.js` | 在上游原生请求客户端中增加 Responses 请求和流解析，续接原生工具调用 ID，并加入可选的受控网关路由 |
| `assets/js/rphub-api-adapters.js` | 新增 Chat Completions、Responses、Embeddings 协议适配器 |
| `index.html`、`assets/js/ui-components.js` | 增加动态供应商设置、按供应商选模与手动输入模型 ID 的界面，并关闭不使用的远程版本提醒入口；设置页另含网关与原生同步入口 |
| `assets/js/rphub-sync-*.js` | 浏览器直连 GitHub 的加密同步、旧快照兼容、本地完整备份与恢复；旧线上仓库尚未启用 |
| `gateway/` | 受控 Cloudflare Worker 模型请求服务，独立预览已部署，尚未通过真实供应商流式调用验收 |
| `character/index.html`、`novel/index.html` | 将工坊和小说页的请求接入选定供应商及受限的父子页面配置桥接 |
| `assets/js/built-in-content.js` | 仅清理公告标题末尾空格，无功能变更 |
| `favicon.svg`、`.gitignore` | 定制图标与本地文件忽略规则；预览不绑定正式域名 |
| `README.md`、`MAINTENANCE.md` | 直接在本仓库说明定制功能和维护边界 |

`RP-Hub-Sync` 的协调器在过渡期可用于本地审查上游变更，但本预览仓库没有自动上游合并工作流。审查和验证后的产品代码须显式提交到本仓库；当前补丁源与测试见私有 [Sync 文档](https://github.com/blycr/RP-Hub-Sync/blob/main/README.md)。

广场官方的一键导入通过受限的 iframe 消息桥接传送角色卡文件。`app.js` 必须同时校验消息来源窗口、origin、请求 ID 和文件大小；可选的 `plazaId` 来源标识只在名称一致且近期收到时关联。不能让来源标识缺失或失配中断正常导入。

## 上游更新与部署

### 请求服务与原生同步迁移（本站预览）

`gateway/` 保存已部署到独立 Cloudflare 预览地址的受控模型请求服务；本站设置页已有可选网关接线。`assets/js/rphub-sync-github.js`、`rphub-sync-crypto.js`、`rphub-sync-snapshot.js` 和 `rphub-sync-native.js` 组成原生同步预览面板，包含旧单文件快照兼容、加密分片、完整校验、本地备份和失败回滚。GitHub Token 与同步口令只在当前页面输入，不进入站点设置或远端快照。正式切换前仍需在浏览器里验证真实 SSE、IndexedDB 与工坊写入、跨设备恢复和大数据量；旧线上仓库仍使用现有同步脚本。

GitHub 私有仓库的带鉴权读取已用 `https://rp.blycr.xyz` Origin 验证返回允许跨域响应；写入和恢复仍需完整端到端验证。新客户端把写入限制在 `rp-hub-sync/`，使用非强制的单次提交更新。加解密测试使用旧脚本生成的公开示例密文，不含真实同步数据；分片测试使用虚构角色卡和 API Key。请求网关采用 Cloudflare Worker，只接受明确批准的 HTTPS 供应商目标，不作为任意 URL 代理；部署方法和鉴权边界见 [`gateway/README.md`](gateway/README.md)。本地契约测试可运行 `node --test gateway/worker.test.mjs tests/*.test.js`。

- 本仓库不含上游自动合并工作流。先在本地审查上游变更并运行测试，再单独推送产品代码。
- GitHub Pages 在 `main` 推送后构建预览站点。正式域名仍归旧站使用；预览仓库不应添加旧站的 `CNAME`。
- 用户脚本的安装版本不会因本站 Pages 部署而自动更换。

运行补丁与测试、核对部署和处理合并冲突的具体命令见私有 [Sync 维护文档](https://github.com/blycr/RP-Hub-Sync/blob/main/README.md#上游合并与维护)。旧公开 fork 的历史另行私有归档；本仓库仅从审查过的当前文件开始新的 Git 历史。
