# RP-Hub 角色卡资产重构与生命周期管理方案（临时草案）

> 用途：同步时不传输角色卡 PNG 二进制，仅同步文本状态与 plaza cardId；恢复后自动从 LAN/源站补回缺失卡；以 plaza cardId 为跨设备唯一标识管理角色卡生命周期。

---

## 1. 核心设计变更

| 项目 | 现状 | 目标 |
|------|------|------|
| 同步内容 | 整个 IndexedDB（含 PNG 头像，可能几百 MB） | 仅文本状态 + plaza cardId 映射 |
| 角色卡标识 | 本地 UUID，跨设备不同 | plaza cardId，跨设备稳定 |
| 恢复后图片 | 直接可用 | 自动从 LAN → 源站依次补回 |
| 更新检测 | 无 | 比较源站 `updated_at`，提示/自动刷新 |
| 删除检测 | 无 | 源站 404 时保留聊天记录，仅头像置占位 |

---

## 2. 为什么必须用 plaza cardId 而不是名字

- 角色名不唯一，广场上可能存在同名卡。
- 用户导入后可能改名。
- 名字含特殊字符/emoji，不适合作为稳定键。
- 同一张卡在不同设备导入后，RP-Hub 会生成不同本地 UUID。
- plaza cardId 是源站分配的全局稳定 UUID，从下载 URL `/api/cards/{id}/...` 中可直接获得。

---

## 3. 关键难点：如何把 plaza cardId 写进 RP-Hub 的角色对象

RP-Hub 当前的角色对象不包含 plaza cardId。必须在导入环节把它记下来。有两个方案：

### 方案 A（推荐）：最小修改 RP-Hub app.js

- 广场 iframe 在触发下载/使用时，通过 `postMessage` 向 RP-Hub 父页面发送：
  ```js
  { type: 'RPHUB_PLAZA_CARD', cardId, name, updatedAt, downloadUrl }
  ```
- RP-Hub 顶页监听该消息，把 pending 的 plaza 卡信息存在 `window.__rphub_pending_plaza_card__`。
- 在 `importCharacter` 创建 `char` 对象后，若存在 pending 信息且文件名/名称匹配，写入：
  ```js
  char.plazaId = pending.cardId;
  char.plazaImportedAt = Date.now();
  char.plazaLastKnownUpdatedAt = pending.updatedAt;
  ```
- **改动量**：约 5–10 行，集中在导入函数附近。
- **风险**：上游 STA1N156/RP-Hub 若修改同一区域，`-X theirs` 合并会覆盖本地改动，需手动重新应用。

### 方案 B（纯 userscript，不改 RP-Hub）

- 拦截广场下载，记录 `cardId → 文件名/下载 URL` 映射。
- 拦截 RP-Hub 的文件导入流程（hook `FileReader`），按文件名反查 cardId，再修改导入后的角色对象。
- **问题**：
  - 文件名不唯一（LAN 下载用卡片名，源站下载可能用 `cardId.png`）。
  - 需要深层 hook RP-Hub 内部流程，脆弱易坏。
  - 重命名、多次导入后关系容易乱。
- **结论**：仅作为“绝对不改源码”的 fallback，不推荐用于生命周期管理。

**建议**：采用方案 A，并在文档里把这块标为“需要手动维护的本地补丁”。

---

## 4. 推荐数据模型

### character 对象新增字段

```js
{
  uuid: '本地 UUID',
  name: '角色名',
  avatar: 'blob/data/远程 URL（不同步二进制）',
  plazaId: 'ed159950-...',          // 新增：广场卡 ID
  plazaImportedAt: 1234567890,      // 新增：本设备导入时间
  plazaLastKnownUpdatedAt: '...',   // 新增：广场最后更新时间
  isLocal: false,                   // 新增：true 表示非广场来源的本地卡
  // ... 其他现有字段
}
```

### 新增 IndexedDB keys

| key | 内容 |
|-----|------|
| `rp_hub_card_blob_<plazaId>` | 下载后的 PNG bytes（data URL 或 Array） |
| `rp_hub_plaza_id_map` | `{ [uuid]: plazaId }` 映射，冗余加速 |

### 同步文件结构

```
rp-hub-sync/
  state.json            # 剥离 avatar 二进制的角色/聊天/设置
  card-id-map.json      # uuid → plazaId 映射
```

---

## 5. 导出流程改造

1. 读取完整 IndexedDB。
2. 遍历 `rp_hub_characters`：
   - 如果 `avatar` 是 data URL 或 blob URL → 替换为占位符或源站 URL 模板。
   - 保留 `plazaId`、`plazaImportedAt`、`plazaLastKnownUpdatedAt`。
3. 生成 `card-id-map.json`：从 characters 提取 `uuid → plazaId`。
4. 上传 `state.json` + `card-id-map.json`。
5. 不上传任何 PNG 二进制。

---

## 6. 恢复后自动补卡流程

