import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchImageModels, partitionImageModels } from "./imageModelDiscovery";

afterEach(() => vi.restoreAllMocks());

describe("image model discovery", () => {
  it("uses the OpenAI-compatible models endpoint as a connectivity check", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [{ id: "gpt-image-2" }] }), { status: 200 }),
      );

    await expect(
      fetchImageModels({
        apiProvider: "openai",
        apiBaseUrl: "https://api.example.test/v1/images",
        apiBaseUrlMode: "full",
        apiMode: "images",
        apiKey: "sk-test",
      }),
    ).resolves.toEqual(["gpt-image-2"]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(devProxyUrl("https://api.example.test/v1/models"));
    expect((init as RequestInit).headers).toEqual({ Authorization: "Bearer sk-test" });
    // 模型发现带 15s 超时，上游挂起时不再无限等待。
    expect((init as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });

  it("uses the proxied origin for model discovery without losing the upstream port", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));

    await fetchImageModels({
      apiProvider: "openai",
      apiBaseUrl: "http://127.0.0.1:8787/?url=http%3A%2F%2Fgateway.example.com%3A8080",
      apiBaseUrlMode: "origin",
      apiMode: "images",
      apiKey: "sk-test",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://127.0.0.1:8787/?url=http%3A%2F%2Fgateway.example.com%3A8080/v1/models",
    );
    expect((init as RequestInit).headers).toEqual({ Authorization: "Bearer sk-test" });
    expect((init as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });

  it("reads Gemini model names without the API prefix", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ models: [{ name: "models/gemini-image" }] }), { status: 200 }),
    );

    await expect(
      fetchImageModels({
        apiProvider: "gemini",
        apiBaseUrl: "https://generativelanguage.googleapis.com",
        apiBaseUrlMode: "origin",
        apiMode: "images",
        apiKey: "gemini-key",
      }),
    ).resolves.toEqual(["gemini-image"]);
  });

  it("surfaces the FastAPI-style detail field in connection errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Forbidden" }), { status: 403 }),
    );

    await expect(
      fetchImageModels({
        apiProvider: "openai",
        apiBaseUrl: "https://api.example.test",
        apiBaseUrlMode: "origin",
        apiMode: "images",
        apiKey: "sk-test",
      }),
    ).rejects.toThrow("连接失败：HTTP 403，Forbidden");
  });
});

describe("partitionImageModels", () => {
  it("groups known image model families ahead of other models", () => {
    const { imageModels, otherModels } = partitionImageModels([
      "gpt-4o",
      "gpt-image-2",
      "grok-2-image-1212",
      "dall-e-3",
      "claude-sonnet-4",
      "gemini-2.5-flash-image",
      "flux-pro",
      "deepseek-chat",
    ]);

    expect(imageModels).toEqual([
      "gpt-image-2",
      "grok-2-image-1212",
      "dall-e-3",
      "gemini-2.5-flash-image",
      "flux-pro",
    ]);
    expect(otherModels).toEqual(["gpt-4o", "claude-sonnet-4", "deepseek-chat"]);
  });

  it("keeps chat models without image markers out of the image group", () => {
    const { imageModels, otherModels } = partitionImageModels([
      "gpt-4.1-mini",
      "o4-mini",
      "imagen-3.0-generate-002",
    ]);
    expect(imageModels).toEqual(["imagen-3.0-generate-002"]);
    expect(otherModels).toEqual(["gpt-4.1-mini", "o4-mini"]);
  });
});

function devProxyUrl(endpoint: string) {
  return `/__api-proxy?url=${encodeURIComponent(endpoint)}`;
}
