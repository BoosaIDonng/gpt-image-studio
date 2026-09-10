# UI 改造参考与选型

本文档记录 gpt-image-studio UI 改造前的架构诊断、参考选型与分阶段实施路径。
它是设计参考和实施计划，不会覆盖项目现有的功能、安全和架构约束。
所有技术栈信息均于 2026-09-09 核实。

## 1. 现状诊断：问题不在配色，在样式架构

### 1.1 核心问题：Tailwind 原子类被 `!important` 劫持

`src/style.css` 第 195–273 行批量重写了 Tailwind 的原子类语义：

```css
/* 实际存在的代码 */
.cupertino-app .bg-black,
.cupertino-app .bg-gray-900 {
  background-color: var(--cupertino-blue) !important;  /* bg-black 渲染成蓝色 */
}
.cupertino-app .rounded-lg { border-radius: 12px !important; }
.cupertino-app .text-gray-500 { color: var(--cupertino-secondary-label) !important; }
```

后果：

- 组件里写的类名与屏幕结果对不上，代码不可读、不可预测。
- 每新增一个灰度/圆角，都必须回 `style.css` 登记，否则暗色模式下显形错误。
- 任何"调个配色"的动作都是在补丁上打补丁。

### 1.2 其他三个结构性问题

| 问题 | 现状 | 影响 |
|------|------|------|
| 双色板并存 | `--cupertino-*` CSS 变量与 Tailwind `gray-*` 原子类靠覆盖层互译 | 两套真值来源 |
| 零组件库 | 43 个 `.vue` 组件全手写，依赖只有 vue / pinia / focus-trap-vue | 交互细节（hover、focus、disabled、暗色对比度）必然不一致 |
| Props 爆炸 | `App.vue` 中 `SettingsModal` 挂了约 60 个 props | 改 UI 时牵一发动全身 |

**结论：先拆掉劫持层，再谈改版。** 但不应把现有 class 按颜色名批量替换：
`bg-black` 可能是遮罩，`bg-gray-900` 可能是按钮，颜色名本身无法表达组件语义。
正确顺序是先把 Cupertino 值放进 Tailwind token，移除 `!important` 劫持，
再把组件换成 `bg-surface`、`text-content` 等语义类。

## 2. 五层选型（每层唯一推荐）

| 层位 | 选型 | 抄什么 | 不抄什么 |
|------|------|--------|----------|
| 结构 | **ComfyUI_frontend** | 目录分层、Pinia store 组织、Tailwind 与组件库共存方式 | LiteGraph 节点画布（形态不同） |
| 形态 | **Cherry Studio** 绘画页 | 会话侧栏 + 主区 + 参数设置的三段式信息架构 | Electron IPC 层 |
| 组件 | **shadcn-vue** + **Reka UI** | Button / Input / Select / Switch / Dialog / Tooltip 六个原语 | 任何自带视觉的完整组件库 |
| 网格 | **@skaut/justified-layout** | 传入宽高数组，取回每格 top/left/width/height，自己渲染 | 原版 `flickr/justified-layout`（已停维护） |
| 灵感 | **Refero** | 按页面类型 / UX 模式检索真实上线产品界面 | — |

### 2.1 如果只能选一个

- **只抄一个仓库** → ComfyUI_frontend。技术栈逐项对齐（Vue 3.5 / Pinia / Vite / Tailwind 4），无需心智转换。
- **只看一个产品** → Cherry Studio 绘画页。它的信息架构就是本项目要做的事。
- **只装一个依赖** → 暂不安装。图片数量和布局性能达到瓶颈前，原生 CSS 足够；
  只有在测量确认需要等高错落布局时，才评估 `@skaut/justified-layout`。

## 3. 参考项目清单

### A. 同技术栈（抄工程结构）

**ComfyUI_frontend** — <https://github.com/Comfy-Org/ComfyUI_frontend>

Vue 3.5 + TypeScript + Pinia + Vite + Tailwind CSS 4 + PrimeVue 4.2 + vue-i18n。
与本项目栈几乎逐项对齐。重点看 `src/` 下的 `composables/ stores/ services/ platform/`
分层方式，以及它如何让 Tailwind 与 PrimeVue 共存而不互相覆盖。

### B. 同形态（抄信息架构）

| 项目 | Star | 栈 | 参考点 |
|------|------|-----|--------|
| **Cherry Studio** | 48.7k | Electron + React 19 + Redux + Dexie | 会话侧栏 + 主区 + 设置；"绘画页"含文生图 / 图生图 / 参数面板 / 批量，形态等价于本项目 |
| LobeChat | 80.4k | Next.js + antd | 现代设计语言，插件市场 / 知识库 / 绘画 |
| Open WebUI | 146k | Svelte | 自托管 AI 前端，多用户与 RAG 的界面组织 |

### C. 图片库专项

| 项目 | 栈 | 参考点 |
|------|-----|--------|
| **PhotoPrism** | Go + **Vue.js** PWA | 唯一能直接抄代码的 Vue 图片库；内置 **Mosaic / Card / List** 三种视图切换 |
| Immich | Svelte (web) + Flutter (app) | 时间轴分组 + 等高错落网格，排布标杆（只抄排布，不抄代码） |
| InvokeAI | — | Gallery / Board / 生成队列的范式定义（仅作形态参考） |

