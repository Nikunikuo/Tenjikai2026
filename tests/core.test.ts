import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextPlayable } from '../lib/playlist.ts';

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
