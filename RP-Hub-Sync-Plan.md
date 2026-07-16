# RP-Hub 多设备同步与万相广场本地化改造方案（v4 · 最终版）

> 目标：在**不修改 RP-Hub 源码、不改动源站**的前提下，实现跨设备状态同步，并**最大限度减少源站流量请求**。  
> 最终决策：
> - **状态同步**：通过 GitHub 私有仓库 + PAT 鉴权，Userscript 手动推送/拉取加密快照。
> - **广场资源**：**局域网本地优先，源站兜底**；不再使用 GitHub 存储图片。
> - **图片格式**：保持原 PNG，不做任何转换。
> - **源站鉴权**：Userscript 绕过源站 UI 层鉴权，直接请求角色卡直链下载。
> - **自动部署**：使用 GitHub Actions 监控上游 `STA1N156/RP-Hub`，有更新时自动同步并部署 GitHub Pages。

---

## 0. 已生成的实施文件

本方案已在本地项目目录生成可直接使用的文件：

| 文件 | 说明 |
|------|------|
| `.github/workflows/sync-upstream.yml` | GitHub Actions 工作流：监控上游 STA1N156/RP-Hub 更新并自动部署 Pages |
| `rphub-sync.user.js` | Tampermonkey/Violentmonkey/Via 注入脚本，包含 GitHub 同步 + 广场 LAN 挟持 |

---

## 1. 为什么用 Userscript + GitHub？

| 方案 | 侵入性 | 后端成本 | 源站改动 | 广场资源 |
|------|--------|----------|----------|----------|
| 改 RP-Hub 源码 + 文件导出导入 | 高 | 无 | 不需要 | 源站 |
| 源站加同步接口 | 中 | 需维护 | **需要** | 源站 |
| **Userscript + GitHub 同步 + LAN 资源（本方案）** | **极低** | **免费** | **不需要** | **LAN + 源站** |

优势：
- **零源码侵入**：RP-Hub、RP-Hub-Card、源站都不改。
- **状态同步免费**：GitHub 私有仓库存放加密快照。
- **广场资源零公网流量**：同 LAN 时完全不访问源站。
- **跨平台**：桌面 Tampermonkey / Violentmonkey；手机 Via / Kiwi Browser。
- **可回退**：关闭脚本即恢复原始体验。

---

## 2. 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│                          设 备 A / 设 备 B                   │
│                                                             │
│   ┌─────────────────┐      ┌─────────────────────────────┐  │
│   │   RP-Hub 页面   │◄────►│      Userscript 中间层       │  │
│   │ (GitHub Pages)  │      │  1. 同步 Hook（GitHub）     │  │
│   │  (IndexedDB)    │      │  2. 广场 Hijack（LAN→源站） │  │
│   └─────────────────┘      └──────────────┬──────────────┘  │
│                                            │                 │
│           ┌────────────────────────────────┼─────┐          │
│           ▼                                ▼     ▼          │
│   ┌───────────────┐              ┌────────────────┐         │
│   │  GitHub 私有   │              │  源站万相广场   │         │
│   │  同步仓库      │              │  (被脚本 Hook) │         │
│   └───────────────┘              └────────────────┘         │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │        局域网 RP-Hub-Card 服务（完整 Pic/）          │   │
│   │        127.0.0.1:8765 或 http://<lan-ip>:8765       │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

说明：
- **RP-Hub 页面**：部署在 `https://<username>.github.io/RP-Hub/index.html`，纯静态。
- **Userscript 中间层**：注入到 RP-Hub 页面与源站广场页面。
- **GitHub 同步仓库**：私有仓库，存放加密的 IndexedDB 快照（`rp-hub-sync/snapshot.enc.json`）。
- **源站万相广场**：脚本在其页面上 Hook 下载/导入行为；仅在局域网无资源时请求。
- **局域网 RP-Hub-Card**：一台设备运行 `python fetch_cards.py --serve`，同 LAN 内所有设备共享完整 Pic/。

---

