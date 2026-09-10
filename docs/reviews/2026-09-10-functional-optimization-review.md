# 功能层优化方案：准确度 / 速度 / 工作流

> 版本：v2 · 2026-09-10 修订（v1 同路径，本次为结构对齐与细节补强，结论与建议未变）
> 定位：本项目的功能层优化契约，供排期与验收使用。
> 所有结论都带 `文件:行号`，可直接跳转核对。

> **落地状态（2026-09-10 晚）**：本方案的「改造类」条目已全部实现并通过
> `pnpm typecheck` / `pnpm test`（260 用例）/ `pnpm lint` / `pnpm build` 四项验证：
> - **速度**：S1（迁移版本标记 + 启动只读元数据）、S2、S3、S4、S5（Worker 解码 + 流式节流）、S6、S7（ETA + 能力表开关）、S8（`v-image-preview` 视口懒加载指令）。
> - **准确度**：A1（`imageCapabilityRegistry.ts` 数据驱动能力表）、A2（RAG 分隔块 + 分 provider 防改写后缀）、A3（`generationValidation.ts` 四类偏差 + 结果卡标黄 + 改写重跑）、A4（`isSafeToAutoRetry` 分类，中断不再自动重发）、A5（并发闸门 = 3）。
> - **工作流**：W1（`commandStore` + `useGlobalUndoRedo`：重命名 / 打标签 / 删除图片（含批量）/ 删除消息，Ctrl+Z / Shift+Z）、W5（中文 2-gram + 同义词表 + 召回评估集）、W7（`wordbankWeights` 个人词库持久化 + 检索加权）。
> - **W1 范围说明**：生成/重试的撤销因「前态是进行中的请求、无法有意义还原」而未自动注册命令（文档原建议中的 6 操作按此口径收敛为 4 类）；「应用参数」入口在当前代码中不存在。
> - **净新增功能**（W2 版本历史 / W3 Recipe 预设 / W4 对比视图 / W6 助手工具化 / W8 错误卡动作）不属于本次改造范围，仍按 §6 的「下个迭代 / 之后」排期。

## 0. 文档定位

### 0.1 优化目标

本方案只解决三件事，每件都有明确判据：

| # | 目标 | 一句话表述 |
|---|---|---|
| 1 | **准确度可判断** | 让「包装提示词 / RAG 注入 / 参数选择」到底有没有用，变成可测量的结论，而不是手感 |
| 2 | **速度可解耦** | 消除同一批数据的重复读取和渲染路径上的 O(n²) / 线性扫描，让启动时间与图库规模脱钩 |
| 3 | **工作流可回退、可沉淀** | 让操作能撤销、能回到历史版本，让参数与词库能复用，而不是每次从零重设 |

### 0.2 适用范围

**范围内**：`src/` 下的提示词构建、图像请求、生成队列、存储与启动水合、图库渲染、RAG 检索、浮窗助手。

**范围外（明确不做）**：

- 平台化：Tauri 桌面壳 / PWA / MCP 导出 / 外部 agent 驱动。
- 画布形态重构（属功能层，另见对标文档 P1-7）。
- `companion/` 本地服务的协议与实现。
- UI 视觉改版——已由 `docs/plans/2026-09-09-ui-redesign-implementation.md` 覆盖，本文不重复。

**依据来源**：GitHub 同类开源项目对标见 `docs/reviews/2026-09-10-open-source-benchmark-review.md`。本文是对标结论在功能层的落地版本。

### 0.3 阅读方式

| 你关心什么 | 读哪一节 |
|---|---|
| 先做什么 | §1 摘要 + §6 落地顺序 |
| 问题是否成立 | §3 / §4 / §5 的 `文件:行号` |
| 怎么算做完了 | §2 验收标准 + §7 风险 |
| 这一版改了什么 | §8 主要调整说明 |

---

## 1. 结论摘要

按「改一处、收益最大」排序，前五项是：

