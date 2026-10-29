# RP-Hub 定制站点维护说明

本仓库是基于 [`STA1N156/RP-Hub`](https://github.com/STA1N156/RP-Hub) 的**独立历史正式产品仓库**，不属于上游 fork 网络。`https://rp.blycr.xyz/` 由本仓库的 GitHub Pages 发布。`assets/js/app.js`、`assets/js/api-utils.js` 等是本站实际运行的产品代码。过渡期的补丁源、用户脚本和协调测试位于私有 [`blycr/RP-Hub-Sync`](https://github.com/blycr/RP-Hub-Sync)。

GitHub Pages 已绑定正式域名。2026-10-28 的隔离 Chromium 验证首页正常挂载；页面不再显示或加载早期原生同步、模型请求网关入口，用户脚本仍是加密跨设备同步的实际职责方。现有用户数据、实际设备和真实模型流式调用仍需验收；在完成迁移前保留已安装脚本与远端快照。正式域名经 Cloudflare 代理（SSL Strict、Always Use HTTPS）提供 HTTPS 与 HTTP 跳转；GitHub Pages 自身 `https_enforced` 仍为 `false`，启用时报证书不存在。后续复查 GitHub 证书，不为勾选开关贸然改变可用的域名路由。

## 四个仓库的边界

| 仓库 | 职责 |
| --- | --- |
| `RP-Hub`（公开） | 唯一正式网站代码；`main` 经 GitHub Pages 发布 `rp.blycr.xyz`，包含供应商与选模、原生工具调用及自动 Gemini 输入混淆 |
| `RP-Hub-Legacy`（私有、已归档） | 已脱离 fork 网络的旧站只读历史；Pages 与上游同步工作流均已关闭，不参与发布 |
| `RP-Hub-Sync`（私有） | 过渡期用户脚本、加密同步数据、补丁规范源与测试、旧 workflow 备份及主要迁移文档 |
| `RP-Hub-Card`（私有） | 独立的局域网角色卡 API 与旧 Git 历史 bundle；不参与网站构建 |

本定制站点增加不限数量的 API 供应商，可选择兼容协议的推理服务并按供应商绑定聊天、UI 模板、记忆和识图模型。它支持 Chat Completions、Responses 与 Embeddings 路由；上游 1.9 的原生工具调用保留在 `assets/js/api-utils.js` 中。`RP-Hub-Card` 不参与站点构建或上游代码合并；2026-09-24 的白屏修复也未改动其 LAN API 契约。

## 相对上游的实际文件改动

当前已适配上游公告版本 **2.0.5**，基线为上游提交 `cd8f2a6d599230e8788a1888a478912c6e83d7fe`（2026-10-21）。本轮审查区间为 `0c1c044b0f64ad2bb48a226f9f790a31d7c0dc91..cd8f2a6`；后续更新从 `cd8f2a6` 比较。上游继续更新时应审查增量并维护此表：

| 文件 | 本仓库的改动 |
| --- | --- |
| `assets/js/app.js` | 增加供应商注册表、模型和记忆供应商绑定、请求路由、广场 `plazaId` 注入及安全的嵌入页消息桥接；保留上游的模型状态与工具调用入口 |
| `assets/js/api-utils.js` | 在上游原生请求客户端中增加 Responses 请求和流解析，续接原生工具调用 ID，并加入可选的受控网关路由 |
| `assets/js/rphub-api-adapters.js` | 新增 Chat Completions、Responses、Embeddings 协议适配器 |
| `index.html`、`assets/js/ui-components.js` | 增加动态供应商设置、按供应商选模、手动输入模型 ID、密钥复制/显示与空间管理；移除早期网关和原生同步设置入口；关闭不使用的远程版本提醒入口 |
| `assets/js/rphub-sync-*.js` | 原生同步的过渡维护源码；主页面不加载，跨设备同步继续由已安装用户脚本负责 |
| `gateway/` | 独立、可选的受控 Cloudflare Worker 模型请求服务源码；主页面不加载，不自动转发请求 |
| `character/index.html`、`novel/index.html` | 将工坊和小说页的请求接入选定供应商及受限的父子页面配置桥接 |
| `assets/js/built-in-content.js`、`core-utils.js`、`data-services.js`、`runtime-services.js`、`assets/css/`、`tailwind.config.cjs`、`assets/vendor/` | 跟随上游 2.0.5 的公告、记忆引用、渲染、用量统计及主题；关键依赖按锁定版本构建到本地，Tailwind CSS 随后生成 |
| `CNAME`、`favicon.svg`、`.gitignore` | 正式域名、定制图标与本地文件忽略规则 |
| `README.md`、`MAINTENANCE.md` | 直接在本仓库说明定制功能和维护边界 |

`RP-Hub-Sync` 的协调器在过渡期可用于本地审查上游变更，但本仓库没有自动上游合并工作流。审查和验证后的产品代码须显式提交到本仓库；旧 fork 的手动上游同步工作流已停用。当前补丁源与测试见私有 [Sync 文档](https://github.com/blycr/RP-Hub-Sync/blob/main/README.md)。

广场官方的一键导入通过受限的 iframe 消息桥接传送角色卡文件。`app.js` 必须同时校验消息来源窗口、origin、请求 ID 和文件大小；可选的 `plazaId` 来源标识只在名称一致且近期收到时关联。不能让来源标识缺失或失配中断正常导入。

## 上游更新与部署

### 同步、请求服务与隐私边界

跨设备同步的实际入口是用户安装的 `rphub-sync.user.js`；同步内容使用项目既有的加密快照格式。`RP-Hub` 不再加载原生同步脚本，也不再显示同步表单，避免同一凭据同时进入用户脚本页面存储和网页存储。`assets/js/rphub-sync-*.js` 仅为过渡维护源码，不能据此认为主页面拥有另一套活动同步功能。

`gateway/` 是独立的 Cloudflare Worker 源码，主页面不再读取或写入网关口令，也不通过设置页自动路由。可直接跨域的供应商继续由浏览器直连；不能跨域的请求沿用用户脚本的受控处理。若未来重新启用独立服务，必须重新完成认证、来源校验、限流、日志脱敏和真实流式验收，并先更新本文件。

上游 2.0.4 的明文云备份明确不采用：16 位备份密钥是取件码，不是客户端加密密钥，管理员能够读取角色卡和聊天。正式站也不启用上游云备份前端或写入暂停恢复逻辑。上游公告中的云备份条目已在本仓库公告副本中删除。角色卡与聊天保存在用户本地；远端同步仅由加密用户脚本处理。GitHub Token 与同步口令只在用户脚本界面输入，不进入站点设置或远端快照。

本地运行 `node --test gateway/worker.test.mjs tests/*.test.js`；私有 Sync 运行 `node --test scripts/tests/*.test.js`。真实部署仍需用浏览器 origin、供应商凭据和长时间流式响应完成端到端验证。

- 本仓库不含上游自动合并工作流。先在本地审查上游变更并运行测试，再单独推送产品代码。
- GitHub Pages 在 `main` 推送后构建正式站点；`CNAME` 属于本仓库，旧 fork 的 `main` 已移除该文件。
- 用户脚本的安装版本不会因本站 Pages 部署而自动更换。

运行补丁与测试、核对部署和处理合并冲突的具体命令见私有 [Sync 维护文档](https://github.com/blycr/RP-Hub-Sync/blob/main/README.md#上游合并与维护)。旧站历史已在私有 `RP-Hub-Legacy` 归档；本仓库仅从审查过的当前文件开始新的 Git 历史。

## 2026-10-10 上游 2.0.0 适配

从正式产品提交 `8e37d1e` 在 `codex/upstream-2.0.0-20261010` 审查分支迁移上游 `a8466dc..ed37201` 的五个提交，使用文件级三方比较保留定制扩展，未合入其他仓库的 Git 历史。新版共享 Tailwind 配置、界面、记忆编号与引用、上下文分类、用量统计、工坊和小说界面均采用上游实现。移除上游已经停用的全局字体配置，沿用其旧数据迁移。

聊天输入区域保留上游快捷面板，新增的直接选模入口也位于该面板内。模型筛选结合上游聊天模型规则与本站供应商的向量能力；排序复制数组，保留同名模型的供应商标识。供应商表、Responses 原生工具调用、工坊每个模型槽位的供应商、原生同步和网关均保留。远程版本检查继续关闭，独立 Card 服务不参与这次站点升级。

验证结果：24 项产品与网关测试、72 项私有协调与用户脚本测试通过；脚本语法与差异检查通过。隔离 Chromium 使用虚构供应商与角色，验证首页挂载、同名模型选择、手动 `bge-m3`、手动槽位供应商绑定、Chat Completions/Responses 模拟 SSE、记忆引用弹窗、上下文查看器、手机快捷面板、旧设置重新加载后的供应商/槽位保留与字体迁移、工坊供应商绑定、小说页挂载，以及用户脚本 2.9.16 的共存与配置面板，未出现页面运行错误。未使用真实用户快照或供应商 Key；真实供应商流式调用和多设备数据迁移仍需用户验收。

发布到 `main` 后由 GitHub Pages 构建。若上线验证出现问题，从升级前提交 `8e37d1e` 恢复本次涉及的产品文件、提交为新的回滚提交并重新发布；使用正常提交保留回滚记录，不重写历史。域名、网关部署和旧站归档状态不参与此次升级。后续上游更新从 `ed37201` 开始比较增量，并优先运行 `node --test gateway/worker.test.mjs tests/*.test.js` 和私有 Sync 的协调测试。

## 2026-10-14 上游 2.0.2 适配

从上次产品提交 `9b3d875` 审查上游 `ed37201..4fee1a9` 的 10 个提交。上游这批改动集中在性能和界面：样式过滤结果缓存、生成前让渡一次 UI、头像大图改用 Blob URL、记忆引用只在确有可引用记忆且超过保留楼层时加入、保留楼层上限提高到 50、工坊输入区思考面板、小说书评团、广场主题握手，以及工坊差异预览和移动端布局。上述功能均保留。

定制协调器新增对上游广场主题握手形态的识别：不覆盖 `RPHUB_THEME` / `RPH_FORUM_THEME_REQUEST`，只替换工作坊和小说页的旧通配符消息目标，继续发送按供应商绑定的模型配置。`plazaId` 补丁在协调器完成后重新注入，并验证消息来源、origin、卡片 ID 和近期匹配。

验证结果：25 项产品与网关测试、73 项私有协调与用户脚本测试通过；上游当前文件在临时干净目录中完成协调器事务和二次幂等检查；JS 语法检查通过。隔离 Chromium 验证双供应商同名模型、手动槽位绑定、Chat Completions/Responses 模拟流、记忆引用、上下文查看器、手机快捷面板、旧设置迁移、工坊绑定、小说页挂载和用户脚本共存；正式站上一版本的 HTTPS、官方导入和来源校验仍保持正常。

产品提交 `7e6db36ef268bcfd3222596889eb00af57dcb974` 已推送至 `main`，GitHub Pages 构建 [38534197635](https://github.com/blycr/RP-Hub/actions/runs/38534197635) 于 2026-10-14 08:19:40 UTC 成功，Pages API 状态为 `built`。正式域名隔离浏览器核验 HTTP 200，远程公告包含 2.0.2，新共享 Tailwind 和原生同步脚本均已加载；页面无运行错误。上一版本正式站的模拟官方导入和来源校验已通过，本轮产品代码保留该协议。

本轮不更新用户脚本 2.9.16、不改动 Card 或 Legacy。真实供应商 SSE、真实用户数据和多设备验收仍需后续单独进行。

## 2026-10-15 上游 2.0.3 适配

从产品提交 `ab1dda6` 审查上游 `4fee1a9..0c1c044` 的 4 个提交。上游本轮新增 Gemini 输入混淆：快捷面板仅在 Gemini 模型下显示开关，把最新一条用户输入作为成对的 `read_user_input` 工具调用与工具结果传递；其余历史、图片说明和附加要求仍按原上下文发送。产品保留该功能，并在共享 `api-utils.js` 中保留上游的消息构造器，同时不改变本站的多供应商、Responses 和原生工具调用路由。

协调器已兼容上游 2.0.3 将 `buildUserInputToolMessages` 与 `buildApiEndpoint` 一起导出的新解构形式；在干净上游目录中完成一次事务重放与二次幂等检查，广场主题握手和 `plazaId` 安全补丁均保留。产品新增输入混淆、API 工具消息和公告兼容测试。

验证结果：26 项产品与网关测试、74 项私有协调与用户脚本测试通过；产品 JavaScript 语法检查、干净上游事务重放与二次幂等、隔离 Chromium 回归均通过。产品提交 `7063f7c` 已推送至 `main`，GitHub Pages 构建 [38692500022](https://github.com/blycr/RP-Hub/actions/runs/38692500022) 于 2026-10-15 06:28:05 UTC 成功；正式域名隔离浏览器核验 HTTP 200、Vue 挂载、原生同步、网关设置、快捷模型面板、官方导入和来源校验均通过，页面无运行错误。用户脚本仍为 2.9.16，Card 与 Legacy 不需要改动；真实供应商 SSE、真实用户数据和多设备验收仍需单独进行。

## 2026-10-28 OpenCode Go 兼容

为 OpenCode Go 增加稳定的 `x-opencode-session` 与自有 User-Agent。会话 ID 从当前角色和剧情分支的稳定标识派生为不可读的 `ses_rphub_...`；主聊天、总结、UI 模板、识图、模型列表、嵌入、角色工坊和小说页共用同一请求头策略。仅对 `https://opencode.ai/inference/go` 生效，不向其他 OpenAI 兼容供应商添加额外头。

OpenCode Go 的路径按官方文档区分：模型列表为 `/inference/go/v1/models`，Chat Completions 为 `/inference/go/openai/v1/chat/completions`，Responses 为 `/inference/go/openai/v1/responses`。用户脚本 2.9.17 的 GM 代理保留页面提供的会话头，旧页面缺少时为 OpenCode Go 补兼容值。

验证使用一次最小真实 Chat Completions 和一次最小真实 Responses 请求，均由 OpenCode Go 返回 HTTP 200；无效测试 Key 在带会话头时返回 401，不带返回原先的 400。测试 Key 未写入仓库，临时响应已删除。回归测试明确覆盖 Chat Completions、Responses、模型列表和第三方 origin 不添头。

## 2026-10-29 移动端加载与恢复优化

正式站此前在移动端慢网下会同步等待 Tailwind Play CDN、Vue、marked、DOMPurify 和 Sortable；首页随后用 `document.write` 串行下载本地脚本，遮罩又在固定 1.5 秒后消失，因此 CDN 失败或 CPU 受限时会出现长时间白屏。现改为：

- 用 `package-lock.json` 固定 Vue 3.5.44、marked 18.1.2、DOMPurify 3.4.17、SortableJS 1.15.7、localForage 1.10.0、DaisyUI 4.7.2 和 Tailwind 3.4.17。
- `npm run build:static` 将关键运行库复制到 `assets/vendor/`，并生成约 180 KB 的已裁剪 `tailwind.css`；三个页面只加载本地资源。
- 首页二次加载顺序改为按顺序执行的 `defer` 脚本，不再使用 `document.write` 或每次请求变化的本地 `Date.now()` 缓存参数。
- `assets/js/boot.js` 在 Vue 挂载完成前保持可见启动状态；脚本失败或超时后显示明确的失败信息、重新加载与清理网站缓存按钮，不再无限白屏。
- 额度、模型列表和 API 状态检查延后到首次界面完成之后，通过 `requestIdleCallback`（带 2.5 秒兜底）运行；本地工坊和小说 iframe 改用稳定 URL。

复现命令：

```bash
npm ci
npm run build:static
npm run check:static
npm test
RPHUB_CHROMIUM_PATH=/path/to/chrome npm run test:mobile
```

`npm test` 本轮 31/31 通过；本地移动端冒烟在 390×844、300 ms 延迟、1.1 Mbps 下确认首页、工坊与小说页均挂载，均无关键 CDN 请求或页面错误。兼容性要求是 Node.js 22；已提交构建产物，因此 GitHub Pages 不需要执行第二次构建。每次上游更新都必须重新运行以上门禁，避免覆盖本地资源和启动修复。

2026-10-29 的 `Static product checks` 和 Pages 构建均成功。正式域名返回 HTTP 200，本地构建资源与启动脚本均可访问；隔离 Chromium 再次确认 Vue 挂载、无页面错误、无关键 CDN 脚本，约 3.1 秒完成应用挂载。


## 2026-10-28 上游 2.0.5 适配

从已适配的 `0c1c044` 审查上游 `49c94e4..cd8f2a6`，范围包含 2.0.4 和 2.0.5。采用 Gemini 自动输入混淆：先完成世界书、增强记忆和附加要求注入，再将整条最新用户消息搬入成对的 `read_user_input` 工具交换；共享请求客户端的 `onBeforeRequest` 在每次实际请求前生成新的零宽前缀，自动重试也会更新。迁移世界书和增强记忆元数据到工具结果，修正上下文查看器不因召回附加内容改变原消息角色，并采用密钥复制/显示、长请求时长显示、渲染分支防回溯修正和上游 2.0.5 公告条目。

未接入上游明文云备份及其恢复暂停写逻辑，保留正式站空间管理。未恢复已废弃的页面网关、原生同步设置卡片或这四个同步脚本的公开加载。协调器改为只兼容共享模型列表路由，遇到废弃设置状态会失败关闭，不再重新生成它们。

验证结果：产品与 Worker 测试 27/27 通过，Sync 协调器测试 72/72 通过；JavaScript 语法和 `git diff --check` 通过。隔离 Chromium 使用虚构供应商与角色，验证首页 Vue 挂载、设置页无两张废弃卡片、空间管理仍在、API 与生图密钥控件、官方升级公告、Gemini 工具交换、世界书进入工具结果、自动重试更换零宽前缀及上下文查看器标记。未使用真实用户快照或真实供应商 Key。

本轮不修改用户脚本 2.9.16、Card 或 Legacy。真实供应商 SSE、现有用户数据和多设备验收仍需单独进行。产品提交 `762b1f3`、`10feec1` 已推送，GitHub Pages 构建 [40636766763](https://github.com/blycr/RP-Hub/actions/runs/40636766763) 与 [40637098445](https://github.com/blycr/RP-Hub/actions/runs/40637098445) 均成功；正式域名隔离 Chromium 验证 HTTP 200、Vue 挂载、2.0.5 公告、设置页精简、密钥控件、未公开加载同步脚本及非扩展请求无 4xx，均通过。