## 3. GitHub 状态同步方案

### 3.1 数据范围

覆盖 RP-Hub 当前 `saveData()` 保存的全部 IndexedDB 状态：

- `characters`：角色卡列表
- `settings`：API、模型、界面设置
- `presets`：生成预设
- `regex` / `global_regex`：正则脚本
- `worldinfo` / `global_worldinfo`：世界书
- `global_ui_templates`：UI 模板
- `user` / `user_profiles`：用户/人设
- `chat_<uuid>`：各角色聊天记录
- `memories_<uuid>` / `classic_memories_<uuid>`：向量/经典记忆
- `token_usage_history`：Token 用量记录

### 3.2 认证方式

**脚本级 GitHub 认证**，不是网站登录：

1. 用户在 GitHub 生成 **Personal Access Token（PAT）**：
   - 仓库选择 **Fine-grained personal access token**，只给目标私有仓库 `contents:write` 和 `contents:read` 权限。
   - 或 Classic token，勾选 `repo`。
2. 在 Userscript 菜单中填写：
   - `GitHub Token`
   - `Owner / Repo`（例如 `blycr/RP-Hub-Sync`）
   - `Branch`（默认 `main`）
   - `Passphrase`（用于加密数据）
3. 脚本用 `GM_setValue` 安全保存 Token（仅该浏览器本地可访问）。

### 3.3 同步文件格式

仓库中只存一个文件：

```
rp-hub-sync/
  └── snapshot.enc.json
```

内容：

```json
{
  "version": 1,
  "exportedAt": 1712345678901,
  "deviceId": "uuid-of-device-a",
  "encryptedBlob": "base64(AES-GCM(compressed(IndexedDB JSON)))",
  "encoding": "base64+aes-gcm+gzip"
}
```

### 3.4 加密流程

```
1. 用户输入同步 passphrase（与 GitHub Token 分开）
2. PBKDF2(passphrase + 固定 salt) 派生 AES-256-GCM 密钥
3. 读取 IndexedDB 全部 key-value，序列化为 JSON
4. gzip 压缩
5. AES-GCM 加密
6. base64 编码后通过 GitHub Contents API PUT 到仓库
```

### 3.5 拉取/覆盖流程

```
1. 用户在设备 B 打开 RP-Hub 页面
2. 脚本用同样口令派生密钥
3. GET GitHub Contents API 下载 snapshot.enc.json
4. 解密 → gzip 解压 → 得到 IndexedDB JSON
5. 清空当前 IndexedDB
6. 写入拉取到的全部 key-value
7. 刷新页面，RP-Hub 自动 loadData()
```

### 3.6 交互方式

脚本提供 Tampermonkey 菜单命令：

```
[RP-Hub Sync] 推送当前状态到 GitHub
[RP-Hub Sync] 从 GitHub 拉取并覆盖本地
[RP-Hub Sync] 配置同步仓库与口令
[RP-Hub Sync] 查看上次同步时间
```

**手动触发**：用户完成配置/对话后手动点击「推送」；换设备后手动点击「拉取并覆盖」。

这是「弱同步」的最低侵入实现：不自动同步、不冲突合并，简单可靠。

### 3.7 GitHub API 调用示例

```javascript
// 读取
GM_xmlhttpRequest({
    method: 'GET',
    url: `https://api.github.com/repos/${owner}/${repo}/contents/rp-hub-sync/snapshot.enc.json?ref=${branch}`,
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' },
    onload: (res) => { /* decode base64 content */ }
});

