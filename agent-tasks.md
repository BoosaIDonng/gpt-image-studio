# 智能体优化任务进度(AGENTS.md 约定:任务状态以本文件为准,勿凭记忆汇报)

> 创建:2026-09-14。来源:调研开源做法(ComfyUI-Prompt-Assistant 四段骨架、OpenAI specificity policy、Open WebUI JSON 模板、LibreChat schema 钳制、Orama/transformers.js 语义检索)。
> 每完成一个子任务,立即更新本文件勾选状态,再进入下一个。

## 已完成

- [x] **优化 1:浮动助手内置化**(2026-09-14 完成)
  - [x] 1a. `floatingChatService.ts` 改用用户 Chat API 配置(与扩写共用 key/baseUrl/model),删除外部 Worker 依赖
  - [x] 1b. 本地生图助手人设 `src/services/imageAssistantPrompt.ts`,不在前端暴露
  - [x] 安全改写链路 `promptSafetyRewrite.ts` 同步迁移(空 system prompt + 自带 system 消息)
  - [x] 项目上下文拼入首条用户消息(`FloatingChat.vue`),历史截断 16 条(`floatingChatStore.ts`)
  - [x] 未配置 Chat API 时给出设置引导(`FLOATING_CHAT_UNCONFIGURED_MESSAGE`)
  - [x] 测试:typecheck + 273 用例全过

- [x] **优化 2:重写「Prompt 智能扩写」system prompt**(2026-09-14 完成)
  - [x] 2a. `DEFAULT_CHAT_SYSTEM_PROMPT` 四段骨架:Role(六领域专家)→ 硬规则 6 条(语言自适应/语义忠实/Specificity policy/禁空泛词/输出纯净/250 词上限)→ 领域路由(摄影/产品/平面/二次元/3D/插画)→ 3 组中英 few-shot
  - [x] 2b. `max_tokens` 400 → 800
  - [x] 2c. 用户自定义 `chatSystemPrompt` 覆盖逻辑未动(空值才用默认)
  - [x] 2d. 新增 `src/services/promptExpander.test.ts`:默认 prompt 内容断言 + max_tokens/端点/覆盖逻辑 + fetchChatModels
  - [x] 2e. 验证:typecheck + 277 用例全过

- [x] **优化 3:RAG 跨语言召回(完整版)**(2026-09-14 完成)
  - [x] 3a. `src/services/ragBilingualTerms.ts`:110 组中→英生图术语映射(光影/构图/风格/情绪/主体/画质),`bilingualExpansions(token)`
  - [x] 3b. `rag.ts`:`bilingualExpansionsForText` 按 Han run 重建整词匹配映射键(绕过 bigram 切分),注入 `tokenCoverageScore` 与 `vectorize` 两条打分链
  - [x] 3c. `src/services/ragSemantic.ts`:transformers.js(`@huggingface/transformers` ^4.2.0)`Xenova/multilingual-e5-small` q8 量化,e5 query/passage 前缀,passage 向量缓存;`rag.ts` 新增 `retrieveRagContextEnhanced`,语义 cosine(≥0.45)与词面分数 max 融合;模型加载/推理失败静默降级纯词面
  - [x] 3c-接线. `ragContextForPromptAsync`(发送/重试路径走语义融合);同步 `retrieveRagContext` 保留给 UI computed 与浮动助手上下文;generationStore 新增可选 `currentPromptRequestSettingsAsync`,三个 async 调用点(doSubmit/retryMessage/rerun)已接
  - [x] 3d. PromptModeSettingsPanel「语义检索」开关(中文说明含模型大小提示,RAG 关闭时禁用)
  - [x] 3e. `ragSemanticEnabled` 全链路:types/studio → settings.ts normalize → settingsStore(定义/加载/保存/导出)→ settingsModalContext → settingsSync → backups(备份/恢复默认 false)
  - [x] 3f. 测试:`ragBilingualTerms.test.ts`(4 用例)、`ragSemantic.test.ts`(3 用例:融合召回/加载失败降级/开关关闭跳过);backups/settings/urlSettings fixture 补字段
  - [x] 3g. 验证:typecheck + 284 用例全过(build 待收尾统一跑)

