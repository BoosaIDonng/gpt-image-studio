export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

import { useSettingsStore } from "../stores/settingsStore";

/** The builtin chat persona lives in this repo, not upstream of the proxy. */
export { IMAGE_ASSISTANT_SYSTEM_PROMPT } from "./imageAssistantPrompt";
import { IMAGE_ASSISTANT_SYSTEM_PROMPT } from "./imageAssistantPrompt";

export const FLOATING_CHAT_UNCONFIGURED_MESSAGE =
  "内置 AI 助手需要先启动并配对本地 Companion：打开设置 → API 设置，启动 Companion 并完成配对后即可使用。";

function companionEndpoint(): { url: string; token: string } | null {
  const settings = useSettingsStore();
  if (!settings.companionUrl || !settings.companionSessionToken) return null;
  return { url: settings.companionUrl, token: settings.companionSessionToken };
}

/** True when companion url + pairing token are both configured. */
export function isBuiltinChatAvailable(): boolean {
  return companionEndpoint() !== null;
}

function useCompanionAvailable(): boolean {
  return isBuiltinChatAvailable();
}

export async function streamChatReply(
  messages: ChatMessage[],
  onDelta: (delta: string) => void,
  systemPrompt: string = IMAGE_ASSISTANT_SYSTEM_PROMPT,
  signal?: AbortSignal,
): Promise<string> {
  const endpoint = companionEndpoint();
  if (!endpoint) {
    throw new Error(FLOATING_CHAT_UNCONFIGURED_MESSAGE);
  }

  const systemMessage: ChatMessage | undefined = systemPrompt.trim()
    ? { role: "system", content: systemPrompt.trim() }
    : undefined;
  const outgoingMessages: ChatMessage[] = [
    ...(systemMessage ? [systemMessage] : []),
    ...messages,
  ];

  const response = await fetch(`${endpoint.url.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${endpoint.token}`,
    },
    body: JSON.stringify({
      messages: outgoingMessages,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`聊天请求失败：HTTP ${response.status}：${text}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("响应没有可读的内容流");

  const decoder = new TextDecoder();
  let buffer = "";
  let result = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") break;
      try {
        const chunk = JSON.parse(payload);
        const delta = chunk?.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta) {
          result += delta;
          onDelta(delta);
        }
      } catch {
        // skip malformed chunk
      }
    }
  }

  if (!result.trim()) throw new Error("响应内容为空");
  return result;
}
