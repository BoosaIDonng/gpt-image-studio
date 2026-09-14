import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_CHAT_SYSTEM_PROMPT,
  buildExpandUserMessage,
  expandPrompt,
  fetchChatModels,
} from "./promptExpander";

describe("DEFAULT_CHAT_SYSTEM_PROMPT", () => {
  it("carries the domain-routing and fidelity rules", () => {
    expect(DEFAULT_CHAT_SYSTEM_PROMPT).toContain("Language adaptation");
    expect(DEFAULT_CHAT_SYSTEM_PROMPT).toContain("Semantic fidelity");
    expect(DEFAULT_CHAT_SYSTEM_PROMPT).toContain("Specificity policy");
    expect(DEFAULT_CHAT_SYSTEM_PROMPT).toContain("Domain routing");
    expect(DEFAULT_CHAT_SYSTEM_PROMPT).toContain("## Examples");
    // Few-shot pairs must be present for both languages.
    expect(DEFAULT_CHAT_SYSTEM_PROMPT).toContain("Input: 一只猫在窗台");
    expect(DEFAULT_CHAT_SYSTEM_PROMPT).toContain("Output: a young woman");
  });
});

describe("expandPrompt", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts to the chat completions endpoint with an 800-token budget", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "expanded prompt text" } }],
        }),
        { status: 200 },
      ),
    );

    const result = await expandPrompt("一只猫", {
      chatApiKey: "key",
      chatApiBaseUrl: "https://chat.example.com/v1/",
      chatModel: "test-model",
    });

    expect(result).toBe("expanded prompt text");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://chat.example.com/v1/chat/completions");
    const body = JSON.parse(String(init?.body));
    expect(body.max_tokens).toBe(800);
    expect(body.messages[0].content).toBe(DEFAULT_CHAT_SYSTEM_PROMPT);
  });

  it("falls back to the default system prompt when none is configured", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: "x" } }] }), {
          status: 200,
        }),
      );

    await expandPrompt("a cat", {
      chatApiKey: "key",
      chatApiBaseUrl: "https://chat.example.com",
      chatModel: "m",
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.messages[0].content).toBe(DEFAULT_CHAT_SYSTEM_PROMPT);
  });
});

describe("buildExpandUserMessage", () => {
  it("passes the prompt through unchanged without rag examples", () => {
    expect(buildExpandUserMessage("一只猫", [])).toBe("一只猫");
  });

  it("prepends rag style references ahead of the user input", () => {
    const message = buildExpandUserMessage("一只猫", [
      "cinematic cat portrait, window light",
      "a very long example that should stay intact up to three hundred characters",
    ]);

    expect(message).toContain("参考示例");
    expect(message).toContain("1. cinematic cat portrait, window light");
    expect(message).toContain("用户输入：");
    expect(message.indexOf("cinematic cat portrait")).toBeLessThan(message.indexOf("用户输入："));
  });

  it("caps rag examples at three and drops empty ones", () => {
    const message = buildExpandUserMessage("一只猫", ["a", "", "b", "c", "d"]);
    expect(message).toContain("1. a");
    expect(message).toContain("3. c");
    expect(message).not.toContain("4. d");
  });
});

describe("fetchChatModels", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists model ids sorted from the models endpoint", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: "b" }, { id: "a" }] }), { status: 200 }),
    );

    const models = await fetchChatModels("key", "https://chat.example.com");

    expect(models).toEqual(["a", "b"]);
  });
});
