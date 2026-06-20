export type PromptExpandSettings = {
  chatApiKey: string;
  chatApiBaseUrl: string;
  chatModel: string;
  chatSystemPrompt?: string;
};

export const DEFAULT_CHAT_SYSTEM_PROMPT = `You are an AI image prompt engineer.
Expand the user's input into a detailed English image generation prompt.
Return ONLY the expanded prompt text, no explanation, no markdown, no quotes.
Keep it under 300 words. Focus on visual details: subject, pose, lighting, style, composition.`;

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
        { role: "system", content: settings.chatSystemPrompt?.trim() || DEFAULT_CHAT_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 400,
      temperature: 0.7,
    }),
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
