import type { Conversation, ImageAsset, Message } from "../types/studio";
import { isoTimestamp } from "../shared/dateTime";
import { bulkPut, getAllFromStore, getFromStore, putInStore, STORE_NAMES } from "./db";

type LegacyConversation = Conversation & {
  createdAtMs?: number;
  updatedAtMs?: number;
};

type LegacyMessage = Message & {
  createdAtMs?: number;
};

type LegacyImageAsset = ImageAsset & {
  createdAtMs?: number;
  updatedAtMs?: number;
};

export const TIME_FIELD_MIGRATION_VERSION = 1;

const MIGRATION_SETTINGS_KEY = "app";

type SettingsRecord = {
  key: string;
  value: { timeFieldMigrationVersion?: number };
};

export async function migrateLegacyTimeFields() {
  const [conversations, messages, imageAssets] = await Promise.all([
    getAllFromStore<LegacyConversation>(STORE_NAMES.conversations),
    getAllFromStore<LegacyMessage>(STORE_NAMES.messages),
    getAllFromStore<LegacyImageAsset>(STORE_NAMES.imageAssets),
  ]);

  const migratedConversations = conversations
    .map(normalizeConversationTimeFields)
    .filter(isPresent);
  const migratedMessages = messages.map(normalizeMessageTimeFields).filter(isPresent);
  const migratedImages = imageAssets.map(normalizeImageTimeFields).filter(isPresent);

  if (migratedConversations.length || migratedMessages.length || migratedImages.length) {
    await Promise.all([
      bulkPut(STORE_NAMES.conversations, migratedConversations),
      bulkPut(STORE_NAMES.messages, migratedMessages),
      bulkPut(STORE_NAMES.imageAssets, migratedImages),
    ]);
  }

  // Stamp the version only after writes succeed, so a failed migration is
  // retried on the next startup instead of being silently skipped forever.
  await stampTimeFieldMigrationVersion();
}

async function stampTimeFieldMigrationVersion() {
  try {
    const record = await getFromStore<SettingsRecord>(STORE_NAMES.settings, MIGRATION_SETTINGS_KEY);
    if (record?.value?.timeFieldMigrationVersion === TIME_FIELD_MIGRATION_VERSION) return;
    await putInStore<SettingsRecord>(STORE_NAMES.settings, {
      key: MIGRATION_SETTINGS_KEY,
      value: { ...record?.value, timeFieldMigrationVersion: TIME_FIELD_MIGRATION_VERSION },
    });
  } catch (error) {
    // Stamping is best-effort; worst case the (cheap) migration runs again.
    console.warn("[migration] 无法写入迁移版本标记", error);
  }
}

export function normalizeConversationTimeFields(record: LegacyConversation) {
  const updatedAt = normalizedDateString(record.updatedAt, record.updatedAtMs);
  const createdAt = normalizedDateString(record.createdAt, record.createdAtMs);
  const nextCreatedAt = createdAt ?? updatedAt;

  if (
    updatedAt === record.updatedAt &&
    nextCreatedAt === record.createdAt &&
    record.createdAtMs === undefined &&
    record.updatedAtMs === undefined
  ) {
    return null;
  }

  const { createdAtMs: _createdAtMs, updatedAtMs: _updatedAtMs, ...cleanRecord } = record;

  return {
    ...cleanRecord,
    createdAt: nextCreatedAt,
    updatedAt: updatedAt ?? record.updatedAt,
  } satisfies Conversation;
}

export function normalizeMessageTimeFields(record: LegacyMessage) {
  const createdAt = normalizedDateString(record.createdAt, record.createdAtMs);

  if (createdAt === record.createdAt && record.createdAtMs === undefined) {
    return null;
  }

  const { createdAtMs: _createdAtMs, ...cleanRecord } = record;

  return {
    ...cleanRecord,
    createdAt: createdAt ?? record.createdAt,
  } satisfies Message;
}

export function normalizeImageTimeFields(record: LegacyImageAsset) {
  const createdAt = normalizedDateString(record.createdAt, record.createdAtMs);
  const updatedAt = normalizedDateString(record.updatedAt, record.updatedAtMs);
  const nextUpdatedAt =
    updatedAt ?? (isValidDateString(record.updatedAt) ? record.updatedAt : createdAt);

  if (
    createdAt === record.createdAt &&
    nextUpdatedAt === record.updatedAt &&
    record.createdAtMs === undefined &&
    record.updatedAtMs === undefined
  ) {
    return null;
  }

  const { createdAtMs: _createdAtMs, updatedAtMs: _updatedAtMs, ...cleanRecord } = record;

  return {
    ...cleanRecord,
    createdAt: createdAt ?? record.createdAt,
    updatedAt: nextUpdatedAt,
  } satisfies ImageAsset;
}

function normalizedDateString(dateString?: string, timestampMs?: number) {
  if (isValidDateString(dateString)) return dateString;
  if (typeof timestampMs === "number") return isoTimestamp(timestampMs);
  return undefined;
}

function isValidDateString(dateString?: string) {
  if (!dateString) return false;
  return Number.isFinite(Date.parse(dateString));
}

function isPresent<T>(record: T | null): record is T {
  return record !== null;
}
