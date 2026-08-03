import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchImageModels } from "./imageModelDiscovery";

afterEach(() => vi.restoreAllMocks());

describe("image model discovery", () => {
  it("uses the OpenAI-compatible models endpoint as a connectivity check", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
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
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/v1/models", {
      headers: { Authorization: "Bearer sk-test" },
    });
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
