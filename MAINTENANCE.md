# RP-Hub 定制站点维护说明

本仓库是基于 [`STA1N156/RP-Hub`](https://github.com/STA1N156/RP-Hub) 的**独立历史正式产品仓库**，不属于上游 fork 网络。`https://rp.blycr.xyz/` 由本仓库的 GitHub Pages 发布。`assets/js/app.js`、`assets/js/api-utils.js` 等是本站实际运行的产品代码。过渡期的补丁源、用户脚本和协调测试位于私有 [`blycr/RP-Hub-Sync`](https://github.com/blycr/RP-Hub-Sync)。

GitHub Pages 已绑定正式域名；2026-09-25 的隔离 Chrome 验证首页正常挂载，网关和原生同步设置面板均出现。旧用户脚本在隔离环境注入后，网页仍可挂载。现有用户数据、实际设备和模型真实流式调用仍需验收；在完成迁移前保留已安装脚本与远端快照。正式域名经 Cloudflare 代理（SSL Strict、Always Use HTTPS）提供 HTTPS 与 HTTP 跳转；GitHub Pages 自身 `https_enforced` 仍为 `false`，启用时报证书不存在。后续复查 GitHub 证书，不为勾选开关贸然改变可用的域名路由。

## 四个仓库的边界

| 仓库 | 职责 |
| --- | --- |
| `RP-Hub`（公开） | 唯一正式网站代码；`main` 经 GitHub Pages 发布 `rp.blycr.xyz`，包含供应商与选模、原生工具调用、同步预览和可选网关客户端 |
| `RP-Hub-Legacy`（私有、已归档） | 已脱离 fork 网络的旧站只读历史；Pages 与上游同步工作流均已关闭，不参与发布 |
| `RP-Hub-Sync`（私有） | 过渡期用户脚本、加密同步数据、补丁规范源与测试、旧 workflow 备份及主要迁移文档 |
| `RP-Hub-Card`（私有） | 独立的局域网角色卡 API 与旧 Git 历史 bundle；不参与网站构建 |

本定制站点增加不限数量的 API 供应商，可选择兼容协议的推理服务并按供应商绑定聊天、UI 模板、记忆和识图模型。它支持 Chat Completions、Responses 与 Embeddings 路由；上游 1.9 的原生工具调用保留在 `assets/js/api-utils.js` 中。`RP-Hub-Card` 不参与站点构建或上游代码合并；2026-09-24 的白屏修复也未改动其 LAN API 契约。

## 相对上游的实际文件改动

以下以 2026-09-24 的上游提交 `a8466dc` 为基线列出；上游继续更新时，应重新核对差异并维护此表：

| 文件 | 本仓库的改动 |
| --- | --- |
| `assets/js/app.js` | 增加供应商注册表、模型和记忆供应商绑定、请求路由、广场 `plazaId` 注入及安全的嵌入页消息桥接；保留上游的模型状态与工具调用入口 |
| `assets/js/api-utils.js` | 在上游原生请求客户端中增加 Responses 请求和流解析，续接原生工具调用 ID，并加入可选的受控网关路由 |
| `assets/js/rphub-api-adapters.js` | 新增 Chat Completions、Responses、Embeddings 协议适配器 |
| `index.html`、`assets/js/ui-components.js` | 增加动态供应商设置、按供应商选模与手动输入模型 ID 的界面，并关闭不使用的远程版本提醒入口；设置页另含网关与原生同步入口 |
| `assets/js/rphub-sync-*.js` | 浏览器直连 GitHub 的加密同步、旧快照兼容、本地完整备份与恢复；现有用户数据迁移前继续保留旧脚本 |
| `gateway/` | 受控 Cloudflare Worker 模型请求服务，独立预览已部署，尚未通过真实供应商流式调用验收 |
| `character/index.html`、`novel/index.html` | 将工坊和小说页的请求接入选定供应商及受限的父子页面配置桥接 |
| `assets/js/built-in-content.js` | 仅清理公告标题末尾空格，无功能变更 |
| `CNAME`、`favicon.svg`、`.gitignore` | 正式域名、定制图标与本地文件忽略规则 |
| `README.md`、`MAINTENANCE.md` | 直接在本仓库说明定制功能和维护边界 |

`RP-Hub-Sync` 的协调器在过渡期可用于本地审查上游变更，但本仓库没有自动上游合并工作流。审查和验证后的产品代码须显式提交到本仓库；旧 fork 的手动上游同步工作流已停用。当前补丁源与测试见私有 [Sync 文档](https://github.com/blycr/RP-Hub-Sync/blob/main/README.md)。

广场官方的一键导入通过受限的 iframe 消息桥接传送角色卡文件。`app.js` 必须同时校验消息来源窗口、origin、请求 ID 和文件大小；可选的 `plazaId` 来源标识只在名称一致且近期收到时关联。不能让来源标识缺失或失配中断正常导入。

## 上游更新与部署

### 请求服务与原生同步迁移

`gateway/` 保存已部署到独立 Cloudflare 预览地址的受控模型请求服务；本站设置页已有可选网关接线。`assets/js/rphub-sync-github.js`、`rphub-sync-crypto.js`、`rphub-sync-snapshot.js` 和 `rphub-sync-native.js` 组成原生同步预览面板，包含旧单文件快照兼容、加密分片、完整校验、本地备份和失败回滚。GitHub Token 与同步口令只在当前页面输入，不进入站点设置或远端快照。隔离浏览器中的 IndexedDB、角色工坊、恢复备份及真实 GitHub 临时分支推拉已通过；真实模型 SSE、现有用户数据、实际设备和大数据量仍待验收。保留现有同步脚本直到真实用户数据迁移完成。

GitHub 私有仓库的带鉴权读取和写入跨域预检已通过；隔离浏览器通过私有仓库一次性分支完成真实加密推送和拉取，测试分支已删除。现有用户快照的恢复仍需端到端验证。新客户端把写入限制在 `rp-hub-sync/`，使用非强制的单次提交更新。加解密测试使用旧脚本生成的公开示例密文，不含真实同步数据；分片测试使用虚构角色卡和 API Key。请求网关采用 Cloudflare Worker，只接受明确批准的 HTTPS 供应商目标，不作为任意 URL 代理；部署方法和鉴权边界见 [`gateway/README.md`](gateway/README.md)。本地契约测试可运行 `node --test gateway/worker.test.mjs tests/*.test.js`。

- 本仓库不含上游自动合并工作流。先在本地审查上游变更并运行测试，再单独推送产品代码。
- GitHub Pages 在 `main` 推送后构建正式站点；`CNAME` 属于本仓库，旧 fork 的 `main` 已移除该文件。
- 用户脚本的安装版本不会因本站 Pages 部署而自动更换。

运行补丁与测试、核对部署和处理合并冲突的具体命令见私有 [Sync 维护文档](https://github.com/blycr/RP-Hub-Sync/blob/main/README.md#上游合并与维护)。旧站历史已在私有 `RP-Hub-Legacy` 归档；本仓库仅从审查过的当前文件开始新的 Git 历史。
