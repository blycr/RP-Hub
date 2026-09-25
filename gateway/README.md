# RP-Hub 请求网关

这是独立部署到 Cloudflare Workers 的可选模型请求服务。静态站点仍由 GitHub Pages 托管。本目录只有可公开的代码和部署配置；密钥、API Key 与用户请求正文不得写入 Git 或日志。

Worker 只接受 `/proxy` 上的 `GET /v1/models` 和 `POST /v1/chat/completions`、`/v1/responses`、`/v1/embeddings`。浏览器请求须带精确匹配的站点 `Origin`、`X-RPHub-Gateway-Token`、`X-RPHub-Target` 与供应商的 `Authorization: Bearer ...`。供应商必须位于运营者批准的 HTTPS origin 列表，Worker 不接受目标重定向，也不转发供应商的 Cookie 等响应头。请求体上限为 5 MiB；JSON 和 SSE 响应保留流式传输。

环境变量：

- `RPHUB_GATEWAY_TOKEN`：至少 32 字符的随机密钥，用 `wrangler secret put` 配置，不能写入公开网页。
- `RPHUB_SITE_ORIGINS`：用逗号分隔的精确 HTTPS 站点 origin。
- `RPHUB_PROVIDER_ORIGINS`：用逗号分隔的运营者批准的精确 HTTPS 供应商 origin。新增自定义供应商时，若其不支持浏览器 CORS，需要在这里批准后才能经过网关。

需要 Cloudflare 账号的 Workers 部署权限。配置变量、密钥和限流规则后执行 `npx wrangler deploy --config gateway/wrangler.jsonc`；先在测试域名验证，再连接站点。`Origin` 是浏览器跨域限制，**不是身份认证**；Worker Token 必须由用户在会话中提供，不能硬编码到站点。

预览 Worker 已部署到 `https://rphub-gateway-preview.qixmz.workers.dev/proxy`，部署命令在上句基础上增加 `--name rphub-gateway-preview`。当前站点 Origin 为 `https://rp.blycr.xyz`、`https://blycr.github.io`；测试用供应商 Origin 为 `https://api.openai.com`、`https://cdn.sta1n.cn`。这些值和网关口令配置在 Cloudflare Secret 中，不在本仓库。实际部署通过了预检、错误来源/口令/目标拒绝和 OpenAI 四类端点的无效 Key 转发测试；尚未使用真实模型 Key 或验证真实 SSE。`cdn.sta1n.cn` 对 Worker 出站的无效 Key 测试返回了非 JSON/SSE 响应，网关按设计拒绝；该供应商的浏览器预检允许直连。

**预览 Worker 已部署，正式站的设置页已有可选接线；网关本身仍处于预览阶段。** 隔离浏览器的模型列表请求已通过客户端路由到预览 Worker；无效测试口令返回预期 401，跨域预检通过。真实 SSE、供应商兼容性和隐私检查完成前，不得退役现有浏览器传输。站点中新增供应商不等于网关自动批准该供应商；允许 CORS 的供应商仍可由浏览器直连。生产还应设置 Cloudflare 限流规则。

本地运行 `node --test gateway/worker.test.mjs`。真实部署还需用浏览器 origin、供应商凭据和长时间流式响应完成端到端验证。
