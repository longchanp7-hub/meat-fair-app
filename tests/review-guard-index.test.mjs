import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewSemanticallySupported} from '../scripts/review-guard.mjs';

test('multi-campaign index may use explicit body date evidence only when opted in',()=>{
  const page={title:'ブランドトップ',bodyText:'2026/09/10 学割クーポン。2026年12月2日まで延長。'};
  const dates={startDate:'2026-09-19',endDate:'2026-09-27'};
  const base={semanticGuard:true,fields:{title:'学割クーポン',startDate:'2026-09-10',endDate:'2026-12-02',targetCourses:[],limitedIngredients:[],allYouCanEat:false}};
  assert.equal(reviewSemanticallySupported(base,page,dates),false);
  assert.equal(reviewSemanticallySupported({...base,allowBodyDateEvidence:true},page,dates),true);
});

test('explicit semantic terms are all required for reviewed index pages',()=>{
  const page={title:'ブランドトップ',bodyText:'学生向けのお得な学割 10%OFF クーポンを平日限定で配信しています。対象条件をご確認ください。'};
  const dates={startDate:null,endDate:null};
  const review={semanticGuard:true,semanticTerms:['10%OFF','クーポン'],fields:{title:'別タイトル',targetCourses:[],limitedIngredients:[],allYouCanEat:false}};
  assert.equal(reviewSemanticallySupported(review,page,dates),true);
  assert.equal(reviewSemanticallySupported({...review,semanticTerms:['10%OFF','見つからない語']},page,dates),false);
});
