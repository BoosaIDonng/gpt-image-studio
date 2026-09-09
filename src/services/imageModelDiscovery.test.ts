import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchImageModels } from "./imageModelDiscovery";

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
    expect(fetchMock).toHaveBeenCalledWith(devProxyUrl("https://api.example.test/v1/models"), {
      headers: { Authorization: "Bearer sk-test" },
    });
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

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8787/?url=http%3A%2F%2Fgateway.example.com%3A8080/v1/models",
      { headers: { Authorization: "Bearer sk-test" } },
    );
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
});

function devProxyUrl(endpoint: string) {
  return `/__api-proxy?url=${encodeURIComponent(endpoint)}`;
}
