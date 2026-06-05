import { describe, expect, it } from "vitest";
import type { PromptWordbanks } from "../types/studio";
import { matchPromptWordbankTerms } from "./promptWordbankMatcher";

const wordbanks: PromptWordbanks = {
  pose: {
    safe: [
      "sitting on chair",
      "standing",
      "lying",
      "soft window light",
      "dynamic pose",
    ],
    creative: ["looking over shoulder", "cinematic rain street", "bare shoulders"],
    nsfw: ["spread legs", "NSFW"],
  },
  adultInspiration: ["completely nude", "micro bikini"],
};

describe("matchPromptWordbankTerms", () => {
  it("matches terms from prompt triggers before deterministic fallback terms", () => {
    const result = matchPromptWordbankTerms({
      prompt: "画一个女孩坐在椅子上，窗边光，肖像摄影",
      mode: "safe",
      seed: "fixed",
      wordbanks,
    });

    expect(result.matchedTerms).toEqual([
      "sitting on chair",
      "soft window light",
    ]);
    expect(result.terms.slice(0, 2)).toEqual(result.matchedTerms);
  });

  it("filters conflicting pose terms from fallback terms", () => {
    const result = matchPromptWordbankTerms({
      prompt: "站立，全身照，干净背景",
      mode: "safe",
      seed: "fixed",
      wordbanks,
    });

    expect(result.matchedTerms).toContain("standing");
    expect(result.terms).toContain("standing");
    expect(result.terms).not.toContain("sitting on chair");
    expect(result.terms).not.toContain("lying");
    expect(result.blockedTerms).toEqual(
      expect.arrayContaining(["sitting on chair", "lying"]),
    );
  });

  it("uses deterministic fallback when prompt has no matching trigger", () => {
    const result = matchPromptWordbankTerms({
      prompt: "抽象色块海报",
      mode: "safe",
      seed: "fixed",
      wordbanks,
    });

    expect(result.matchedTerms).toEqual([]);
    expect(result.fallbackTerms).toHaveLength(2);
    expect(result.terms).toEqual(result.fallbackTerms);
    expect(result.blockedTerms).toEqual([]);
  });

  it("keeps safe mode away from nsfw and adult inspiration terms", () => {
    const result = matchPromptWordbankTerms({
      prompt: "不要裸露，坐在椅子上",
      mode: "safe",
      seed: "fixed",
      wordbanks,
    });

    expect(result.terms).toContain("sitting on chair");
    expect(result.terms).not.toContain("spread legs");
    expect(result.terms).not.toContain("NSFW");
    expect(result.terms).not.toContain("completely nude");
  });

  it("allows adult mode sources but still respects explicit safe intent", () => {
    const result = matchPromptWordbankTerms({
      prompt: "成年人肖像，不要裸露，站立",
      mode: "adult",
      seed: "fixed",
      wordbanks,
    });

    expect(result.terms).toContain("standing");
    expect(result.terms).not.toContain("completely nude");
    expect(result.terms).not.toContain("NSFW");
    expect(result.blockedTerms).toEqual(
      expect.arrayContaining(["completely nude", "NSFW"]),
    );
  });
});
