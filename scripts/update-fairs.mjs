import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { SOURCES } from './source-registry.mjs';
import { validateDataset, validateCampaign } from './quality-gate.mjs';
import {
  linksFromHtml, rawDetailUrls, relevantTitle, allowedPath, campaignId,
  textFromHtml, titleFromHtml, dateFields, imageCandidatesFromHtml,
  deriveFields, canonicalUrl, firstDate, lifecycleFields, targetCoursesFromText
} from './fair-utils.mjs';
import {
  NEXT_ROLLOUT_IDS, rawRolloutUrls, allowedRolloutPath,
  rolloutTitleRelevant, adjustRolloutFields
} from './rollout-utils.mjs';

const OUT = new URL('../app/data/fairs.json', import.meta.url);
const CANDIDATE = new URL('../app/data/candidates.json', import.meta.url);

const BASE_IDS = SOURCES.slice(0, 4).map(x => x.brandId);
const DISCOVERY_IDS = new Set([...BASE_IDS, ...NEXT_ROLLOUT_IDS]);
const DISCOVERY_SOURCES = SOURCES.filter(x => DISCOVERY_IDS.has(x.brandId));
const PROMOTE_IDS = new Set(BASE_IDS); // next four remain candidate-only until this audit passes

const NON_FOOD = /(?:アンケート|Q\d|学生|食育|啓発|採用|求人|抽選会|大抽選|スピードくじ|ポイント山分け|プレゼント|アプリ会員.{0,12}(?:突破|記念)|アプリプレゼント|SNS|フォロー|リポスト|グッズ|キャンペーン開催記念|テイクアウト|お持ち帰り|d払い|PayPay|映画|プリキュア|キッズ|おこさま|改装|オープン|休業|営業時間)/i;
const FOOD_SIGNAL = /(?:フェア|フェス|期間限定|季節|食べ放題|半額|OFF|割引|お値打ち|ナイト割|お得|敬老|キャンペーン|特別価格|コース|メニュー|牛タン|牛たん|カルビ|焼肉|しゃぶ|鴨|きのこ|松茸|寿司|サーモン|秋刀魚|蟹|かに|肉|デザート|台湾|ポルチーニ|コムタン|海鮮チゲ)/i;