| 优先级 | 问题 | 位置 | 影响面 | 改动量 |
|---|---|---|---|---|
| P0-1 | 消息列表每次渲染 O(n²)：每条消息都复制 + 倒序扫描整个数组 | `MessageList.vue:42-54` | 大（会话越长越卡） | 小 |
| P0-2 | 启动一次把同一批数据完整读 4 遍，并加载**全部**图片 Blob | `useStudioRestore.ts:33-79` | 大（图越多启动越慢） | 中 |
| P0-3 | 图片查找全是线性扫描，且在渲染路径上反复调用 | `imagesStore.ts:55-57` | 大 | 小 |
| P0-4 | 模型能力靠硬编码模型名判断，同一条规则写在两个文件里 | `imageApiRequest.ts:69` + `imageCapabilities.ts:11` | 中（新模型必踩） | 小 |
| P0-5 | 生成结果不做任何校验，接口改写了 prompt 也不告诉用户 | `generationStore.ts:523-565` | 中（准确度闭环缺失） | 小 |

三个方向各一句话：

- **准确度**：不是「包装得不够用力」，而是**没有度量**。目前没有任何机制能回答「加了模式说明和 RAG 之后，出图是不是更贴合原意了」。
- **速度**：瓶颈不在网络，在**同一批数据被反复全量读取**和**渲染路径上的 O(n²)**。
- **工作流**：缺的不是新功能，是**可回退**（Undo / 版本）和**可沉淀**（参数 / RAG 词库的复用闭环）。

---

## 2. 优化目标与验收标准

用这张表判断「做完了没有」，避免改动变成主观判断。

| 目标 | 现状 | 达标判据 | 度量方式 |
|---|---|---|---|
| 准确度：效果可判断 | 无任何对照，改包装只能靠手感 | 同一 prompt + 同 seed 能跑出「有包装 / 无包装」两组并可比较 | 固定评分（人工盲评或模型打分）形成基线后回归 |
| 准确度：偏差可见 | `revisedPrompt` 已存但不展示 | 数量 / 尺寸 / 透明 / 改写四类偏差在结果卡片上可见 | 代码走查 + 手工构造偏差用例 |
| 准确度：能力判断统一 | 同一规则散落 3 处 | 新增模型只需改一处声明；未知模型走保守默认 | 新增一个模型，不改两处以上代码 |
| 速度：启动 | 同批数据读 4 遍 + 全量图片 Blob | 启动只读一次元数据；预览图进视口才加载 | 用 500 / 2000 张图的会话测首屏时间 |
| 速度：渲染 | `MessageList` O(n²)、图片线性扫描 | 单次渲染 O(n)、查找 O(1) | 200 条消息会话的渲染耗时对比 |
| 速度：并发 | 全量并发打同一上游 → 429 → 退避更慢 | 并发有闸门，队列状态可见 | 8 张图并发时的总耗时对比 |
| 工作流：可回退 | 仅 `EditMaskModal` 内部有撤销 | 6 个高频操作可 `Ctrl/Cmd+Z` 回退 | 逐操作手工验证 + 单测 |
| 工作流：可沉淀 | 词库命中只存内存 | 成功图能回写词库权重，并被后续检索复用 | 生成 → 检索闭环用例 |

---

## 3. 准确度

### A1. 模型能力判断靠硬编码模型名，新增模型必然出错

**问题**：同一条规则（`gpt-image-2` 不支持透明背景）在多个文件各写了一遍，改一处必然漏另一处。

**证据**：

```ts
// src/services/imageApiRequest.ts:69
if (apiMode === "images" && model === "gpt-image-2" && background === "transparent") {
  throw new Error("gpt-image-2 当前不支持透明背景，请选择自动或不透明背景。");
}

// src/services/imageCapabilities.ts:11
transparentBackground: openai && !(apiMode === "images" && model === "gpt-image-2"),
```

第三种判断方式在 `src/shared/models.ts:7`：

```ts
export function isGptImageModel(model: string): boolean {
  return /^gpt-image-\d/i.test(model.trim());
}
```

**为什么会出错**：

- 规则已重复且分散（同一条件写在两个文件），维护时遗漏是必然的。
- `imageCapabilities.ts:4` 的粒度是 `openai → 全支持`，太粗。同一个 provider 下，不同 `apiMode` / 不同模型的能力矩阵并不一样。
- 正则 `^gpt-image-\d` 遇到 `gpt-image-2-turbo`、`gpt-image-preview` 这类命名会猜错。