- [x] **增强 A:扩写时注入 RAG few-shot 示例**(2026-09-14 完成)
  - [x] A1. `expandPrompt(userPrompt, settings, options)` 增加 `ragExamples?: string[]` + `signal?`;`buildExpandUserMessage` 把示例以「参考示例…不要照抄内容」段落置于用户输入前,清洗(去空白/300 字截断/最多 3 条/丢空)
  - [x] A2. viewModel 新增 `ragExamplesForPrompt(prompt)`(retrieveRagContext top3,ragEnabled 关闭返回空),经 `GenerationStoreContext.ragExamplesForPrompt?` 回调传入 generationStore
  - [x] A3. 注入格式见 A1(参考示例段 + 用户输入段)
  - [x] A4. RAG 关闭/无命中 → 空数组 → `buildExpandUserMessage` 原样返回,行为与现状一致
  - [x] A5. promptExpander.test 新增 3 用例(透传/前置注入/上限3条)
  - [x] A6. 验证:typecheck + 287 用例全过

- [x] **增强 B:浮动助手结构化输出(JSON 生成参数)**(2026-09-14 完成)
  - [x] B1. 协议:回复末尾 ```studio JSON 块 `{"action":"apply_prompt","prompt":...}` + 可选 size/imageCount/quality/background/outputFormat(仅用户明确要求参数时携带,其余回复不输出)
  - [x] B2. `imageAssistantPrompt.ts` 增加协议说明段(输出时机、字段取值范围)
  - [x] B3. 新增 `src/services/assistantApplyAction.ts`:解析 fenced 块(容错:无 fence 裸 JSON 兜底、损坏 JSON 返 null)+ `stripAssistantApplyBlock` 供显示
  - [x] B4. `FloatingChat.vue`:气泡显示文本剥离 studio 块;解析成功渲染「应用 prompt(和参数)」按钮,写入 composer + settingsStore(imageWidth/imageHeight/imageCount/quality/background/outputFormat)
  - [x] B5. `sanitizeApplyAction` 钳制/白名单:imageCount 钳 1-10、size 限 preset 或 `\d{3,4}x\d{3,4}`、quality/background/outputFormat enum;非法值丢弃而非拒绝,永不阻断聊天
  - [x] B6. `assistantApplyAction.test.ts` 8 用例(正常/钳制/非法值/自定义尺寸/非 apply/空 prompt/损坏 JSON/裸 JSON 兜底/块剥离)
  - [x] B7. 验证:typecheck + 295 用例全过

- [x] **收尾**(2026-09-14 完成)
  - [x] 全量验证:`pnpm typecheck` ✓ + `pnpm test` 295 用例 ✓ + `pnpm build` ✓(transformers.web ~550KB chunk 警告,来自懒加载动态 import,不影响首屏)
  - [x] 更新 `MEMORY.md`:已记录优化 1 架构变更;优化 2/3 与增强 A/B 见 `agent-tasks.md`
  - [x] 逐项回查本文件,确认无遗漏

## 全部任务已完成 ✅

## 约束备忘

- UI 文案中文;代码/注释/测试英文;Conventional Commits。
- 不引入重型依赖;transformers.js 是本次唯一新增依赖,必须懒加载 + 可降级(已达成)。
- 所有新逻辑都要有测试;失败降级路径优先考虑。
- 改动前先读相关文件,不要凭记忆改(防幻读)。

---

## 第三轮:内置 chat 直连 NVIDIA API(2026-09-14,全部完成 ✅)

需求:内置聊天模型直连 NVIDIA API(`openai/gpt-oss-20b`,base_url `https://integrate.api.nvidia.com/v1`),key 不暴露给前端,用户无需配置自己的模型和 key。

- [x] C1. `companion/src/routes/chat.ts`:新增 `POST /chat/completions`。NVIDIA key 从环境变量 `NVIDIA_API_KEY` 读取(服务端持有,可被 `NVIDIA_CHAT_BASE_URL`/`NVIDIA_CHAT_MODEL` 覆盖,默认 integrate.api.nvidia.com + openai/gpt-oss-20b);请求体校验(messages ≤40 条、单条 ≤24000 字符、stream 布尔、role 白名单);上游参数固定 temperature 1 / top_p 1 / max_tokens 4096;SSE 响应流式透传;key 未配置返回 503 带中文引导
- [x] C2. `companion/src/server.ts`:注册 chatRoutes,getUpstream 闭包每次请求时读 env(key 轮换无需重启也可感知);沿用 pairing auth 中间件(Bearer session token)+ Host 本地校验 + CORS origin 白名单,密钥自动进 logger redact 名单
- [x] C3. 前端 `floatingChatService.ts`:改为请求 `companionUrl + /chat/completions`(Bearer 配对 token),请求体只有 messages + stream,无任何 key/model 字段;system prompt(IMAGE_ASSISTANT_SYSTEM_PROMPT)仍由前端注入以便迭代;未配对抛 `FLOATING_CHAT_UNCONFIGURED_MESSAGE`(引导启动/配对 Companion);新增 `isBuiltinChatAvailable()`
- [x] C4. `floatingChatStore.ts`:适配新签名(persona + signal 参数);abort 时保留已流出的部分内容且不显示错误横幅
- [x] C5. `promptSafetyRewrite.ts`:同步迁移,`isBuiltinChatAvailable()` 前置检查,失败提示与浮动助手一致
- [x] C6. 测试:companion `chat.test.ts`(8 用例:校验/清洗/上游契约)+ 前端 floatingChatService(4:companion 端点与 token、无 key/model 泄漏断言、可用性、abort signal)+ store(3,含 abort 保留部分内容)+ promptSafetyRewrite 适配
- [x] C7. 验证:前端 typecheck ✓ / companion typecheck ✓ / 前端 302 用例 ✓ / companion 29 用例 ✓ / build ✓

