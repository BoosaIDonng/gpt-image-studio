import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import { useSettingsStore } from "./settingsStore";

const storage = new Map<string, string>();

vi.stubGlobal("localStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
});

describe("settings store provider API cache", () => {
  beforeEach(() => {
    storage.clear();
    setActivePinia(createPinia());
  });

  it("keeps browser direct API settings separate for each provider", async () => {
    const settings = useSettingsStore();

    settings.apiProvider = "openai";
    settings.apiKey = "openai-key";
    settings.apiBaseUrl = "https://openai.example/v1/images";
    settings.apiBaseUrlMode = "full";
    settings.apiMode = "responses";
    settings.model = "gpt-image-2";

    settings.apiProvider = "grok";
    await nextTick();

    settings.apiKey = "grok-key";
    settings.apiBaseUrl = "https://api.x.ai/v1";
    settings.apiBaseUrlMode = "full";
    settings.apiMode = "images";
    settings.model = "grok-imagine-image-quality";

    settings.apiProvider = "gemini";
    await nextTick();

    settings.apiKey = "gemini-key";
    settings.apiBaseUrl = "https://generativelanguage.googleapis.com";
    settings.apiBaseUrlMode = "origin";
    settings.apiMode = "images";
    settings.model = "gemini-3.1-flash-image-preview";

    settings.apiProvider = "openai";
    await nextTick();

    expect(settings.apiKey).toBe("openai-key");
    expect(settings.apiBaseUrl).toBe("https://openai.example/v1/images");
    expect(settings.apiBaseUrlMode).toBe("full");
    expect(settings.apiMode).toBe("responses");
    expect(settings.model).toBe("gpt-image-2");

    settings.apiProvider = "grok";
    await nextTick();

    expect(settings.apiKey).toBe("grok-key");
    expect(settings.apiBaseUrl).toBe("https://api.x.ai/v1");
    expect(settings.apiBaseUrlMode).toBe("full");
    expect(settings.apiMode).toBe("images");
    expect(settings.model).toBe("grok-imagine-image-quality");

    settings.apiProvider = "gemini";
    await nextTick();

    expect(settings.apiKey).toBe("gemini-key");
    expect(settings.apiBaseUrl).toBe("https://generativelanguage.googleapis.com");
    expect(settings.apiBaseUrlMode).toBe("origin");
    expect(settings.apiMode).toBe("images");
    expect(settings.model).toBe("gemini-3.1-flash-image-preview");
  });

  it("includes RAG settings in current settings", () => {
    const settings = useSettingsStore();

    settings.ragEnabled = true;
    settings.ragTopK = 6;

    expect(settings.currentSettings()).toMatchObject({
      ragEnabled: true,
      ragTopK: 6,
    });
  });

  it("clears the legacy fixed model once before users select an upstream model", () => {
    storage.set(
      "gpt-image-studio:provider-api:openai",
      JSON.stringify({
        apiKey: "",
        apiBaseUrl: "",
        apiBaseUrlMode: "origin",
        apiMode: "images",
        model: "gpt-image-2",
      }),
    );

    const settings = useSettingsStore();

    expect(settings.model).toBe("");
  });
});
