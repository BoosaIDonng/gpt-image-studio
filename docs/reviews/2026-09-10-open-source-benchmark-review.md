# 开源对标总结：画布类与 Agent 类项目能给我们什么

> 版本：v2 · 2026-09-10 修订（v1 同路径，本次为结构对齐与细节补强，结论与建议未变）
> 定位：本项目对外部开源生态的调研基线，供选型与排期引用。

## 0. 文档定位

### 0.1 调研目标

回答三个问题，并给出可直接排期的结论：

1. 本项目在同赛道的开源项目里处于什么位置（强在哪、短板在哪）？
2. 哪些开源实现值得直接借鉴，哪些只能学架构不能抄代码？
3. 上游 `honlnk/gpt-image-studio` 已经领先了哪些能力，如何低成本取回？

### 0.2 适用范围

**范围内**：画布类项目（GenCanvas / Drift / open-canvas / Excalidraw / tldraw / ComfyUI）、Agent UI 项目（CopilotKit / assistant-ui / Open Generative UI / Tambo / AG-UI）、上游 `upstream/main` 的提交差异。

**范围外（已确认为非目标）**：平台化方向——Tauri 桌面壳、PWA、MCP 导出、外部 agent 驱动。原 P2 清单据此作废。

**配套文档**：功能层的准确度 / 速度 / 工作流落地结论见 `2026-09-10-functional-optimization-review.md`；本文是它的选型依据。

### 0.3 阅读方式

| 你关心什么 | 读哪一节 |
|---|---|
| 直接看结论 | §1 |
| 我们现在是什么形态 | §2 |
| 白捡的收益 | §3 上游差距 |
| 具体借鉴哪个项目 | §4 画布类 + §5 Agent 侧 |
| 排期 | §6 建议清单 |
| 能不能抄代码 | §7 许可证 |

## 1. 结论摘要

1. **本项目在产品形态上属于"聊天流式图片工作台"，已经跑在同类开源项目前面**：多供应商（OpenAI / Grok / Gemini）、提示词模式 + 词库 + 防改写、本地 RAG 匹配栏、浮窗 AI 助手、遮罩编辑、生成任务队列、IndexedDB 双通道存储、本地 Companion 凭据代理。这些组合在同类开源仓库里很少同时出现。
2. **最直接的收益不在"抄新功能"，而在补齐三个地基**：统一命令栈（Undo/Redo）、会话/图片的版本快照、AI 助手从"prompt 拼接"升级为"工具调用"。这三件事做完，后面接画布、接 Agent 都是顺势而为。
3. **上游 honlnk/gpt-image-studio 已经领先了 4 块功能**（本地行为日志、Tauri 桌面壳、About 面板、聊天空状态），可以低成本 cherry-pick。
4. **如果要做"画布"，唯一值得参考的实现是 GenCanvas**：技术栈几乎一样（Vite + IndexedDB + Tailwind），而且已经把图层、分组、minimap、LOD 缩略图、可取消任务这些坑踩完了，MIT 许可。
5. **Agent 侧的正确架构在 Kumanga 和 CopilotKit 里**：Agent 不直接写数据库，而是走"和手动 UI 完全相同的命令"，包在一个事务里，一次 Undo 回滚整轮。现在的浮窗助手是"把上下文拼成一条 user message"，属于 prompt 拼接，不是 agent。
6. 许可证提醒：**tldraw 不是 MIT**（source-available，生产环境嵌入需要付费 license）；Excalidraw、GenCanvas、Drift、open-canvas、Kumanga 都是 MIT，可直接借鉴。

## 2. 项目现状盘点（事实）

