/** Runs async tasks with bounded concurrency, preserving result order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Groups items into batches whose summed weight stays under `max` (each batch has at least one item). */
export function batchByWeight<T>(items: T[], weight: (t: T) => number, max: number): T[][] {
  const out: T[][] = [];
  let cur: T[] = [];
  let w = 0;
  for (const it of items) {
    const iw = weight(it);
    if (cur.length && w + iw > max) {
      out.push(cur);
      cur = [];
      w = 0;
    }
    cur.push(it);
    w += iw;
  }
  if (cur.length) out.push(cur);
  return out;
}
