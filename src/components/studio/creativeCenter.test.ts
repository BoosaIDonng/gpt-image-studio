import { describe, expect, it } from "vitest";
import { buildCreativeCenterStatus, creativeTemplates, promptFromTemplate } from "./creativeCenter";
import { buildTutorialSteps } from "../settings/tutorial";

describe("creative center", () => {
  it("shows setup guidance when direct mode has no api key", () => {
    const status = buildCreativeCenterStatus({
      connectionMode: "direct",
      apiKey: "",
      companionPaired: false,
      pendingJobCount: 0,
      failedMessageCount: 0,
      imageCount: 0,
      messageCount: 0,
    });

    expect(status.connectionTone).toBe("warning");
    expect(status.connectionLabel).toBe("接口未配置");
    expect("guideSteps" in status).toBe(false);
    expect(status.shouldExpandByDefault).toBe(true);
  });

  it("keeps tutorial progress in settings instead of creative center", () => {
    const steps = buildTutorialSteps({
      isConnected: false,
      hasPrompted: true,
      hasCreated: false,
    });

    expect(steps).toEqual([
      { label: "配置接口", done: false },
      { label: "输入提示词", done: true },
      { label: "生成图片", done: false },
    ]);
  });

  it("prioritizes generation progress over idle state", () => {
    const status = buildCreativeCenterStatus({
      connectionMode: "localCompanion",
      apiKey: "",
      companionPaired: true,
      pendingJobCount: 3,
      failedMessageCount: 1,
      imageCount: 4,
      messageCount: 8,
    });

    expect(status.connectionLabel).toBe("Companion 已连接");
    expect(status.activityLabel).toBe("生成中");
    expect(status.activityDetail).toBe("还有 3 张图片正在生成");
    expect(status.shouldExpandByDefault).toBe(false);
  });

  it("builds edit-oriented template prompts when reference images exist", () => {
    const portrait = creativeTemplates.find((template) => template.id === "portrait");

    expect(promptFromTemplate(portrait!, false)).toContain("人物写真");
    expect(promptFromTemplate(portrait!, true)).toContain("基于引用图");
  });

  it("keeps templates detailed enough for direct generation", () => {
    for (const template of creativeTemplates) {
      expect(template.prompt.length).toBeGreaterThan(100);
      expect(template.editPrompt.length).toBeGreaterThan(90);
      expect(template.prompt).toContain("构图");
      expect(template.prompt).toContain("避免");
    }
  });
});