**建议**：建一个数据驱动的 capability registry，一处声明、多处消费，未知模型走**保守默认 + 明确提示**。

```ts
type Capability = {
  supportsBackground: boolean;
  supportsTransparent: boolean;
  supportsCustomSize: boolean;
  supportsOutputFormat: boolean;
  supportsQuality: boolean;
  supportsBatch: boolean;
  supportsStreaming: boolean;
};
declareCapability({ apiMode: "images", model: /^gpt-image-/i }, { supportsTransparent: false, ... });
```

顺带把 `ApiSettingsPanel` 的禁用逻辑（`streamImages && apiProvider === 'openai'`，见 S7）也改成读同一份能力表。

**验收**：新增一个模型时，只需在 registry 改一处；未声明的模型走保守默认并给出提示。

### A2. 请求 prompt 是一个大文本块，没有结构化分层

**问题**：`promptRequest.ts:29-45` 把所有控制指令和内容拼成一段文本，导致来源混淆、语种混杂、无 role 分层。

**证据**：最终请求文本的结构如下。

```
[防改写前缀，英文]
[模式说明 + 灵感词 + 用户原始提示词：]
[RAG 参考内容：1. xxx 2. xxx ...]
[用户原始提示词：]
[用户输入]
```

**四个具体问题**：

1. **RAG 和用户原始 prompt 挤在同一个 blob 里**（`promptRequest.ts:30-32`），只靠一句「以用户原始提示词为准」来约束，模型混用两个来源的风险很高。
2. **防改写前缀是英文、主体是中文**（`promptRequest.ts:14-15`：`"Use the following text as the complete prompt. Do not rewrite it:"`）。混合语种会削弱指令遵循，在非 OpenAI 模型上尤其明显。
3. **没有 system / user 分层**。API 本身支持消息结构，现在却把所有控制指令与内容压进一段文本。
4. **包装措辞对所有 provider 一视同仁**，但 Grok / Gemini 的指令遵循习惯明显不同。

**建议**：

- 分层：控制指令（模式说明、防改写约束、RAG 使用约束）进 `system`，用户原始 prompt 单独一条 `user` 消息。
- 每个 provider 单独适配包装措辞与长度——`imageClients/` 已经按 provider 拆了，包装层也应该拆。
- **给「包装是否有效」建可测量的对照**：同一 prompt + 同 seed 跑「有包装 / 无包装」两组，用固定评分形成基线。现在这套逻辑完全靠手感，改一次只能靠感觉判断好坏。

**验收**：请求体出现 system / user 分层；能产出「有包装 vs 无包装」的对照数据并给出胜负结论。

### A3. 生成结果不做任何校验，`revisedPrompt` 存了但没用

**问题**：`buildGeneratedImageAsset`（`generationStore.ts:523-565`）拿到返回后直接入库，不验证任何一项请求条件。

**证据**：以下偏差全部静默通过。

- 请求 4 张，返回 2 张 → 不提示
- 请求 `1024x1536`，返回 `1024x1024` → 不提示
- 请求 `transparent`，返回不透明 → 不提示
- 接口改写了 prompt（`revisedPrompt` ≠ `requestPrompt`）→ **不提示用户**

**影响**：最后一条最要紧——用户在聊天记录里看到的是自己写的 prompt，但实际出图用的是被接口改写过的版本，两者不一致却完全不可见。

**好消息**：所需字段全都已经存在——`ImageAsset.width / height / sizeBytes / requestPrompt / revisedPrompt / generationRecipe`（`types/studio.ts:47-72`），**不需要改数据结构就能做**。

**建议**：加一个结果校验层。

```ts
validateGenerationResult(job, results) → {
  countMismatch?: { requested, actual };
  sizeDeviation?: { requested, actual };
  transparentIgnored?: boolean;
  promptRewritten?: { requestPrompt, revisedPrompt };
}
```

前三条在结果卡片上标黄；`promptRewritten` 做成显式提示 + 一键「用改写后的 prompt 重跑」。这是投入产出比最高的一项准确度改进。

