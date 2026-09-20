import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

test('PWA identity, launch URL and scope stay inside the meat app', async () => {
  const base = 'https://longchanp7-hub.github.io/meat-fair-app/';
  const manifest = JSON.parse(await fs.readFile(new URL('../app/manifest.webmanifest', import.meta.url)));
  for (const field of ['id', 'start_url', 'scope']) assert.equal(new URL(manifest[field], base).href, base);
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color, '#e53935');
  assert.equal(manifest.background_color, manifest.theme_color);
  const index = await fs.readFile(new URL('../app/index.html', import.meta.url), 'utf8');
  assert.match(index, new RegExp(`<meta name="theme-color" content="${manifest.theme_color}">`));
  for (const icon of manifest.icons) {
    const data = await fs.readFile(new URL('../app/' + icon.src, import.meta.url));
    assert.equal(data.readUInt32BE(16), Number(icon.sizes.split('x')[0]));
    assert.equal(data.readUInt32BE(20), Number(icon.sizes.split('x')[1]));
  }
});

async function fixture() {
  const events = {}, nodes = {};
  const document = {getElementById(id) {return nodes[id] ??= {hidden:true, addEventListener(name, fn) {this[name] = fn;}};}};
  const window = {addEventListener(name, fn) {events[name] = fn;}, matchMedia() {return {matches:false, addEventListener(){}};}};
  vm.runInNewContext(await fs.readFile(new URL('../app/install.js', import.meta.url), 'utf8'), {window, document, navigator:{}, console});
  return {events, nodes};
}

test('install button uses the browser prompt, prevents duplicate submissions, and handles cancellation', async () => {
  const {events, nodes} = await fixture();
  let calls = 0, prevented = false;
  events.beforeinstallprompt({preventDefault(){prevented=true;}, async prompt(){calls++;}, userChoice:Promise.resolve({outcome:'dismissed'})});
  assert.ok(prevented);
  assert.equal(nodes['install-app'].hidden, false);
  await Promise.all([nodes['install-app'].click(), nodes['install-app'].click()]);
  assert.equal(calls, 1);
  assert.match(nodes['install-status'].textContent, /キャンセル/);
});

test('accepted request is not reported as installed until appinstalled arrives', async () => {
  const {events, nodes} = await fixture();
  events.beforeinstallprompt({preventDefault(){}, async prompt(){}, userChoice:Promise.resolve({outcome:'accepted'})});
  await nodes['install-app'].click();
  assert.match(nodes['install-status'].textContent, /受け付け/);
  events.appinstalled();
  assert.match(nodes['install-status'].textContent, /インストールしました/);
});

test('offline worker keeps the meat app shell and official data network-first without touching other origins', async () => {
  const sw = await fs.readFile(new URL('../app/sw.js', import.meta.url), 'utf8');
  assert.ok(sw.includes("CACHE_PREFIX='meat-fair-shell-v'"));
  for (const file of ['index.html','app.js','styles.css','manifest.webmanifest','icons/icon-192.png']) assert.ok(sw.includes(file), file);
  for (const file of ['/data/fairs.json','/data/catalog.json','/data/offers.json']) assert.ok(sw.includes(file), file);
  assert.ok(sw.includes("fetch(request,{cache:'no-store'"));
  assert.ok(sw.includes("fallbackKey:'./index.html'"));
  assert.ok(sw.includes("event.request.method!=='GET'||!sameOrigin(event.request)"));
  assert.ok(sw.includes('cache.match(request)'));
});
