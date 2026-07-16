# RP-Hub Sync 跨浏览器测试交接文档

> 用途：交给下一个 AI/协作者，在 Chrome 推送、Firefox 拉取的场景下复现/验证角色卡自动补回问题。
> 测试目标页面：https://blycr.github.io/RP-Hub/
> 脚本版本：2.0.2
> 写入时间：2026-07-16

---

## 1. 当前项目状态

- 仓库：`C:/Users/blycr/Projects/RP-Hub`（fork 自 STA1N156/RP-Hub）
- 最新提交：
  - `4c14302` chore: bump version to 2.0.2
  - `02d685b` fix(sync): rewrite autoFillMissingCards to avoid cross-iframe blob URL and add logs
  - `180f124` fix(sync): githubRequest status=0 fallback to fetch + retry + clearer error
  - `235fe7c` feat(sync): v2.0.0 增量同步、角色卡剥离、自动补回、生命周期检测
- 同步仓库：`https://github.com/blycr/RP-Hub-Sync`
- 同步脚本文件：`rphub-sync.user.js`（已追踪在 RP-Hub 仓库中）

### 测试原则

- **先检测，后配置**：用户已声明两个浏览器的脚本和配置都已完成。执行测试前应先检查配置是否真实存在；只有未配置或配置不一致时才进行配置。
- **不限定问题范围**：本交接文档只记录了当前已发现的问题。下一个 AI 在测试时应保持开放，主动检查控制台所有异常、网络请求、IndexedDB 状态、UI 表现等，不要只盯着文档里列出的 bug。

---

## 2. 测试目标

验证以下完整链路是否正常：

1. **Chrome 端**：用户已有角色卡和聊天记录，点击脚本面板「推送」到 GitHub。
2. **Firefox 端**：配置相同 GitHub Token/Repo/口令，点击「拉取并覆盖本地」。
3. **Firefox 端**：拉取完成后，脚本应自动从局域网/源站补回缺失的角色卡 PNG 图片。
4. **Firefox 端**：刷新页面后，角色卡管理中应显示正常头像，而不是占位符 404。

**重点观察问题**：
- 控制台是否报错 `GET https://blycr.github.io/RP-Hub/__RPHUB_SYNC_AVATAR_PLACEHOLDER__ 404`
- 角色卡管理里角色头像是否空白/404
- 脚本日志中 `[RP-Hub Sync] autoFill ...` 相关日志

---

## 3. 前置条件

- Chrome 已安装 Tampermonkey，脚本 `RP-Hub Sync & Plaza LAN Hijack` v2.0.2 已启用。
- Firefox 已安装 Tampermonkey，脚本 v2.0.2 已启用。
- 两个浏览器的脚本已配置相同的：
  - GitHub Token
  - GitHub Owner（`blycr`）
  - Sync Repo（`RP-Hub-Sync`）
  - 同步口令
  - 局域网 RP-Hub-Card 地址（如 `http://192.168.31.40:8765`，可选但建议配置）
- Chrome 中 `https://blycr.github.io/RP-Hub/` 已登录/有角色卡和聊天记录。
- RP-Hub 的 `assets/js/app.js` 已注入 plazaId 补丁并已部署到 GitHub Pages。
  - 如果补丁未生效，角色卡对象没有 `plazaId` 字段，自动补卡不会触发。

---

## 4. 测试步骤

### 4.1 Chrome 端推送

1. 打开 `https://blycr.github.io/RP-Hub/`。
2. 按 F12 打开控制台，过滤 `[RP-Hub Sync]`。
3. 点击右上角白色同步悬浮按钮。
4. **检测配置是否已填写**：
   - 如果 GitHub Token、Owner、Repo、同步口令均已填写 → 直接关闭面板，跳到第 5 步。
   - 如果有任何一项为空 → 按「前置条件」中的配置项逐项填写，与 Firefox 端保持一致，然后保存。
5. 点击「推送」。
6. 等待提示「✅ 已推送 ... 到 GitHub」。
7. 确认 GitHub 仓库 `blycr/RP-Hub-Sync` 出现以下文件：
   - `rp-hub-sync/state.enc.json`
   - `rp-hub-sync/card-id-map.enc.json`
   - `rp-hub-sync/chats-index.enc.json`
   - `rp-hub-sync/chats/*.enc.json`

### 4.2 Firefox 端拉取