**验收**：构造四类偏差用例，界面上均有可见提示；`promptRewritten` 可一键重跑。

### A4. 重试可能重复扣费，且不区分「未发出」和「已发出」

**问题**：重试粒度是整个请求，无法区分请求是否已经到达上游。

**证据**：`networkRetry.ts` 本身做得不错——4 次上限、指数退避 + ±25% 抖动、支持 abort，但缺一个关键判断：

- 请求**还没发出去**就失败（DNS、连接被拒）→ 重试安全。
- 请求**已经到达上游、正在生成**，只是响应超时或连接中断 → 重试会**再生成一张**，多付一次钱，而且出图可能不同。

**建议**：按错误类型区分。连接建立阶段失败 → 自动重试；响应中断 / 超时 → 先标记为「结果未知」，让用户选择「重试（可能重复计费）」或「放弃」。`Message.networkRetryAttempt` 字段已经在，可以复用。

**验收**：响应超时场景下不再自动重发；用户可见「结果未知」状态与两个明确选项。

### A5. 并发无上限，反而把整体耗时拉长

**问题**：所有任务同时打同一个上游，触发限流后退避，总耗时比串行还长。

**证据**：

```ts
// src/stores/generationStore.ts:809
await Promise.all(createdJobs.map((job) => runImageRequest(job, controller.signal)));
```

`imageCount` 预设可以到 8+，全部同时发出 → 触发 429 → 进入退避（2s / 4s / 8s / 16s）→ 总耗时反而超过串行，而且退避期间界面只有「已重试 N 次」。

**建议**：加并发闸门，默认 2–3 路；队列状态可见（第 3/8 张生成中）；按 provider 配不同上限。`GenerationJob` 概念已经存在，加一个调度器即可。

**验收**：8 张图并发时总耗时不超过串行；界面可见队列进度。

---

## 4. 速度

### S1. 启动把同一批数据完整读 4 遍，并加载全部图片 Blob（最严重）

**问题**：同一个启动流程里，同一批数据被完整读取 4 次；N 张图意味着启动即 N 次 Blob 读 + N 个常驻内存的对象 URL。

**证据**：启动路径 `useStudioRestore.ts:33-79`。

| 步骤 | 代码位置 | 代价 |
|---|---|---|
| 1. 时间字段迁移 | `timeFieldMigration.ts:20-24` | 全量读 conversations + messages + imageAssets |
| 2. 真正的水合 | `useStudioRestore.ts:38` | 再一次全量读 conversations + messages + imageAssets |
| 3. 恢复预览图 | `imagesStore.ts:246-276` | **每张图 1 次 `loadImageBlob` + 1 个 `createObjectURL`**，无并发上限 |
| 4. 统计存储用量 | `storageUsage.ts:20-24` | 又全量读 conversations + messages + imageAssets + settings + drafts |

第 3 步在宽高缺失时还会额外 `readImageDimensions` 并回写；第 1 步的迁移在**每次启动**都跑（`timeFieldMigration.ts:32` 只在「没东西可迁移」时提前返回，读取开销照样付）。

**建议**：

- 迁移改成版本标记：settings 里存 `migrationVersion`，已迁移就完全跳过读取。
- 启动只读元数据；预览图**进视口再加载**（`IntersectionObserver`）。
- **生成时顺手存一张缩略图**（256px webp），列表和网格用缩略图，点开大图才取原图。这一条同时解决 S8。
- `refreshStorageUsage` 复用已经读到的内存数据，不再独立 `getAll`。

**验收**：2000 张图的会话，启动 Blob 读取次数为 O(视口内图片数) 而非 O(总数)；首屏时间与图库规模无关。

### S2. 消息列表 O(n²)：每条消息都复制 + 倒序扫描整个数组

**问题**：`sourcePromptFor` 在模板里对每条消息调用一次，每次复制整个数组再全量扫描。

**证据**：

```vue
<!-- src/components/chat/MessageList.vue:42-54 -->
function sourcePromptFor(message: Message) {
  if (message.role !== "assistant") return "";
  return (
    [...props.messages]                                  // ← 每个消息一次全数组复制
      .reverse()
      .find((item) => ...)                               // ← 再全量扫描
      ?.content ?? ""
  );
}
```