部署注意:Companion 需以 `NVIDIA_API_KEY=<key> gpt-image-studio start`(或 serve)方式启动;未设置该环境变量时,图片配对功能不受影响,仅内置聊天/安全改写返回 503 引导文案。

## 全部任务已完成 ✅(第二轮 + 第三轮)

---

## 第四轮:线上部署零配置内置 chat(2026-09-14,全部完成 ✅)

需求:https://image.idurspace.cn/(GitHub Pages 静态站)的访客打开链接即可使用内置 chat,key 由站点持有。

安全决策:Pages 是纯静态托管,key 不能进前端 bundle(可被任何访客提取)。方案 = 新建专用中继 Worker。

- [x] D1. `chat-relay/worker.mjs`:独立 Cloudflare Worker(不动带密码门的 unlimited)。`POST /chat/completions` 持 NVIDIA_API_KEY 转发 NVIDIA(gpt-oss-20b, temperature 1 / top_p 1 / max_tokens 4096, SSE 透传);`GET /health`;Origin 白名单(image.idurspace.cn + 本地 dev);每 IP 20 次/分钟限流;消息 ≤40 条/单条 ≤24k 字符
- [x] D2. 部署:`https://chat-relay.354561650.workers.dev`(wrangler secret put NVIDIA_API_KEY + deploy,版本 513f9a22);验证 health ✓ / 恶意 origin 403 ✓ / 流式真实推理 ✓(正确回答 9.8 更大)
- [x] D3. 前端 `floatingChatService.ts` 双通道:默认走内置 relay(访客零配置);配对 Companion 仍优先(本地低延迟)。请求体只含 messages+stream,key/model 不出服务端
- [x] D4. CI 修复:serviceworker globals(chat-relay 独立运行时)+ unused imports + prettier;四步(lint/format/typecheck/test)本地全绿后 CI 通过(c895774)
- [x] D5. 线上 E2E:以全新访客(无 Companion/无 localStorage)在 https://image.idurspace.cn/ 打开助手发消息 → 流式回复符合本地人设(「我是 GPT Image Studio 的生图创作助手…」)→「插入到输入框」可用
- [x] D6. 文档:MEMORY.md 已更新

部署资产:Worker `chat-relay`(secret: NVIDIA_API_KEY);前端 relay 地址硬编码于 `floatingChatService.ts` 的 `BUILTIN_RELAY_URL`。

---

## 第五轮:剔除废弃的 unlimited 项目(2026-09-14,代码与文档部分完成)

盘点结论:
- 活代码零依赖:`src/` 内对 unlimited Worker 的引用只剩 imageAssistantPrompt.ts 的一句历史注释;聊天链路已由 chat-relay 接替
- 待清理资产:① Cloudflare Worker `unlimited`(仍在运行,持 NVIDIA_API_KEY secret)② 本地 `Desktop/Grok/unlimited-ai-main`(276KB diverged zip)③ GitHub fork `BoosaIDonng/unlimited-ai` ④ 文档残留

清理执行状态:
- [x] E1. `imageAssistantPrompt.ts` 头注释更新(不再提 builtin persona 依赖)
- [x] E2. MEMORY.md 归档历史记录(标注 deprecated,保留排坑经验)
- [ ] E3. Cloudflare Worker `unlimited` 删除 —— ⚠️ 不可逆,等用户确认后执行:`npx wrangler delete --name unlimited`
- [ ] E4. 本地目录删除 —— ⚠️ 等用户确认后执行
- [ ] E5. GitHub fork 仓库删除 —— ⚠️ 等用户确认后执行:`gh repo delete BoosaIDonng/unlimited-ai --yes`
- [x] E3. Cloudflare Worker `unlimited` 已删除(2026-09-14,用户授权;secret 随 Worker 一并销毁;域名返回 404,chat-relay health 正常)。剩余待定:E4 本地目录 `Desktop\Grok\unlimited-ai-main`、E5 GitHub fork `BoosaIDonng/unlimited-ai`(用户未授权,保留)。
