# AI 助手项目上下文接入设计

## 背景

当前浮动 AI 助手通过 `floatingChatService` 请求用户部署的聊天网站。请求只包含助手自己的对话消息，并使用 `openai/gpt-oss-120b` 与 `use_builtin_persona: true`。助手不知道当前输入框、主会话、引用图片、生成参数或 RAG 命中，因此回答常常像普通聊天，而不是当前项目里的创作助手。

本功能让 AI 助手在每次发送时携带当前创作上下文。上下文只帮助模型理解用户正在做什么，不改变图片生成链路，也不改变用户部署网站的接口协议。

## 目标

- AI 助手每次请求都自动带上当前创作上下文。
- 使用兼容现有 Worker 的消息形态，不要求后端支持新的 `project_context` 字段。
- 控制上下文长度，避免把整库图片、全部历史消息或 API key 发给模型。
- 让上下文与主项目状态同步，包括输入框、最近消息、引用图、生成参数和 RAG 摘要。
- 保持浮窗 UI 简洁，不新增设置项或复杂调试面板。

## 非目标

- 不改动用户部署网站的接口协议。
- 不关闭 `use_builtin_persona`。
- 不发送 API key、Companion token、图片 Blob、base64、预览 URL 或完整图片库。
- 不让 AI 助手直接执行生成、删除、导入或设置修改操作。
- 不把主聊天消息合并进助手对话历史；主聊天只作为只读摘要上下文。

## 方案

前端在发送助手请求前构造一条隐藏的上下文消息，并把它放在助手消息列表之前。该消息使用普通 chat messages 兼容形态，内容以明确标题包裹，例如：

```text
以下是 GPT Image Studio 当前项目上下文，仅用于理解用户意图。不要原样复述，除非用户要求。
...
```

这种方案不需要后端读取新字段。只要部署网站按 OpenAI 兼容 chat messages 转发，模型就能看到上下文。用户在浮窗里仍只看到自己和助手的对话，不显示隐藏上下文消息。

## 上下文内容

上下文包含当前创作所需的短摘要：

- 当前输入框文字，空输入时标记为“空”。
- 当前主会话标题。
- 最近 6 条主聊天消息，每条保留角色、状态和前 240 个字符。
- 当前引用图片，最多 4 张，包含名称、来源、尺寸、原始 prompt、request prompt 和 revised prompt 的短摘录。
- 当前生成参数：供应商、模型、接口模式、连接模式、尺寸、分辨率、数量、质量、背景和格式。
- 当前 RAG 状态：是否开启、topK、按当前输入计算出的命中词条，最多 4 条。

上下文构建函数会裁剪长文本，过滤空值，并使用稳定顺序输出，便于测试和排查。

## 数据流

新增一个纯函数服务 `floatingChatContext.ts`，输入为当前项目状态，输出隐藏上下文消息文本。组件层负责从现有 store 读取状态：

- `useComposerStore()` 提供输入框文字。
- `useConversationsStore()` 或 view model 提供当前会话和最近主消息。
- `useImagesStore()` 提供当前引用图片。
- `useSettingsStore()` 提供供应商、模型、生成参数和 RAG 设置。
- `collectRagDocuments()` 与 `retrieveRagContext()` 复用现有 RAG 计算。

`FloatingChat.vue` 调用 `chat.send(projectContext)`。`floatingChatStore` 将上下文交给 `streamChatReply()`。`floatingChatService` 在请求体中发送 `[contextMessage, ...messages]`，但 store 里的 `messages` 仍只保存用户可见对话。

## 错误处理

上下文构建失败不应阻断助手聊天。若某个局部数据缺失，例如图片没有尺寸或 prompt，构建函数跳过该字段。若 RAG 无命中，只输出 RAG 开关和 topK，不输出空命中列表。

聊天请求失败仍沿用现有错误展示：移除空 assistant 消息，并在浮窗底部显示错误文本。

## 测试

新增单元测试覆盖：

- 上下文包含输入框、会话标题、最近消息、引用图、生成参数和 RAG 摘要。
- 上下文不会包含 API key、token、Blob URL、base64 或过长消息全文。
- `streamChatReply()` 会把隐藏上下文消息放在用户可见消息之前。
- 没有上下文时，请求保持当前行为。

验证命令：

```bash
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

同时按仓库规则扫描中文和 Unicode 文本，确认没有乱码、替换字符或隐藏 Unicode 控制字符。
