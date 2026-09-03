import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextPlayable } from '../lib/playlist.ts';
import { GestureGate, type Point, type HandFrame } from '../lib/gestures.ts';

void test('playlist runs through ten complete loops, preserving order', () => {
  const items = ['A', 'B', 'C'].map((id) => ({ id }));
  let current = 'A';
  for (let i = 1; i <= 30; i++) {
    current = nextPlayable(items, current, 1)!.id;
    assert.equal(current, items[i % 3].id);
  }
});
void test('one clip repeats, reverse wraps, empty and all-broken lists terminate', () => {
  assert.equal(nextPlayable([{ id: 'A' }], 'A', 1)?.id, 'A');
  assert.equal(nextPlayable([{ id: 'A' }, { id: 'B' }], 'A', -1)?.id, 'B');
  assert.equal(nextPlayable([], null, 1), undefined);
  assert.equal(nextPlayable([{ id: 'A', failed: true }], 'A', 1), undefined);
  assert.equal(
    nextPlayable([{ id: 'A' }, { id: 'B' }], 'A', 1, new Set(['A', 'B'])),
    undefined,
  );
});
void test('broken files are skipped in both directions; active removal chooses a valid item', () => {
  const items = [{ id: 'A' }, { id: 'bad', failed: true }, { id: 'C' }];
  assert.equal(nextPlayable(items, 'A', 1)?.id, 'C');
  assert.equal(nextPlayable(items, 'C', -1)?.id, 'A');
  assert.equal(nextPlayable([{ id: 'A' }, { id: 'C' }], 'removed', 1)?.id, 'A');
});
function frame(displayX = 0.6, pinch = false, open = true): HandFrame {
  const hand: Point[] = Array.from({ length: 21 }, () => ({
    x: 1 - displayX,
    y: 0.5,
  }));
  hand[5] = { x: 1 - displayX - 0.1, y: 0.5 };
  hand[17] = { x: 1 - displayX + 0.1, y: 0.5 };
  hand[4] = { x: 1 - displayX, y: 0.3 };
  hand[8] = { x: 1 - displayX + (pinch ? 0.02 : 0.2), y: 0.3 };
  return {
    hands: [hand],
    labels: [{ name: open ? 'Open_Palm' : 'None', score: 0.95 }],
  };
}
void test('mirrored viewer-left swipe goes next; held/continuous hand cannot repeat', () => {
  const gate = new GestureGate();
  gate.update(frame(0.8), 0);
  gate.update(frame(0.74), 150);
  assert.equal(gate.update(frame(0.5), 400).action, 'next');
  for (let t = 500; t < 4000; t += 100)
    assert.equal(gate.update(frame(0.5), t).action, undefined);
});
void test('viewer-right swipe goes previous; release and cooldown are both required to rearm', () => {
  const gate = new GestureGate();
  gate.update(frame(0.2), 0);
  assert.equal(gate.update(frame(0.5), 400).action, 'previous');
  gate.update({ hands: [], labels: [] }, 500);
  gate.update({ hands: [], labels: [] }, 900);
  assert.equal(gate.update(frame(0.8), 1000).action, undefined);
  gate.update({ hands: [], labels: [] }, 1600);
  gate.update({ hands: [], labels: [] }, 2000);
  gate.update(frame(0.8), 2100);
  assert.equal(gate.update(frame(0.5), 2500).action, 'next');
});
void test('brief pinch does nothing; sustained pinch toggles once until released', () => {
  const gate = new GestureGate();
  gate.update(frame(0.5, true, false), 0);
  assert.equal(gate.update(frame(0.5, true, false), 600).action, undefined);
  assert.equal(gate.update(frame(0.5, true, false), 800).action, 'toggle');
  assert.equal(gate.update(frame(0.5, true, false), 4000).action, undefined);
});
void test('two hands, low confidence and loss of tracking cancel pending commands', () => {
  const gate = new GestureGate();
  gate.update(frame(0.8), 0);
  const two = frame(0.5);
  two.hands.push(two.hands[0]);
  assert.equal(gate.update(two, 400).action, undefined);
  gate.update(frame(0.8), 500);
  gate.update({ hands: [], labels: [] }, 700);
  assert.equal(gate.update(frame(0.5), 900).action, undefined);
  const weak = frame(0.1);
  weak.labels[0].score = 0.2;
  assert.equal(gate.update(weak, 1200).action, undefined);
});
