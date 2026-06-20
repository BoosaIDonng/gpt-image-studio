// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import ImageCard from "./ImageCard.vue";
import type { ImageAsset } from "../../types/studio";

const baseAsset: ImageAsset = {
  id: "img-1",
  name: "测试图片.png",
  source: "generated",
  mimeType: "image/png",
  sizeBytes: 1024,
  width: 512,
  height: 512,
  createdAt: "2026-06-20T00:00:00.000Z",
  updatedAt: "2026-06-20T00:00:00.000Z",
  prompt: "a cat",
};

describe("ImageCard", () => {
  it("renders image name", () => {
    const wrapper = mount(ImageCard, {
      props: {
        image: baseAsset,
        isAttached: false,
        isSelected: false,
        nowMs: Date.now(),
      },
    });
    expect(wrapper.text()).toContain("测试图片.png");
  });

  it("shows '已引用' when attached", () => {
    const wrapper = mount(ImageCard, {
      props: {
        image: baseAsset,
        isAttached: true,
        isSelected: false,
        nowMs: Date.now(),
      },
    });
    expect(wrapper.text()).toContain("已引用");
  });

  it("shows '引用' when not attached", () => {
    const wrapper = mount(ImageCard, {
      props: {
        image: baseAsset,
        isAttached: false,
        isSelected: false,
        nowMs: Date.now(),
      },
    });
    expect(wrapper.text()).toContain("引用");
  });

  it("renders preview image when previewUrl is set", () => {
    const wrapper = mount(ImageCard, {
      props: {
        image: { ...baseAsset, previewUrl: "blob:http://localhost/test" },
        isAttached: false,
        isSelected: false,
        nowMs: Date.now(),
      },
    });
    const img = wrapper.find("img");
    expect(img.exists()).toBe(true);
    expect(img.attributes("src")).toBe("blob:http://localhost/test");
    expect(img.attributes("loading")).toBe("lazy");
  });

  it("emits selectImage when card is clicked", async () => {
    const wrapper = mount(ImageCard, {
      props: {
        image: baseAsset,
        isAttached: false,
        isSelected: false,
        nowMs: Date.now(),
      },
    });
    await wrapper.find("article").trigger("click");
    expect(wrapper.emitted("selectImage")).toEqual([["img-1"]]);
  });

  it("emits attachImage when attach button is clicked", async () => {
    const wrapper = mount(ImageCard, {
      props: {
        image: baseAsset,
        isAttached: false,
        isSelected: false,
        nowMs: Date.now(),
      },
    });
    const attachBtn = wrapper.findAll("button").find((b) => b.text() === "引用");
    await attachBtn!.trigger("click");
    expect(wrapper.emitted("attachImage")).toEqual([["img-1"]]);
  });
});
