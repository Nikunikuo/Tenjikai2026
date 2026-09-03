import { test } from 'node:test';
import assert from 'node:assert/strict';
import { browseWork, ReelGesture, workSlots } from '../lib/visitor.ts';

void test('browsing wraps independently of playback; empty and removed selections recover', () => {
  const ids = ['A', 'B', 'C'];
  assert.equal(browseWork(ids, 'C', 1), 'A');
  assert.equal(browseWork(ids, 'A', -1), 'C');
  assert.equal(browseWork(ids, 'removed', 1), 'A');
  assert.equal(browseWork([], null, 1), null);
  assert.deepEqual(workSlots(ids, 'B'), ['A', 'B', 'C']);
  assert.deepEqual(workSlots(['A'], 'A'), [null, 'A', null]);
  assert.deepEqual(workSlots(['A', 'B'], 'B'), [null, 'B', 'A']);
  assert.deepEqual(workSlots(['A'], 'removed'), [null, 'A', null]);
});

void test('a steady click is not a swipe; one long drag browses exactly once', () => {
  const gesture = new ReelGesture();
  gesture.start(1, 200, 100);
  assert.deepEqual(gesture.end(1, 205, 102, 600), {
    dragged: false,
    direction: 0,
  });
  gesture.start(1, 250, 100);
  gesture.move(1, 180, 102);
  assert.deepEqual(gesture.end(1, -500, 110, 600), {
    dragged: true,
    direction: 1,
  });
  assert.equal(gesture.end(1, -500, 110, 600), null);
  gesture.start(1, 50, 100);
  assert.deepEqual(gesture.end(1, 200, 100, 600), {
    dragged: true,
    direction: -1,
  });
});

void test('vertical, short, and return-to-origin drags suppress clicks without choosing a work', () => {
  const gesture = new ReelGesture();
  for (const [x, y] of [
    [120, 250],
    [120, 100],
  ]) {
    gesture.start(1, 100, 100);
    assert.deepEqual(gesture.end(1, x, y, 600), {
      dragged: true,
      direction: 0,
    });
  }
  gesture.start(1, 100, 100);
  gesture.move(1, 240, 100);
  assert.deepEqual(gesture.end(1, 100, 100, 600), {
    dragged: true,
    direction: 0,
  });
});

void test('cancellation and extra pointers cannot commit a stale drag', () => {
  const gesture = new ReelGesture();
  assert.equal(gesture.start(1, 100, 100), true);
  assert.equal(gesture.start(2, 100, 100), false);
  assert.equal(gesture.end(2, 500, 100, 600), null);
  assert.deepEqual(gesture.end(1, 100, 100, 600), {
    dragged: false,
    direction: 0,
  });
  gesture.start(3, 100, 100);
  gesture.move(3, 500, 100);
  gesture.cancel();
  assert.equal(gesture.end(3, 500, 100, 600), null);
  assert.equal(gesture.start(4, 100, 100), true);
  assert.deepEqual(gesture.end(4, 100, 100, 600), {
    dragged: false,
    direction: 0,
  });
});
