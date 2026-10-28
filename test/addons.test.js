// Vérifie la règle « on n'installe que ce qui marche » sans contacter les vrais sites
const test = require('node:test');
const assert = require('node:assert');
const { buildLinks, tmdbKeys } = require('../lib/addons');

const sent = [];
global.fetch = async (url, opt) => {
  sent.push([String(url), opt && opt.body]);
  throw new Error('hors ligne (test)');
};
const names = async (input) => (await buildLinks(input)).map((a) => a.name);
// Faux jeton TMDB v4 : seul le champ aud (clé v3) compte
const TMDB = `x.${Buffer.from(JSON.stringify({ aud: 'a'.repeat(32) })).toString('base64url')}.y`;

test('debrid seul : ni Stream-Fusion, ni WaCustom', async () => {
  const n = await names({ alldebrid: 'ADKEY12345' });
  assert.deepStrictEqual(n, ['Lumio', 'AIOSources', 'UwU-FR', 'Torrentio', 'Comet', 'TorrentsDB', 'Anime Catalogs', 'SubSense', 'OpenSubtitles v3+', 'FKStream']);
});

test('TMDB seul : WaCustom en plus, pas Stream-Fusion', async () => {
  const n = await names({ alldebrid: 'ADKEY12345', tmdbToken: TMDB });
  assert(n.includes('WaCustom') && !n.includes('Stream-Fusion'));
});

test('TMDB + tr4ker : tout, et la clé tr4ker part chez UwU', async () => {
  const links = await buildLinks({ alldebrid: 'ADKEY12345', torbox: 'TBKEY12345', tmdbToken: TMDB, trackers: { tr4ker: 'TRK123456' } });
  const by = Object.fromEntries(links.map((a) => [a.name, a]));
  assert(by['Stream-Fusion'] && by.WaCustom);
  const dec = (u) => JSON.parse(Buffer.from(u.split('/')[3], 'base64').toString());
  assert.strictEqual(dec(by['UwU-FR'].url).tr4ker_key, 'TRK123456');
  assert.match(by.Torrentio.url, /alldebrid=ADKEY12345/);
});

test('NekoBT seul : UwU le reçoit, mais pas de Stream-Fusion', async () => {
  const n = await names({ torbox: 'TBKEY12345', tmdbToken: TMDB, trackers: { nekobt: 'NEKO12345' } });
  assert(!n.includes('Stream-Fusion'));
});

test('« j’ai déjà un compte » : on reprend le lien sans rien créer', async () => {
  sent.length = 0;
  const links = await buildLinks({ alldebrid: 'ADKEY12345', mine: { lumio: 'https://mylumio.tv/x/manifest.json', wacustom: 'https://wacustom.nipva.com/y/manifest.json' } });
  assert.strictEqual(links.find((a) => a.name === 'WaCustom').url, 'https://wacustom.nipva.com/y/manifest.json');
  assert(!sent.some(([u]) => u.includes('mylumio') || u.includes('wacustom')));
});

test('AIOSources : liens en cache seulement, jamais de téléchargement direct', async () => {
  sent.length = 0;
  await buildLinks({ alldebrid: 'ADKEY12345', torbox: 'TBKEY12345' });
  const body = JSON.parse(sent.find(([u]) => u.includes('aiosources'))[1]);
  assert.strictEqual(body.preferences.cached_only, true);
  assert.deepStrictEqual(body.preferences.services, ['alldebrid', 'torbox']);
});

test('addons décochés : ni lien ni compte créé', async () => {
  sent.length = 0;
  const n = await names({ alldebrid: 'ADKEY12345', tmdbToken: TMDB, skip: ['WaCustom', 'Torrentio'] });
  assert(!n.includes('WaCustom') && !n.includes('Torrentio') && n.includes('Lumio'));
  assert(!sent.some(([u]) => u.includes('wacustom')));
});

test('jeton TMDB invalide refusé', () => {
  assert.strictEqual(tmdbKeys('nimporte-quoi'), null);
  assert.strictEqual(tmdbKeys(TMDB).key, 'a'.repeat(32));
});

test('vérif tracker : valide, refusée, ou vérificateur en panne', async () => {
  const { checkTracker } = require('../lib/addons');
  const reply = (status) => { global.fetch = async (url) => ({ json: async () => (String(url).includes('csrf') ? { token: 't' } : { status }) }); };
  reply('valid'); assert.deepStrictEqual(await checkTracker('tr4ker', 'KEY12345'), {});
  reply('invalid'); assert(await checkTracker('tr4ker', 'KEY12345').then((r) => r.error));
  reply('unknown'); assert(await checkTracker('tr4ker', 'KEY12345').then((r) => r.note));
});
