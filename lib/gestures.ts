export type Point = { x: number; y: number; z?: number };
export type GestureAction = 'next' | 'previous' | 'toggle';
export type HandFrame = {
  hands: Point[][];
  labels: { name: string; score: number }[];
};
export type GestureFeedback = {
  action?: GestureAction;
  x?: number;
  y?: number;
  progress: number;
  hint: string;
};
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Display coordinates are mirrored exactly once here, matching the camera preview. */
export class GestureGate {
  private releaseSince: number | null = null;
  private lockedUntil = 0;
  private locked = false;
  private palmSince: number | null = null;
  private origin: Point | null = null;
  private pinchSince: number | null = null;
  private lastHand: Point | null = null;
  reset() {
    this.releaseSince = null;
    this.lockedUntil = 0;
    this.locked = false;
    this.clear();
  }
  private clear() {
    this.palmSince = null;
    this.origin = null;
    this.pinchSince = null;
    this.lastHand = null;
  }
  private fire(
    action: GestureAction,
    now: number,
    x: number,
    y: number,
  ): GestureFeedback {
    this.locked = true;
    this.lockedUntil = now + 1100;
    this.releaseSince = null;
    this.clear();
    return {
      action,
      x,
      y,
      progress: 1,
      hint:
        action === 'next'
          ? '次の動画へ'
          : action === 'previous'
            ? '前の動画へ'
            : '再生 / 一時停止',
    };
  }
  update(frame: HandFrame, now: number): GestureFeedback {
    const hand =
      frame.hands.length === 1 && frame.hands[0]?.length === 21
        ? frame.hands[0]
        : null;
    const label = frame.labels[0];
    const open = !!hand && label?.name === 'Open_Palm' && label.score >= 0.75;
    const palmSize = hand ? distance(hand[5], hand[17]) : 0;
    const pinch =
      !!hand &&
      palmSize > 0.045 &&
      distance(hand[4], hand[8]) / palmSize < 0.28;
    const x = hand ? 1 - (hand[0].x + hand[5].x + hand[17].x) / 3 : undefined;
    const y = hand ? (hand[0].y + hand[5].y + hand[17].y) / 3 : undefined;
    if (this.locked) {
      if (
        frame.hands.length === 0 ||
        (frame.hands.length === 1 && !open && !pinch)
      )
        this.releaseSince ??= now;
      else this.releaseSince = null;
      if (
        now >= this.lockedUntil &&
        this.releaseSince !== null &&
        now - this.releaseSince >= 350
      ) {
        this.locked = false;
        this.clear();
      }
      return {
        x,
        y,
        progress: 0,
        hint: '手を一度下ろすと、もう一度操作できます',
      };
    }
    if (!hand || x === undefined || y === undefined || palmSize < 0.045) {
      this.clear();
      return {
        progress: 0,
        hint:
          frame.hands.length > 1
            ? '片手だけを映してください'
            : 'カメラに片手を見せてください',
      };
    }
    if (this.lastHand && distance(this.lastHand, { x, y }) > 0.4) this.clear();
    this.lastHand = { x, y };
    if (pinch) {
      this.palmSince = null;
      this.origin = null;
      this.pinchSince ??= now;
      const progress = Math.min((now - this.pinchSince) / 750, 1);
      if (progress >= 1) return this.fire('toggle', now, x, y);
      return { x, y, progress, hint: '親指と人差し指をつまんでキープ…' };
    }
    this.pinchSince = null;
    if (!open) {
      this.palmSince = null;
      this.origin = null;
      return {
        x,
        y,
        progress: 0,
        hint: '手をひらいて左右へ / つまんで再生・停止',
      };
    }
    if (this.palmSince === null) {
      this.palmSince = now;
      this.origin = { x, y };
    }
    const age = now - this.palmSince;
    const dx = x - this.origin!.x,
      dy = y - this.origin!.y;
    if (
      age >= 240 &&
      age <= 1200 &&
      Math.abs(dx) >= 0.25 &&
      Math.abs(dy) < 0.17
    )
      return this.fire(dx < 0 ? 'next' : 'previous', now, x, y);
    if (age > 1200 || Math.abs(dy) > 0.17) {
      this.palmSince = now;
      this.origin = { x, y };
    }
    return {
      x,
      y,
      progress: Math.min(Math.abs(dx) / 0.25, 0.95),
      hint:
        age < 240
          ? '手を認識しています…'
          : '手をひらいたまま、左右に払ってみよう',
    };
  }
}