1. 打开 `https://blycr.github.io/RP-Hub/`。
2. 按 F12 打开控制台，过滤 `[RP-Hub Sync]`。
3. 点击右上角白色同步悬浮按钮。
4. **检测配置是否已填写且与 Chrome 端一致**：
   - 如果 GitHub Token、Owner、Repo、同步口令均已填写 → 直接关闭面板，跳到第 5 步。
   - 如果有任何一项为空 → 按 Chrome 端的值逐项填写，保存。
5. 点击「拉取并覆盖本地」，确认弹窗。
6. 观察控制台日志：
   - 应出现 `autoFill candidates: N`
   - 对每个角色卡：`autoFill trying 角色名 plazaId`
   - LAN 命中：`autoFill LAN hit:`
   - 源站命中：`autoFill source hit:`
   - 失败：`Auto-fill failed for ...`
7. 等待页面自动刷新。
8. 刷新后检查角色卡管理中的头像是否显示正常。

---

## 5. 关键调试命令

在 Firefox 控制台执行以下命令，可快速判断同步状态：

### 5.1 检查角色卡是否有 plazaId 和 avatar

```js
JSON.parse(localStorage.getItem('rphub_characters') || '[]').map(c => ({
  name: c.name,
  plazaId: c.plazaId,
  isLocal: c.isLocal,
  avatarPreview: c.avatar ? c.avatar.slice(0, 80) : null
}))
```

预期：
- `plazaId` 应为非空字符串（如 `ed159950-87a1-4314-9f28-e63d63e63b30`）。
- `avatarPreview` 应以 `data:image/png;base64,` 或 `data:image/jpeg;base64,` 开头。
- 如果 `avatarPreview` 是 `__RPHUB_SYNC_AVATAR_PLACEHOLDER__`，说明自动补卡未执行或未成功。

### 5.2 检查 IndexedDB 中是否写入了角色卡 blob

```js
(async () => {
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open('RPHubDB');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const tx = db.transaction('store', 'readonly');
  const store = tx.objectStore('store');
  const keys = await new Promise((resolve, reject) => {
    const req = store.getAllKeys();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  console.log('IndexedDB keys:', keys.filter(k => String(k).includes('card_blob') || String(k).includes('characters')));
})();
```

预期：存在 `rp_hub_card_blob_<plazaId>` 键，且对应值为 Blob 对象。

---

## 6. 已知问题和修复历史

### 6.1 问题 A：拉取时 `githubRequest` status=0

- 现象：拉取失败，控制台报错对象 `{ status: 0, responseText: '' }`。
- 原因：Tampermonkey/扩展拦截或网络问题。
- 修复：v2.0.1（commit `180f124`）中增加了 fetch 兜底、重试机制和更清晰错误提示。
- 状态：已修复。

### 6.2 问题 B：拉取后角色卡没有自动补回，控制台报 placeholder 404

- 现象：`GET https://blycr.github.io/RP-Hub/__RPHUB_SYNC_AVATAR_PLACEHOLDER__ 404`。
- 原因：旧版 `autoFillMissingCards` 复用了广场劫持的 `resolveDownload`，当 LAN 命中时返回的是广场 iframe 内部的 `blob:` URL，RP-Hub 父页面无法跨 iframe 访问。
- 修复：v2.0.2（commit `02d685b`）中重写了 `autoFillMissingCards`，直接在父页面中按 `plazaId` 查询 LAN manifest 并下载，失败再回退源站直链。
- 状态：待验证是否完全修复。

---

## 7. 核心代码位置

### 7.1 自动补卡逻辑

文件：`rphub-sync.user.js`  
函数：`autoFillMissingCards(data)`  
关键行为：
- 遍历 `data['rp_hub_characters']`。
- 筛选 `avatar` 为 placeholder 或 svg 且存在 `plazaId` 的角色。
- 优先从 LAN 下载：`http://<lan>/api/image/<filename>`。
- LAN 失败回退源站：`https://rphforum.zeabur.app/api/cards/<plazaId>/download/file`。
- 下载成功后写入 `rp_hub_card_blob_<plazaId>` 并更新 `char.avatar`。
- 最后把更新后的 characters 写回 IndexedDB。

### 7.2 拉取主流程

文件：`rphub-sync.user.js`  
函数：`pullStateFromGitHub()`  
关键行为：
- 检测新版同步文件 `rp-hub-sync/state.enc.json`。
- 如果存在，调用 `pullSyncV2(cfg)` 下载 state + card-id-map + chats-index + chats。
- 调用 `restoreIndexedDB(data)` 覆盖本地数据。
- 调用 `autoFillMissingCards(data)` 补回缺失角色卡。
- 1.5 秒后刷新页面。