| 维度 | 现状 |
|------|------|
| 技术栈 | Vue 3.5 + TS 6 + Vite 8 + Pinia 3，Tailwind v4（无 config 文件），零重型运行时依赖（仅 pinia、vue、focus-trap-vue） |
| 代码规模 | `src/` 约 25.6k 行；components 9.9k、services 8.5k、stores 3.7k、features 1.5k、app 1.2k |
| 界面形态 | 左会话侧边栏 + 中聊天流 + 右图片库 + 底部 composer（正在做响应式重构） |
| 存储 | 双通道：轻量草稿走 localStorage，会话/消息/图片元数据/Blob/设置走 IndexedDB；Blob 与元数据分表，`blobKey` 关联 |
| 生成链路 | `ImageClient` 接口 → `directImagesClient`（浏览器直连）/ `localCompanionImagesClient`（本地 companion）；按供应商适配请求格式 |
| 供应商 | OpenAI（`gpt-image-2`）、Grok（`grok-imagine-image-quality`）、Gemini（`gemini-3.1-flash-image-preview`） |
| 提示词 | 四档模式（默认/安全/创意/开放）+ 词库注入 + 防改写前缀；聊天记录保留原始 prompt，只改请求文本 |
| RAG | 纯前端字面量检索：`cosineSimilarity` + `tokenCoverageScore` + `exactTextScore` 取最大值，四类来源加权（wordbank 1.35 / favorite 1.15 / image 1.0 / history 0.9） |
| AI 助手 | 浮窗，把"当前输入/会话/引用图/生成参数/RAG 命中"拼成一条 user 消息发给 chat 模型 |
| 生成任务 | `generationStore` 管理 job 生命周期，已有 `AbortController` + `cancelMessageGeneration` 取消能力 |
| 主研发中 | UI redesign 未提交 48 个文件（+1172 / −1094）：token 化、Button/Switch 原语、280/360 响应式面板、SettingsModal 改 provide/inject |

**当前明显的空缺**（已在代码里确认）：

- 没有 Undo/Redo：`EditMaskModal` 内部有撤销，但**跨功能的全局命令栈不存在**。
- 没有图片懒加载/虚拟化：全项目搜不到 `IntersectionObserver`，也没有缩略图分级；图库上千张必然掉帧。
- 没有 Web Worker：唯一的重活（ZIP 打包、图片尺寸读取）都在主线程。
- 没有版本历史：`Message` / `ImageAsset` 没有 version 字段，无法回退到上一版 prompt 或上一次生成。
- API key 明文落 IndexedDB。
- 没有图片并排对比功能。
- AI 助手无工具调用、无结构化输出。

## 3. 上游差距（最省力的收益）

`upstream/main` 领先本地 9 个提交，含 4 块本地没有的能力：

| 上游提交 | 内容 | 对我们的价值 |
|---|---|---|
| `707f0cb` / `db7faaa` / `2c7e69e` | 本地行为日志 V1.0 → V1.2（事件、高频事件、ZIP 导出、颜色标签事件、会话分片） | `docs/analytics-event-logging-plan.md` 已有计划，上游有实现可对照，本地零成本补齐 |
| `8472de4` | Tauri v2 桌面壳（macOS 打包） | `docs/roadmap.md` 里"后置：Tauri/Electron 桌面端评估"可以直接推进 |
| `eea81b1` / `868524d` | About 面板 + 实时 GitHub stars + 聊天空状态 | UI 层面的低风险补充 |
| `1bf233f` | 聊天工作区头部"桌面端下载"按钮 | 与 Tauri 一起做 |

另外注意：上游 `c7f39b9` 与本地 `8786b8f` 是**同一个 bug 的独立修复**（`response_format` 导致严格网关 400）。说明这是该 API 生态的普遍坑，值得在 `docs/` 里记一条 ADR 或迁移说明，避免以后回退。

**建议做法**：用 `git cherry-pick` 逐块摘，不要 merge。理由是本地上层已经改了 UI 和状态层（48 个文件未提交），merge 的冲突面会远大于 cherry-pick。

## 4. 画布类开源项目对标

### 4.1 GenCanvas（gupsammy/gencanvas，MIT）— 最值得抄的一个

AI 媒体生成的无限画布，React 19 + Vite + IndexedDB + Tailwind，和我们的栈几乎是镜像。

