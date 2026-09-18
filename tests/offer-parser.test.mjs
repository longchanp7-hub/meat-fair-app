import test from 'node:test';
import assert from 'node:assert/strict';
import {taxPrice,classifyOfferKind,canonicalCourseTitle,pruneIncludedRows} from '../scripts/offer-parser.mjs';

test('combined food and drink package is a course, not a drink add-on',()=>{
  const s='9月7日（月）～12月18日（金）まで平日限定。肉匠坂井の学割・「学生応援コース」49品食べ放題＋ソフトドリンク16品飲み放題を100分間。1名様3,000円（税込）・3名様以上、前日まで要予約';
  assert.equal(classifyOfferKind(s),'course');
  assert.deepEqual(taxPrice(s),{price:3000,priceText:'税込3,000円'});
  assert.equal(canonicalCourseTitle(s,'course'),'学生応援コース');
});

test('drink add-on that only references an all-you-can-eat course remains drink',()=>{
  assert.equal(classifyOfferKind('食べ放題コースをご注文のお客様限定 飲み放題 100分 税込1,639円'),'drink');
});

test('食べ飲み放題 is treated as a combined course',()=>{
  assert.equal(classifyOfferKind('学生限定 食べ飲み放題 税込3,000円'),'course');
});

test('included unpriced detail rows are pruned behind a priced combined course',()=>{
  const course={kind:'course',price:3000,rawText:'「学生応援コース」49品食べ放題＋ソフトドリンク16品飲み放題 3,000円（税込）'};
  const rows=[
    course,
    {kind:'course',price:null,rawText:'◎コース内容 49品食べ放題＋ソフトドリンク16品飲み放題'},
    {kind:'drink',price:null,rawText:'ソフトドリンク（飲み放題全16品） ウーロン茶など'}
  ];
  assert.deepEqual(pruneIncludedRows(rows),[course]);
});

test('offer parser does not turn discount amounts into plan prices',()=>{
  assert.deepEqual(taxPrice('牛＆豚食べ放題コース 税込100円引き'),{price:null,priceText:null});
  assert.deepEqual(taxPrice('鴨しゃぶ食べ放題コース 税込200円OFF'),{price:null,priceText:null});
});
