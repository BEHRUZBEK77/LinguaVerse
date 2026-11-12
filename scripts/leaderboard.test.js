const assert = require('node:assert/strict');
const test = require('node:test');
const { writeInBatches } = require('../netlify/functions/update-leaderboard.js');

test('leaderboard writes run at most 5 at a time and all complete', async () => {
  let active = 0, peak = 0;
  const done = [];
  const items = [...Array(12).keys()];
  const written = await writeInBatches(items, async i => {
    active++; peak = Math.max(peak, active);
    await new Promise(r => setTimeout(r, 2));
    done.push(i); active--;
  });
  assert.equal(written, 12);
  assert.equal(peak, 5);
  assert.deepEqual(done.sort((a, b) => a - b), items);
});