| 它有的 | 我们缺的启发 |
|---|---|
| 图层系统：分组、z-order、拖拽重排、等比缩放 | 图库目前只有"网格 + 列表"两态，没有空间关系 |
| Minimap 导航 + LOD（分级）缩略图 | 我们连 `IntersectionObserver` 都没有；**LOD 思路可以直接先用在图库上**（小图用低清，点开才取原图） |
| 可取消的生成任务 + 进度追踪 | 我们已有取消，缺"进度条 + 队列视图" |
| Undo/Redo（Ctrl+Z / Ctrl+Shift+Z） | 完全没有，见 §6 P0 |
| 任意生成结果可作为下一轮输入 | 我们已有"设为引用图"，但只支持单条路径，没有"从画布任意节点出发" |
| IndexedDB 持久化整个画布状态 | 我们有持久化，但持久化的是"消息列表"，不是"画布文档" |

**结论**：如果要做画布，不要重写现有聊天流，而是**新增一个 canvas 视图**，把会话里的图片资产当作画布上的卡片。数据结构上，`ImageAsset` 已经是"带 prompt / 参数 / 来源 / 引用关系"的节点，加 `x/y/z/groupId` 就能直接铺到画布上，改动面很小。

### 4.2 Drift（CodeDreamer06/Drift，MIT）— 图库体验补充

本地优先的图片工作台（Next.js + IndexedDB）。可直接借的点：

- **双图并排对比**（我们完全没有）
- **Negative prompt、temperature** 参数维度
- **多 API key + 每个 key 的用量统计**（我们只有一个 key 字段）
- 独立收藏页（`/favorites`）；我们已有收藏**提示词**，但没有收藏**图片**

### 4.3 OPENLLMPIX（nicremo）— 安全与"Chat Studio"

- **API key 用 WebCrypto AES-GCM 加密后再存浏览器**。我们现在明文存 IndexedDB，这是本项目最大的安全短板，而实现成本很低（`crypto.subtle` 即可，无需依赖）。
- "Chat Studio"：多轮对话式改图，最多 4 张参考图作为上下文。我们的编辑是单轮 + 引用图，可以对齐成"多轮迭代 + 参考图池"。

### 4.4 Kumanga（BotTony329/mangaharness，MIT）— Agent 与画布的正确架构 ⭐

本地优先漫画工作台，有两个模式非常关键：

1. **结构化资产做一致性**：角色 = poses × expressions 的集合，适配器是 reference-image aware 的，从已有资产生成新姿态，而不是重新掷骰子；换景别（全/中/近）走裁剪，不重新生成。
   → 对我们的启发：把"提示词 + 参考图 + 参数"沉淀成可复用的**创作资产（角色 / 风格 / 构图）**，而不是每次从 prompt 重来。我们其实已经有 `GenerationRecipe` 类型，只是没有把它产品化成"可复用资产"。
2. **Agent 走和手动 UI 完全相同的编辑器命令，并且包在一个事务里**：一次 Undo 就能回滚整轮 Agent 输出，回滚后所有内容仍可手工编辑。
   → 这是 Agent + 画布的正确架构。**Agent 绝不能直接写 IndexedDB**，必须先有命令层。

### 4.5 langchain-ai/open-canvas（MIT）— 双栏与 artifact 版本

| 它有的 | 对我们的启发 |
|---|---|
| 双栏：左聊天 + 右 artifact 编辑器 | 把"生成结果"当成一等公民 artifact，而不是消息里的图片 |
| **Artifact 版本历史**（可回退到任意历史版本） | `Message` / `ImageAsset` 加 version 链，或单独建 `snapshots` 表 |
| **Memory**（reflection agent 把风格偏好、用户洞察存进共享 memory store） | 我们的 `favoritePrompts` 只是静态列表，没有"自动沉淀偏好" |
| **Quick Actions**（用户自定义 prompt，一键作用于当前 artifact） | 我们已有收藏提示词，差"一键作用在当前图上"这个动作 |
| 选中文本 → 局部改写（`selectedBlocks`） | 对应我们的遮罩编辑，但它是文本域，可以借交互模型 |
| Web Worker 处理流式响应 | 见 P0-4 |
| 强化的错误状态（`artifactUpdateFailed`、`isArtifactSaved`、`failedToGetArtifactVersions`） | 我们的失败态只在 message 级，artifact 级状态缺失 |

