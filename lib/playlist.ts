export type PlaylistItem = { id: string; failed?: boolean };
/** Bounded search: all-invalid collections terminate; one valid item wraps to itself. */
export function nextPlayable<T extends PlaylistItem>(
  items: T[],
  active: string | null,
  direction: number,
  failed: Set<string> = new Set(),
): T | undefined {
  if (!items.length) return;
  const found = items.findIndex((item) => item.id === active);
  const start = found >= 0 ? found : direction < 0 ? 0 : items.length - 1;
  for (let n = 1; n <= items.length; n++) {
    const candidate =
      items[
        (((start + (direction < 0 ? -n : n)) % items.length) + items.length) %
          items.length
      ];
    if (!candidate.failed && !failed.has(candidate.id)) return candidate;
  }
}
