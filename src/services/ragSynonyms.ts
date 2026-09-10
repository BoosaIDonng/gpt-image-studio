/**
 * Chinese synonym groups for the RAG tokenizer.
 *
 * Chinese prompts are tokenized into 2-grams; single characters carry almost
 * no meaning, and near-synonyms ("少女" vs "女孩") share zero characters.
 * Tokens that appear in a group are expanded with the other group members so
 * queries and documents can meet on paraphrases, not just exact overlaps.
 */
const SYNONYM_GROUPS: string[][] = [
  ["少女", "女孩", "妹子", "女生"],
  ["男孩", "男生", "少年"],
  ["女人", "女性", "女子"],
  ["男人", "男性", "男子"],
  ["夜景", "夜晚", "深夜", "午夜"],
  ["街拍", "街头", "街道"],
  ["风景", "景色", "风光"],
  ["肖像", "头像", "特写"],
  ["古风", "汉服", "国风"],
  ["动漫", "二次元", "动画"],
  ["写实", "照片", "摄影"],
  ["赛博朋克", "科幻", "未来"],
  ["婚纱", "新娘", "婚礼"],
  ["制服", "校服", "学生装"],
  ["表情", "神态", "情绪"],
];

const EXPANSIONS = new Map<string, string[]>();
for (const group of SYNONYM_GROUPS) {
  for (const term of group) {
    EXPANSIONS.set(
      term,
      group.filter((member) => member !== term),
    );
  }
}

/** Expand a token with its synonym group members (empty array when none). */
export function synonymExpansions(token: string): string[] {
  return EXPANSIONS.get(token) ?? [];
}