### 4.6 引擎层：tldraw vs Excalidraw

| | Excalidraw | tldraw |
|---|---|---|
| 许可证 | **MIT**（可商用、可 fork） | source-available，**生产嵌入需付费 license** |
| 架构 | Canvas 渲染 + 协作层（E2EE） | signal-based reactive store + schema-driven record store，视口动画与输入处理统一 API |
| AI | Mermaid → 图（转换库也开源） | Make Real：草图 → 可运行网页（BYO key） |

**结论**：如果未来要嵌画布引擎，选 Excalidraw 系或自研；tldraw 的架构（signal + schema store）可以学，但代码不能直接拿来商用。

### 4.7 ComfyUI 系（节点图）

节点图和我们不在一个赛道（面向开发者的可编程引擎 vs 面向创作者的画板），但有一个概念值得抄：**只重算受影响的 branch，中间结果带缓存**。
→ 对应我们：`GenerationRecipe` 已经记录了完整生成条件，可以做"改一个参数，只重跑受影响的那一条链"，而不是重开一条会话。

## 5. Agent 侧对标

### 5.1 我们现在的位置

`buildFloatingChatProjectContext()` 把「当前输入 / 当前会话标题 / 最近 6 条消息 / 当前引用图（最多 4 张）/ 生成参数 / RAG 命中」拼成**一条 `role: "user"` 的消息**发给 chat 模型，并做了脱敏（key、blob url、base64）。

这属于 **prompt 拼接 / RAG-in-prompt**，不是 Agent。局限：只能"说"，不能"做"；上下文长度受限；模型无法主动查更多数据。

### 5.2 行业做法

| 项目 | 模式 | 关键点 |
|---|---|---|
| **CopilotKit generative-ui** | 三种模式：controlled（预置组件，agent 只选组件 + 填参）/ declarative（A2UI、Open-JSON-UI 结构化 spec）/ open-ended（MCP Apps，sandboxed iframe 跑生成内容） | 用 `MCPAppsMiddleware` 把 Excalidraw MCP 接进来，agent 调 `create_view` 返回元素数组，前端直接渲染成**可编辑画布** |
| **assistant-ui** | tool result → 组件映射 | 按工具名注册渲染器；带 human-in-the-loop 的 inline Approve/Deny |
| **Open Generative UI** | Skills 渐进式披露 + 强制工作流 | SKILL.md 按需加载（不塞满 system prompt）；强制"先 `plan_visualization` → 再渲染 → 再叙述"；并对外暴露 MCP server |
| **Tambo** | per-prop 流式渲染 | 组件 props 边生成边渲染，避免空白等待 |
| **AG-UI** | 双向通信层 | agent 与前端实时同步状态 |

### 5.3 对我们的落地方案

三步，按依赖顺序：

1. **先建命令层**（P0-2）。把生成、重试、取消、设为引用图、打标签、删除、mask 提交都收敛成命令对象，带逆操作。
2. **再把 AI 助手改成工具调用**。工具集建议：`read_active_conversation`、`read_image_metadata`、`update_prompt`、`start_generation`、`search_prompt_library`、`tag_image`、`compare_images`。
3. **最后加人类确认**。破坏性工具（发起生成消耗额度、批量删除）走 inline 确认，对齐 assistant-ui 的 HITL 模式。
4. 可选：把工具集导出成 **MCP server**，这样 Claude / Cursor 也能直接驱动这个工作台（对齐 CopilotKit / Open Generative UI 的做法，也是本季度开源项目的明显风向）。

## 6. 建议清单

### P0 — 低成本、高收益（建议本迭代做）

