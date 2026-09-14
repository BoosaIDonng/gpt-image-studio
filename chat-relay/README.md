# chat-relay

内置 AI 助手的服务端中继。静态站（GitHub Pages）访客零配置使用内置 chat；
NVIDIA API key 只存在于 Worker secret，绝不进入前端。

- 上游：`https://integrate.api.nvidia.com/v1`，模型固定 `openai/gpt-oss-20b`
- 端点：`POST /chat/completions`（`{ messages, stream? }`，SSE 透传）、`GET /health`
- 安全：Origin 白名单、每 IP 每分钟 20 次限流、消息 ≤40 条 / 单条 ≤24k 字符

部署（本目录）：

```bash
npx wrangler secret put NVIDIA_API_KEY   # 首次
npx wrangler deploy
```