// 写入
GM_xmlhttpRequest({
    method: 'PUT',
    url: `https://api.github.com/repos/${owner}/${repo}/contents/rp-hub-sync/snapshot.enc.json`,
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' },
    data: JSON.stringify({
        message: `RP-Hub sync from ${deviceId} @ ${new Date().toISOString()}`,
        content: base64EncryptedBlob,
        sha: existingSha // 更新时需要
    })
});
```

### 3.8 移动端适配

- **Via 浏览器**：支持自定义脚本，`GM_xmlhttpRequest` 可能受限，可降级为 `fetch`（GitHub API 支持 CORS）。
- **Kiwi Browser**：完整 Tampermonkey 支持。
- **Token 输入**：在脚本菜单中通过 `prompt` 或注入的设置面板填写。

---

## 4. 万相广场本地化（LAN 优先 + 源站兜底）

### 4.1 核心策略

不复写 RP-Hub 内的广场页面，而是**在源站万相广场页面注入 Userscript，把下载/导入请求重定向到局域网 RP-Hub-Card 服务**；局域网不可用时直接回退源站。

```
用户点击广场卡片下载/导入
        │
        ▼
┌─────────────────────────────────────┐
│ 1. 探测局域网 RP-Hub-Card 服务       │
│    配置：lanBaseUrl                  │
└──────────────────┬──────────────────┘
                   │
      ├─ 在线且本地有该卡 ──► 返回本地 PNG
      │
      └─ 不在线或无该卡
                   │
                   ▼
┌─────────────────────────────────────┐
│ 2. 回退源站                          │
│    直接请求 rphforum.zeabur.app     │
└─────────────────────────────────────┘
```

### 4.2 局域网 RP-Hub-Card 服务

桌面端启动：

```bash
cd C:\Users\blycr\Projects\RP-Hub-Card
python fetch_cards.py --serve
```

默认监听 `127.0.0.1:8765`。

要让局域网内其他设备访问，启动时绑定所有接口：

```bash
python fetch_cards.py --serve --bind 0.0.0.0
```

或修改 `.env`：

```env
SERVER_HOST=0.0.0.0
SERVER_PORTS=8765
```

其他设备通过 `http://<运行电脑的内网IP>:8765` 访问。

### 4.3 具体 Hook 点

在源站广场页面脚本中：

1. **Hook `fetch` / `XMLHttpRequest`**：拦截卡片详情与下载请求。
2. **Hook 下载按钮点击事件**：捕获用户点击，判断局域网是否存在。
3. **改写图片 `src` 或下载链接**：如果局域网存在，替换 URL 为 `http://<lan-ip>:8765/api/image/<filename>`。
4. **源站直取（绕过 UI 鉴权）**：当 LAN 无资源时，脚本直接构造源站卡片下载 URL 并发起请求。由于卡片文件本身无需鉴权即可下载，这一步可以绕过网站前端的登录/UI 限制。
5. **注入状态标识**：在卡片角落显示小标签（如「LAN」「源站」），让用户知道当前走的是哪个源。
6. **注入「导入到 RP-Hub」按钮**（可选）：点击后通过 `postMessage` 或剪贴板把卡片数据传给 RP-Hub。

### 4.4 资源发现流程

```javascript
async function resolveCardAsset(cardId) {
    const lanBaseUrl = GM_getValue('lanBaseUrl', 'http://127.0.0.1:8765');

    // 1. 优先局域网
    if (lanBaseUrl) {
        const lan = await tryGetAsset(lanBaseUrl, cardId);
        if (lan) return { ...lan, source: 'lan' };
    }

    // 2. 回退源站
    return await getSourceAsset(cardId);
}

async function tryGetAsset(baseUrl, cardId) {
    try {
        const manifest = await fetch(`${baseUrl}/manifest.json`).then(r => r.json());
        const info = manifest[cardId];
        if (info && info.filename) {
            return {
                url: `${baseUrl}/api/image/${encodeURIComponent(info.filename)}`,
                filename: info.filename
            };
        }
    } catch (e) {
        console.warn('LAN asset not accessible', e);
    }
    return null;
}
```

### 4.5 权限校验与源站鉴权绕过

#### 局域网

- 局域网 RP-Hub-Card 服务不对外暴露，无需前端鉴权。
- 如果 RP-Hub-Card 的 `fetch_cards.py` 在请求源站时需要 `X-Sync-Token`，那只在后端与源站之间发生，前端不参与。

#### 源站

