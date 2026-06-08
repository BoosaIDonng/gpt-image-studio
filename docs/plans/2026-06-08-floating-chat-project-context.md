# AI Assistant Project Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the floating AI assistant include the current GPT Image Studio creation context in each chat request.

**Architecture:** Add a pure context builder service that turns current app state into one hidden chat message. Pass that message to the existing floating chat request without storing it in visible chat history or changing the Worker protocol.

**Tech Stack:** Vue 3, Pinia, TypeScript, Vitest, Vite.

---

## File Structure

- Create `src/services/floatingChatContext.ts`: builds a compact hidden project-context message from current composer, conversation, image, settings, and RAG state.
- Create `src/services/floatingChatContext.test.ts`: verifies context content, redaction, trimming, and RAG summary behavior.
- Modify `src/services/floatingChatService.ts`: accepts an optional hidden context message and prepends it to outgoing `messages`.
- Create `src/services/floatingChatService.test.ts`: verifies request payloads with and without hidden context.
- Modify `src/stores/floatingChatStore.ts`: accepts an optional project context when sending, forwards it to the service, and keeps visible history unchanged.
- Modify `src/components/studio/FloatingChat.vue`: reads current app stores, builds context at send time, and calls `chat.send(context)`.

## Task 1: Context Builder

**Files:**
- Create: `src/services/floatingChatContext.ts`
- Test: `src/services/floatingChatContext.test.ts`

- [ ] **Step 1: Write the failing context builder test**

