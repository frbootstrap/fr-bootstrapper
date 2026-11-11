// Règle stricte de Jeunesse FR, sans contacter TMDB
const test = require('node:test');
const assert = require('node:assert');
const { rating, isKidSafe, allowedCerts, readConfig, discoverParams, CATALOGS, handle } = require('../lib/jeunesse');

const film = (fr, us, genres = []) => ({
  genres: genres.map((id) => ({ id })),
  release_dates: { results: [...(fr ? [{ iso_3166_1: 'FR', release_dates: [{ certification: fr }] }] : []), ...(us ? [{ iso_3166_1: 'US', release_dates: [{ certification: us }] }] : [])] },
});

test('classification : la plus sévère de la française et de l’américaine, sinon rien', () => {
  assert.strictEqual(rating([{ c: 'US', r: 'R' }, { c: 'FR', r: '12' }]), 17);
  assert.strictEqual(rating([{ c: 'US', r: 'PG' }]), 0);
  assert.strictEqual(isKidSafe(film('TP', 'PG-13'), 12, 'movie'), false); // Avengers : TP en France, PG-13 aux USA
  assert.strictEqual(isKidSafe(film('TP', 'PG'), 7, 'movie'), true); // La Reine des neiges
  assert.strictEqual(rating([{ c: 'DE', r: '6' }]), null);
});

test('non classé, horreur ou âge atteint : refusé', () => {
  assert.strictEqual(isKidSafe(film(null, null), 10, 'movie'), false); // non classé
  assert.strictEqual(isKidSafe(film('TP', null, [27]), 10, 'movie'), false); // horreur
  assert.strictEqual(isKidSafe(film('10', null), 10, 'movie'), false); // « -10 » pour moins de 10 ans
  assert.strictEqual(isKidSafe(film('TP', null, [10752]), 10, 'movie'), false); // guerre avant 12 ans
  assert.strictEqual(isKidSafe(film('TP', 'PG', [16]), 7, 'movie'), true);
  assert.strictEqual(isKidSafe(film(null, 'PG-13'), 12, 'movie'), false);
  assert.strictEqual(isKidSafe(film(null, 'PG-13'), 16, 'movie'), true);
});

test('listes TMDB : seulement des classifications sous l’âge', () => {
  assert.deepStrictEqual(allowedCerts('US', 10).filter((c) => c.startsWith('TV')), ['TV-Y', 'TV-Y7', 'TV-G']);
  assert(!allowedCerts('US', 7).includes('TV-Y7'));
  const p = discoverParams(CATALOGS.find((c) => c[0] === 'jeunesse-studios'), 10, 'Pixar');
  assert.strictEqual(p.with_companies, '3');
  assert.strictEqual(p.certification_country, 'FR');
  assert.match(p.without_genres, /27/);
});

test('dossier de genre : reste dans Famille / Pour les petits', () => {
  const cat = (id) => CATALOGS.find((c) => c[0] === id);
  assert.strictEqual(discoverParams(cat('jeunesse-films'), 12, 'Documentaire').with_genres, '99,10751');
  assert.strictEqual(discoverParams(cat('jeunesse-films'), 12, 'Famille').with_genres, '10751');
  assert.strictEqual(discoverParams(cat('jeunesse-series'), 12, 'Comédie').with_genres, '35,10762');
  assert.strictEqual(discoverParams(cat('jeunesse-series'), 12, 'Pour les petits').with_genres, '10762');
});

test('lien : âge et jeton obligatoires', async () => {
  const ok = Buffer.from(JSON.stringify({ t: 'eyJa.b.c', a: 10 })).toString('base64url');
  assert(readConfig(ok));
  assert.strictEqual(readConfig(Buffer.from(JSON.stringify({ t: 'eyJa.b.c', a: 18 })).toString('base64url')), null);
  assert.strictEqual((await handle('nimporte/manifest.json')).status, 400);
  const m = (await handle(`${ok}/manifest.json`)).body;
  assert.deepStrictEqual(m.resources, ['catalog', 'meta']);
  assert(m.catalogs.some((c) => c.extra.some((e) => e.name === 'search')));
});
