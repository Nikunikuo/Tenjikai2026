export const VISITOR_IDLE_MS = 12_000;

export function browseWork(
  ids: string[],
  selected: string | null,
  direction: number,
) {
  if (!ids.length) return null;
  const found = ids.indexOf(selected ?? '');
  const start = found < 0 ? (direction < 0 ? 0 : ids.length - 1) : found;
  return ids[(start + (direction < 0 ? -1 : 1) + ids.length) % ids.length];
}

/** Three fixed slots keep the selected card centred, without duplicate buttons. */
export function workSlots(ids: string[], selected: string | null) {
  if (!ids.length) return [null, null, null];
  const centre = ids.includes(selected ?? '') ? selected! : ids[0];
  return [
    ids.length > 2 ? browseWork(ids, centre, -1) : null,
    centre,
    ids.length > 1 ? browseWork(ids, centre, 1) : null,
  ];
}

/** A drag may browse once on release, but must never also activate a card. */
export class ReelGesture {
  private pointer: { id: number; x: number; y: number; moved: boolean } | null =
    null;
  start(id: number, x: number, y: number) {
    if (this.pointer) return false;
    this.pointer = { id, x, y, moved: false };
    return true;
  }
  move(id: number, x: number, y: number) {
    const p = this.pointer;
    if (!p || p.id !== id) return null;
    const dx = x - p.x,
      dy = y - p.y;
    p.moved ||= Math.hypot(dx, dy) > 10;
    return { dx, dy, dragged: p.moved };
  }
  end(id: number, x: number, y: number, width: number) {
    const move = this.move(id, x, y);
    if (!move) return null;
    this.pointer = null;
    const threshold = Math.max(48, Math.min(96, width * 0.12));
    const direction =
      Math.abs(move.dx) >= threshold &&
      Math.abs(move.dx) > Math.abs(move.dy) * 1.2
        ? move.dx < 0
          ? 1
          : -1
        : 0;
    return { dragged: move.dragged, direction };
  }
  cancel() {
    this.pointer = null;
  }
}
