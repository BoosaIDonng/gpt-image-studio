// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import ConfirmDialog from "./ConfirmDialog.vue";

// Stub FocusTrap to avoid jsdom focus limitations
const FocusTrapStub = {
  template: "<slot />",
  props: ["active", "initialFocus"],
};

describe("ConfirmDialog", () => {
  const defaultDialog = {
    title: "确认删除",
    description: "此操作不可撤销。",
    confirmLabel: "删除",
    tone: "danger" as const,
  };

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  function mountDialog(dialog: { title: string; description: string; confirmLabel: string; tone?: "danger" | "default" } | null) {
    return mount(ConfirmDialog, {
      props: { dialog },
      attachTo: document.body,
      global: { stubs: { FocusTrap: FocusTrapStub } },
    });
  }

  it("renders nothing when dialog is null", () => {
    const wrapper = mountDialog(null);
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("renders dialog with title, description, and confirm label", () => {
    const wrapper = mountDialog(defaultDialog);
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.textContent).toContain("确认删除");
    expect(dialog!.textContent).toContain("此操作不可撤销");
    expect(dialog!.textContent).toContain("删除");
    expect(dialog!.textContent).toContain("取消");
    wrapper.unmount();
  });

  it("emits confirm when confirm button is clicked", async () => {
    const wrapper = mountDialog(defaultDialog);
    const buttons = document.body.querySelectorAll("button");
    const confirmButton = Array.from(buttons).find((b) => b.textContent?.includes("删除"));
    confirmButton!.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("confirm")).toHaveLength(1);
    wrapper.unmount();
  });

  it("emits cancel when cancel button is clicked", async () => {
    const wrapper = mountDialog(defaultDialog);
    const buttons = document.body.querySelectorAll("button");
    const cancelButton = Array.from(buttons).find((b) => b.textContent?.includes("取消"));
    cancelButton!.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("cancel")).toHaveLength(1);
    wrapper.unmount();
  });

  it("applies danger tone styles", () => {
    const wrapper = mountDialog(defaultDialog);
    const buttons = document.body.querySelectorAll("button");
    const confirmButton = Array.from(buttons).find((b) => b.textContent?.includes("删除"));
    expect(confirmButton!.className).toContain("bg-red-600");
    wrapper.unmount();
  });

  it("applies default tone styles", () => {
    const wrapper = mountDialog({ title: "确认", description: "描述", confirmLabel: "确定", tone: "default" as const });
    const buttons = document.body.querySelectorAll("button");
    const confirmButton = Array.from(buttons).find((b) => b.textContent?.includes("删除"));
    expect(confirmButton!.className).toContain("bg-black");
    wrapper.unmount();
  });
});