Create `src/services/floatingChatContext.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildFloatingChatProjectContext } from "./floatingChatContext";
import type { ImageAsset, Message, PromptWordbanks } from "../types/studio";

const wordbanks: PromptWordbanks = {
  pose: {
    safe: ["sitting on chair"],
    creative: ["cinematic rain street"],
    nsfw: ["bold silhouette"],
  },
  adultInspiration: ["mature editorial mood"],
};

const messages: Message[] = [
  {
    id: "m-1",
    conversationId: "c-1",
    role: "user",
    content: "画一个雨夜街头人物",
    referencedImageIds: [],
    resultImageIds: [],
    status: "success",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "m-2",
    conversationId: "c-1",
    role: "assistant",
    content: "已生成一张图片。",
    referencedImageIds: [],
    resultImageIds: ["img-1"],
    status: "success",
    createdAt: "2026-01-01T00:00:01.000Z",
  },
];

const images: ImageAsset[] = [
  {
    id: "img-1",
    name: "rain portrait",
    source: "generated",
    width: 1024,
    height: 1024,
    prompt: "cinematic rain street portrait",
    requestPrompt: "cinematic rain street portrait, neon reflection",
    revisedPrompt: "a portrait on a cinematic rainy street",
    createdAt: "2026-01-01T00:00:02.000Z",
  },
];

describe("floating chat project context", () => {
  it("summarizes the current creation context for the assistant", () => {
    const context = buildFloatingChatProjectContext({
      composerText: "帮我延续这个雨夜电影感",
      activeConversationTitle: "雨夜街景",
      recentMessages: messages,
      activeAttachments: images,
      generation: {
        apiProvider: "openai",
        apiMode: "images",
        connectionMode: "direct",
        model: "gpt-image-2",
        size: "1:1",
        resolution: "1k",
        width: 1024,
        height: 1024,
        imageCount: 1,
        quality: "auto",
        background: "auto",
        outputFormat: "png",
      },
      rag: {
        enabled: true,
        topK: 4,
        promptWordbanks: wordbanks,
        imageAssets: images,
        excludedIds: [],
      },
    });

    expect(context.role).toBe("user");
    expect(context.content).toContain("GPT Image Studio 当前项目上下文");
    expect(context.content).toContain("帮我延续这个雨夜电影感");
    expect(context.content).toContain("雨夜街景");
    expect(context.content).toContain("画一个雨夜街头人物");
    expect(context.content).toContain("rain portrait");
    expect(context.content).toContain("gpt-image-2");
    expect(context.content).toContain("cinematic rain street");
  });

  it("redacts sensitive and bulky values", () => {
    const context = buildFloatingChatProjectContext({
      composerText: "x".repeat(400),
      activeConversationTitle: "隐私测试",
      recentMessages: [
        {
          ...messages[0],
          content: `sk-secret ${"a".repeat(400)} blob:http://local-preview`,
        },
      ],
      activeAttachments: [
        {
          ...images[0],
          previewUrl: "blob:http://local-preview",
          prompt: `data:image/png;base64,${"A".repeat(200)}`,
        },
      ],
      generation: {
        apiProvider: "openai",
        apiMode: "images",
        connectionMode: "direct",
        model: "gpt-image-2",
        size: "custom",
        resolution: "1k",
        width: 1200,
        height: 1600,
        imageCount: 2,
        quality: "high",
        background: "opaque",
        outputFormat: "webp",
      },
      rag: {
        enabled: false,
        topK: 4,
        promptWordbanks: wordbanks,
        imageAssets: images,
        excludedIds: [],
      },
    });

    expect(context.content).not.toContain("blob:http");
    expect(context.content).not.toContain("base64");
    expect(context.content).not.toContain("sk-secret");
    expect(context.content.length).toBeLessThan(5000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm test src/services/floatingChatContext.test.ts
```

Expected: FAIL because `src/services/floatingChatContext.ts` does not exist.

- [ ] **Step 3: Implement the context builder**

Create `src/services/floatingChatContext.ts` with:

```ts
import type {
  ApiMode,
  ApiProvider,
  ConnectionMode,
  GenerationParams,
  ImageAsset,
  Message,
  PromptWordbanks,
} from "../types/studio";
import { collectRagDocuments, retrieveRagContext } from "./rag";
import type { ChatMessage } from "./floatingChatService";

type FloatingChatGenerationContext = GenerationParams & {
  apiProvider: ApiProvider;
  apiMode: ApiMode;
  connectionMode: ConnectionMode;
  model: string;
};

type FloatingChatRagContext = {
  enabled: boolean;
  topK: number;
  promptWordbanks: PromptWordbanks;
  imageAssets: ImageAsset[];
  excludedIds: string[];
};

export type FloatingChatProjectContextInput = {
  composerText: string;
  activeConversationTitle?: string;
  recentMessages: Message[];
  activeAttachments: ImageAsset[];
  generation: FloatingChatGenerationContext;
  rag: FloatingChatRagContext;
};

const MAX_TEXT_LENGTH = 240;
const MAX_CONTEXT_MESSAGES = 6;
const MAX_CONTEXT_IMAGES = 4;
const MAX_RAG_MATCHES = 4;

export function buildFloatingChatProjectContext(
  input: FloatingChatProjectContextInput,
): ChatMessage {
  const lines = [
    "以下是 GPT Image Studio 当前项目上下文，用于回答下一条用户消息。不要原样复述上下文，除非用户要求。",
    "如果用户问“当前在做什么图”，这里的“图”指 AI 图片创作，不是数据图表。",
    "",
    "## 当前输入",
    safeText(input.composerText) || "空",
    "",
    "## 当前会话",
    safeText(input.activeConversationTitle) || "新的对话",
    "",
    "## 最近主聊天消息",
    ...messageLines(input.recentMessages),
    "",
    "## 当前引用图片",
    ...imageLines(input.activeAttachments),
    "",
    "## 当前生成参数",
    generationLine(input.generation),
    "",
    "## RAG",
    ...ragLines(input),
  ];

  return {
    role: "user",
    content: lines.join("\n").trim(),
  };
}

function messageLines(messages: Message[]) {
  const recentMessages = messages.slice(-MAX_CONTEXT_MESSAGES);
  if (!recentMessages.length) return ["无"];

  return recentMessages.map((message) =>
    `- ${message.role}/${message.status}: ${safeText(message.content) || "空"}`,
  );
}

function imageLines(images: ImageAsset[]) {
  const visibleImages = images.slice(0, MAX_CONTEXT_IMAGES);
  if (!visibleImages.length) return ["无"];

  return visibleImages.flatMap((image, index) => [
    `- 图片 ${index + 1}: ${safeText(image.name) || image.id} / ${image.source} / ${image.width ?? "?"}x${image.height ?? "?"}`,
    image.prompt ? `  prompt: ${safeText(image.prompt)}` : "",
    image.requestPrompt ? `  requestPrompt: ${safeText(image.requestPrompt)}` : "",
    image.revisedPrompt ? `  revisedPrompt: ${safeText(image.revisedPrompt)}` : "",
  ]).filter(Boolean);
}

function generationLine(generation: FloatingChatGenerationContext) {
  const size = generation.size === "custom"
    ? `${generation.width}x${generation.height}`
    : generation.size;
  return [
    `供应商 ${generation.apiProvider}`,
    `模型 ${generation.model}`,
    `接口 ${generation.apiMode}`,
    `连接 ${generation.connectionMode}`,
    `尺寸 ${size}`,
    `分辨率 ${generation.resolution}`,
    `数量 ${generation.imageCount}`,
    `质量 ${generation.quality}`,
    `背景 ${generation.background}`,
    `格式 ${generation.outputFormat}`,
  ].join("；");
}

function ragLines(input: FloatingChatProjectContextInput) {
  if (!input.rag.enabled) return [`关闭；topK ${input.rag.topK}`];

  const query = input.composerText.trim();
  if (!query) return [`开启；topK ${input.rag.topK}；当前输入为空，未计算命中`];

  const result = retrieveRagContext({
    query,
    documents: collectRagDocuments({
      wordbanks: input.rag.promptWordbanks,
      imageAssets: input.rag.imageAssets,
    }),
    excludedIds: input.rag.excludedIds,
    topK: input.rag.topK,
  });
  const items = result.items.slice(0, MAX_RAG_MATCHES);

  if (!items.length) return [`开启；topK ${input.rag.topK}；无命中`];

  return [
    `开启；topK ${input.rag.topK}`,
    ...items.map((item) =>
      `- ${safeText(item.text)} (${item.title}, score ${item.score.toFixed(2)})`,
    ),
  ];
}

function safeText(value: unknown) {
  if (typeof value !== "string") return "";

  return value
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted-key]")
    .replace(/blob:[^\s]+/g, "[redacted-blob-url]")
    .replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, "[redacted-image-data]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm test src/services/floatingChatContext.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/services/floatingChatContext.ts src/services/floatingChatContext.test.ts
git commit -m "feat: build ai assistant project context"
```

## Task 2: Request Payload Context

**Files:**
- Modify: `src/services/floatingChatService.ts`
- Test: `src/services/floatingChatService.test.ts`

- [ ] **Step 1: Write the failing service tests**

Create `src/services/floatingChatService.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { streamChatReply, type ChatMessage } from "./floatingChatService";

function streamResponse(text = "ok") {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    }),
    { status: 200 },
  );
}

