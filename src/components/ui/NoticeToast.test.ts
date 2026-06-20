// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import NoticeToast from "./NoticeToast.vue";

describe("NoticeToast", () => {
  it("renders nothing when notice is null", () => {
    const wrapper = mount(NoticeToast, { props: { notice: null } });
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
  });

  it("renders success notice with message", () => {
    const wrapper = mount(NoticeToast, {
      props: { notice: { type: "success", message: "操作成功" } },
    });
    const el = wrapper.find('[role="status"]');
    expect(el.exists()).toBe(true);
    expect(el.text()).toContain("操作成功");
    expect(el.attributes("aria-live")).toBe("polite");
  });

  it("renders error notice with message", () => {
    const wrapper = mount(NoticeToast, {
      props: { notice: { type: "error", message: "出错了" } },
    });
    const el = wrapper.find('[role="status"]');
    expect(el.exists()).toBe(true);
    expect(el.text()).toContain("出错了");
  });

  it("emits close when dismiss button is clicked", async () => {
    const wrapper = mount(NoticeToast, {
      props: { notice: { type: "success", message: "完成" } },
    });
    await wrapper.find('button[aria-label="关闭提示"]').trigger("click");
    expect(wrapper.emitted("close")).toHaveLength(1);
  });
});
