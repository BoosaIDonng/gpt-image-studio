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