- 源站的**网站/UI 层面**有鉴权（例如登录态、Cookie、Token）。
- 但**角色卡 PNG 文件本身的下载 URL 无需鉴权**即可直接访问。
- Userscript 的优势在于：它在浏览器端运行，可以**直接构造并请求卡片下载 URL**，绕开网站前端的 UI 鉴权流程。
- 这意味着：
  - 用户无需在源站广场页面登录。
  - 脚本可以直接把卡片数据拖下来，交给 RP-Hub 导入。
- 注意：这只适用于「卡片文件直链无需鉴权」的前提。如果源站后续对文件直链也加了鉴权，则需要重新评估。

#### 前端脚本不保存 Token

- Userscript 不保存、不处理源站的任何登录 Token。
- 它只做两件事：
  1. 检查局域网有没有这张卡。
  2. 没有时，直接请求源站卡片直链。

### 4.6 过期检测（简化版）

由于不再使用 GitHub 缓存图片，过期检测可以简化：

- **信任本地/LAN 的 manifest**：RP-Hub-Card 的 `fetch_cards.py` 每次同步时已经会更新本地文件。
- **强制刷新按钮**：Userscript 提供「强制从源站下载此卡」菜单，供用户手动绕过 LAN。
- **可选**：启动 `fetch_cards.py` 时加上 `--sync`，让它每天自动与源站同步一次，保持 LAN 端最新。

如果后续需要自动过期检测，可扩展为：
- 源站提供卡片 `updated_at` 接口，Userscript 比较 LAN manifest 与源站元数据。
- 或在 LAN manifest 中记录 `synced_at`，超过 N 天未同步则提示用户运行 `fetch_cards.py`。

---

## 5. Userscript 结构与匹配规则

```javascript
// ==UserScript==
// @name         RP-Hub Sync & Plaza Hijack
// @namespace    rphub
// @version      4.0
// @description  RP-Hub GitHub 弱同步 + 广场 LAN 优先资源挟持
// @author       You
// @match        https://*.github.io/RP-Hub/*
// @match        https://rphforum.zeabur.app/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    const isRpHub = location.href.includes('RP-Hub');
    const isPlaza = location.hostname.includes('rphforum.zeabur.app');

    if (isRpHub) {
        initRpHubSync();
    } else if (isPlaza) {
        initPlazaHijack();
    }

    function initRpHubSync() {
        // 1. 注册 Tampermonkey 菜单命令（推送/拉取/配置）
        // 2. 读取 IndexedDB 全量数据
        // 3. GitHub Contents API 上传/下载
        // 4. AES-GCM 加解密
    }

    function initPlazaHijack() {
        // 1. 读取配置 lanBaseUrl、sourceBaseUrl
        // 2. 探测局域网 RP-Hub-Card 服务
        // 3. Hook fetch / XHR / 按钮点击
        // 4. LAN 存在时改写资源 URL，否则回退源站
    }
})();
```

---

## 6. 实施步骤

### 第一阶段：部署 RP-Hub 到 GitHub Pages（GitHub Actions 自动同步上游）

1. **Fork 上游仓库**：在 GitHub 上 Fork `https://github.com/STA1N156/RP-Hub` 到你的账号下，得到 `https://github.com/<your-username>/RP-Hub`。
   - 或者新建一个空仓库，把本地项目 push 上去。
2. **确认工作流文件已包含**：本地 `.github/workflows/sync-upstream.yml` 应该已经在仓库中。
3. **开启 GitHub Pages**：
   - 进入仓库 Settings → Pages。
   - Source 选择 **Deploy from a branch** → `main` / `root`。
4. **配置 Actions 权限**：
   - Settings → Actions → General → Workflow permissions。
   - 选择 **Read and write permissions**。
5. **推送到你的仓库**：
   ```bash
   git remote add origin https://github.com/<your-username>/RP-Hub.git
   git push -u origin main
   ```
