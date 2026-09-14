import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {planGallery} from '../app/gallery-plan.mjs';
import {selectMedia} from '../app/gallery.mjs';

const widths = [280, 320, 360, 390, 430, 600, 690, 720, 760, 820, 1024];
const ratios = [.15, .25, .424, .5, .75, 1, 1.4, 1.622, 2.4, 4, 8];
const epsilon = .02;

function assertLayout(items, width) {
  const plan = planGallery(items, width);
  const context = `${items.length} images at ${width}px`;
  assert.equal(plan.boxes.length, items.length, `stale or missing block: ${context}`);
  assert.ok(Number.isFinite(plan.height) && plan.height >= 0, context);
  assert.deepEqual(plan.boxes.map(box => box.index), items.map((_, index) => index), context);
  if (!items.length) {
    assert.equal(plan.height, 0, 'empty galleries must not reserve an image area');
    return;
  }
  for (const [i, a] of plan.boxes.entries()) {
    assert.ok([a.x, a.y, a.width, a.height, a.imageHeight].every(Number.isFinite), context);
    assert.ok(a.width > 0 && a.imageHeight > 0, context);
    assert.ok(a.x >= -epsilon && a.y >= -epsilon, context);
    assert.ok(a.x + a.width <= width + epsilon, context);
    assert.ok(a.y + a.height <= plan.height + epsilon, context);
    assert.ok(Math.abs(a.width / a.imageHeight - items[i].ratio) < .001,
      `official image must not be stretched or cropped: ${context}`);
    for (const b of plan.boxes.slice(i + 1)) {
      const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      assert.ok(overlapX <= epsilon || overlapY <= epsilon, `overlap: ${context}`);
    }
  }
  assert.ok(Math.abs(Math.max(...plan.boxes.map(b => b.x + b.width)) - width) < epsilon,
    `unused right band: ${context}`);
  assert.ok(Math.abs(Math.max(...plan.boxes.map(b => b.y + b.height)) - plan.height) < epsilon,
    `unused bottom band: ${context}`);
}

test('automatic gallery packs 0-40 images across phone and folding-tablet widths', () => {
  for (const width of widths) {
    for (let count = 0; count <= 40; count++) {
      for (let offset = 0; offset < ratios.length; offset++) {
        assertLayout(Array.from({length: count}, (_, i) => ({
          ratio: ratios[(i + offset) % ratios.length],
          kind: i < 3 ? 'campaign' : 'menu',
          captionHeight: 56
        })), width);
      }
    }
  }
});

test('published official image proportions pack for every current chain', () => {
  const data = JSON.parse(fs.readFileSync(new URL('../app/data/gallery.json', import.meta.url)));
  for (const brandId of new Set(data.assets.map(a => a.brandId))) {
    const items = data.assets.filter(a => a.brandId === brandId).map(a => ({
      ratio: a.width / a.height, kind: a.kind, captionHeight: 56
    }));
    for (const width of widths) assertLayout(items, width);
  }
});

test('new and removed fairs change block counts without stale auxiliary images', () => {
  const now = new Date('2026-09-15T00:00:00Z');
  const checkedAt = now.toISOString();
  const make = i => ({id: `fair-${i}`, title: `Fair ${i}`, contentHash: `hash-${i}`,
    imageUrl: `https://official.example/fair-${i}.jpg`,
    officialUrl: `https://official.example/fair-${i}/`});
  const allRows = Array.from({length: 40}, (_, i) => make(i));
  const data = {assets: allRows.map(c => ({
    brandId: 'test-chain', kind: 'detail', rank: 20, campaignId: c.id,
    parentHash: c.contentHash, checkedAt, title: `Detail ${c.id}`,
    imageUrl: `https://official.example/${c.id}-detail.jpg`, officialUrl: c.officialUrl
  }))};
  for (const count of [0, 1, 2, 5, 12, 40, 7, 3, 0, 6]) {
    const rows = allRows.slice(0, count);
    const media = selectMedia(rows, 'test-chain', data, 'active', now);
    assert.equal(media.length, count * 2, `${count} current fairs must own exactly their image blocks`);
    assert.ok(media.every(a => rows.some(c => c.id === a.campaignId)), 'removed fair leaked into gallery');
  }
  const changed = [{...allRows[0], contentHash: 'new-official-content'}];
  assert.equal(selectMedia(changed, 'test-chain', data, 'active', now).length, 1,
    'old detail images must not survive a changed official page');
});