### D. 组件层

- **shadcn-vue** — <https://www.shadcn-vue.com>：复制粘贴进项目，基于 Reka UI + Tailwind，无黑盒依赖。
- **Reka UI** — <https://reka-ui.com>：Vue 版 Radix，headless 原语，只要交互逻辑不要样式。
- **PrimeVue 4**（unstyled mode）：ComfyUI 同款，90+ 组件，作为备选。

**明确排除**：Element Plus / Ant Design Vue / Naive UI。它们自带完整设计语言，
与项目 cupertino 风格叠加会形成第三套视觉系统。

### E. 设计灵感库

- **Refero** — <https://refero.design>：真实 SaaS / Web 产品界面库，45 种页面类型 + 87 种 UX 模式，提供 MCP 可直接接入 AI 工具。
- **Mobbin** — <https://mobbin.com>：60 万+ 真实上线产品截图，按流程 / 模式检索（免费额度有限）。
- **60fps.design**：交互动效片段。**Page Flows**：完整流程录屏（付费）。

## 4. 改造路径

每阶段可独立上线，无需一次性重写。

### 阶段 0：拆劫持层，建 token（前置，必做）

1. 在 `src/style.css` 用 Tailwind 4 的 `@theme` 定义语义 token。
2. 删除颜色、圆角和 hover 的 `!important` 劫持规则；表单默认样式放入 `@layer base`，
   允许组件自己的 utility 覆盖。
3. 只在触碰组件时将 class 换成语义类，不做一次性机械替换。
4. 每次改动跑 `pnpm test`、`pnpm typecheck` 和 `pnpm build`。

**验收标准**：删除劫持规则后，遮罩仍保持黑色、表单可被组件 class 覆盖、明暗模式可用，
且 `pnpm test`、`pnpm typecheck`、`pnpm build` 全部通过。语义 class 的完整迁移单独验收。

**当前进度**：阶段 0 已实施。`src/style.css` 已建立 token 和 radius token，43 个 Vue
组件已将灰度/圆角 utility 迁移到语义类，并移除了颜色/圆角/hover 的劫持层。

### 阶段 1：抽六个原语组件

只有同一交互在三个以上位置重复时才抽原语。优先从现有 `Tooltip`、`ConfirmDialog`、
`NoticeToast` 的真实重复开始；Button / Input / Select / Switch 不预先铺设空壳。
如需 headless 行为，再单独引入 Reka UI；shadcn-vue 作为代码组织参考，不作为运行时依赖。

### 阶段 2：布局改造

- 侧栏可折叠，宽度持久化到 settings store。
- 设置先保留 modal 形态，利用已有 `provide/inject` 和 store 继续收敛 props；
  只有需要深链接、浏览器返回或移动端独立导航时才引入路由页。
- 生成结果从单列消息流改为网格化展示。

### 阶段 3：图片库

先用 CSS grid 或 columns 验证图片库的真实使用数据和滚动性能；当图片数量和布局测量
确认原生方案不足时，再接入 `@skaut/justified-layout`。Mosaic / Card / List 视图属于
独立产品需求，不与第一次网格改造绑定。

### 阶段 4：配色重定

到这一步才轮到调色，且只需改 `@theme` 里的几个变量。

## 5. Token 层示例

Tailwind 4 采用 CSS-first 配置，token 定义在 `@theme` 中：

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --color-surface: var(--cupertino-grouped-background);
  --color-surface-muted: var(--cupertino-secondary-fill);
  --color-border-subtle: var(--cupertino-separator);
  --color-content: var(--cupertino-label);
  --color-content-muted: var(--cupertino-secondary-label);
  --color-accent: var(--cupertino-blue);
  --radius-card: 12px;
  --radius-panel: 16px;
}
```

之后新改动的组件继续使用语义类：`bg-surface` `border-border-subtle` `text-content-muted` `rounded-card`。

关键设计：token **引用** `--cupertino-*` 变量而非硬编码色值，
因此暗色模式只需在 `.dark` 下重定义变量，无需改动任何组件。

`--color-*` 会生成 `bg-` / `text-` / `border-` 工具类，`--radius-*` 生成 `rounded-*`。

## 6. 明确不做的事

1. **不整体引入带视觉的组件库**——病根就是多套视觉系统打架，不要再加一套。
2. **不用 `react-photo-album`**——它是 React 的，且把渲染也包了；本项目只需要纯几何计算。
3. **不装原版 `flickr/justified-layout`**——已停止维护，用 `@skaut/justified-layout`。
4. **不先调色**——token 层建好前调色，等于在补丁上打补丁。

## 7. 已核实的事实与坑

- `flickr/justified-layout` **已停止维护**，维护中的 fork 是 `@skaut/justified-layout`（MIT，自带 TS 类型，只算几何不碰 DOM）。
- PhotoPrism 前端是 **Vue.js PWA**，非 React；内置 Mosaic / Card / List 三视图。
- Immich Web 端是 **Svelte**（非 Vue），只能抄排布思路。
- Cherry Studio 稳定版 v1.9.x 为 Electron + React 19；`main` 分支处于 2.0.0-dev 重构中，参考时锁定 tag。
- ComfyUI_frontend 使用 PrimeVue 4.2 + Tailwind 4，是"Tailwind 与组件库共存"的现成范例。
