import { normalizeGenerationParams, type StoredGenerationParams } from "./generationParams";
import type { Message } from "../types/studio";
import { timestampFromCreatedAt } from "../shared/dateTime";
import { deleteFromStore, getAllFromStore, getStudioDb, putInStore, STORE_NAMES } from "./db";

type StoredMessage = Omit<Message, "generationParams"> & {
  generationParams?: StoredGenerationParams;
};

export async function listMessages() {
  const messages = await getAllFromStore<StoredMessage>(STORE_NAMES.messages);

  return messages
    .map(normalizeMessage)
    .sort((a, b) => timestampFromCreatedAt(a) - timestampFromCreatedAt(b));
}

export function saveMessage(message: Message) {
  return putInStore(STORE_NAMES.messages, message);
}

export async function listMessagesByConversation(conversationId: string): Promise<Message[]> {
  const db = await getStudioDb();
  const tx = db.transaction(STORE_NAMES.messages, "readonly");
  const store = tx.objectStore(STORE_NAMES.messages);
  const index = store.index("conversationId");
  const messages: StoredMessage[] = await new Promise((resolve, reject) => {
    const request = index.getAll(conversationId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return messages.map(normalizeMessage).sort((a, b) => timestampFromCreatedAt(a) - timestampFromCreatedAt(b));
}

export function deleteMessage(id: string) {
  return deleteFromStore(STORE_NAMES.messages, id);
}

function normalizeMessage(message: StoredMessage): Message {
  return {
    ...message,
    generationParams: message.generationParams
      ? normalizeGenerationParams(message.generationParams)
      : undefined,
  };
}