### 7.3 plazaId 注入

文件：`assets/js/app.js`  
位置：
- `setup()` 开头：监听广场 iframe 的 `postMessage`。
- `importCharacter` 中：创建 `char` 对象后注入 `plazaId` / `plazaImportedAt` / `plazaLastKnownUpdatedAt` / `isLocal`。

### 7.4 广场 postMessage

文件：`rphub-sync.user.js`  
位置：
- `hookNetworkRequests()`：缓存广场卡片详情（`name`、`updated_at`）。
- `observeDownloadButtons()`：点击下载按钮时向父页面 `postMessage({ type: 'RPHUB_PLAZA_CARD', cardId, name, updatedAt })`。

---

## 8. 如果问题仍复现

请收集以下信息：

1. Firefox 控制台完整日志（过滤 `[RP-Hub Sync]`）。
2. 上述 5.1 和 5.2 命令的输出。
3. 角色卡对象示例（脱敏后）。
4. LAN 是否可达（在 Firefox 中直接访问 `http://<lan-ip>/api/manifest` 看是否返回 JSON）。
5. 源站直链是否可用（在 Firefox 中直接访问 `https://rphforum.zeabur.app/api/cards/<plazaId>/download/file` 看是否下载 PNG）。

---

## 9. 注意事项

- **不要修改 `RP-Hub-Asset-Reconstruct-Plan.md`**：这是临时方案文档，无需 git 追踪。
- **不要提交 GitHub Token**：任何日志或截图中的 Token 都应打码。
- **测试后可删除本文件**（`RP-Hub-Test-Handover.md`），它不需要被 git 追踪。

---

## 10. 2026-07-16 测试经验、问题与改进建议

### 10.1 本次实际完成的检查

- 线上页面 `https://blycr.github.io/RP-Hub/` 可以正常加载。
- 默认 Chrome DevTools MCP 启动的是独立的 headless Chrome profile，并且带有 `--disable-extensions`；该环境没有 Tampermonkey，不能代表用户的正常 Chrome 测试环境。
- Firefox 已使用正常 profile 启动，并通过 Marionette 接入：
  - Firefox 版本：`152.0.6`。
  - Marionette 地址：`127.0.0.1:2828`。
  - profile：`cwvf9vg2.default-release`。
  - 页面中存在 Tampermonkey 注入的 RP-Hub 同步按钮和同步配置面板。
- Firefox 同步面板中的 Token、Owner、Repo、同步口令、LAN 地址和源站模板字段均已检查为已填写；测试记录中不得输出 Token 或同步口令的值。
- Firefox 的 `RPHubDB` 和 `store` object store 可以读取。
- 当前 Firefox 本地有 3 个角色，但这 3 个角色的 `plazaId` 均为 `null`，头像均为同步占位符；页面产生了 3 个：
  `https://blycr.github.io/RP-Hub/__RPHUB_SYNC_AVATAR_PLACEHOLDER__` 404 请求。
- 由于角色缺少 `plazaId`，按当前 `autoFillMissingCards()` 的筛选条件不能成为自动补卡候选。因此本次尚未证明 v2.0.2 的自动补卡修复已完全生效，也没有执行真实的 Chrome 推送和 Firefox 拉取。

### 10.2 浏览器接入的关键经验

1. **先确认浏览器环境，再开始测试。**
   - Chrome DevTools MCP 默认可能创建独立 profile；必须检查启动参数、扩展状态和 profile 路径。
   - 看到页面能打开，不代表 Tampermonkey 已运行。应先检查同步悬浮按钮、脚本注入日志和扩展状态。
2. **Chrome 与 Firefox 的调试机制不同。**
   - Chrome DevTools MCP 可使用 `--autoConnect` 或 `--browser-url` 连接可调试 Chrome，但 `chrome://inspect/#remote-debugging` 的授权不应直接等同于传统 `--remote-debugging-port` 端口已经可用。
   - Firefox DevTools MCP 使用 WebDriver BiDi/Marionette；在 Windows 上可关闭 Firefox 后用以下参数启动正常 profile：
     ```text
     firefox.exe --marionette -no-remote -profile <profile-path> <url>
     ```
   - Firefox 默认 Marionette 端口为 `2828`。复用正常 profile 前必须先关闭正在使用该 profile 的 Firefox，避免 profile 锁冲突或数据竞争。
