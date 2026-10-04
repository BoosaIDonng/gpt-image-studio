import { describe, expect, it } from "vitest";
import { extractUpstreamErrorDetail } from "./apiErrors";

describe("extractUpstreamErrorDetail", () => {
  it("reads OpenAI-style {error: {message}}", () => {
    expect(extractUpstreamErrorDetail({ error: { message: "Invalid API key" } })).toBe(
      "Invalid API key",
    );
  });

  it("reads {error: {msg}} payloads", () => {
    expect(extractUpstreamErrorDetail({ error: { msg: "model is required" } })).toBe(
      "model is required",
    );
  });

  it("reads string error payloads", () => {
    expect(extractUpstreamErrorDetail({ error: "rate limited" })).toBe("rate limited");
  });

  it("reads generic {message} payloads", () => {
    expect(extractUpstreamErrorDetail({ message: "quota exceeded" })).toBe("quota exceeded");
  });

  it("reads FastAPI-style {detail} payloads used by shared-account relays", () => {
    expect(extractUpstreamErrorDetail({ detail: "Forbidden" })).toBe("Forbidden");
  });

  it("reads validation errors in array-shaped detail payloads", () => {
    expect(
      extractUpstreamErrorDetail({
        detail: [{ msg: "model is required" }, { message: "image is required" }],
      }),
    ).toBe("model is required; image is required");
  });

  it("returns empty string for non-object payloads or unreadable shapes", () => {
    expect(extractUpstreamErrorDetail(null)).toBe("");
    expect(extractUpstreamErrorDetail("oops")).toBe("");
    expect(extractUpstreamErrorDetail({})).toBe("");
    expect(extractUpstreamErrorDetail({ error: { code: 42 } })).toBe("");
    expect(extractUpstreamErrorDetail({ detail: { loc: ["body"] } })).toBe("");
  });
});
