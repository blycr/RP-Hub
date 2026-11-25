# Changelog

本文件按标准分类记录 `blycr/RP-Hub` 定制站点的公开版本演进（上游基线为 [`STA1N156/RP-Hub`](https://github.com/STA1N156/RP-Hub)）。

## [2.0.6-custom.2] - 2026-11-23

### 概述（Overview）
修复清空聊天与初始开场白状态下 UI 模板面板丢失、主模型模板 ID 轻微拼写错误以及 OpenCode Go 会话与路径兼容问题，并补齐工程化配置与文档。

### 改进（Improved）
- `normalizeUiTemplateUpdateList` 支持对主模型输出中的轻微模板 ID 截断/拼写偏差进行无歧义恢复（精确匹配、大小写无关匹配、唯一模板名匹配及唯一 8 位 UUID 前/后缀匹配）。
- 重构中英文 `README`，修正 `assets/vendor/tailwind.css` 路径与目录树；新增 `.editorconfig` 与 `CHANGELOG.md`。

### 修复（Fixed）
- 修复点击清空聊天、切换角色、新建/切换剧情分支或删除消息回到开场白时，未自动挂载初始 UI 模板面板的问题（新增 `ensureInitialUiTemplateBlocks` 与回归测试）。
- 修复 `api-utils.js` 中 `withApiResponse` 未透传 `options.sessionId` 导致覆盖 OpenCode Go 会话头的问题，同时兼容 `/zen/go` 与省略 `/v1` 的 `/inference/go` 路径。

## [2.0.6-custom.1] - 2026-11-15

### 概述（Overview）
适配上游 `2.0.6`（`9124647`），取消独立识图模型改为聊天主模型直读图片，清理已退役页面原生同步代码，并补齐行为回归测试与 CI 移动端验证。

### 新增（Added）
- 聊天主模型直接支持多模态图片消息（`image_url` 分片）；自动 Gemini 输入混淆（`read_user_input`）自动跳过含数组图片内容的消息。
- 自动将已保存的旧 `cdn.sta1n.cn` 供应商地址一次性迁移至 `sta1n.ai`。
- 新增 `tests/provider-and-bridges.test.js` 行为测试；固定 GitHub Actions 静态检查环境为 `ubuntu-24.04` 以运行 Playwright 移动端冒烟测试。

### 改进（Improved）
- 模型设置统一收敛为单一列表（聊天主模型、记忆总结、记忆向量、变量分析）；密钥输入框未聚焦时不再预留按钮留白。
- 移除已退役的页面原生同步模块（`assets/js/rphub-sync-*.js`）；公开仓库仅保留产品代码与面向用户的文档。

### 修复（Fixed）
- 仅对 OpenCode Go 目标地址转发 `x-opencode-session` 请求头，避免泄漏至其他网关。
- 修复供应商清理、小说页桥接与模型列表拉取超时边界问题。

## [2.0.5-custom] - 2026-10-29

### 概述（Overview）
适配上游 `2.0.5`（`cd8f2a6`），实现前端依赖完全本地静态化以消除移动端 CDN 白屏，并接入 OpenCode Go 会话与供应商删除持久化修复。

### 新增（Added）
- 引入 `npm run build:static` / `check:static` / `test:mobile`：将 Vue、marked、DOMPurify、SortableJS、localForage 与编译后 Tailwind CSS 锁定并提交至 `assets/vendor/`；新增 `assets/js/boot.js` 启动看门狗（提供重试与清理缓存恢复入口）。
- 新增 OpenCode Go 支持：按角色与剧情分支派生稳定 `x-opencode-session`，支持 Chat Completions 与 Responses。

### 改进（Improved）
- 保留自动 Gemini 输入混淆（每次请求刷新零宽前缀）、密钥复制/显示、用量时长显示与聊天导入性能修复；不接入上游明文云备份。
- 移除重复的页面网关与原生同步预览设置卡片。

### 修复（Fixed）
- 彻底修复自定义供应商删除后刷新复活的问题：同步清理供应商列表、Key、协议、缓存模型及所有模型绑定，历史 `custom`/`custom2` 字段仅迁移一次并记录 `providerMigrationVersion: 2`。
- 显式声明站点 `favicon.svg`。

## [2.0.0 - 2.0.3-custom] - 2026-10-10 ~ 2026-10-15

### 概述（Overview）
连续适配上游 `2.0.0`、`2.0.2`、`2.0.3`，保留多供应商、Responses/Embeddings 路由、安全父子页面桥接与广场导入能力。

### 新增（Added）
- 接入 Gemini `read_user_input` 输入混淆、样式过滤缓存、大头像 Blob URL、广场主题握手、角色工坊思考面板与小说书评团面板。
- 聊天快捷面板支持直接按「供应商 + 模型 ID」选模。

## [1.9-clean-history] - 2026-09-25

### 概述（Overview）
以干净独立 Git 历史建立公开产品仓库 `blycr/RP-Hub`，接管 `rp.blycr.xyz` 正式站发布，保留上游原生工具调用与自定义多供应商路由。

### 新增（Added）
- 建立公开静态站仓库与 `CNAME`（`rp.blycr.xyz`），提供不限数量 API 供应商、Chat Completions / Responses / Embeddings 协议适配器与独立可选的 `gateway/` Cloudflare Worker 源码。