模板里对**每条消息**调用一次（`MessageList.vue:77`），所以一次渲染是 O(n²)，且每次都新建数组。

**影响**：触发条件很宽松——生成过程中每条消息状态更新、`useNow` 每 30s 的 tick、滚动导致的重渲染，都会重跑。200 条消息的会话 → 单次渲染约 200 次数组复制 × 200 元素。

**建议**：改成一次 computed 建前置索引，O(n) 建一次、O(1) 查询。

```ts
const sourcePromptById = computed(() => {
  const map = new Map<string, string>();
  // 单次遍历：为每个 assistant 消息记住最近的 user 消息内容
  ...
  return map;
});
```

**验收**：200 条消息的会话，单次渲染不再随消息数平方增长。

### S3. 图片查找全是线性扫描，且在渲染路径上

**问题**：`imageById` 是线性扫描，且在渲染路径上被反复调用，规模相乘后到十万级比较。

**证据**：

```ts
// src/stores/imagesStore.ts:55-57
function imageById(id: string) {
  return imageAssets.value.find((image) => image.id === id);
}
```

两处放大：

- `activeAttachments`（`imagesStore.ts:33-37`）每次计算都对每个附件做一次 `find` → O(m×n)。
- `MessageList.vue:74` 把 `imageById` 作为函数传给**每个** `MessageItem`，每张图渲染一次扫描。

1000 张图 + 一个 50 条消息的会话，轻松到十万级比较。

**建议**：维护 `Map<id, ImageAsset>` 索引（变更时重建，O(n)），`imageById` 变 O(1)。

**验收**：`imageById` 复杂度为 O(1)；1000 张图 + 50 条消息场景下渲染无线性退化。

### S4. 改名 / 打标签会重建整个数组并改变顺序

**问题**：就地修改被写成「过滤 + 前插」，既 O(n) 复制又把该项挪到数组最前，破坏列表 diff。

**证据**：

```ts
// src/stores/imagesStore.ts:143 与 155
imageAssets.value = [image, ...imageAssets.value.filter((item) => item.id !== id)];
```

**影响**：O(n) 复制只是小事；真正的问题是这一项被**挪到了数组最前面** → 列表顺序变化 → 整个列表的 diff 失效、滚动位置可能跳动。

**建议**：就地替换（`splice`）保持顺序稳定，配合 S3 的 Map 索引。

**验收**：改名 / 打标签后列表顺序不变、滚动位置不跳动。

### S5. 主线程重活：base64 解码、图片解码、ZIP

**问题**：全项目 **0 处 Web Worker**，所有重活压在主线程。

**证据**：当前压在主线程上的活包括——

- `base64ToBlob`（`imagesApi.ts:419`）在**每次流式 partial 事件**都跑一遍（`generationStore.ts:415-418`）——流式时这是高频调用。
- `readImageDimensions(blob)` 对每张生成图做一次解码（`generationStore.ts:537`），4K 图很贵。
- 备份 ZIP 的 CRC32 与打包（`zipArchive.ts`）。

**建议**：Worker 承担 base64 解码 + 尺寸读取 + 缩略图生成 + ZIP。流式预览做节流：同一张图只渲染最后一帧，中间帧丢弃。

**验收**：流式生成期间主线程无长任务（>50ms）堆积。

### S6. 每完成一个 job 就重算一次存储用量

**问题**：`refreshStorageUsage` 内部是 5 次 `getAll`，却被每个 job 的成功 / 失败分支各调一次。

**证据**：

```ts
// src/stores/generationStore.ts:357、466、487
await input.value.refreshStorageUsage();
```

三处调用（含生成前一次），而 `estimateStorageUsage` 自己又是 5 次 `getAll`。4 个并发 job → 多次全量重算。

**建议**：批量结束后统一刷新一次，或做 500ms 去抖。

**验收**：一次生成（无论几张图）只触发一次存储用量重算。

### S7. 流式预览只有 OpenAI 可用

**问题**：Grok / Gemini 用户全程没有任何进度反馈，只有一个转圈。

**证据**：

