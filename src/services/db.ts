const DB_NAME = "gpt-image-studio";
const DB_VERSION = 3;

export const STORE_NAMES = {
  conversations: "conversations",
  messages: "messages",
  imageAssets: "imageAssets",
  imageBlobs: "imageBlobs",
  settings: "settings",
  conversationDrafts: "conversationDrafts",
} as const;

type StoreName = (typeof STORE_NAMES)[keyof typeof STORE_NAMES];

let dbPromise: Promise<IDBDatabase> | null = null;

/** 重置内部缓存的数据库连接 Promise（仅供测试使用）。 */
export function resetDbCache() {
  dbPromise = null;
}

/**
 * 打开 IndexedDB 数据库。
 * 如果打开失败（数据库损坏、版本冲突等），自动删除后重建。
 * 重建后数据会丢失，但用户可以通过备份恢复。
 */
export function getStudioDb() {
  if (!dbPromise) {
    dbPromise = openDb().catch(async (error) => {
      console.error("[db] 数据库打开失败，尝试重建...", error);
      dbPromise = null;
      await deleteDb();
      return openDb();
    });
  }

  return dbPromise;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const transaction = request.transaction;

      if (!db.objectStoreNames.contains(STORE_NAMES.conversations)) {
        const store = db.createObjectStore(STORE_NAMES.conversations, {
          keyPath: "id",
        });
        store.createIndex("updatedAt", "updatedAt");
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.messages)) {
        const store = db.createObjectStore(STORE_NAMES.messages, {
          keyPath: "id",
        });
        store.createIndex("conversationId", "conversationId");
        store.createIndex("createdAt", "createdAt");
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.imageAssets)) {
        const store = db.createObjectStore(STORE_NAMES.imageAssets, {
          keyPath: "id",
        });
        store.createIndex("createdAt", "createdAt");
        store.createIndex("conversationId", "conversationId");
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.imageBlobs)) {
        db.createObjectStore(STORE_NAMES.imageBlobs, {
          keyPath: "key",
        });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.settings)) {
        db.createObjectStore(STORE_NAMES.settings, {
          keyPath: "key",
        });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.conversationDrafts)) {
        const store = db.createObjectStore(STORE_NAMES.conversationDrafts, {
          keyPath: "conversationId",
        });
        store.createIndex("updatedAtMs", "updatedAtMs");
      }

      if (event.oldVersion < 2) {
        replaceIndex(transaction, db, STORE_NAMES.conversations, "updatedAtMs", "updatedAt");
        replaceIndex(transaction, db, STORE_NAMES.messages, "createdAtMs", "createdAt");
        replaceIndex(transaction, db, STORE_NAMES.imageAssets, "createdAtMs", "createdAt");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      console.warn("[db] 数据库删除被阻塞，其他标签页可能仍在使用");
      resolve(); // 继续尝试重建
    };
  });
}

function replaceIndex(
  transaction: IDBTransaction | null,
  db: IDBDatabase,
  storeName: StoreName,
  oldIndexName: string,
  newIndexName: string,
) {
  if (!transaction || !db.objectStoreNames.contains(storeName)) return;

  const store = transaction.objectStore(storeName);
  if (store.indexNames.contains(oldIndexName)) {
    store.deleteIndex(oldIndexName);
  }
  if (!store.indexNames.contains(newIndexName)) {
    store.createIndex(newIndexName, newIndexName);
  }
}

export async function getAllFromStore<T>(storeName: StoreName) {
  const db = await getStudioDb();
  const transaction = db.transaction(storeName, "readonly");
  const store = transaction.objectStore(storeName);
  return requestToPromise<T[]>(store.getAll());
}

export async function getFromStore<T>(storeName: StoreName, key: IDBValidKey) {
  const db = await getStudioDb();
  const transaction = db.transaction(storeName, "readonly");
  const store = transaction.objectStore(storeName);
  return requestToPromise<T | undefined>(store.get(key));
}

export async function putInStore<T>(storeName: StoreName, value: T) {
  const db = await getStudioDb();
  const transaction = db.transaction(storeName, "readwrite");
  const store = transaction.objectStore(storeName);
  store.put(value);
  await transactionDone(transaction);
}

export async function deleteFromStore(storeName: StoreName, key: IDBValidKey) {
  const db = await getStudioDb();
  const transaction = db.transaction(storeName, "readwrite");
  const store = transaction.objectStore(storeName);
  store.delete(key);
  await transactionDone(transaction);
}

/**
 * 批量写入：把多条记录放到同一个事务里一次性 put。
 * 相比循环调用 putInStore（每次都开一个事务+一次事务完成事件），
 * 批量写入把 N 次 round-trip 合并成 1 次，备份恢复/迁移场景下提升明显。
 */
export async function bulkPut<T>(storeName: StoreName, values: readonly T[]) {
  if (!values.length) return;
  const db = await getStudioDb();
  const transaction = db.transaction(storeName, "readwrite");
  const store = transaction.objectStore(storeName);
  for (const value of values) {
    store.put(value);
  }
  await transactionDone(transaction);
}

/**
 * 批量删除：同上，把多个 key 合并到单个事务。
 */
export async function bulkDelete(storeName: StoreName, keys: readonly IDBValidKey[]) {
  if (!keys.length) return;
  const db = await getStudioDb();
  const transaction = db.transaction(storeName, "readwrite");
  const store = transaction.objectStore(storeName);
  for (const key of keys) {
    store.delete(key);
  }
  await transactionDone(transaction);
}

export async function clearStore(storeName: StoreName) {
  const db = await getStudioDb();
  const transaction = db.transaction(storeName, "readwrite");
  const store = transaction.objectStore(storeName);
  store.clear();
  await transactionDone(transaction);
}

function requestToPromise<T>(request: IDBRequest) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