| # | 事项 | 依据 | 备注 |
|---|---|---|---|
| 1 | 对齐上游本地行为日志（V1.0→V1.2） | `docs/analytics-event-logging-plan.md` 已有计划，上游有实现 | 建议 cherry-pick |
| 2 | **建立统一命令栈 + 全局 Undo/Redo** | Kumanga 的核心模式；`EditMaskModal` 已有局部撤销可抽取 | 这是后面接 agent 的地基，优先级最高 |
| 3 | 生成任务加进度 + 队列视图 | GenCanvas 的可取消任务 + 进度 | 取消能力已有，只差 UI |
| 4 | 图库 LOD + 懒加载 | GenCanvas 的 LOD 缩略图；本地无 `IntersectionObserver` | 先落到图库，后续画布直接复用 |
| 5 | API key 用 WebCrypto AES-GCM 加密后落库 | OPENLLMPIX | 无新依赖，纯浏览器 API |
| 6 | 双图并排对比 | Drift | 图库多选已有，加一个对比弹窗即可 |

### P1 — 结构型重构（明确值得做，但要排期）

| # | 事项 | 依据 |
|---|---|---|
| 7 | **新增画布视图**（不重写聊天流），`ImageAsset` 加 `x/y/z/groupId` | GenCanvas |
| 8 | **Artifact 版本历史**：prompt / 参数 / 结果做 version 快照，可回退 | open-canvas |
| 9 | **AI 助手改工具调用 + HITL** | CopilotKit / assistant-ui |
| 10 | RAG 双通道：保留现有字面量通道，增加可选语义通道 | 现状只有字面量，语义靠词库举 |
| 11 | 把 `GenerationRecipe` 产品化为"可复用创作资产"（角色/风格/构图），支持一致性复用 | Kumanga 的 poses × expressions |
| 12 | Tool result → 组件注册表（生成结果、RAG 命中、错误卡统一走渲染器映射） | assistant-ui |
| 13 | 参考图池 + 多轮迭代编辑（现在编辑是单轮） | OPENLLMPIX Chat Studio |
| 14 | 关键重活移入 Web Worker（ZIP、图片解码、RAG 打分） | open-canvas |

### P2 — 平台化（不属于本次范围）

已确认不做 Tauri 桌面壳、PWA、MCP 导出、外部 agent 驱动。画布视图保留在 P1-7，但它属于功能层，
详细的功能层结论见 `2026-09-10-functional-optimization-review.md`。

## 7. 许可证与合规提醒

- **可直接借鉴（MIT）**：Excalidraw、GenCanvas、Drift、open-canvas、Kumanga（需保留 `NOTICE.md` 归属）、本项目自身（MIT，已标注 fork 来源）。
- **不可直接商用**：tldraw SDK 是 source-available，生产环境嵌入需要 license。学架构可以，抄代码不行。
- **GPL 系**：ComfyUI 是 GPL-3.0，仅作概念参考，不要复制代码进 MIT 项目。

## 8. 一句话总结

本项目在**功能广度**上已经超过绝大多数同类开源仓库；差距集中在**工程地基**（命令栈、版本历史、Worker、懒加载、密钥加密）和**Agent 化程度**（从 prompt 拼接升级到工具调用）。建议顺序：先补地基（P0）→ 再做画布与版本历史（P1）。平台化不做。

## 9. 主要调整说明（相对 v1）

本次为结构对齐与细节补强，**所有对标结论、借鉴项与优先级均未改变**：

| # | 调整 | 原因 |
|---|---|---|
| 1 | 新增 §0「文档定位」，含**调研目标 / 适用范围 / 阅读方式** | v1 只在文首写「范围」，缺少明确目标；对齐  契约式写法 |
| 2 | 章节编号由「一、二、三…」改为「1、2、3…」 | 与功能层文档统一编号风格，便于两边交叉引用 |
| 3 | 修正交叉引用「见第五节 P0」→「见 §6 P0」 | 编号变更后原引用会失效 |
| 4 | 新增 §9 本节（调整说明） | 便于对照 v1 审阅 |
| 5 | 平台化的 P2 清单保持作废状态，并在 §0.2 显式声明为非目标 | 保留 v1 的决策结论，只把说明从正文括号上提到范围声明中 |

**未改动**：§1 结论摘要、§2 现状盘点、§3 上游差距、§4 画布类对标、§5 Agent 侧对标、§6 建议清单、§7 许可证提醒，内容按 v1 保留。