```vue
<!-- src/components/settings/ApiSettingsPanel.vue:451 与 476 -->
:checked="streamImages && apiProvider === 'openai'"
:disabled="!streamImages || apiProvider !== 'openai'"
```

**影响**：感知速度差距很大——同样的等待时间，有进度条感觉快一倍。

**建议**：非流式 provider 也补「进度占位 + 已用时 + 预计剩余」。`ImageAsset.generationDurationMs` 已经在记录历史耗时，可以直接拿来算 ETA。

**验收**：Grok / Gemini 生成过程中可见进度与 ETA。

### S8. 图库无懒加载、无虚拟化

**问题**：网格一次性渲染所有图片卡片，每张都是原图。

**证据**：全项目 **0 处 `IntersectionObserver`**，也没有任何虚拟化。

**建议**：视口懒加载 + 网格虚拟化 + 缩略图（与 S1 第 3 条合并做，一次改动同时解决启动慢和滚动卡）。

**验收**：2000 张图的图库可流畅滚动，同时存在的原图对象 URL 数量受控。

---

## 5. 工作流

### W1. 没有全局 Undo/Redo（最关键）

**问题**：只有 `EditMaskModal` 内部有撤销 / 重做（16 处相关代码），其余所有操作都不可回退。

**证据**：不可回退的操作包括——重命名图片、打标签、删除图片、删除消息、重试、把参数应用到当前会话。

**影响**：这是三项里优先级最高的，原因有两个：直接体验损伤，以及**它是后面接 Agent 的地基**（Agent 必须走命令，不能直接改状态）。

**建议**：`Command { label, do(), undo() }` + 命令栈 + `Ctrl/Cmd+Z` / `Shift+Z`。第一步只覆盖 6 个高频操作：生成、重试、删除图片、打标签、重命名、应用参数。

**验收**：上述 6 个操作可逐个撤销 / 重做，且撤销后状态与操作前一致。

### W2. 没有版本历史，回不到上一版

**问题**：`Message` / `ImageAsset` 都没有 version 字段，无法回退。

**证据**：但**需要的原料已经齐了**——

- `GenerationRecipe`（`types/studio.ts:8-16`）：connectionMode / apiProvider / apiBaseUrl / apiBaseUrlMode / apiMode / model / params
- `PromptRequestSettings`（`types/studio.ts:120-126`）：promptMode / promptWordbanks / 防改写 / ragContext

也就是说，每一次生成都能完整复现，缺的只是「把历次快照串起来」。

**建议**：加 `GenerationSnapshot { prompt, recipe, promptRequestSettings, resultImageIds, createdAt }`，一条消息挂多个快照 → 可以「回到第 3 版，改一个参数重跑」，而不是重开一条会话。这也是 ComfyUI「只重算受影响分支」能落地的前提。

**验收**：可选中任一历史快照，修改一个参数后重跑，且历史版本仍可访问。

### W3. 生成参数不能沉淀成可复用资产

**问题**：`GenerationRecipe` 挂在每张图上，但没有「存为预设 / 应用到新会话 / 复制给别的会话」的入口。

**证据**：用户想复现上次那套组合，只能手动逐项再设一遍。

**建议**：Recipe 预设（命名 + 收藏 + 一键应用到当前 composer）。

**验收**：可把一张图的 recipe 存为预设并一键应用到新会话。

### W4. 没有并排对比

**问题**：图库多选能力已经具备（批量下载 / 删除），但没有对比视图。

**证据**：一次生成 4 张时，用户最需要的就是并排看细节。

**建议**：多选 ≥2 张 → 对比视图，支持同步缩放和平移。

**验收**：多选两张可进入对比视图，缩放 / 平移同步。

### W5. RAG 只有字面量通道，中文语义基本失效

**问题**：中文 tokenize 按单字切，导致中文语义召回几乎不起作用。

**证据**：`rag.ts:274-283` 的评分取三个值的 max——

```ts
return Math.max(vectorScore, coverageScore, exactScore);
```

看起来是混合策略，但 `tokenize`（`rag.ts:311-324`）对中文是**按单字切**：

