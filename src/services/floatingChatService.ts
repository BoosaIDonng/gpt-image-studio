export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

import { useSettingsStore } from "../stores/settingsStore";

/** The builtin chat persona lives in this repo, not upstream of the relay. */
export { IMAGE_ASSISTANT_SYSTEM_PROMPT } from "./imageAssistantPrompt";
import { IMAGE_ASSISTANT_SYSTEM_PROMPT } from "./imageAssistantPrompt";

/**
 * Builtin relay Worker for static deployments (GitHub Pages): the NVIDIA key
 * stays server-side, so site visitors can chat with zero configuration.
 */
const BUILTIN_RELAY_URL = "https://chat-relay.354561650.workers.dev";

export const FLOATING_CHAT_UNCONFIGURED_MESSAGE =
  "内置 AI 助手需要先启动并配对本地 Companion：打开设置 → API 设置，启动 Companion 并完成配对后即可使用。";

/** True when any chat channel is reachable: the relay is always on. */
export function isBuiltinChatAvailable(): boolean {
  return true;
}

function companionEndpoint(): { url: string; token: string } | null {
  const settings = useSettingsStore();
  if (!settings.companionUrl || !settings.companionSessionToken) return null;
  return { url: settings.companionUrl, token: settings.companionSessionToken };
}

export async function streamChatReply(
  messages: ChatMessage[],
  onDelta: (delta: string) => void,
  systemPrompt: string = IMAGE_ASSISTANT_SYSTEM_PROMPT,
  signal?: AbortSignal,
): Promise<string> {
  const systemMessage: ChatMessage | undefined = systemPrompt.trim()
    ? { role: "system", content: systemPrompt.trim() }
    : undefined;
  const outgoingMessages: ChatMessage[] = [
    ...(systemMessage ? [systemMessage] : []),
    ...messages,
  ];

  const companion = companionEndpoint();
  const url = companion
    ? `${companion.url.replace(/\/+$/, "")}/chat/completions`
    : `${BUILTIN_RELAY_URL}/chat/completions`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (companion) headers.Authorization = `Bearer ${companion.token}`;

  const response = await fetch(url, {
    method: "POST",
    headers,
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
