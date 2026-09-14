export type PromptExpandSettings = {
  chatApiKey: string;
  chatApiBaseUrl: string;
  chatModel: string;
  chatSystemPrompt?: string;
};

export type PromptExpandOptions = {
  /**
   * RAG hits (recent successful prompts / favorites) offered to the model as
   * style references. They must not be copied into the output.
   */
  ragExamples?: string[];
  signal?: AbortSignal;
};

export const DEFAULT_CHAT_SYSTEM_PROMPT = `You are a professional image generation prompt engineer with expert visual knowledge across photography, product design, graphic design, anime, 3D CGI, and illustration.

## Absolute rules
1. Language adaptation: if the user writes in Chinese, respond with a Chinese prompt; if the user writes in English, respond in English.
2. Semantic fidelity: keep every core subject, action, composition, style, and scene requirement the user wrote. Never add new people, new plot, or elements the user did not imply.
3. Specificity policy: if the user's input is already detailed, only normalize wording — do not embellish. Add visual details (environment, material, lighting, mood, camera feel) only when the input is brief or vague.
4. No empty adjectives: never use vague praise words like "high quality", "beautiful", "masterpiece". Convert them into perceivable physical details or professional art terms.
5. Output purity: return ONLY the expanded prompt text. No markdown, no quotes, no explanations, no bilingual pairs, no prefix or suffix.
6. Keep it under 250 words.

## Domain routing (decide first, then use that domain's vocabulary)
- Photography: camera/lens/film terms (e.g. 85mm portrait lens, shallow depth of field, golden hour backlight), real-world materials and light behavior.
- Product: studio lighting, seamless background, surface texture (brushed metal, frosted glass), commercial clean composition.
- Graphic/poster: flat color blocks, typography space, layout hierarchy, vector look.
- Anime/manga: character design features, cel shading, line art quality, anime-style eyes and hair rendering.
- 3D CGI: renderer feel (octane, unreal engine), subsurface scattering, global illumination, PBR materials.
- Illustration/painting: brush texture, color palette mood, art movement or artist-style phrasing (without naming living artists).
Never mix vocabularies across domains (e.g. no lens parameters in anime prompts).

## Examples
Input: 一只猫在窗台
Output: 一只橘猫蹲坐在洒满阳光的窗台上,白色纱帘半透,窗外是模糊的城市街景,午后暖色调逆光勾勒出猫毛的轮廓光,浅景深,胶片质感,日系摄影风格

Input: cyberpunk girl
Output: a young woman with a neon-lit cyberpunk aesthetic, short asymmetrical hair with glowing strands, reflective rain-soaked street at night, holographic signs in the background, teal and magenta rim lighting, cinematic wide shot with shallow depth of field

Input: a cup of coffee on a wooden table, morning light
Output: a ceramic cup of latte on a rustic oak table, soft morning window light from the left casting long gentle shadows, faint steam rising, warm earthy tones, macro shot with creamy bokeh background, editorial food photography style`;

function buildChatBaseUrl(rawUrl: string): string {
  return rawUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
}

export async function fetchChatModels(
  chatApiKey: string,
  chatApiBaseUrl: string,
): Promise<string[]> {
  const baseUrl = buildChatBaseUrl(chatApiBaseUrl);
  const response = await fetch(`${baseUrl}/v1/models`, {
    headers: { Authorization: `Bearer ${chatApiKey}` },
  });
  if (!response.ok) throw new Error(`获取模型失败 (${response.status})`);
  const data = await response.json();
  const models: string[] = (data?.data ?? [])
    .map((m: { id: string }) => m.id)
    .filter((id: string) => typeof id === "string" && id.length > 0)
    .sort();
  return models;
}

export async function expandPrompt(
  userPrompt: string,
  settings: PromptExpandSettings,
  options: PromptExpandOptions = {},
): Promise<string> {
  const baseUrl = buildChatBaseUrl(settings.chatApiBaseUrl);
  const url = `${baseUrl}/v1/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.chatApiKey}`,
    },
    body: JSON.stringify({
      model: settings.chatModel,
      messages: [
        {
          role: "system",
          content: settings.chatSystemPrompt?.trim() || DEFAULT_CHAT_SYSTEM_PROMPT,
        },
        { role: "user", content: buildExpandUserMessage(userPrompt, options.ragExamples ?? []) },
      ],
      max_tokens: 800,
      temperature: 0.7,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`提示词扩展失败：HTTP ${response.status}：${text}`);
  }

  const data = await response.json();
  const expanded = data?.choices?.[0]?.message?.content?.trim();
  if (!expanded) throw new Error("提示词扩展返回了空响应");
  return expanded;
}

/** User turn with optional RAG style references kept clearly separated. */
export function buildExpandUserMessage(userPrompt: string, ragExamples: string[]): string {
  const examples = ragExamples.map(cleanExample).filter(Boolean).slice(0, 3);
  if (!examples.length) return userPrompt;

  return [
    "参考示例（来自用户过去的成功 Prompt，仅供风格参考，不要照抄内容）：",
    ...examples.map((example, index) => `${index + 1}. ${example}`),
    "",
    "用户输入：",
    userPrompt,
  ].join("\n");
}

function cleanExample(example: string) {
  return example.trim().replace(/\s+/g, " ").slice(0, 300);
}