```
1. 拉取 state.json + card-id-map.json
2. 写回 IndexedDB（此时 avatar 可能为占位符）
3. 遍历 characters：
   a. 若 char.plazaId 存在：
      - 查 LAN manifest（按 plazaId）
        - 命中 → GM_xhr 下载 PNG → 写入 rp_hub_card_blob_<plazaId> → 更新 avatar
      - 未命中 → 源站 /api/cards/{plazaId}/download/file → 同上
   b. 若 char.plazaId 不存在（本地卡/isLocal）：
      - 提示用户该卡无法自动补回，保留聊天记录
4. 显示进度："正在补全角色卡 3/12..."
```

---

## 7. 生命周期管理

### 7.1 更新检测

- 广场卡详情 API `/api/cards/{plazaId}` 返回 `updated_at`。
- 在恢复后或定期（可选）比较 `updated_at` 与本地 `plazaLastKnownUpdatedAt`：
  - 若源站更新 → 提示“广场有新版，是否重新下载？”或自动重下（可配置）。
- LAN manifest 可包含 `updated_at`（需 RP-Hub-Card 扩展），局域网内优先比较 LAN 版本。

### 7.2 删除检测

- 补卡时若源站返回 404：
  - 该 plazaId 已从广场删除。
  - 策略：**保留本地角色和聊天记录**（这是用户资产），仅把 avatar 置为占位图。
  - UI 提示：“广场已删除该卡，聊天记录已保留。”

### 7.3 本地自定义卡

- `isLocal: true` 的卡没有 plazaId。
- 同步时：若体积小可保留 avatar data URL；若体积大需提示用户“本地卡无法云端恢复，请自行备份 PNG”。
- 恢复后：无法自动补回，需手动重新导入。

### 7.4 重命名

- 用户改名不影响 `plazaId`。
- `card-id-map` 以 uuid 为键，uuid 在单设备内稳定；跨设备靠 `plazaId` 关联。

---

## 8. 待确认决策

1. **是否接受对 RP-Hub app.js 的最小修改（方案 A）？**
   - 这是稳定使用 plaza cardId 的前提。
2. **本地自定义卡片的处理策略？**
   - A：保留 data URL（可能让快照再次变大）
   - B：剥离，恢复后提示手动重新导入
3. **更新检测是自动重下还是仅提示用户？**
   - 建议默认提示，避免覆盖用户本地修改。
4. **是否同时给 RP-Hub-Card 的 manifest 增加 `updated_at`？**
   - 这样局域网内就能做更新判断，不用请求源站。

---

## 9. 实施顺序建议

1. 加诊断：导出前打印每个 IndexedDB key 的大小，确认体积大头。
2. 改导出：剥离 avatar 二进制，生成 state.json + card-id-map.json。
3. 实现恢复后自动补卡（先按 plazaId，LAN → 源站回退）。
4. （如接受）改 RP-Hub app.js，注入 plazaId。
5. 加生命周期：更新/删除检测与提示。

---

## 10. 增量同步与大数据量改造方案

### 10.1 为什么需要增量同步

- 当前脚本每次 GitHub 同步都是**全量覆盖**：把整个 IndexedDB 打包成 JSON 上传，再把整个 JSON 下载后覆盖本地。
- 当聊天记录、角色卡数量增多后，state.json 可能达到几十 MB 甚至几百 MB。
- 全量同步的问题：
  - GitHub API / gist 单文件有大小限制（gist 单个文件 ≤ 100 MB，实际建议 ≤ 25 MB）。
  - 移动端网络不稳定，容易“拉取失败: JSON.parse: unexpected end of data”。
  - 冲突处理粗暴：A 设备推送，B 设备拉取，B 的本地新增内容会被 A 的状态完全覆盖。

### 10.2 推荐方案：拆分 + 分片 + 按需

> 这是“数据量变大后”的演进路线，不一定现在全部实现，但架构上要预留。

| 层级 | 方案 | 说明 |
|------|------|------|
| **① 按实体拆分** | 把 state.json 拆成多个文件 | `characters.json`、`chats.json`、`settings.json`、`card-id-map.json` |  |
| **② 按角色拆分聊天记录** | `chats_<charUuid>.json` | 只同步/拉取有变化的角色 |
| **③ 分片上传** | 大文件按 1 MB 切 block | 绕过 gist 单文件限制，但复杂度上升 |
| **④ 后端化** | 用自己的后端 / Cloudflare KV / Supabase | 不再受 GitHub 限制，但引入新依赖 |

### 10.3 当前最可落地的折中方案

在仍使用 GitHub gist 的前提下，建议分阶段：

1. **第一阶段（现在可做）**：剥离 PNG 二进制，state.json 体积会下降一个数量级。
2. **第二阶段**：把 `chats` 按角色拆文件，每个角色独立同步。
3. **第三阶段**：引入“最后修改时间”版本向量，只拉取/推送变更文件。
4. **第四阶段**：如果仍不够用，再迁移到私有后端或对象存储。

### 10.4 不建议现在做的事

