# Changelog

本文件记录 `blycr/RP-Hub` 自独立干净历史建立以来的**全部历史版本**与**未来所有版本**的 Release Note（上游基线：[`STA1N156/RP-Hub`](https://github.com/STA1N156/RP-Hub)）。

> **发布规范（未来所有版本必须遵守）**：每条 Release Note 统一使用「破坏性变更（如有，置顶并附迁移步骤）→ 概述（Overview）→ 新增（Added）→ 改进（Improved）→ 修复（Fixed）」五段式结构；无内容的分类直接省略，不留空标题。

---

## [2.0.6-custom.9] - 2026-11-28

### 概述（Overview）
修复角色卡生成页面（工坊 `character/index.html`）无法同步显示和切换主界面已配置模型（含 3 个主模型槽位与直选当前主模型）的问题，并补齐生图模型与自定义画师串同步。

### 修复（Fixed）
- 修复主站 `syncSettingsToGenerator` 发送 `SYNC_SETTINGS` 时遗漏 `qualityModel`、`balancedModel`、`fastModel`、`imageModel` 与 `customImageArtists` 字段的问题。
- 修复工坊页仅从顶层字段读取下拉模型名称且未支持 `current` 当前主模型的问题：现优先从 `presets.{quality,balanced,fast}` 与 `currentModel` 同步所有已配置模型及供应商名称，顶部栏直接显示当前激活模型，下拉列表支持在直选主模型与 3 个预设槽位间自由切换。

---

## [2.0.6-custom.8] - 2026-11-28

### 概述（Overview）
修复角色卡生成页面（工坊 `character/index.html`）在 IndexedDB 存有空角色列表或异常索引时触发渲染崩溃导致完全白屏的问题，并加固工坊启动脚本顺序与防异步改写标记。

### 修复（Fixed）
- 修复角色卡工坊加载 `ai_chargen_characters` 为空数组（`"[]"`，例如跨设备云同步恢复空工坊后）或异常/越界索引时，将 `characters.value` 置空导致 `currentCharacter.value` 为 `undefined` 并抛出 `Cannot read properties of undefined (reading 'avatar')` 引起整页白屏的问题；现强制保底至少一张可编辑空白角色卡并对 `currentCharacter` / `worldInfo` / `regexScripts` / 头像 watcher 做防御性兜底。
- 修复工坊 `setupSyncListener()` 在 `options` 与 `api` 声明之前调用的初始化顺序隐患，避免父页面快速下发 `SYNC_SETTINGS` 时触发 TDZ 异常。
- 为工坊主内联 `<script>` 补全 `data-cfasync="false"`，防止边缘代理异步改写脚本顺序导致页面卡在 `v-cloak` 空白态。

---

## [2.0.6-custom.7] - 2026-11-27

### 概述（Overview）
面向长对话 Prompt Cache（KV 缓存）命中率与请求防空转做三项核心收口，并新增默认关闭的通用「严格格式守卫」可选预设：实现 UI 模板静态协议与动态变量快照分离、100%→85% 硬红线滞回批裁剪与单调锚点，以及 24 小时多协议探测冷却与协议复用。

### 新增（Added）
- 新增默认关闭的通用内置预设「严格格式守卫」（`strictFormatGuard`）：用于指令遵循偏弱的模型按需开启，明确隔离 XML 系统元数据与用户实际发言，并在长对话中维持角色卡人称与结构格式。
- 上下文预算面板新增「重测」快捷按钮：已探测过的模型默认 24 小时内复用缓存结论，需要跳过冷却全量刷新时可显式触发强制重测。

### 改进（Improved）
- **UI 模板动静分离保护前缀 KV 缓存**：主模型分析模式与独立分析模式的实时变量快照统一改为通过尾部 `<ui_template_state_context>` 只读块注入最新用户消息末尾（无用户消息分支自动安全回退顶部），顶部 `messages[0]` 仅保留跨轮不变的静态协议、schema 与基于初始变量的示例，消除每轮变量变动导致的整条前缀缓存 0% 命中问题。
- **硬红线滞回批裁剪与会话内单调锚点**：`enforceHardCapOnMessages` 升级为超过 `100%` 安全上限时一次性回落至 `85%` 水位并记录本分支单调截断锚点，预留约 `15%` 增长缓冲期以维持前缀冻结与高缓存命中；历史回档或切换更大上限模型时自动重置锚点。
- **多协议探测防空转与会话隔离**：探测请求不再携带当前对话分支 `sessionId`；24 小时内对 `passive_usage` 0 请求短路、对已命中计数协议仅直连复测该端点，并按供应商协议与模型特征优先排序，网关白名单模式下自动跳过不支持的子路径。

---

## [2.0.6-custom.6] - 2026-11-27

### 概述（Overview）
落地长对话保精度与保格式治理（第二期 2B）：新增近端角色卡格式守卫锚点、双阈值原文控窗与安全红线保护裁剪、结构化双轨记忆总结提示词，以及免计费多协议上限与 Token 计数探测。

### 新增（Added）
- 新增近端格式守卫锚点（`buildProximalFormatAnchor`）：长对话（≥ 8 轮或超出质量甜点线）时在 `<next_response>` 内自动注入紧凑的 `<format_anchor>`，守护角色卡专属正则格式、输出标记与 `<ui_template_updates>` 结构，防止长距离注意力衰减导致丢格式。
- 新增双阈值近期原文窗口（`computeEffectiveSummaryKeepFloors`）与安全红线保护（`enforceHardCapOnMessages`）：甜点区内不提前压缩，超甜点线时优先平滑切换为已有记忆摘要（至少保底 6 楼近期原文），逼近安全红线时省略最早中段历史并插入省略提示，避免 `400 context_length_exceeded` 卡死。
- 新增按需免计费多协议探测（`probeModelContextAndTokenizer` 与上下文面板内「探测上限/协议」按钮）：依次探测 `GET /models/{id}` 元数据与 `Responses /input_tokens`、`Anthropic /messages/count_tokens`、`Gemini :countTokens`，命中即刻完成精准校准并缓存协议模式，未命中则无感回退真实对话 `usage` 自动校准。
- 新增 `tests/phase2b-context-resilience.test.js` 行为回归测试。

### 改进（Improved）
- 升级经典单轮总结与 5 合 1 二次合并提示词为「`【硬事实】` + `【剧情】`」结构化双轨格式，合并时严格保留地点/衣着/物品归属、明确承诺与未解伏笔，避免无脑散文压缩损失创作精度。

---

## [2.0.6-custom.5] - 2026-11-27

### 概述（Overview）
新增面向现代大上下文模型（`128k / 256k / 500k / 1M / 2M`）的 API 实测自校准 Token 估算器、按模型独立的双水位线（质量甜点线与安全红线）配置，以及输入框顶部的实时绿/黄/红水位条与 5 层 Token 占比可视化面板。

### 新增（Added）
- 新增 API 实测自校准 Token 估算机制（`estimateTextBaseTokens`、`estimateMessagesBaseTokens`、`updateTokenCalibration`）：按中英文/JSON 权重估算并在每次真实聊天响应返回 `inputTokens` 后按 `(供应商 + 模型)` 维度通过滑动平均自动校准，无需引入笨重本地分词器。
- 新增按 `(providerId, modelId)` 独立的上下文硬上限与质量甜点线解析（三级来源：用户手动设置 ＞ `/v1/models` 接口元数据 ＞ 现代模型家族默认表，支持 `DeepSeek V4` 1M / 300k 甜点区等现代大模型）。
- 聊天输入区顶部新增可点击的实时上下文水位胶囊（绿/黄/红三态）与展开式监控配置面板：实时展示「设定与预设 / 世界书 / UI 模板变量 / 记忆摘要 / 近期原文」5 层占比，支持一键切换当前模型上限（`128k / 256k / 500k / 1M / 2M`）、甜点比例（`20% / 30% / 40% / 50%`）或自定义输入（如 `1M`、`300k`、`30w`）。
- 新增 `tests/context-budget.test.js` 行为回归测试。

### 改进（Improved）
- 删除自定义供应商时同步清理该供应商关联的 `modelContextBudgets` 与 `modelTokenCalibrations`，避免残留孤立配置键。

---

## [2.0.6-custom.4] - 2026-11-27

### 概述（Overview）
强化多轮会话下的 UI 模板变量更新韧性并消除历史变量块上下文膨胀：支持 JSON 容错修复与字段级部分采纳、失败保底面板渲染、不重发正文的自动/一键原地变量补算，以及历史 `<ui_template_updates>` 滑动裁剪与防纠错污染。

### 新增（Added）
- 新增 `repairUiTemplateJson` 与 `normalizeUiTemplateUpdateListLenient`，支持容错修复尾逗号、注释、夹杂闲聊文本、字符串内原始换行及末尾截断 JSON，支持安全标量转型与字段级部分采纳（不再因单个异常字段作废整块变量更新）。
- 聊天气泡与操作栏新增「仅补算变量 / 仅重新分析变量（不重发正文）」入口；主模型分析失败时自动触发 1 次轻量原地变量补算（按 `uiTemplateModel -> fastModel -> 主模型` 自动回退），正文保持原样不动。
- 新增 `tests/ui-template-resilience.test.js`，覆盖 JSON 容错修复、部分采纳、失败保底面板、防纠错污染及 Layer 0 历史变量块裁剪回归。

### 改进（Improved）
- 上下文组装（Layer 0 零损去噪）：主模型变量模式下仅保留最近 1 条合法助手消息的 `<ui_template_updates>` 作为格式示范，剥离更早轮次与所有失败残块，减少 Token 占用并避免旧变量 JSON 与最新状态快照冲突。
- 变量校验失败的纠错提示改为仅对紧邻当前请求的未修复消息单次临时注入，不再永久写入历史用户消息污染后续多轮上下文。

### 修复（Fixed）
- 修复主模型或副模型变量更新失败时直接跳过/排除 `uiTemplateBlocks` 导致会话中 UI 模板面板凭空消失的问题（改为始终沿用当前最新有效变量状态保底渲染面板）。

---

## [2.0.6-custom.3] - 2026-11-27

### 概述（Overview）
彻底修复隐藏态导入后 UI 模板 iframe 在移动端（尤其是 Firefox）塌陷或高度锁死、刷新/开启开关后开场白未补挂模板，以及正文开头 HTML 块与文风过滤导致的偶发性正文掉格式问题。

### 新增（Added）
- 新增 `tests/card-rendering.test.js`，覆盖 Firefox 隐藏态 `getComputedStyle === null` 测高恢复、`srcdoc` 人设名转义、文风过滤 Markdown 标记保护及会话恢复/视图切换生命周期回归。

### 修复（Fixed）
- 修复可执行 HTML / UI 模板 iframe 在 `display: none` 隐藏态下 `getComputedStyle()` 返回 `null` 抛错导致 `isUpdating` 永久锁死、以及 `<head>` 同步执行时 `document.body` 尚未创建导致 `ResizeObserver` 从未绑定的问题；新增隐藏态跳过、异常保护、`DOMContentLoaded` 补绑 `ResizeObserver`/`IntersectionObserver` 与切回 `chat` 视图强制重测高度。
- 修复刷新页面恢复会话（`onMounted`）或后续开启「变量 UI 模板」开关时未对开场白补挂初始 UI 模板面板的问题。
- 修复 `index.html` 直接对已序列化的 `<iframe srcdoc="...">` 执行原始 `{{user}}` 替换在人设名含引号或尖括号时破坏属性的问题（改用 `replaceUserNamePlaceholderInHtml` 进行双层安全转义）。
- 修复 `renderMarkdown` 在消息以 `<div>`/`<style>` 等 HTML 块标签开头且不含代码块围栏时整条跳过 Markdown 解析、导致后续正文段落与 Markdown 格式全部丢失的问题，改为仅对顶层裸文本/行内片段执行 Markdown 解析，同时保持纯 HTML 卡片原样不变。
- 修复 `filterBlockedStyleText` 删除命中句子/词组时吞掉行首 Markdown 块级前缀（`>`、`#`、列表符）或破坏成对加粗/删除线标记（`**`、`__`、`~~`）的问题。

---

## [2.0.6-custom.2] - 2026-11-25

### 概述（Overview）
修复清空聊天与初始开场白状态下 UI 模板面板缺失、主模型模板 ID 轻微拼写错误以及 OpenCode Go 会话与路径兼容问题，并补齐中英文文档与工程规范文件。

### 新增（Added）
- 新增 `CHANGELOG.md` 与 `.editorconfig`，补全 `.gitignore` 通用本地工具忽略规则。
- 新增 `tests/ui-template-reset.test.js`，覆盖清空聊天、切换角色/分支、初始开场白挂载与模板 ID 模糊恢复回归。

### 改进（Improved）
- `normalizeUiTemplateUpdateList` 支持对主模型输出中的轻微模板 ID 截断或拼写偏差进行无歧义恢复（精确匹配、大小写无关匹配、唯一模板名匹配及唯一 8 位 UUID 前/后缀匹配）。
- 重写精简 `README.md` 与 `README.en.md`，修正 `assets/vendor/tailwind.css` 路径并补全目录树，移除已退役模块说明。

### 修复（Fixed）
- 修复清空聊天、切换角色、新建/切换剧情分支或删除消息回到开场白时未自动挂载初始 UI 模板面板的问题（新增 `ensureInitialUiTemplateBlocks`）。
- 修复 `api-utils.js` 中 `withApiResponse` 未透传 `options.sessionId` 导致覆盖 OpenCode Go 会话头的问题，同时兼容 `/zen/go` 与省略 `/v1` 的 `/inference/go` 路径。

---

## [2.0.6-custom.1] - 2026-11-15

### 破坏性变更（Breaking Changes）
- **移除独立识图模型配置**（同步上游 `2.0.6`）：图片改由聊天主模型直接通过 `image_url` 多模态分片读取，旧独立识图模型选择器与识别缩略图入口不再保留。迁移方式：在模型设置中选择支持多模态的聊天主模型即可。
- **移除页面内置原生同步模块**：删除 `assets/js/rphub-sync-{native,snapshot,crypto,github}.js`（此前已停用加载）。跨设备加密同步统一由私有用户脚本负责。

### 概述（Overview）
适配上游 `2.0.6`（`9124647`），统一模型设置界面、迁移已下线的旧默认 API 域名，并将内部流程文档迁出公开仓库，同时补齐行为级回归测试与 CI 移动端验证环境。

### 新增（Added）
- 聊天主模型直接支持多模态图片消息（`image_url` 分片），自动 Gemini 输入混淆（`read_user_input`）自动跳过数组型图片消息。
- 启动时自动将已保存的旧 `cdn.sta1n.cn` 供应商地址一次性迁移至 `sta1n.ai`（保留原有供应商 ID 与密钥映射）。
- 新增 `tests/provider-and-bridges.test.js` 行为回归测试与公开仓库内部文档守卫测试。

### 改进（Improved）
- 模型设置统一收敛为单一列表（聊天主模型、记忆总结、记忆向量、变量分析）；密钥输入框未聚焦时不再预留按钮留白。
- 固定 GitHub Actions `Static product checks` 运行环境为 `ubuntu-24.04`，保证 Playwright Chromium 移动端冒烟测试稳定执行。
- 公开仓库仅保留产品代码与面向用户的产品文档，内部维护与交接文档移出公开树。

### 修复（Fixed）
- 仅对 OpenCode Go 网关目标转发 `x-opencode-session` 请求头，避免向其他供应商泄漏会话头。
- 修复自定义供应商清理边界、小说页父子窗口桥接与模型列表拉取超时处理，修复 `character/index.html` 在 `data-cfasync="false"` 下的脚本注入兼容性。

---

## [2.0.5-custom] - 2026-10-29

### 破坏性变更（Breaking Changes）
- **退役页面原生同步与网关设置卡片**：移除设置页中重复的“模型请求网关（可选）”和“加密跨设备同步（预览）”入口及公开脚本加载；未接入上游 2.0.4+ 的明文云备份。迁移方式：继续使用已安装用户脚本的加密同步与跨域代理，`gateway/` 仍作为独立可选 Worker 源码保留。

### 概述（Overview）
适配上游 `2.0.5`（`cd8f2a6`），将全部关键前端依赖本地静态化以消除移动端 CDN 白屏，新增 OpenCode Go 会话路由，并彻底修复已删除自定义供应商刷新复活问题。

### 新增（Added）
- 新增静态构建与门禁脚本（`scripts/build-static.mjs`、`scripts/check-static.mjs`、`tests/mobile-smoke.mjs`、`tests/performance-budget.test.js`），将 Vue、marked、DOMPurify、SortableJS、localForage 与编译后的 Tailwind CSS 锁定并提交至 `assets/vendor/`。
- 新增 `assets/js/boot.js` 页面启动看门狗：保持加载状态直至 Vue 挂载完成，失败或超时时提供重试与清理本站缓存恢复按钮。
- 新增 OpenCode Go 支持：按当前角色与剧情分支派生稳定 `x-opencode-session`，兼容 Chat Completions 与 Responses。

### 改进（Improved）
- 保留自动 Gemini 输入混淆（每次真实请求重新生成隐藏零宽前缀）、密钥复制与显示控件、长请求用量时长显示与聊天导入卡死修复。
- 显式声明站点 `favicon.svg`。

### 修复（Fixed）
- 彻底修复自定义供应商删除后刷新复活的问题：删除时同步清理列表、Key、协议、缓存模型及所有模型绑定；历史 `custom`/`custom2` 仅在明确被引用时一次性迁移并写入 `providerMigrationVersion: 2`，修复 `pruneDanglingProviderState` 提前访问后声明状态导致的异常。
- 嵌入小说页与工坊页改用精确同源校验的 `RPHUB_API_SETTINGS_UPDATED` 同步最新供应商配置。

---

## [2.0.3-custom] - 2026-10-15

### 概述（Overview）
适配上游 `2.0.3`（`0c1c044`），接入 Gemini 快捷面板输入混淆机制，同时保持多供应商、Responses/Embeddings 与广场桥接完整可用。

### 新增（Added）
- 接入 Gemini `read_user_input` 成对工具调用输入混淆，适配上游 `api-utils.js` 合并导出 `buildApiEndpoint` 与 `buildUserInputToolMessages`。

### 改进（Improved）
- 保持多供应商路由、Chat Completions / Responses / Embeddings 协议与广场主题握手兼容。

---

## [2.0.2-custom] - 2026-10-14

### 概述（Overview）
适配上游 `2.0.2`（`4fee1a9`），引入性能优化、记忆引用修正及工坊/小说页新面板，并保持全部自定义路由与协议扩展。

### 新增（Added）
- 接入样式过滤缓存、大头像 Blob URL、广场主题握手、角色卡工坊思考面板、小说书评团面板、移动端布局优化与差异预览。

### 修复（Fixed）
- 同步上游正文记忆引用条件修正，保留历史与压缩记忆编号一致性。

---

## [2.0.0-custom] - 2026-10-10

### 概述（Overview）
适配上游 `2.0.0` 大版本，在快捷面板中集成直接按「供应商 + 模型 ID」选模能力，保持多协议推理路由与工具调用兼容。

### 新增（Added）
- 聊天快捷面板支持直接选择供应商与模型（兼容同名模型隔离、搜索与手动输入模型 ID）。

### 改进（Improved）
- 排序模型列表前执行浅拷贝避免污染原始状态，保留向量模型供应商能力校验；不恢复已退役的全局字体设置。

---

## [1.9-clean-history] - 2026-09-25

### 破坏性变更（Breaking Changes）
- **独立干净历史建仓与正式域名切流**：`blycr/RP-Hub` 脱离旧 fork 网络，以独立根提交 `3dff0bf` 发布至 `rp.blycr.xyz`（通过 `CNAME` 与 GitHub Pages）；旧 fork 转私有并归档为 `blycr/RP-Hub-Legacy`。迁移方式：后续更新统一拉取本仓库 `main`，不再使用旧 fork 的 Sync fork 或自动上游合并工作流。

### 概述（Overview）
建立干净独立历史的公开定制站点仓库，基于上游 1.9 模块化客户端扩展无限自定义供应商、Responses/Embeddings 协议与官方广场一键导入支持。

### 新增（Added）
- 建立公开静态站点代码库、GitHub Pages 自定义域名 `CNAME`（`rp.blycr.xyz`）及独立可选的受控模型请求 Cloudflare Worker（`gateway/`）。
- 扩展上游 `assets/js/api-utils.js` 与 `assets/js/rphub-api-adapters.js`，支持无限自定义供应商、Chat Completions / Responses / OpenAI Embeddings 与原生工具调用续接。
- 接入受限 `origin`/`source` 校验的广场一键导入与 `plazaId` 来源记录，以及工坊/小说页安全配置桥接。
