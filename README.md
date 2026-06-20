# GPT Image Studio

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Vue 3](https://img.shields.io/badge/Vue-3-4FC08D?logo=vuedotjs&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

> 🔗 **在线体验**：<a href="https://image.idurspace.cn" target="_blank">image.idurspace.cn</a>

本地优先的 AI 图片创作工作台。通过聊天式界面调用 OpenAI 兼容 Images API 生成和编辑图片，所有数据保存在浏览器本地。默认数据保存在浏览器本地；如需把 API 凭据留在本机而不是浏览器中，可以配合本地 `Companion` 使用。

## 来源说明

本仓库基于 [honlnk/gpt-image-studio](https://github.com/honlnk/gpt-image-studio) fork 后二次开发，保留原项目的 `LICENSE` 并在此标注来源。在上游基础上新增了多供应商图片生成、RAG 提示词检索、AI 助手等能力。

## 功能特性

### 图片创作
- 文生图：输入 prompt 直接生成图片
- 图片编辑：附带引用图 + prompt 进行局部或整体编辑
- 遮罩编辑：画笔、橡皮、矩形、圆形工具绘制编辑区域，支持撤销重做
- 自定义参数：尺寸比例、分辨率、背景透明度、输出格式

### 多供应商支持
- 内置 OpenAI / Grok / Gemini 三套图片接口，可在「设置」中切换
- 每个供应商有独立的默认模型与参数：
  - OpenAI：`gpt-image-2`
  - Grok：`grok-imagine-image-quality`
  - Gemini：`gemini-3.1-flash-image-preview`
- 浏览器直连与本地 Companion 双通道均可使用，按供应商自动适配请求格式

### 提示词控制
- 提示词模式：默认、安全、创意、开放四档，默认保持原始 prompt 直出
- 安全 / 创意 / 开放模式会在请求前注入对应模式说明和词库灵感
- 聊天记录保留用户原始提示词，模式包装只影响发送给图片接口的请求文本
- 提示词防改写：可在最终请求前追加防改写前缀，减少接口侧改写

### RAG 提示词检索
- 输入提示词时，从词库、收藏提示词、图片资产、历史会话四类来源检索相关内容
- 各来源带权重打分，按 topK 返回高分匹配
- 匹配结果在输入框上方以「RAG 匹配栏」展示，可逐条采纳或排除

### AI 助手
- 浮窗式 AI 助手，可结合项目上下文（当前会话、附件、生成参数、RAG 结果）对话
- 用于辅助调整提示词、解读生成结果，无需离开当前创作流

### 对话管理
- 聊天式消息流，完整保留创作历史
- 多会话管理：新建、搜索、切换、重命名、删除
- 每个会话独立保存草稿和参数设置
- 生成失败支持重试

### 图片库
- 浏览所有生成和导入的图片
- 大图预览，支持缩放
- 多选批量下载（ZIP）、批量删除
- 存储用量可视化

### 数据安全
- 本地优先：所有数据存储在浏览器 IndexedDB
- 完整备份导出/恢复（ZIP 格式）
- API key 不写入备份文件
- 支持本地 Companion 模式，凭据不经过浏览器

## 连接模式

| 模式 | 说明 |
|------|------|
| 浏览器直连 | 配置 API Base URL 和 API key，浏览器直接调用接口 |
| 本地 Companion | 安装本地 CLI 服务，凭据保存在本机，浏览器只与 localhost 通信 |

## 提示词模式

提示词模式可以在「设置」里的「提示词保护」页面切换。默认模式不会修改 prompt；其他模式会在发送请求前追加模式说明和随机灵感词。

| 模式 | 说明 |
|------|------|
| 默认 | 不追加任何模式指令，保持当前逻辑 |
| 安全 | 使用安全提示词方向，只抽取 safe 词库 |
| 创意 | 使用 safe + creative 词库，强化性感氛围和画面张力 |
| 开放 | 使用 safe + creative + nsfw 词库，适合支持成人内容的模型或接口 |

提示词模式不会改写聊天记录里的原始输入，只改变最终发送给图片接口的请求文本。是否能生成对应内容仍取决于当前模型和接口本身的能力与限制。

## 页面嵌入

可以将完整工作台作为 iframe 嵌入到其他页面，并通过 URL 参数预填浏览器直连配置和默认生成参数：

使用 `settings` JSON 传入完整配置：

```html
<iframe
  id="imageStudioFrame"
  allow="clipboard-read; clipboard-write"
></iframe>

<script>
  const settings = {
    apiUrl: "https://api.example.com",
    apiKey: "sk-xxx",
  };
  const frame = document.getElementById("imageStudioFrame");
  frame.addEventListener("load", () => {
    frame.contentWindow.postMessage(
      { source: "image-studio-embed", type: "apply-settings", settings },
      "*",
    );
  });
  frame.src = "https://image.idurspace.cn";
</script>
```

## 仓库结构

```text
gpt-image-studio/
├── src/                # Web App 源码，Vue 组件、状态、业务逻辑
├── companion/          # 本地 CLI Companion，负责本机凭据代理
├── public/             # 静态资源
├── prompt-wordbanks/   # Prompt 模式使用的词库
├── docs/               # 架构、路线图、ADR、迁移和专题文档
├── embed-test.html     # iframe 嵌入联调页
├── package.json        # Web App 根脚本
└── pnpm-workspace.yaml # workspace 配置
```

`src/` 当前按应用装配、业务功能、组件、共享工具划分：

```text
src/
├── app/          # 页面装配与视图模型
├── components/   # 按界面区域拆分的 Vue 组件
├── features/     # 业务模块编排
├── services/     # API、存储、备份等服务
├── shared/       # 通用工具与纯函数
├── stores/       # Pinia 状态管理
└── types/        # 领域类型定义
```

## 开发命令

```bash
pnpm install
pnpm dev
pnpm dev:companion
pnpm test
pnpm typecheck
pnpm build
```

命令说明：

- `pnpm dev`：启动 Web App，本地默认地址为 `http://127.0.0.1:8888`
- `pnpm dev:companion`：启动本地 Companion 服务
- `pnpm test`：运行 Vitest 测试
- `pnpm typecheck`：运行前端类型检查
- `pnpm build`：构建 Web App

## Companion 说明

`companion/` 是一个可独立发布的 CLI 包，包名为 `@honlnk/image-studio-companion`。它负责把 API 凭据保存在本地机器，并通过 `localhost` 为 Web App 提供代理能力。

常用启动方式：

```bash
npm install -g @honlnk/image-studio-companion
gpt-image-studio login
gpt-image-studio start
```

更多命令和配对流程见 [companion/README.md](companion/README.md)。

## 文档入口

- [文档索引](docs/README.md)
- [架构说明](docs/architecture.md)
- [产品路线图](docs/roadmap.md)
- [本地 Companion 方案](docs/companion.md)
- [遮罩编辑方案](docs/mask-editing.md)
- [备份格式](docs/backup-format.md)

## 注意事项

- 浏览器直连模式下，目标接口需要支持 CORS。
- API key 默认保存在当前浏览器的 IndexedDB 中，更适合个人设备。
- 跨站 iframe 测试时，浏览器可能会按顶层站点隔离本地存储数据。

## License

[MIT](LICENSE)
