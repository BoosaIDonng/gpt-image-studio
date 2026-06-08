# RAG / 词库命中可视化设计

## 背景

当前 RAG 会从成功生成的图片提示词中提取词库命中项，再用当前输入的描述词检索这些参考。用户在生成前只能通过 Prompt 预览间接看到最终参考内容，难以及时发现误命中，也不方便排除单个参考。

本功能提供一个日常使用型可视化入口。它不做完整调试台，而是在输入区附近显示“本次会纳入最终 Prompt 的 RAG 参考词”，让用户生成前能快速确认和排除。

## 目标

- 在输入框上方显示紧凑的 RAG 命中条。
- 默认只显示会进入最终 Prompt 的词库词，不显示复杂调试字段。
- 支持一键排除单个命中项，并支持恢复已排除项。
- 复用现有 RAG 计算、排除列表和设置项。
- 在移动端保持紧凑，不挤压主要输入体验。

## 非目标

- 不新增独立的 RAG 调试工作台。
- 不改变 RAG 检索算法、词库匹配算法或 Prompt 构建顺序。
- 不新增新的 RAG 设置项。
- 不把历史对话全文、收藏 Prompt 或失败图片重新纳入 RAG 来源。

## 用户体验

当 `RAG` 开启、输入框存在有效描述、且当前查询有命中项时，输入框上方显示命中条：

```text
RAG 参考 3 项 · 来自 2 张成功图

cinematic rain street ×   sitting on chair ×   soft window light ×   详情
```

每个 chip 展示一条将进入最终 Prompt 的词库词。用户点击 `×` 后，该项写入 `composer.ragExcludedMatchIds`，并立即从命中条和最终 Prompt 中移除。

当存在已排除项时，命中条显示轻量恢复入口：

```text
已排除 1 项 · 恢复
```

点击 `详情` 打开现有 Prompt 预览弹窗，并定位到其中的 RAG 命中区域。详情区继续展示来源标题、原始相似度、加权分和排除/恢复操作。

## 布局

新增组件 `ComposerRagMatchBar.vue`，放在 `ChatComposer.vue` 的附件列表下方、`PromptInputBox` 上方。它只在有可展示内容时渲染。

桌面端显示最多 `ragTopK` 个 chip。移动端优先显示前 2 到 3 个 chip，剩余数量显示为 `+N`，避免输入区高度膨胀。

视觉风格沿用当前参数栏：小字号、圆角 chip、灰底为主。RAG 命中条不能比输入框和发送按钮更抢眼。

## 数据流

组件复用现有 store 和 service：

- `useComposerStore()` 提供当前输入、排除列表和排除/恢复动作。
- `useImagesStore()` 提供成功图片资产。
- `useSettingsStore()` 提供 `ragEnabled`、`ragTopK` 和词库。
- `collectRagDocuments()` 继续从成功生成图片中收集词库命中项。
- `retrieveRagContext()` 继续根据当前输入计算最终命中项。

组件内部只做展示整理，不复制 RAG 算法。最终发送请求时仍由 `currentPromptRequestSettings()` 计算 `ragContext`，保证预览和实际发送使用同一套来源。

## 状态与空状态

以下情况不显示命中条：

- `RAG` 未开启。
- 当前输入为空，且没有引用图片触发的默认编辑描述。
- 没有达到最小分数的命中项。
- 所有命中项都被用户排除。

如果所有命中项被排除，但存在已排除项，可以显示一行轻量恢复提示，避免用户忘记自己排除了参考。

## 错误处理

RAG 可视化只依赖本地数据和纯函数计算。正常情况下不需要异步错误处理。若图片资产缺少 prompt、requestPrompt 或 revisedPrompt，现有 `collectRagDocuments()` 会跳过空文本，组件不额外报错。

## 测试

需要覆盖以下行为：

- `RAG` 关闭时不显示命中条。
- 有命中时显示词库 chip 和数量。
- 点击排除后调用现有排除动作，并从展示列表移除该项。
- 有已排除项时显示恢复入口。
- 最终 Prompt 预览和实际发送仍使用同一套 RAG 排除结果。

验证命令：

```bash
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

同时按仓库规则扫描中文和 Unicode 文本，确认没有乱码、替换字符或隐藏 Unicode 控制字符。
