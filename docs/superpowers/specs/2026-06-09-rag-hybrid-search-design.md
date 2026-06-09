# RAG 混合检索增强设计

## 背景

GPT Image Studio 现有 RAG 是浏览器端纯函数能力。它从成功生成的图片提示词中提取词库命中项，用本地词频向量检索，再把结果写入最终 Prompt。这个方案轻量、稳定，但召回范围偏窄：收藏 Prompt、最近历史消息和原始成功图提示词还没有真正进入自动检索来源。

本设计增强现有 RAG，而不引入完整 RAG 平台。RAGFlow、AnythingLLM、LangChain.js 和 Mastra 可作为设计参考，但当前项目仍保持 Vue + IndexedDB + 可选 companion 的 local-first 架构。

## 目标

- 扩展 RAG 来源：成功生成图片、收藏 Prompt、最近用户历史消息。
- 保留现有词库命中权重，让“项目词库相关经验”优先于普通历史文本。
- 用轻量混合检索替代单一词频相似度，提升中文、英文和短提示词召回。
- 保持生成流程不变：RAG 只补充参考，不覆盖用户原始提示词。
- 保持 RAG 命中条和排除项行为一致。

## 非目标

- 不接入 RAGFlow、AnythingLLM、Dify 或 Open WebUI 这类完整平台。
- 不在第一版引入云端 embedding、Transformers.js 或 companion 向量服务。
- 不新增独立 RAG 调试台。
- 不改变图片生成 API、连接模式或 Prompt 改写保护的优先级。
- 不持久化完整索引；第一版按当前 IndexedDB 数据即时构建内存索引。

## 架构

`src/services/rag.ts` 继续作为 RAG 的统一入口。它新增文档收集输入，支持 image assets、favorite prompts 和最近 messages。检索仍由前端同步完成，调用方不需要处理异步状态。

检索分为两步：

1. 文档收集：把成功图、收藏和历史消息转换为统一的 `RagDocument`。
2. 混合排序：计算文本匹配分和来源权重，生成 `RagMatch` 列表。

第一版不新增运行时依赖。实现先使用一个小型内部 hybrid scorer，避免破坏项目当前轻依赖策略。Orama 和 MiniSearch 作为后续适配目标：如果测试或真实数据证明内部 scorer 不够，再把检索实现替换为库适配器。

## 文档来源

成功生成图片继续使用现有逻辑，从 `prompt`、`requestPrompt` 和 `revisedPrompt` 提取词库命中项。新增一类 image prompt 文档，用成功图的原始提示词作为低权重补充来源，但最终 RAG block 仍要去重，避免同一张图贡献重复文本。

收藏 Prompt 直接来自设置里的 `favoritePrompts`。收藏通常代表用户主动沉淀的风格或模板，权重低于词库命中，高于普通历史。

历史消息只收最近成功的用户消息。助手消息、失败消息、空消息、包含明显密钥或图片 data URL 的内容不进入 RAG。历史数量设置为固定上限，避免旧对话噪声压过当前创作意图。

## 排序策略

每个匹配项有三个分数：

- `textScore`：查询和文档的词项匹配分。
- `sourceWeight`：来源权重，词库最高，收藏其次，图片原始提示词和历史较低。
- `score`：最终排序分，等于文本分与来源权重的组合。

中文短句需要按 Han 字符补充 token；英文继续保留简单词干归一。排序稳定性沿用现有规则：分数相同按来源权重，再按 id 排序。

## UI 和交互

`ComposerRagMatchBar.vue` 继续显示最终会进入 Prompt 的命中项。新增来源标签时保持克制，只在详情或 title 中展示来源，避免输入区变拥挤。

用户排除某条命中后，该 id 不进入最终 Prompt，也从命中条中移除。恢复全部排除项的行为不变。

Prompt 预览继续展示最终 Prompt。预览和实际发送必须复用同一套 `retrieveRagContext()` 参数，避免“预览和发送不一致”。

## 错误处理

RAG 是增强能力，不阻断生成。文档收集或检索遇到异常时返回空上下文，最终 Prompt 只使用用户输入和现有 Prompt 模式。

收集历史消息时要清洗敏感内容：API key、blob URL、base64 图片和超长文本不进入索引。清洗后的空文本直接跳过。

## 测试

新增或调整 `src/services/rag.test.ts`：

- 成功图、收藏 Prompt、最近历史消息都能转换为 RAG 文档。
- 词库命中优先于收藏和历史。
- 历史消息只收用户成功消息，跳过助手消息、失败消息和空消息。
- 排除项不会出现在 `items` 或最终 RAG block 中。
- 中英文短查询都能命中合理文档。

补充调用侧测试：

- Prompt 预览和实际发送使用同一份 RAG 上下文。
- RAG 关闭时不收集、不展示、不注入。

## 迁移与兼容

第一版不变更 IndexedDB schema。所有增强都从现有内存状态和设置中计算，用户无需迁移数据。

如果后续数据量导致构建索引卡顿，再新增持久索引 store，并用 DB version 升级迁移。

## 外部参考

- Orama：https://github.com/oramasearch/orama。浏览器端 JavaScript 搜索引擎，适合轻量索引。
- MiniSearch：https://github.com/lucaong/minisearch。小型 JavaScript 全文搜索库，适合本地文档集合。
- LangChain.js：https://js.langchain.com/docs/tutorials/rag/。适合作为 RAG 编排设计参考，不作为第一版依赖。
- Mastra：https://mastra.ai/en/docs/rag/overview。适合作为 TypeScript RAG 编排参考，不作为第一版依赖。
- RAGFlow：https://github.com/infiniflow/ragflow。完整 RAG 平台，适合参考产品能力，不适合直接嵌入当前前端。
- AnythingLLM：https://github.com/Mintplex-Labs/anything-llm。完整 RAG 应用，适合参考产品能力，不适合直接嵌入当前前端。