6. **手动触发一次 Actions**：
   - 进入 Actions → Sync upstream and deploy Pages → Run workflow。
   - 如果上游没有更新，会提示跳过；有更新则自动合并并部署。
7. 访问 `https://<your-username>.github.io/RP-Hub/index.html` 验证能正常打开。

> **配额说明**：
> - 该工作流每天只运行一次（cron 触发），且只有上游有更新时才会执行 push。
> - 如果上游无更新，工作流会在 check 阶段快速结束，几乎不消耗 Actions 分钟数。
> - GitHub Pages 部署本身不计入 Actions 分钟数。

### 第二阶段：GitHub 状态同步功能

1. 创建私有仓库 `RP-Hub-Sync`。
2. 生成 Fine-grained PAT：
   - GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens。
   - Repository access：选择 `RP-Hub-Sync`。
   - Permissions：`Contents` → Read and write。
3. 安装 Userscript：
   - 桌面：安装 Tampermonkey / Violentmonkey 扩展，然后打开本地 `rphub-sync.user.js` 文件，扩展会自动识别安装。
   - 手机 Via：设置 → 脚本 → 添加脚本，把 `rphub-sync.user.js` 内容粘贴进去。
   - 手机 Kiwi：安装 Tampermonkey 扩展，同样方式安装脚本。
4. 配置脚本：
   - 在 RP-Hub 页面点击脚本菜单的「同步设置」，或在页面底部注入的同步面板点击「设置」。
   - 填写：GitHub Token、Owner（你的 GitHub 用户名）、Repo（`RP-Hub-Sync`）、同步口令。
5. 测试：
   - 桌面端：设备 A 点击「推送到 GitHub」→ 设备 B 点击「从 GitHub 拉取」→ 数据一致。
   - 移动端：Via/Kiwi 中验证拉取成功。

### 第三阶段：局域网 RP-Hub-Card 服务

1. 在桌面电脑启动 RP-Hub-Card 服务，绑定所有接口供局域网访问：
   ```bash
   cd C:\Users\blycr\Projects\RP-Hub-Card
   python fetch_cards.py --serve --bind 0.0.0.0
   ```
2. 确认本机可访问：`http://127.0.0.1:8765/api/status`。
3. 确认跨设备可访问：`http://<电脑内网IP>:8765/api/status`。
4. 配置 Windows 防火墙放行 8765 端口（如果跨设备访问失败）。
5. 在 Userscript 中配置局域网地址：
   - 打开脚本设置，设置 `plaza_lan_url` 为 `http://<电脑内网IP>:8765`。
   - 如果在本地单机使用，保持默认 `http://127.0.0.1:8765`。

### 第四阶段：广场 Hijack（LAN → 源站）

1. 在源站广场页面脚本中实现：
   - 读取 `lanBaseUrl` 配置。
   - 探测 LAN 服务。
   - Hook 下载请求，LAN 存在时改写 URL。
   - LAN 不存在或无该卡时回退源站。
2. 测试场景：
   - LAN 在线且有卡 → 走 LAN。
   - LAN 不在线 → 走源站。
   - LAN 在线但无该卡 → 走源站。
3. （可选）注入状态标签和「强制源站下载」按钮。

### 第五阶段：体验优化

1. **增量同步**：Userscript 的 IndexedDB 快照用 JSON Patch 减少 GitHub API 调用。
2. **压缩快照**：gzip 后上传，减小 blob 体积。
3. **多版本快照**：在 `RP-Hub-Sync` 仓库保留最近 N 个 snapshot。
4. **自动探测 LAN IP**：脚本启动时尝试自动发现局域网中的 RP-Hub-Card 服务（可选）。
5. **广场状态标签**：显示当前卡片走的是 LAN 还是源站。

---

## 7. 风险与注意事项