- 不要现在就直接上分片上传，收益不大但代码复杂度翻倍。
- 不要现在引入后端，违背“低侵入、零成本部署”的初衷。

---

## 11. 角色卡自动补回机制细化

### 11.1 问题场景

- 设备 A 同步了“角色 R + 聊天记录”到云端。
- 设备 B 拉取后，聊天记录存在，但角色 R 的 PNG 头像/卡本体缺失（因为剥离了二进制）。
- 如果没有自动补回，B 打开聊天会看不到头像，甚至角色列表里没有这个角色。

### 11.2 自动补回流程

恢复完成后，脚本应遍历所有 character：

```
1. 若 char.plazaId 存在：
   a. 检查本地 IndexedDB 是否已有 plazaId 对应 PNG。
   b. 若无：
      - 先查 LAN manifest（plazaId → 本地文件名）
      - LAN 命中 → GM_xhr GET http://<lan-ip>/<filename>.png
      - LAN 未命中 → 回退源站 /api/cards/{plazaId}/download/file
      - 下载成功后写入 IndexedDB，并更新 char.avatar
2. 若 char.plazaId 不存在（isLocal: true）：
   - 无法自动补回，UI 提示“本地卡需手动导入 PNG”。
3. 所有补回完成后，触发一次 RP-Hub 的保存/刷新。
```

### 11.3 失败处理

- LAN 不可达：静默回退源站。
- 源站 404：说明该卡已从广场删除，保留聊天记录，头像置为占位图。
- 源站 401/403：说明鉴权失败，提示用户检查登录状态（脚本已去除广场下载鉴权，但源站若变更可能仍需要）。
- 网络超时：记录失败 plazaId，提供“重试补回”按钮。

---

## 12. 生命周期管理（ plazaId 为中心）

### 12.1 为什么 plazaId 是唯一正确键

- 角色名可能重复、可能被用户修改。
- 本地 UUID 在不同设备上不同。
- plazaId 是广场分配的全局 UUID，稳定、唯一、不可伪造。
- 所有同步、补回、更新检测都应以 plazaId 为准。

### 12.2 更新检测

- 触发时机：恢复后、进入广场时、每日一次（可选）。
- 比较字段：广场 API 返回的 `updated_at` vs 本地 `plazaLastKnownUpdatedAt`。
- 行为选择（可配置）：
  - **提示模式（推荐默认）**：在角色卡片上显示“广场有更新”角标，用户点击后重新下载。
  - **自动模式**：自动下载新版覆盖本地卡。

> 注意：自动覆盖可能丢失用户对角色卡的本地修改，建议默认提示。

### 12.3 删除检测

- 补卡时源站返回 404，标记 `plazaDeleted: true`。
- 不删除本地角色和聊天记录（聊天记录是用户资产）。
- 头像替换为占位图，并在角色名旁显示“已下架”提示。

### 12.4 本地自定义卡

- 本地导入、非广场来源的卡：`isLocal: true`，无 plazaId。
- 同步策略可选：
  - A：保留 data URL（简单，但增大快照体积）。
  - B：剥离 data URL，恢复后提示手动重新导入（推荐，与广场卡统一处理）。
- 生命周期：完全由用户手动管理，脚本不尝试自动补回。

### 12.5 更新/删除对聊天记录的影响

- 角色卡更新 ≠ 聊天记录重置：更新只替换 `avatar` 与角色定义，保留聊天历史。
- 角色卡删除 ≠ 删除聊天：仅头像变占位，聊天记录仍可浏览。

---

## 13. 仍待用户拍板的关键决策

1. **是否接受对 RP-Hub app.js 的最小修改（方案 A），以稳定写入 plazaId？**
   - 这是 plazaId 生命周期管理的前提。
2. **本地自定义卡是否剥离 avatar data URL？**
   - A：保留（简单但快照变大）
   - B：剥离（推荐，统一处理）
3. **更新检测默认行为？**
   - A：仅提示（推荐，安全）
   - B：自动覆盖
4. **是否扩展 RP-Hub-Card 的 manifest 增加 `updated_at`？**
   - 这样局域网内就能判断是否有新版，不用频繁请求源站。
5. **是否现在开始实现增量同步（拆分 chats）？**
   - 建议先完成剥离二进制，数据量仍然很大时再拆分。

---

## 14. 实施顺序建议（更新）

1. 加诊断：导出前打印 IndexedDB 各 key 体积，确认大头。
2. 改导出：剥离 avatar 二进制，生成 `state.json` + `card-id-map.json`。
3. 实现恢复后自动补卡（LAN → 源站回退，按 plazaId）。
4. 实现 IndexedDB 大小预警（超过阈值提示用户）。
5. （如接受）改 RP-Hub app.js，注入 plazaId。
6. 加生命周期：更新/删除检测与提示。
7. （数据量仍大时）拆分 chats 为按角色文件，实现增量同步。

---

*草案版本：v1.1*
*更新时间：2026-07-16*
