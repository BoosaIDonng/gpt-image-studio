# GPT Image Studio README更新版

[![Deploy](https://github.com/honlnk/gpt-image-studio/actions/workflows/deploy.yml/badge.svg)](https://github.com/honlnk/gpt-image-studio/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Vue 3](https://img.shields.io/badge/Vue-3-4FC08D?logo=vuedotjs&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

> 在线体验：<a href="https://image.idurspace.cn" target="_blank">image.idurspace.cn</a>

本项目是一个本地优先的 AI 图片创作工作台，通过聊天式界面调用 OpenAI 兼容 Images API 进行图片生成、编辑和管理。默认数据保存在浏览器本地；如需把 API 凭据留在本机而不是浏览器中，可以配合本地 `Companion` 使用。

## 来源说明

本仓库基于 [honlnk/gpt-image-studio](https://github.com/honlnk/gpt-image-studio) fork 后整理，当前保留原项目的 `LICENSE`，并在 README 中继续标注来源。提交到你自己的 GitHub 时，GitHub fork 关系也会继续显示原始仓库来源。

## 核心能力

- 文生图、局部编辑、整体重绘、遮罩编辑
- Prompt 模式控制：默认、安全、创意、开放
- 多会话创作流与图片库管理
- 本地 IndexedDB 持久化、ZIP 备份与恢复
- 浏览器直连模式与本地 Companion 模式双通道接入

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

## PR 整理建议

提交到上游仓库前，建议只保留源码、文档和必要配置文件。以下内容通常属于本地生成物或运行产物，不适合进入 PR：

- `node_modules/`
- `dist/`
- `companion/dist/`
- `*.log`

这些目录和文件已经在 [.gitignore](.gitignore) 中配置忽略；如果本地存在，清理后再整理提交会更干净。

## 注意事项

- 浏览器直连模式下，目标接口需要支持 CORS。
- API key 默认保存在当前浏览器的 IndexedDB 中，更适合个人设备。
- 跨站 iframe 测试时，浏览器可能会按顶层站点隔离本地存储数据。

## License

[MIT](LICENSE)