3. **MCP 配置变更需要重启 Claude Code。**
   - 使用 `claude mcp add` 新增 MCP 后，当前 Claude Code 进程不会立即出现新工具；需要重启并继续会话后再检查工具列表。
   - 如果已经有可用的浏览器专用 MCP，应优先使用它，不要在未确认 profile 的情况下退回到独立 headless 浏览器。
4. **代理配置要区分浏览器流量和包管理器流量。**
   - 本机网络要求优先使用 `socks5://127.0.0.1:7890`；命令行下载通常可尝试 `socks5h://127.0.0.1:7890`，并设置 `ALL_PROXY`、`HTTP_PROXY`、`HTTPS_PROXY`。
   - Firefox profile 本身已有代理/PAC 配置，浏览器请求是否经过该代理应在 Firefox 网络面板中单独确认。
   - Bun 下载 `chrome-devtools-mcp` 时曾出现：
     `UnsupportedProxyProtocol downloading package manifest chrome-devtools-mcp`。
     这是 Bun 包管理器代理协议处理失败，不是 RP-Hub 的 GitHub 拉取失败。遇到同类问题时应保留错误原文，并尝试使用已缓存包、`npx` 或仅对包下载设置兼容的代理方式；不要反复覆盖 MCP 配置。

### 10.3 本次遇到的操作问题

- 直接在 Git Bash 中嵌入 PowerShell 时，Bash 可能先处理 PowerShell 的 `$变量`，造成 PowerShell 收到变量名缺失的命令。改进：使用单引号包住 PowerShell 脚本，或把复杂脚本写入临时文件后执行。
- Marionette 响应外层结构是 `[type, messageId, error, result]`；解析时不能把 `result` 误当作外层数组。改进：先统一封装协议解析，再调用具体命令。
- 通过 `ExecuteScript` 执行异步 IndexedDB 检查时，Firefox 需要使用 `ExecuteAsyncScript` 并显式调用回调；否则返回 `null` 不能说明脚本执行成功或失败。
- 执行真实推送/拉取前必须先记录本地角色的 `plazaId`、头像状态和 IndexedDB keys；否则拉取覆盖会改变现场，后续难以判断是源数据问题还是自动补卡问题。

### 10.4 后续测试的正确顺序

1. 关闭无扩展的 headless Chrome，或明确标记其仅用于静态页面检查。
2. 用正常 Chrome profile 启动并确认 Tampermonkey v2.0.2 已注入；打开同步面板，只检查配置是否存在，不打印敏感值。
3. 推送前记录 Chrome 的角色对象摘要：`name`、`uuid`、`plazaId`、头像类型；确认至少有一个角色带非空 `plazaId`。
4. 执行 Chrome「推送」，记录 GitHub 返回状态和上传文件路径，但不要记录 Token 或完整授权请求头。
5. Firefox 端先记录覆盖前状态，再执行「拉取并覆盖本地」并确认弹窗。
6. 记录 `[RP-Hub Sync]` 全部日志，重点检查：
   - `autoFill candidates: N`；
   - `autoFill trying ... plazaId`；
   - `autoFill LAN manifest entries`、`autoFill LAN hit`；
   - `autoFill source hit`；
   - `Auto-fill failed` 或源站 404。
7. 刷新后再次检查角色摘要、头像 `naturalWidth`、IndexedDB 中的 `rp_hub_card_blob_<plazaId>` 和占位符 404 请求。
8. 若 `plazaId` 仍为空，应先回到“广场下载/导入角色卡”流程验证 `postMessage` 与 `app.js` 注入补丁，不应直接把自动补卡失败归因于 v2.0.2。

### 10.5 当前结论边界

- 已确认：正常 Firefox profile、Tampermonkey 注入、同步配置存在、RPHubDB 可读，以及当前页面存在占位符 404。
- 未确认：正常 Chrome 推送、Firefox 真实拉取、LAN manifest 命中、源站回退命中、自动写入角色卡 blob，以及刷新后头像恢复。
- 本次没有修改 RP-Hub 源码，没有执行推送/拉取，没有提交 Token，也没有删除浏览器数据。
- 本次新增的 Firefox/Chrome MCP 配置属于本机 Claude 配置，不属于仓库代码；后续测试前应先重启 Claude Code，确认 MCP 工具已加载，并再次检查连接到的 profile。

---

*交接完成。祝测试顺利。*