```ts
const cjkChars = [...normalized].filter((char) => /\p{Script=Han}/u.test(char));
return [...tokens, ...cjkChars];
```

`normalizeToken`（`rag.ts:327-333`）又只做英文词干化。后果：中文查询被拆成孤立单字，「少女」和「女孩」零重叠。对以中文为主的词库和 prompt，语义召回几乎不起作用。

**建议**：

- 中文改用 2-gram，或接入一份轻量分词词典。
- 加同义词 / 标签归一表（「少女 = 女孩 = 妹子」这类）。
- **建一个召回评估集**：20–30 条 query 标注期望命中的文档，让 topK 和 `SOURCE_WEIGHTS`（`rag.ts:47-52`）的调参变成可回归的事，而不是凭感觉改数字。

**验收**：召回评估集上给出改造前 / 改造后的命中率对比。

### W6. AI 助手只会说不会做

**问题**：助手把上下文拼成一条 user 消息发给文本模型，能力上只能「说」。

**证据**：`buildFloatingChatProjectContext`（`floatingChatContext.ts:49-79`）把上下文拼成**一条 `role: "user"` 消息**。它做了脱敏（`safeText` 会清掉 key / blob url / base64），这部分是好的，但没有工具调用能力。

**建议**：工具化。第一批工具：读当前会话、读图片元数据、改 prompt、发起生成、查提示词库、给图片打标签。破坏性动作（发起生成、批量删除）走行内确认。

**验收**：助手能通过工具调用完成一次「读图 → 改 prompt → 发起生成」的闭环，破坏性动作有确认。

### W7. 提示词收藏与词库没有闭环

**问题**：成功生成反查出的词库命中只存在内存里，没有回写沉淀。

**证据**：

- `rag.ts:63-73` 已经会从成功图片的 prompt 里反查命中的词库词，但结果只存在于**内存里的 RAG 文档**，没有回写。
- `favoritePrompts`（`types/studio.ts:112-118`）是纯静态列表：没有使用次数、没有成功率、没有最近使用时间。

**建议**：打通「生成 → 沉淀 → 复用」：

- 成功图 → 反查命中的词库词 → 累加命中权重，形成**个人词库**。
- 收藏 prompt 记录使用次数与所用 provider / model。
- RAG 排序时把「个人命中权重」作为一路特征，对齐 `SOURCE_WEIGHTS` 的思路。

**验收**：生成后词库权重有持久化变化，且后续检索能体现该变化。

### W8. 失败信息不够可操作

**问题**：错误卡片只描述问题，不给下一步动作。

**证据**：`moderationAdvice.ts`（216 行）已经在做拒答归因，这是很好的设计。但两处不足——

- 网络重试只在消息上显示「第 N 次重试」（`updateMessageNetworkRetry`），没有说明发生了什么、还要等多久。
- 错误卡片没有**下一步动作按钮**。比如 400 参数错误，用户需要的是「切到支持该参数的模型」或「去掉 transparent」这类一键操作，而不是读一段错误文案。

**建议**：错误卡带建议动作；把 `analyzeModerationRejection` 的输出同时映射成可点击的修复项。

**验收**：至少 3 类常见错误（400 参数、429 限流、拒答）的卡片上有可点击的修复动作。

---

## 6. 落地顺序

### 立刻做（改动小、收益大、风险低）

1. **S2**：`MessageList` 的 `sourcePromptFor` 改 computed 索引 —— 会话越长收益越大。
2. **S3 + S4**：图片加 Map 索引，改名 / 打标签改为就地替换。
3. **S6**：`refreshStorageUsage` 加去抖或批量收尾刷新。
4. **A3**：结果校验 + `revisedPrompt` 显式提示 —— 不改数据结构就能上。
5. **W1 第一步**：命令栈骨架 + 6 个高频操作的 undo。

### 本迭代

6. **S1**：启动路径重构（迁移版本标记 + 预览图懒加载 + 缩略图）。缩略图一次性同时解决 S1 和 S8。
7. **A1**：capability registry，消除三处分散的模型名硬编码。
8. **A5**：并发闸门（默认 2–3）+ 队列状态可见。
9. **S5**：Worker 承担 base64 解码 / 尺寸读取 / 缩略图 / ZIP。