| 风险 | 说明 | 缓解方式 |
|------|------|----------|
| **GitHub API 速率限制** | 未认证 60/h，认证后 5000/h | 用 PAT 认证，足够个人使用 |
| **Token 泄露** | PAT 保存在脚本存储中 | 使用 Fine-grained token，最小权限；不硬编码 |
| **仓库公开导致隐私泄露** | 同步仓库应设为私有 | 加密后上传 + 私有仓库 |
| **IndexedDB 过大** | 聊天记录多导致 blob 大 | gzip 压缩 + 增量同步 |
| **移动端脚本兼容** | Via 对 `GM_*` API 支持有限 | 优先用标准 `fetch`，`GM_xmlhttpRequest` 做降级 |
| **覆盖丢失** | 「拉取并覆盖」会清空本地 | 加确认弹窗；可选先本地备份 |
| **局域网不可达** | 手机与电脑不在同一网络 | 自动回退源站，不影响使用 |
| **CORS** | GitHub API 支持 CORS；LAN 服务需 `fetch_cards.py` 允许跨域 | 确认 `fetch_cards.py` 已设置 `Access-Control-Allow-Origin: *` |

---

## 8. 方案演进对比

| 维度 | v1（源站接口） | v2/v3（GitHub 缓存图片） | v4（本方案） |
|------|----------------|--------------------------|--------------|
| 源站改动 | 需要加接口 | 不需要 | **不需要** |
| 后端成本 | 需维护服务 | 免费 | **免费** |
| 图片存储 | 源站 / 本地 | GitHub / LAN | **LAN + 源站** |
| GitHub 容量压力 | 无 | 大（需热度筛选） | **无** |
| 源站流量 | 中 | 低 | **最低（同 LAN 时为零）** |
| 复杂度 | 中 | 高 | **低** |
| 移动端 | 支持 | 支持 | 支持（回退源站） |

---

## 9. 快速检查清单

部署前请确认以下配置：

- [ ] GitHub 上 Fork 了 `STA1N156/RP-Hub`，或创建了同名仓库。
- [ ] 仓库 Settings → Pages → Source 设置为 `main / root`。
- [ ] 仓库 Settings → Actions → General → Workflow permissions 设置为 **Read and write permissions**。
- [ ] 本地 `.github/workflows/sync-upstream.yml` 已 push 到你的仓库。
- [ ] 手动触发一次 Actions，确认 `https://<你的用户名>.github.io/RP-Hub/index.html` 可访问。
- [ ] 创建私有仓库 `RP-Hub-Sync`。
- [ ] 生成 Fine-grained PAT，授予 `RP-Hub-Sync` 仓库 `Contents: Read and write` 权限。
- [ ] 安装 `rphub-sync.user.js` 到 Tampermonkey / Violentmonkey / Via / Kiwi。
- [ ] 在脚本设置中填入 Token、Owner、Repo、同步口令。
- [ ] 启动 RP-Hub-Card：`python fetch_cards.py --serve --bind 0.0.0.0`。
- [ ] 在脚本设置中配置 `plaza_lan_url` 为运行 RP-Hub-Card 的电脑内网 IP。
- [ ] 测试广场下载：LAN 有卡时走 LAN，无卡时走源站直链。
- [ ] 测试同步：设备 A 推送，设备 B 拉取，数据一致。

---

## 10. 已知限制与后续迭代

### 当前限制

1. **广场卡片 ID 识别**：`rphub-sync.user.js` 中内置了几种常见的 URL 模式（`/api/download/<id>`、`/card/<id>` 等）。如果源站实际 URL 不同，需要修改 `getPlazaCardIdFromUrl` 函数。
2. **Via 浏览器兼容性**：Via 对 `GM_xmlhttpRequest` 支持有限，GitHub 同步部分会降级为 `fetch`。如果 Via 中仍有问题，建议使用 Kiwi Browser + Tampermonkey。
3. **自动推送**：第一版只做了手动推送/拉取。自动推送（监听 `beforeunload` 或 IndexedDB 变化）作为后续扩展实现。
4. **过期检测**：第一版信任 LAN manifest。如需自动比较源站 `updated_at`，需要源站提供公开元数据接口。

### 建议迭代顺序