async function fetchText(url) {
  const r = await fetch(url, {
    headers: { 'user-agent': 'meat-fair-app/0.7 (+github-actions)' },
    signal: AbortSignal.timeout(12000)
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.text();
}

const auxCache = new Map();
async function fetchCached(url) {
  if (!auxCache.has(url)) auxCache.set(url, fetchText(url));
  return await auxCache.get(url);
}

function contentText(html = '') {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (main) return textFromHtml(main[1]);
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  return textFromHtml(article ? article[1] : html);
}

function metaTitle(html = '') {
  const m =
    html.match(/<meta[^>]+(?:property|name)=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:title["']/i) ||
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? textFromHtml(m[1]) : '';
}

function cleanTitle(brandId, title = '') {
  let t = String(title)
    .replace(/^\s*20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}\s*/, '')
    .replace(/\s*\|\s*焼肉なら「牛角」\s*$/, '')
    .replace(/\s*[|｜]\s*(?:国産牛)?焼肉食べ放題.*$/i, '')
    .replace(/\s*[|｜]\s*$/, '')
    .replace(/\s*｜\s*[^｜]{0,30}公式サイト.*$/, '')
    .trim();

  const brand = DISCOVERY_SOURCES.find(x => x.brandId === brandId);
  for (const name of [
    brand?.name, 'あみやき亭Plus', 'あみやき亭',
    'しゃぶしゃぶ温野菜', '国産牛焼肉食べ放題 肉匠坂井'
  ].filter(Boolean)) t = t.split(name).join(' ');

  t = t.replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 2; i++) {
    const m = t.match(/^(.{3,}?)\s+\1$/);
    if (m) t = m[1].trim();
  }
  if (brandId === 'yakiniku-king' && /韓国市場/.test(t)) {
    return '期間限定 韓国市場（カンコクシジャン）';
  }
  return t || title;
}

function rawCampaignTitle(brandId, html, link) {
  const page = titleFromHtml(html) || '';
  const meta = metaTitle(html);
  const anchor = link.title || '';
  if (NEXT_ROLLOUT_IDS.includes(brandId)) {
    for (const t of [anchor, meta, page]) {
      if (t && rolloutTitleRelevant(brandId, t)) return t;
    }
    return anchor || meta || page;
  }
  return page || meta || anchor;
}

function iso(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function urlDateHint(url = '') {
  try {
    const p = new URL(url).pathname;
    const ym = p.match(/\/(20\d{2})\/(\d{1,2})\//);
    if (ym) return { year: Number(ym[1]), month: Number(ym[2]) };
    const y = p.match(/\/(20\d{2})\//);
    if (y) return { year: Number(y[1]), month: null };
  } catch {}
  return null;
}

function dottedDate(s = '') {
  const m = s.match(/\b(20\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})\b/);
  return m ? iso(Number(m[1]), Number(m[2]), Number(m[3])) : null;
}

function publishedDateFromHtml(html = '', url = '', text = '', rawTitle = '') {
  const patterns = [
    /article:published_time["'][^>]*content=["'](20\d{2}-\d{2}-\d{2})/i,
    /content=["'](20\d{2}-\d{2}-\d{2})[^"']*["'][^>]*(?:article:published_time|datePublished)/i,
    /datePublished["']?\s*:\s*["'](20\d{2}-\d{2}-\d{2})/i,
    /<time[^>]+datetime=["'](20\d{2}-\d{2}-\d{2})/i
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }

  const dotted = dottedDate(rawTitle) || dottedDate(text.slice(0, 500));
  if (dotted) return dotted;

  const hint = urlDateHint(url);
  const bodyDate = firstDate(text);
  if (!bodyDate) return null;
  if (!hint) return bodyDate;
  const by = Number(bodyDate.slice(0, 4));
  const bm = Number(bodyDate.slice(5, 7));
  if (by !== hint.year) return null;
  if (hint.month && bm !== hint.month) return null;
  return bodyDate;
}

function yearForMonth(publishedDate, url) {
  const hint = urlDateHint(url);
  if (hint?.year) return hint.year;
  return publishedDate ? Number(publishedDate.slice(0, 4)) : null;
}

function rangeFromMatch(m, yearHint) {
  if (!m || !yearHint) return null;
  const sm = Number(m[1]), sd = Number(m[2]), em = Number(m[3]), ed = Number(m[4]);
  let ey = yearHint;
  if (em < sm) ey++;
  return {
    startDate: iso(yearHint, sm, sd),
    endDate: iso(ey, em, ed),
    endDateText: null
  };
}

function partialDates(text = '', yearHint) {
  if (!yearHint) return null;
  let m = text.match(/(\d{1,2})月\s*(\d{1,2})日[^0-9]{0,30}[～〜~\-－—][^0-9]{0,30}(\d{1,2})月\s*(\d{1,2})日/);
  if (m) return rangeFromMatch(m, yearHint);

  m = text.match(/(\d{1,2})月\s*(\d{1,2})日/);
  if (!m) return null;
  return {
    startDate: iso(yearHint, Number(m[1]), Number(m[2])),
    endDate: null,
    endDateText: /なくなり次第終了/.test(text) ? 'なくなり次第終了' : null
  };
}

function labelledPeriodDates(text = '', yearHint) {
  if (!yearHint) return null;
  const labels = ['販売期間', '開催期間', '実施期間', '提供期間', 'フェア期間'];
  for (const label of labels) {
    const idx = text.indexOf(label);
    if (idx < 0) continue;
    const chunk = text.slice(idx, idx + 260);
    const m = chunk.match(/(\d{1,2})月\s*(\d{1,2})日[\s\S]{0,45}?[～〜~\-－—][\s\S]{0,45}?(\d{1,2})月\s*(\d{1,2})日/);
    if (m) return rangeFromMatch(m, yearHint);
  }
  return null;
}

function campaignDates(title, text, html, url, publishedDate) {
  const titleFull = dateFields(title);
  if (titleFull.startDate && titleFull.endDate) return titleFull;

  const yearHint = yearForMonth(publishedDate, url);
  const titlePartial = partialDates(title, yearHint);
  const labelled = labelledPeriodDates(text, yearHint);
  const bodyFull = dateFields(text);
  const bodyPartial = partialDates(text, yearHint);

  if (titlePartial?.startDate) {
    const matching = [labelled, bodyFull, bodyPartial].find(x => x?.startDate === titlePartial.startDate);
    return {
      startDate: titlePartial.startDate,
      endDate: titlePartial.endDate || matching?.endDate || null,
      endDateText: titlePartial.endDateText || matching?.endDateText || null
    };
  }
  if (labelled) return labelled;
  if (bodyFull.startDate || bodyFull.endDate) return bodyFull;
  if (bodyPartial) return bodyPartial;
  return { startDate: null, startDateText: null, endDate: null, endDateText: null };
}

function kingHomeVisualScore(title, url) {
  const u = url.toLowerCase();
  let bonus = 0;
  if (title.includes('ハワイ')) {
    if (/king2101_hawaii/.test(u)) bonus += 55;
    else if (/hawaii|hawaiian/.test(u)) bonus += 36;
    if (/kingshawaiian/.test(u)) bonus -= 24;
    if (/1500x1500|1500_1500/.test(u)) bonus += 5;
  }
  if (title.includes('韓国')) {
    if (/korea|korean|kankoku|kannkoku|shijang|shijan/.test(u)) bonus += 34;
    if (/chusenkai|speedkuji|yamawake|抽選|kuji/.test(u)) bonus -= 40;
  }
  return bonus;
}

function nearbyImageText(html, url) {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
    if (!name) return '';
    let i = html.indexOf(name);
    if (i < 0) i = html.toLowerCase().indexOf(name.toLowerCase());
    if (i < 0) return '';
    return textFromHtml(html.slice(Math.max(0, i - 650), Math.min(html.length, i + 1100)));
  } catch {
    return '';
  }
}

function brandVisualBoost(brandId, title, url, ctx = '') {
  const u = url.toLowerCase();
  let bonus = 0;
  if (brandId === 'gyukaku' && /牛タン|牛たん/.test(title)) {
    if (/牛タン|牛たん|タン塩|ねぎ牛タン|上タン/.test(ctx)) bonus += 42;
    if (/ビール|ハイボール|サワー|アルコール|ドリンク|飲み放題|ジョッキ/.test(ctx)) bonus -= 70;
    if (/beer|drink|alcohol|sour|highball/.test(u)) bonus -= 70;
    if (/ogp\.png/.test(u)) bonus += 30;
  }
  if (brandId === 'syabuyo') {
    if (/秋のきのこと鴨しゃぶフェア|鴨肉と6種のきのこ|秋の味覚/.test(ctx)) bonus += 26;
    if (/おすすめのお肉|柔らかくジューシーな鴨肉|鴨ロース肉/.test(ctx)) bonus -= 18;
    if (/ss_0901_pc_01/.test(u)) bonus += 45;
    if (/ss_0901_pc_02/.test(u)) bonus -= 12;
  }
  if (brandId === 'yuzuan') {
    if (/旬のごちそう|秋期間限定|期間限定メニュー/.test(ctx)) bonus += 20;
    if (/web_sushi_1500x1000_2609/.test(u)) bonus += 40;
    if (/seasonal-abstract|app_suhi|app_sushi/.test(u)) bonus -= 35;
    if (/握り|手巻き|茶碗蒸し|単品|三貫盛り/.test(ctx)) bonus -= 8;
  }
  if (brandId === 'amiyakitei') {
    if (/厚切り|牛ハラミ|タン|ロースステーキ/.test(ctx)) bonus += 18;
    if (/coupon|クーポン/.test(`${u} ${ctx}`)) bonus -= 20;
  }
  if (brandId === 'onyasai') {
    if (/食べ放題|しゃぶしゃぶ|国産野菜|ポルチーニ|鴨|敬老|海鮮チゲ|コムタン/.test(ctx)) bonus += 18;
    if (/qr|coupon|クーポン/.test(`${u} ${ctx}`)) bonus -= 18;
  }
  if (brandId === 'nikusho-sakai') {
    if (/台湾|肩ロース|鶏もも|ルーロー|焼肉/.test(ctx)) bonus += 16;
  }
  if (brandId === 'washoku-sato') {
    if (/松茸|サーモン|食べ放題|なごやめし/.test(ctx)) bonus += 16;
    if (/テイクアウト|お持ち帰り/.test(ctx)) bonus -= 25;
  }
  return bonus;
}

function decorateCandidates(brandId, title, html, list, source, baseBonus = 0) {
  return list.map(c => {
    const ctx = nearbyImageText(html, c.url);
    return { ...c, score: c.score + baseBonus + brandVisualBoost(brandId, title, c.url, ctx), source };
  });
}

async function selectFoodImage(brandId, html, officialUrl, title) {
  const candidates = decorateCandidates(
    brandId, title, html, imageCandidatesFromHtml(html, officialUrl, { title }), 'detail'
  );
  const links = linksFromHtml(html, officialUrl);
  const extras = [];

  if (brandId === 'yuzuan') {
    for (const x of links.filter(x => new URL(x.url).pathname === '/seasonal/' || new URL(x.url).pathname.startsWith('/seasonal/')).slice(0, 2)) {
      extras.push(x.url);
    }
  } else if (brandId === 'yakiniku-king' && !new URL(officialUrl).pathname.startsWith('/menu_all/season/')) {
    const x = links.find(x => /\/menu_all\/season\/[A-Za-z0-9_-]+\/?$/.test(new URL(x.url).pathname));
    if (x) extras.push(x.url);
  }

  for (const url of [...new Set(extras)]) {
    try {
      const linkedHtml = await fetchCached(url);
      candidates.push(...decorateCandidates(
        brandId, title, linkedHtml, imageCandidatesFromHtml(linkedHtml, url, { title }), 'campaign-page', 5
      ));
    } catch {}
  }

  if (brandId === 'yakiniku-king' && /(ハワイ|韓国)/.test(title)) {
    try {
      const homeUrl = 'https://www.yakiniku-king.jp/';
      const homeHtml = await fetchCached(homeUrl);
      for (const c of imageCandidatesFromHtml(homeHtml, homeUrl, { title })) {
        const bonus = kingHomeVisualScore(title, c.url);
        if (bonus > 0) candidates.push({ ...c, score: c.score + bonus, source: 'brand-home-campaign' });
      }
    } catch {}
  }

  const bestByUrl = new Map();
  for (const c of candidates) {
    const old = bestByUrl.get(c.url);
    if (!old || c.score > old.score) bestByUrl.set(c.url, c);
  }
  const best = [...bestByUrl.values()].sort((a, b) => b.score - a.score)[0];
  return best && best.score >= 5 ? best.url : null;
}

function titleKey(s = '') {
  let t = s;
  for (const b of DISCOVERY_SOURCES) t = t.replaceAll(b.name, '');
  return t
    .replace(/20\d{2}年\d{1,2}月\d{1,2}日[^「『]*/g, '')
    .replace(/お知らせ|期間限定|販売開始|発売開始|開催します|開催|フェア|フェス|キャンペーン/g, '')
    .replace(/[\s　!！?？。、・「」『』（）()\-~〜～|｜]/g, '')
    .trim();
}

function foodRelevant(c) {
  if (NON_FOOD.test(c.title)) return false;
  if (!['P1', 'P2'].includes(c.priority)) return false;
  return FOOD_SIGNAL.test(`${c.title} ${(c.limitedIngredients || []).join(' ')} ${(c.targetCourses || []).join(' ')}`);
}

function richer(a, b) {
  const score = c =>
    (['seasonal_index', 'campaign_detail'].includes(c.sourceType) ? 6 : 0) +
    (c.endDate ? 3 : 0) +
    (c.startDate ? 2 : 0) +
    (c.imageUrl ? 2 : 0) +
    (c.targetCourses?.length || 0) +
    (c.limitedIngredients?.length || 0) / 10 +
    (c.priority === 'P1' ? 2 : 0);
  return score(a) >= score(b) ? a : b;
}

function similarCampaign(a, b) {
  if (a.brandId !== b.brandId) return false;
  const ak = titleKey(a.title), bk = titleKey(b.title);
  if (ak.length >= 4 && bk.length >= 4 && (ak.includes(bk) || bk.includes(ak))) return true;
  if (a.startDate && b.startDate && a.startDate === b.startDate) {
    const ai = new Set(a.limitedIngredients || []), bi = new Set(b.limitedIngredients || []);
    if ([...ai].some(x => bi.has(x))) return true;
  }
  return false;
}

function semanticDedup(list) {
  const out = [];
  for (const c of list.filter(foodRelevant)) {
    const hit = out.findIndex(x => similarCampaign(x, c));
    if (hit < 0) {
      out.push({ ...c, secondarySources: c.secondarySources || [] });
      continue;
    }
    const old = out[hit], keep = richer(old, c), other = keep === old ? c : old;
    const secondary = [
      ...(keep.secondarySources || []),
      { url: other.officialUrl, type: other.sourceType, title: other.title },
      ...(other.secondarySources || [])
    ];
    out[hit] = { ...keep, secondarySources: [...new Map(secondary.map(s => [s.url, s])).values()] };
  }
  return out;
}

function isLiveish(c) {
  return !['ended_official', 'ended_by_date', 'stale_unverified'].includes(c.lifecycleStatus);
}

function applyRolloutStaleRule(brandId, life, d, now) {
  if (!NEXT_ROLLOUT_IDS.includes(brandId)) return life;
  if (!d.startDate || d.endDate || life.lifecycleStatus !== 'current') return life;
  const age = (now - new Date(`${d.startDate}T00:00:00+09:00`)) / 86400000;
  return age > 45 ? { lifecycleStatus: 'stale_unverified', staleAfterDays: 45 } : life;
}

const nowIso = new Date().toISOString();
const now = new Date();
let current = {
  schemaVersion: 1,
  updatedAt: null,
  timezone: 'Asia/Tokyo',
  statusRules: { newDays: 7, endingSoonDays: 7 },
  campaigns: []
};
try { current = JSON.parse(await fs.readFile(OUT, 'utf8')); } catch {}

const previous = new Map((current.campaigns || []).map(c => [`${c.brandId}|${canonicalUrl(c.officialUrl)}`, c]));
const candidates = [];
const errors = [];
const sourceOk = new Set();

for (const brand of DISCOVERY_SOURCES) {
  for (const source of brand.sources) {
    try {
      const indexHtml = await fetchText(source.url);
      sourceOk.add(brand.brandId);

      const map = new Map();
      const self = source.type === 'campaign_detail'
        ? [{ title: source.campaignTitle || '', url: canonicalUrl(source.url) }]
        : [];
      const discovered = [
        ...self,
        ...linksFromHtml(indexHtml, source.url),
        ...rawDetailUrls(brand.brandId, indexHtml, source.url),
        ...rawRolloutUrls(brand.brandId, indexHtml, source.url)
      ];

      for (const l of discovered) {
        if ((allowedPath(brand.brandId, l.url) || allowedRolloutPath(brand.brandId, l.url)) && !map.has(l.url)) {
          map.set(l.url, l);
        }
      }

      for (const link of [...map.values()].slice(0, 30)) {
        try {
          const html = link.url === canonicalUrl(source.url) && source.type === 'campaign_detail'
            ? indexHtml
            : await fetchText(link.url);
          const text = contentText(html);
          const rawTitle = rawCampaignTitle(brand.brandId, html, link);
          const detailTitle = cleanTitle(brand.brandId, rawTitle);
          const rollout = NEXT_ROLLOUT_IDS.includes(brand.brandId);

          if ((rollout ? !rolloutTitleRelevant(brand.brandId, rawTitle) : !relevantTitle(rawTitle)) || NON_FOOD.test(detailTitle)) continue;

          const publishedDate = publishedDateFromHtml(html, link.url, text, rawTitle);
          const d = campaignDates(detailTitle, text, html, link.url, publishedDate);
          const x = adjustRolloutFields(brand.brandId, detailTitle, text, deriveFields(detailTitle, text));
          let life = lifecycleFields({
            text: `${detailTitle} ${text}`,
            startDate: d.startDate,
            endDate: d.endDate,
            publishedDate,
            campaignType: x.campaignType,
            now
          });
          if (/※?\s*終了しました|終了いたしました/.test(detailTitle)) {
            life = { lifecycleStatus: 'ended_official', staleAfterDays: null };
          }
          life = applyRolloutStaleRule(brand.brandId, life, d, now);

          const officialUrl = canonicalUrl(link.url);
          const old = previous.get(`${brand.brandId}|${officialUrl}`);
          const imageUrl = x.campaignType === 'price_change'
            ? null
            : await selectFoodImage(brand.brandId, html, officialUrl, detailTitle);

          const c = {
            id: campaignId(brand.brandId, officialUrl),
            brandId: brand.brandId,
            brandName: brand.name,
            title: detailTitle,
            officialUrl,
            sourceUrl: source.url,
            sourceType: source.type,
            campaignType: x.campaignType,
            priority: x.priority,
            startDate: d.startDate,
            startDateText: null,
            endDate: d.endDate,
            endDateText: d.endDateText,
            publishedDate,
            price: x.price,
            priceText: x.priceText,
            allYouCanEat: x.allYouCanEat,
            targetCourses: targetCoursesFromText(brand.brandId, text),
            targetStores: [],
            targetAreas: [],
            regionScope: x.regionScope,
            limitedIngredients: x.limitedIngredients,
            weekdayCondition: x.weekdayCondition,
            conditions: [],
            imageUrl,
            lifecycleStatus: life.lifecycleStatus,
            staleAfterDays: life.staleAfterDays,
            firstSeenAt: old?.firstSeenAt || nowIso,
            fetchedAt: nowIso,
            lastVerifiedAt: nowIso,
            confidence: (d.startDate || d.endDate || /期間限定|フェア|フェス|コラボ|半額|割引|OFF|秋しゃぶ/.test(`${detailTitle} ${text}`)) ? 0.9 : 0.72,
            contentHash: crypto.createHash('sha256').update(text.slice(0, 20000)).digest('hex')
          };
          if (!validateCampaign(c).length) candidates.push(c);
        } catch (e) {
          errors.push({ brandId: brand.brandId, url: link.url, error: String(e.message || e) });
        }
      }
    } catch (e) {
      errors.push({ brandId: brand.brandId, url: source.url, error: String(e.message || e) });
    }
  }
}

const urlDedup = [...new Map(candidates.map(c => [`${c.brandId}|${c.officialUrl}`, c])).values()];
const dedup = semanticDedup(urlDedup);

let production = [...(current.campaigns || [])];
const sourceHealth = [];

for (const brand of DISCOVERY_SOURCES) {
  const fresh = dedup.filter(c => c.brandId === brand.brandId && c.confidence >= 0.72);
  const prev = (current.campaigns || []).filter(c => c.brandId === brand.brandId);
  const freshLive = fresh.filter(isLiveish).length;
  const prevLive = prev.filter(isLiveish).length;

  let action = 'candidate_only';
  if (PROMOTE_IDS.has(brand.brandId)) {
    action = 'lkg';
    if (sourceOk.has(brand.brandId) && fresh.length > 0 && !(prevLive > 0 && freshLive === 0)) {
      production = production.filter(c => c.brandId !== brand.brandId).concat(fresh);
      action = 'replace';
    } else {
      errors.push({
        brandId: brand.brandId,
        error: sourceOk.has(brand.brandId)
          ? 'suspicious_or_empty_candidates_using_lkg'
          : 'source_failed_using_lkg'
      });
    }
  }

  sourceHealth.push({
    brandId: brand.brandId,
    sourceOk: sourceOk.has(brand.brandId),
    candidateCount: fresh.length,
    liveCandidateCount: freshLive,
    previousLiveCount: prevLive,
    action
  });
}

const next = { ...current, updatedAt: nowIso, campaigns: production };
const gate = validateDataset(next);
if (gate.length) throw new Error(`quality gate failed: ${gate.join(', ')}`);

await fs.writeFile(OUT, JSON.stringify(next, null, 2));
await fs.writeFile(CANDIDATE, JSON.stringify({
  schemaVersion: 15,
  updatedAt: nowIso,
  campaigns: dedup,
  errors,
  sourceHealth
}, null, 2));

console.log(JSON.stringify({
  candidateCount: dedup.length,
  errorCount: errors.length,
  productionCount: next.campaigns.length,
  sourceHealth
}, null, 2));
