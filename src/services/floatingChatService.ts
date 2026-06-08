export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const DEFAULT_WORKER_URL = "https://unlimited.354561650.workers.dev/api/chat";
const DEFAULT_MODEL = "openai/gpt-oss-120b";

export async function streamChatReply(
  messages: ChatMessage[],
  onDelta: (delta: string) => void,
  projectContext?: ChatMessage,
): Promise<string> {
  const outgoingMessages = projectContext
    ? [projectContext, ...messages]
    : messages;

  const response = await fetch(DEFAULT_WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      use_builtin_persona: true,
      messages: outgoingMessages,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Chat failed (${response.status}): ${text}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

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

  if (!result.trim()) throw new Error("Empty response");
  return result;
}
