const CACHE_PREFIX = "secure-attendance:offline:v1:";
const CACHE_VERSION = 1;

function storage() {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

function key(kind, userId) {
  return `${CACHE_PREFIX}${kind}:${userId}`;
}

function readJson(storageKey, fallback) {
  try {
    const value = storage()?.getItem(storageKey);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(storageKey, value) {
  try {
    storage()?.setItem(storageKey, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function createClientRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `web-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function readWorkspaceCache(userId) {
  if (!userId) return null;
  const cached = readJson(key("workspace", userId), null);
  return cached?.version === CACHE_VERSION && cached.workspace ? cached : null;
}

export function writeWorkspaceCache(userId, workspace) {
  if (!userId || !workspace) return false;
  return writeJson(key("workspace", userId), {
    version: CACHE_VERSION,
    savedAt: new Date().toISOString(),
    workspace,
  });
}

export function readOfflineLeaveQueue(userId) {
  if (!userId) return [];
  const queued = readJson(key("leave-queue", userId), []);
  return Array.isArray(queued) ? queued : [];
}

export function writeOfflineLeaveQueue(userId, queue) {
  if (!userId) return false;
  return writeJson(key("leave-queue", userId), queue);
}