1. **先跑通 MVP**：Pages 部署 + 手动同步 + LAN 广场 Hijack。
2. **调整 URL 模式**：根据源站实际地址修改 `getPlazaCardIdFromUrl`。
3. **加入自动推送**：离开页面时自动 push（纯 Userscript，不涉及 RP-Hub 源码）。
4. **加入增量同步**：减少 GitHub API 调用和 blob 体积（纯 Userscript）。
5. **加入 LAN 自动发现**：扫描常见内网 IP 段或缓存上次成功的 IP（纯 Userscript）。

---

## 11. 推荐的最小可行路径（MVP）

按这个顺序可以最快验证核心逻辑：

### Step 1：RP-Hub 上 GitHub Pages
- Fork `STA1N156/RP-Hub` 或创建仓库，推送代码（包含 `.github/workflows/sync-upstream.yml`）。
- 开启 Pages，设置 Actions 权限。
- 手动触发 Actions，验证 Pages 可访问。

### Step 2：Userscript 同步功能
- 创建私有仓库 `RP-Hub-Sync`。
- 生成 Fine-grained PAT。
- 安装 `rphub-sync.user.js`。
- 配置 Token、Owner、Repo、同步口令。
- 桌面双浏览器测试通。

### Step 3：局域网 RP-Hub-Card 服务
- 启动 `python fetch_cards.py --serve --bind 0.0.0.0`。
- 手机/另一台电脑访问 `http://<lan-ip>:8765/api/status` 确认可达。
- 在脚本中配置 `plaza_lan_url`。

### Step 4：Userscript 广场 Hijack（LAN → 源站）
- 根据源站实际 URL 调整 `getPlazaCardIdFromUrl`。
- 测试：LAN 有卡走 LAN，LAN 不在线走源站。

### Step 5：移动端测试
- Via 或 Kiwi 安装脚本。
- 验证同步拉取与广场资源回退。

MVP 完成后：
- RP-Hub 自动从上游同步并部署到 Pages。
- RP-Hub 状态可跨设备手动同步。
- 广场资源优先走局域网 RP-Hub-Card，缺失时走源站直链。
- 同 LAN 时源站图片流量为零。
- 全程零改动 RP-Hub 源码。

---

## 12. 可扩展方向（按侵入性分类）

以下扩展**不涉及 RP-Hub 源码改动**，只增加/修改 Userscript 代码，建议逐步实现：

| 功能 | 说明 | 复杂度 |
|------|------|--------|
| **自动推送** | 监听 `beforeunload` 或 IndexedDB 变化，自动 push 状态快照 | 低 |
| **增量同步** | 只上传变化的 key，减少 GitHub API 调用和 blob 体积 | 中 |
| **多快照版本** | 在 `RP-Hub-Sync` 仓库保留最近 N 个 snapshot，支持回滚 | 低 |
| **自动发现 LAN 服务** | 脚本通过预定义 IP 段扫描或本地缓存找到 RP-Hub-Card 服务地址 | 中 |
| **广场状态标签** | 在每张卡片上显示「LAN」「源站」来源标识 | 低 |
| **强制源站下载** | 右键菜单/按钮，绕过 LAN 直接下载源站最新版 | 低 |
| **源站搜索/列表 Hijack** | 不仅改下载链接，还把广场的卡片列表数据源也重定向到 LAN manifest | 中 |

以下扩展**需要修改 RP-Hub 源码或引入外部服务**，作为远期方向：

| 功能 | 说明 | 复杂度 |
|------|------|--------|
| **WebRTC 直连** | 同 LAN 时设备 A 与 B 直接同步状态，不经过 GitHub | 高 |
| **PWA + Service Worker** | 把 Userscript 逻辑下沉到 Service Worker，用户无需安装脚本管理器 | 高 |

---

*方案版本：v4.1（最终版）*  
*基于 RP-Hub 部署到 GitHub Pages、源站不改动、GitHub 私有仓库同步状态、局域网 RP-Hub-Card 优先、源站直链绕过 UI 鉴权设计。*
