import { describe, expect, it } from "vitest";
import { parseAssistantApplyAction, stripAssistantApplyBlock } from "./assistantApplyAction";

const fenced = (json: string) => `这是改写后的 prompt:\n\n\`\`\`studio\n${json}\n\`\`\``;

describe("parseAssistantApplyAction", () => {
  it("parses a fenced studio block with prompt only", () => {
    const action = parseAssistantApplyAction(fenced('{"action":"apply_prompt","prompt":"a girl in rain"}'));

    expect(action).toEqual({ action: "apply_prompt", prompt: "a girl in rain" });
  });

  it("keeps whitelisted parameters and clamps imageCount", () => {
    const action = parseAssistantApplyAction(
      fenced(
        '{"action":"apply_prompt","prompt":"a girl","size":"1536x1024","imageCount":99,"quality":"high","background":"transparent","outputFormat":"png"}',
      ),
    );

    expect(action).toMatchObject({
      prompt: "a girl",
      size: "1536x1024",
      imageCount: 10,
      quality: "high",
      background: "transparent",
      outputFormat: "png",
    });
  });

  it("drops invalid enum values and malformed sizes", () => {
    const action = parseAssistantApplyAction(
      fenced(
        '{"action":"apply_prompt","prompt":"a girl","size":"999x1","quality":"ultra","background":"blue","outputFormat":"gif","imageCount":-3}',
      ),
    );

    expect(action?.size).toBeUndefined();
    expect(action?.quality).toBeUndefined();
    expect(action?.background).toBeUndefined();
    expect(action?.outputFormat).toBeUndefined();
    expect(action?.imageCount).toBe(1);
  });

  it("accepts a custom WxH size", () => {
    const action = parseAssistantApplyAction(
      fenced('{"action":"apply_prompt","prompt":"x","size":"832x1216"}'),
    );
    expect(action?.size).toBe("832x1216");
  });

  it("returns null for non-apply actions, missing prompt, or broken JSON", () => {
    expect(parseAssistantApplyAction(fenced('{"action":"other","prompt":"x"}'))).toBeNull();
    expect(parseAssistantApplyAction(fenced('{"action":"apply_prompt","prompt":"  "}'))).toBeNull();
    expect(parseAssistantApplyAction(fenced("{not json"))).toBeNull();
    expect(parseAssistantApplyAction("普通回复,没有代码块")).toBeNull();
  });

  it("recovers a bare JSON object when the model drops the fence", () => {
    const action = parseAssistantApplyAction(
      'prompt 如下:{"action":"apply_prompt","prompt":"a girl"}',
    );
    expect(action?.prompt).toBe("a girl");
  });
});

describe("stripAssistantApplyBlock", () => {
  it("removes the studio block but keeps the reply body", () => {
    expect(stripAssistantApplyBlock(fenced('{"action":"apply_prompt","prompt":"x"}'))).toBe(
      "这是改写后的 prompt:",
    );
  });

  it("leaves replies without a block unchanged", () => {
    expect(stripAssistantApplyBlock("普通回复")).toBe("普通回复");
  });
});
