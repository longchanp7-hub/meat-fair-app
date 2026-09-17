import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewSemanticallySupported} from '../scripts/review-guard.mjs';

const review={semanticGuard:true,fields:{
  title:'期間限定 韓国市場（カンコクシジャン）',startDate:'2026-09-16',endDate:'2026-12-08',
  targetCourses:['きんぐコース','プレミアムコース'],limitedIngredients:['韓国'],allYouCanEat:true
}};

test('semantic review guard tolerates harmless markup/body drift while preserving facts',()=>{
  const page={title:'期間限定 韓国市場（カンコクシジャン）',bodyText:'2026年9月16日〜2026年12月8日 韓国市場。きんぐコース・プレミアムコースで期間限定商品が食べ放題。新しい説明文。'};
  assert.equal(reviewSemanticallySupported(review,page,{startDate:'2026-09-16',endDate:'2026-12-08'}),true);
});

test('semantic review guard fails closed on changed dates or missing reviewed course facts',()=>{
  const page={title:'期間限定 韓国市場（カンコクシジャン）',bodyText:'2026年9月16日〜2026年11月30日 韓国市場。きんぐコースのみで食べ放題。'};
  assert.equal(reviewSemanticallySupported(review,page,{startDate:'2026-09-16',endDate:'2026-11-30'}),false);
  assert.equal(reviewSemanticallySupported({...review,semanticGuard:false},page,{startDate:'2026-09-16',endDate:'2026-12-08'}),false);
});
