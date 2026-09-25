'use client';

// Reads back files staged by sw.js's Web Share Target handler (see sw.js's
// handleShareTarget) and cleans up the cache entries afterward. Returns an
// empty array if nothing is staged, caching is unsupported, or the session
// id doesn't match anything (e.g. already consumed, or a stale/forged URL).
const SHARE_CACHE = 'zapit-share-target-v1';

interface SharedFileIndexEntry {
  name: string;
  type: string;
  key: string;
}

export async function readSharedFiles(sessionId: string): Promise<File[]> {
  if (typeof caches === 'undefined') return [];

  try {
    const cache = await caches.open(SHARE_CACHE);
    const indexKey = `/shared-file/${sessionId}/index`;
    const indexRes = await cache.match(indexKey);
    if (!indexRes) return [];

    const index = (await indexRes.json()) as SharedFileIndexEntry[];
    const files = await Promise.all(
      index.map(async (entry) => {
        const res = await cache.match(entry.key);
        if (!res) return null;
        const blob = await res.blob();
        return new File([blob], entry.name, { type: entry.type });
      }),
    );

    // Cleanup — this is a one-time handoff, not persistent storage.
    await Promise.all([...index.map((e) => cache.delete(e.key)), cache.delete(indexKey)]);

    return files.filter((f): f is File => f !== null);
  } catch {
    return [];
  }
}