### 下个迭代

10. **W2**：`GenerationSnapshot` + 版本回退（原料已齐，工作量大在 UI）。
11. **W5**：RAG 中文 2-gram + 同义词表 + 召回评估集。
12. **A2**：prompt 分层（system / user）+ 分 provider 包装 + 建立「包装有效性」对照基线。
13. **W4**：并排对比。
14. **W7**：生成 → 词库沉淀闭环。

### 之后

15. **W3**：Recipe 预设。
16. **W6**：AI 助手工具化。
17. **W8**：错误卡建议动作。
18. **S7**：非 OpenAI 的进度与 ETA。

---

## 7. 验收与风险

### 验收（整体）

- §2 的每一行判据都有对应证据（耗时对比、复杂度复核、用例截图或单测）。
- 所有改动不引入新运行时依赖（当前只有 pinia、vue、focus-trap-vue）。
- `pnpm test` / `pnpm typecheck` / `pnpm build` 保持通过。
- 验证不依赖真实付费 API 请求；偏差用例用本地构造数据。

### 风险与边界

| 风险 | 说明 | 缓解 |
|---|---|---|
| 数据迁移 | S1 的 `migrationVersion` 若写错会让老用户数据「看似消失」 | 迁移只在版本号落后时执行，且失败不写版本号；先备份 |
| 预览图懒加载 | 进视口才加载会短暂出现空位 | 先落缩略图（生成时存），再改加载时机 |
| 结果校验提示 | 提示过多会变成噪音 | 仅四类偏差触发，且只在卡片上标一次 |
| 命令栈 | 撤销边界设计不当会误伤数据 | 第一步只覆盖 6 个明确操作，删除类操作先备份 |
| 并发闸门 | 闸门过低会拖长总耗时 | 默认 2–3，按 provider 可调，配合实测调整 |

---

## 8. 主要调整说明（相对 v1）

本次为结构对齐与细节补强，**所有结论、建议与优先级均未改变**。具体改动：

| # | 调整 | 原因 |
|---|---|---|
| 1 | 新增 §0「文档定位」，含**优化目标 / 适用范围 / 阅读方式** | v1 只在文首一行写了「范围」，缺少明确目标；对齐 `docs/plans/*` 契约式文档的「范围 → 边界」写法 |
| 2 | 新增 §2「优化目标与验收标准」表 | 对齐优秀文档的「验收（acceptance）」实践；让每项目标都有可判定的达标判据，避免改动变成主观评价 |
| 3 | 18 个条目统一为「问题 → 证据 → 影响 → 建议 → 验收」五段式 | v1 各条结构不一（有的先给结论、有的先贴代码），不便横向比较与排期 |
| 4 | §1 摘要表把「量级」拆成**影响面 / 改动量**两列 | 原「量级」含义模糊，无法直接用于排期 |
| 5 | 新增 §7「验收与风险」 | 对齐 `docs/plans/*` 的「Acceptance and risks」；原文档只列顺序，没写「怎么算做完」和「可能踩什么坑」 |
| 6 | 新增 §8 本节（调整说明） | 便于对照 v1 审阅，后续修订可沿用同一节 |
| 7 | 补充事实性细节：`refreshStorageUsage` 实际有 3 处调用（357 / 466 / 487）；`useStudioRestore` 水合行号为 38；`tokenize` 实际范围 311–324 | 复核代码时发现 v1 的行号范围略有偏差，已按实际修正 |
| 8 | 三条「一句话」结论上移到 §1、总结措辞保留 | 保持原有意图与核心信息，仅调整位置，方便只读摘要的人拿到结论 |

**未改动**：A1–A5、S1–S8、W1–W8 的问题描述、代码证据、建议内容与落地顺序，全部按 v1 保留。

---

## 9. 一句话总结

准确度缺的是**度量**（先能判断包装和 RAG 到底有没有用），速度缺的是**去重复**（同一批数据读 4 遍、渲染路径 O(n²)、图片线性扫描），工作流缺的是**可回退 + 可沉淀**（命令栈、快照、词库闭环）。三件事里，速度那批的改动最小、体感最直接，建议先做。
