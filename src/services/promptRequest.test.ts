import { describe, expect, it } from "vitest";
import { defaultPromptWordbanks } from "./promptWordbanks";
import { PROMPT_REWRITE_GUARD_PREFIX, buildFinalRequestPrompt } from "./promptRequest";

describe("buildFinalRequestPrompt", () => {
  it("returns the original prompt in default mode without guard", () => {
    expect(
      buildFinalRequestPrompt({
        prompt: "画一张雨夜街头照片",
        promptMode: "default",
        promptWordbanks: defaultPromptWordbanks,
        promptRewriteGuardEnabled: false,
        promptRewriteGuardText: PROMPT_REWRITE_GUARD_PREFIX,
      }),
    ).toBe("画一张雨夜街头照片");
  });

  it("applies prompt mode wordbanks before wrapping the final prompt guard", () => {
    const prompt = buildFinalRequestPrompt({
      prompt: "画一张雨夜街头照片",
      promptMode: "creative",
      promptWordbanks: defaultPromptWordbanks,
      promptRewriteGuardEnabled: true,
      promptRewriteGuardText: PROMPT_REWRITE_GUARD_PREFIX,
    });

    expect(prompt.startsWith(`${PROMPT_REWRITE_GUARD_PREFIX}\n`)).toBe(true);
    expect(prompt).toContain("当前模式：创意");
    expect(prompt).toContain("灵感词：");
    expect(prompt).toContain("用户原始提示词：\n画一张雨夜街头照片");
  });

  it("adds RAG context through the final prompt builder before wrapping the guard", () => {
    const prompt = buildFinalRequestPrompt({
      prompt: "画一张雨夜街头照片",
      promptMode: "default",
      promptWordbanks: defaultPromptWordbanks,
      promptRewriteGuardEnabled: true,
      promptRewriteGuardText: PROMPT_REWRITE_GUARD_PREFIX,
      ragContext: [
        "RAG 参考内容：",
        "以下内容仅作为参考，不要覆盖用户原始提示词；如果冲突，以用户原始提示词为准。",
        "1. cinematic rain street",
      ].join("\n"),
    });

    expect(prompt.startsWith(`${PROMPT_REWRITE_GUARD_PREFIX}\n`)).toBe(true);
    expect(prompt).toContain("RAG 参考内容：");
    expect(prompt).toContain("cinematic rain street");
    expect(prompt).toContain("用户原始提示词：\n画一张雨夜街头照片");
  });
});

describe("buildFinalRequestPrompt provider adaptation", () => {
  it("openai（默认）不加额外后缀", () => {
    const prompt = buildFinalRequestPrompt({
      prompt: "画一张雨夜街头照片",
      promptMode: "default",
      promptWordbanks: defaultPromptWordbanks,
      promptRewriteGuardEnabled: true,
      promptRewriteGuardText: PROMPT_REWRITE_GUARD_PREFIX,
      provider: "openai",
    });
    expect(prompt).toBe(`${PROMPT_REWRITE_GUARD_PREFIX}\n画一张雨夜街头照片`);
  });

  it("grok/gemini 在防改写包装后追加强化指令", () => {
    for (const provider of ["grok", "gemini"] as const) {
      const prompt = buildFinalRequestPrompt({
        prompt: "画一张雨夜街头照片",
        promptMode: "default",
        promptWordbanks: defaultPromptWordbanks,
        promptRewriteGuardEnabled: true,
        promptRewriteGuardText: PROMPT_REWRITE_GUARD_PREFIX,
        provider,
      });
      expect(prompt.startsWith(`${PROMPT_REWRITE_GUARD_PREFIX}\n`)).toBe(true);
      expect(
        prompt.endsWith("embellish the prompt above. Output exactly what it describes.)"),
      ).toBe(true);
    }
  });

  it("未开启防改写时不追加强化指令", () => {
    const prompt = buildFinalRequestPrompt({
      prompt: "画一张雨夜街头照片",
      promptMode: "default",
      promptWordbanks: defaultPromptWordbanks,
      promptRewriteGuardEnabled: false,
      promptRewriteGuardText: PROMPT_REWRITE_GUARD_PREFIX,
      provider: "grok",
    });
    expect(prompt).toBe("画一张雨夜街头照片");
  });

  it("RAG 参考内容被显式分隔块包裹", () => {
    const prompt = buildFinalRequestPrompt({
      prompt: "画一张雨夜街头照片",
      promptMode: "default",
      promptWordbanks: defaultPromptWordbanks,
      promptRewriteGuardEnabled: false,
      promptRewriteGuardText: PROMPT_REWRITE_GUARD_PREFIX,
      ragContext: "RAG 参考内容：\n1. cinematic rain street",
    });
    expect(prompt).toContain("[RAG 参考开始]");
    expect(prompt).toContain("[RAG 参考结束]");
    expect(prompt.indexOf("[RAG 参考开始]")).toBeLessThan(prompt.indexOf("用户原始提示词："));
  });
});
