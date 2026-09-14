/* Match only images actually present in the same official HTML document.
 * Some sites split a dish into menu01_pic and menu01_text/sign. The label's
 * alt text identifies the photo; its URL is never guessed or constructed.
 */
const LABEL = new Set(['text','txt','sign','title','ttl','label','price','caption']);
function roleOf(imageUrl) {
  const u = new URL(imageUrl);
  const basename = u.pathname.slice(u.pathname.lastIndexOf('/') + 1)
    .replace(/\.[^.]+$/, '')
    .replace(/(^|[_-])(?:pc|sp|mobile|desktop)(?=[_-]|$)/gi, '$1')
    .replace(/[_-]{2,}/g, '_').replace(/^[_-]|[_-]$/g, '');
  const match = basename.match(/^(.*?)[_-](pic|photo|image|img|text|txt|sign|title|ttl|label|price|caption)$/i);
  if (!match) return {label: LABEL.has(basename.toLowerCase()), photo: false, family: null};
  const role = match[2].toLowerCase();
  return {
    label: LABEL.has(role), photo: !LABEL.has(role),
    family: u.origin + u.pathname.slice(0, u.pathname.lastIndexOf('/') + 1) + match[1]
  };
}
export function officialPhotoCandidates(items) {
  const labels = new Map();
  for (const item of items) {
    const role = roleOf(item.imageUrl);
    if (!role.label || !role.family || !item.title?.trim()) continue;
    if (!labels.has(role.family)) labels.set(role.family, new Set());
    labels.get(role.family).add(item.title.trim());
  }
  const photos = [];
  for (const item of items) {
    const role = roleOf(item.imageUrl);
    // A heading, price label or sign by itself cannot fill a food-photo block.
    if (role.label) continue;
    const names = role.photo ? labels.get(role.family) : null;
    const ownTitle = item.title?.trim() || '';
    const title = ownTitle || (names?.size === 1 ? [...names][0] : '');
    photos.push({...item, title});
  }
  return photos;
}
