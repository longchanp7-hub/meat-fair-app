// Verified alternative official announcements. No fuzzy matching by date/ingredient.
const ALIASES = [{
  brandId: 'yakiniku-king',
  canonicalUrl: 'https://www.yakiniku-king.jp/menu_all/season/2609_koreanfair/',
  announcementUrl: 'https://www.yakiniku-king.jp/news/6811/',
  titleIncludes: '韓国市場',
  startDate: '2026-09-16'
}];
function ruleFor(c) {
  return ALIASES.find(a => c.brandId === a.brandId && c.officialUrl === a.announcementUrl &&
    c.title.includes(a.titleIncludes) && c.startDate === a.startDate);
}
export function resolveAnnouncements(rows) {
  const out = [];
  for (const c of rows) {
    const rule = ruleFor(c);
    if (!rule) { out.push(c); continue; }
    // A changed/missing canonical review must not be bypassed by an older announcement.
    const canonical = rows.find(x => x.brandId === rule.brandId && x.officialUrl === rule.canonicalUrl &&
      x.verificationState === 'reviewed' && x.startDate === rule.startDate &&
      x.title.includes(rule.titleIncludes));
    if (!canonical) continue;
    out.push({ ...c, campaignKey: rule.canonicalUrl });
  }
  // Keep the checked end date, image and conditions even when the announcement came first.
  return out.sort((a, b) => Number(b.verificationState === 'reviewed') - Number(a.verificationState === 'reviewed'));
}
export function duplicateAnnouncements(rows) {
  return rows.filter(c => {
    const rule = ruleFor(c);
    return rule && rows.some(x => x.brandId === rule.brandId && x.officialUrl === rule.canonicalUrl);
  });
}