describe("floating chat service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prepends hidden project context before visible messages", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(streamResponse());
    const context: ChatMessage = {
      role: "user",
      content: "项目上下文",
    };

    await streamChatReply(
      [{ role: "user", content: "帮我改 prompt" }],
      vi.fn(),
      context,
    );

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.messages).toEqual([
      context,
      { role: "user", content: "帮我改 prompt" },
    ]);
    expect(body.use_builtin_persona).toBe(true);
  });

  it("keeps the current payload shape when no project context is provided", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(streamResponse());

    await streamChatReply(
      [{ role: "user", content: "你好" }],
      vi.fn(),
    );

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.messages).toEqual([{ role: "user", content: "你好" }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm test src/services/floatingChatService.test.ts
```

Expected: FAIL because `streamChatReply()` does not accept a third argument.

- [ ] **Step 3: Implement optional context forwarding**

Update `src/services/floatingChatService.ts`:

```ts
export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};
```

Update `streamChatReply()` signature:

```ts
export async function streamChatReply(
  messages: ChatMessage[],
  onDelta: (delta: string) => void,
  projectContext?: ChatMessage,
): Promise<string> {
```

Before `fetch()`, build outgoing messages:

```ts
  const outgoingMessages = projectContext
    ? [projectContext, ...messages]
    : messages;
```

In the JSON body, replace `messages` with:

```ts
      messages: outgoingMessages,
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm test src/services/floatingChatService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/services/floatingChatService.ts src/services/floatingChatService.test.ts
git commit -m "feat: send ai assistant project context"
```

## Task 3: Store and Component Wiring

**Files:**
- Modify: `src/stores/floatingChatStore.ts`
- Modify: `src/components/studio/FloatingChat.vue`

- [ ] **Step 1: Update store send signature**

In `src/stores/floatingChatStore.ts`, change:

```ts
  async function send() {
```

to:

```ts
  async function send(projectContext?: ChatMessage) {
```

Update the service call:

```ts
      await streamChatReply(
        messages.value.slice(0, -1),
        (delta) => {
          const msg = messages.value[assistantIdx];
          if (msg) msg.content += delta;
        },
        projectContext,
      );
```

- [ ] **Step 2: Wire context in FloatingChat**

In `src/components/studio/FloatingChat.vue`, import the stores and builder:

```ts
import { computed, nextTick, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { buildFloatingChatProjectContext } from "../../services/floatingChatContext";
import { useConversationsStore } from "../../stores/conversationsStore";
import { useImagesStore } from "../../stores/imagesStore";
import { useSettingsStore } from "../../stores/settingsStore";
```

Create local store refs after existing store setup:

```ts
const conversations = useConversationsStore();
const images = useImagesStore();
const settings = useSettingsStore();
const { activeConversation, activeMessages } = storeToRefs(conversations);
```

Add a computed context:

```ts
const projectContext = computed(() =>
  buildFloatingChatProjectContext({
    composerText: composer.composerText,
    activeConversationTitle: activeConversation.value?.title,
    recentMessages: activeMessages.value,
    activeAttachments: images.activeAttachments,
    generation: {
      apiProvider: settings.apiProvider,
      apiMode: settings.apiMode,
      connectionMode: settings.connectionMode,
      model: settings.model,
      size: settings.activeSizePreset,
      resolution: settings.sizeResolution,
      width: settings.imageWidth,
      height: settings.imageHeight,
      imageCount: settings.imageCount,
      quality: settings.quality,
      background: settings.background,
      outputFormat: settings.outputFormat,
    },
    rag: {
      enabled: settings.ragEnabled,
      topK: settings.ragTopK,
      promptWordbanks: settings.promptWordbanks,
      imageAssets: images.imageAssets,
      excludedIds: composer.ragExcludedMatchIds,
    },
  }),
);
```

Update `handleKeydown()` and send button click to call:

```ts
chat.send(projectContext.value)
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS. If `storeToRefs(conversations)` does not expose `activeConversation` or `activeMessages`, inspect `src/stores/conversationsStore.ts` and use the matching returned refs.

- [ ] **Step 4: Commit**

Run:

```bash
git add src/stores/floatingChatStore.ts src/components/studio/FloatingChat.vue
git commit -m "feat: connect ai assistant to project context"
```

## Task 4: Final Verification

**Files:**
- Review: all changed source and test files

- [ ] **Step 1: Run full verification**

Run:

```bash
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

Expected: all commands pass.

- [ ] **Step 2: Run Unicode and Chinese integrity scans**

Run the repository AGENTS.md mojibake scan and hidden Unicode scan across `src`, `docs`, `README.md`, `README更新版.md`, and `CLAUDE.md`.

Expected: no matches.

- [ ] **Step 3: Manual smoke test**

Run the dev server if it is not already running:

```bash
pnpm dev
```

Open the app, type a prompt in the main composer, open the AI assistant, ask “我当前在做什么图？”. Expected: the assistant uses current composer/conversation/image context rather than answering generically.

- [ ] **Step 4: Final local status**

Run:

```bash
git status -sb
```

Expected: only ignored or known local temporary files remain. Do not push. Wait for the user to test and explicitly request push.

## Self-Review

- Spec coverage: the plan implements hidden message context, no Worker protocol change, redaction, compact summaries, RAG summary, and unchanged visible chat history.
- Placeholder scan: passed; no open-ended implementation steps remain.
- Type consistency: `ChatMessage` allows `system` for compatibility, but the project context builder returns `user` because the deployed Worker/model reads that form reliably; the store and service pass the same optional context object.
