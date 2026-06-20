import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  bulkDelete,
  bulkPut,
  clearStore,
  deleteFromStore,
  getAllFromStore,
  getFromStore,
  getStudioDb,
  putInStore,
  resetDbCache,
  STORE_NAMES,
} from "./db";

// 每个测试前删除数据库并重置缓存，确保隔离
beforeEach(async () => {
  const db = await getStudioDb();
  db.close();
  resetDbCache();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase("gpt-image-studio");
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

describe("getStudioDb", () => {
  it("返回可用的数据库实例", async () => {
    const db = await getStudioDb();
    expect(db).toBeInstanceOf(IDBDatabase);
    expect(db.objectStoreNames.contains(STORE_NAMES.conversations)).toBe(true);
    expect(db.objectStoreNames.contains(STORE_NAMES.messages)).toBe(true);
    expect(db.objectStoreNames.contains(STORE_NAMES.imageAssets)).toBe(true);
    expect(db.objectStoreNames.contains(STORE_NAMES.imageBlobs)).toBe(true);
    expect(db.objectStoreNames.contains(STORE_NAMES.settings)).toBe(true);
    expect(db.objectStoreNames.contains(STORE_NAMES.conversationDrafts)).toBe(true);
  });

  it("重复调用返回同一 Promise", async () => {
    const db1 = await getStudioDb();
    const db2 = await getStudioDb();
    expect(db1).toBe(db2);
  });
});

describe("putInStore / getFromStore", () => {
  it("写入后可读取单条记录", async () => {
    const record = { id: "conv-1", title: "测试", updatedAt: "2026-01-01" };
    await putInStore(STORE_NAMES.conversations, record);

    const result = await getFromStore(STORE_NAMES.conversations, "conv-1");
    expect(result).toEqual(record);
  });

  it("读取不存在的 key 返回 undefined", async () => {
    const result = await getFromStore(STORE_NAMES.conversations, "nonexistent");
    expect(result).toBeUndefined();
  });
});

describe("getAllFromStore", () => {
  it("空 store 返回空数组", async () => {
    const result = await getAllFromStore(STORE_NAMES.conversations);
    expect(result).toEqual([]);
  });

  it("返回所有记录", async () => {
    await putInStore(STORE_NAMES.messages, { id: "m-1", content: "hello" });
    await putInStore(STORE_NAMES.messages, { id: "m-2", content: "world" });

    const result = await getAllFromStore(STORE_NAMES.messages);
    expect(result).toHaveLength(2);
  });
});

describe("deleteFromStore", () => {
  it("删除后读取返回 undefined", async () => {
    await putInStore(STORE_NAMES.settings, { key: "theme", value: "dark" });
    await deleteFromStore(STORE_NAMES.settings, "theme");

    const result = await getFromStore(STORE_NAMES.settings, "theme");
    expect(result).toBeUndefined();
  });
});

describe("bulkPut", () => {
  it("批量写入多条记录", async () => {
    const records = [
      { id: "a-1", name: "图片1" },
      { id: "a-2", name: "图片2" },
      { id: "a-3", name: "图片3" },
    ];
    await bulkPut(STORE_NAMES.imageAssets, records);

    const result = await getAllFromStore(STORE_NAMES.imageAssets);
    expect(result).toHaveLength(3);
  });

  it("空数组不报错", async () => {
    await expect(bulkPut(STORE_NAMES.imageAssets, [])).resolves.toBeUndefined();
  });
});

describe("bulkDelete", () => {
  it("批量删除多条记录", async () => {
    await bulkPut(STORE_NAMES.imageAssets, [
      { id: "a-1", name: "图片1" },
      { id: "a-2", name: "图片2" },
      { id: "a-3", name: "图片3" },
    ]);

    await bulkDelete(STORE_NAMES.imageAssets, ["a-1", "a-3"]);

    const result = await getAllFromStore(STORE_NAMES.imageAssets);
    expect(result).toHaveLength(1);
    expect((result[0] as any).id).toBe("a-2");
  });

  it("空数组不报错", async () => {
    await expect(bulkDelete(STORE_NAMES.imageAssets, [])).resolves.toBeUndefined();
  });
});

describe("clearStore", () => {
  it("清空指定 store 的所有记录", async () => {
    await putInStore(STORE_NAMES.conversations, { id: "c-1", title: "对话1" });
    await putInStore(STORE_NAMES.conversations, { id: "c-2", title: "对话2" });

    await clearStore(STORE_NAMES.conversations);

    const result = await getAllFromStore(STORE_NAMES.conversations);
    expect(result).toEqual([]);
  });
});
