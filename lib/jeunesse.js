// Addon « Jeunesse FR » : rangées, recherche et fiches en français, filtrées par âge.
// Règle stricte : un titre n'est montré que s'il a une classification (française, sinon américaine) strictement
// sous l'âge choisi, et n'est pas de l'horreur. Un titre sans classification est rejeté.
// Config dans le lien : base64url de { t: jeton TMDB de la personne, a: âge (7, 10, 12 ou 16) }. Rien n'est gardé.

const ID = 'fr.bootstrapper.jeunesse';
const AGES = [7, 10, 12, 16];
// Genres exclus : horreur toujours ; guerre jusqu'à 12 ans (films : 10752, séries : 10768)
const banned = (type, age) => [type === 'movie' ? 27 : null, age <= 12 ? (type === 'movie' ? 10752 : 10768) : null].filter(Boolean);

// Âge à partir duquel chaque classification est permise
const AGE = {
  FR: { U: 0, TP: 0, 10: 10, 12: 12, 16: 16, 18: 18, '-10': 10, '-12': 12, '-16': 16, '-18': 18 },
  US: { G: 0, PG: 8, 'PG-13': 13, R: 17, 'NC-17': 18, 'TV-Y': 0, 'TV-Y7': 7, 'TV-G': 0, 'TV-PG': 10, 'TV-14': 14, 'TV-MA': 17 },
};
// Listes TMDB : classifications permises pour un âge (TMDB écarte d'office les titres non classés)
const allowedCerts = (country, age) => Object.entries(AGE[country]).filter(([c, a]) => a < age && !c.startsWith('-')).map(([c]) => c);

// Classification retenue : la française si elle existe, sinon l'américaine ; null = non classé
function rating(list) {
  for (const c of ['FR', 'US']) {
    const ages = list.filter((x) => x.c === c && x.r in AGE[c]).map((x) => AGE[c][x.r]);
    if (ages.length) return Math.max(...ages);
  }
  return null;
}
const certsOf = (d) => (d.release_dates
  ? d.release_dates.results.flatMap((r) => r.release_dates.map((x) => ({ c: r.iso_3166_1, r: x.certification.trim() })))
  : (d.content_ratings?.results || []).map((x) => ({ c: x.iso_3166_1, r: x.rating.trim() }))).filter((x) => x.r);
const isKidSafe = (d, age, type) => {
  const r = rating(certsOf(d));
  const no = banned(type, age);
  return r !== null && r < age && !(d.genres || []).some((g) => no.includes(g.id));
};

const FILM_GENRES = [['Dessins animés', 16], ['Aventure', 12], ['Comédie', 35], ['Fantastique', 14], ['Famille', 10751], ['Musique', 10402], ['Documentaire', 99]];
const SERIE_GENRES = [['Dessins animés', 16], ['Pour les petits', 10762], ['Comédie', 35], ['Aventure', 10759], ['Fantastique', 10765], ['Documentaire', 99]];
// [nom, id TMDB, vignette dans public/tuiles/ (logo en blanc sur dégradé, faites à partir des logos TMDB)]
const STUDIOS = [['Disney', 2, 'disney'], ['Pixar', 3, 'pixar'], ['DreamWorks', 521, 'dreamworks'], ['Illumination', 6704, 'illumination'], ['Studio Ghibli', 10342, 'ghibli'], ['Aardman', 297, 'aardman'], ['Sony Animation', 2251, 'sony-animation'], ['Blue Sky', 9383, 'blue-sky'], ['Laika', 11537, 'laika']];
const CHAINES = [['Disney Channel', 54, 'disney-channel'], ['Disney Junior', 281, 'disney-junior'], ['Nickelodeon', 13, 'nickelodeon'], ['Cartoon Network', 56, 'cartoon-network']];
const today = () => new Date().toISOString().slice(0, 10);

// Rangées : [id, type, nom, réglage TMDB, choix « genre » (null = aucun), choix obligatoire]
const CATALOGS = [
  ['jeunesse-films', 'movie', 'Films pour enfants', { with_genres: '16|10751', sort_by: 'popularity.desc' }, FILM_GENRES],
  ['jeunesse-series', 'series', 'Séries pour enfants', { with_genres: '10762|16', sort_by: 'popularity.desc' }, SERIE_GENRES],
  ['jeunesse-films-nouveaux', 'movie', 'Nouveaux films', () => ({ with_genres: '16|10751', sort_by: 'primary_release_date.desc', 'primary_release_date.lte': today(), 'vote_count.gte': 20 })],
  ['jeunesse-films-cultes', 'movie', 'Les grands classiques', { with_genres: '16|10751', sort_by: 'vote_average.desc', 'vote_count.gte': 1500 }],
  ['jeunesse-series-nouvelles', 'series', 'Nouvelles séries', () => ({ with_genres: '10762|16', sort_by: 'first_air_date.desc', 'first_air_date.lte': today(), 'vote_count.gte': 10 })],
  ['jeunesse-studios', 'movie', 'Studios', { sort_by: 'popularity.desc' }, STUDIOS, true],
  ['jeunesse-chaines', 'series', 'Chaînes', { sort_by: 'popularity.desc' }, CHAINES, true],
];

function readConfig(text) {
  try {
    const c = JSON.parse(Buffer.from(text, 'base64url').toString('utf8'));
    if (!AGES.includes(c.a) || typeof c.t !== 'string' || !/^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(c.t)) return null;
    return c;
  } catch {
    return null;
  }
}

function manifest() {
  return {
    id: ID,
    version: '1.0.0',
    name: 'Jeunesse FR',
    description: 'Films et séries pour enfants, en français, filtrés par âge (classification officielle ; titres non classés et horreur exclus).',
    logo: 'https://fr-bootstrapper.pages.dev/icon-512-fusee.png',
    resources: ['catalog', 'meta'],
    types: ['movie', 'series'],
    idPrefixes: ['tt', 'tmdb:'],
    catalogs: [
      ...CATALOGS.map(([id, type, name, , genres, required]) => ({
        id, type, name,
        extra: [...(genres ? [{ name: 'genre', options: genres.map(([n]) => n), isRequired: !!required }] : []), { name: 'skip' }],
      })),
      { id: 'jeunesse-recherche', type: 'movie', name: 'Jeunesse FR', extra: [{ name: 'search', isRequired: true }] },
      { id: 'jeunesse-recherche', type: 'series', name: 'Jeunesse FR', extra: [{ name: 'search', isRequired: true }] },
    ],
    behaviorHints: { configurable: true, configurationRequired: false },
  };
}

const img = (p, size = 'w500') => (p ? `https://image.tmdb.org/t/p/${size}${p}` : undefined);
const kind = (type) => (type === 'movie' ? 'movie' : 'tv');

// Petite fiche pour une rangée (l'id tt arrive avec la fiche complète, demandée à l'ouverture)
const preview = (x, type) => ({
  id: `tmdb:${x.id}`, type, name: x.title || x.name, poster: img(x.poster_path), background: img(x.backdrop_path, 'w1280'),
  description: x.overview, releaseInfo: (x.release_date || x.first_air_date || '').slice(0, 4),
});

function discoverParams(cat, age, genre) {
  const [, type, , base, genres] = cat;
  const p = { ...(typeof base === 'function' ? base() : base), include_adult: 'false', ...(banned(type, age).length && { without_genres: banned(type, age).join(',') }) };
  if (type === 'movie') Object.assign(p, { certification_country: 'FR', certification: allowedCerts('FR', age).join('|') });
  else Object.assign(p, { certification_country: 'US', certification: allowedCerts('US', age).filter((c) => c.startsWith('TV')).join('|') });
  const pick = genre && genres?.find(([n]) => n === genre);
  if (pick) {
    if (cat[0] === 'jeunesse-studios') p.with_companies = String(pick[1]);
    else if (cat[0] === 'jeunesse-chaines') p.with_networks = String(pick[1]);
    else p.with_genres = String(pick[1]);
  }
  return p;
}

// Petite fabrique d'appels TMDB avec le jeton de la personne
const tmdbClient = (token, fetchImpl = fetch) => async (path, params = {}) => {
  const q = new URLSearchParams({ language: 'fr-FR', ...params });
  const r = await fetchImpl(`https://api.themoviedb.org/3${path}?${q}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`TMDB ${r.status}`);
  return r.json();
};

async function catalog(T, cfg, type, id, extra) {
  if (id === 'jeunesse-recherche') {
    if (!extra.search) return { metas: [] };
    const s = await T(`/search/${kind(type)}`, { query: extra.search, include_adult: 'false' });
    // Une recherche est vérifiée titre par titre (une dizaine d'appels) : les listes de recherche ne filtrent pas l'âge
    const full = await Promise.all((s.results || []).slice(0, 12).map((x) => T(`/${kind(type)}/${x.id}`, {
      append_to_response: type === 'movie' ? 'release_dates' : 'content_ratings',
    }).catch(() => null)));
    return { metas: full.filter((d) => d && isKidSafe(d, cfg.a, type)).map((d) => preview(d, type)) };
  }
  const cat = CATALOGS.find((c) => c[0] === id && c[1] === type);
  if (!cat) return { metas: [] };
  if (cat[5] && !extra.genre) return { metas: [] };
  // 20 titres par page TMDB ; Nuvio et Stremio demandent la suite avec skip = nombre déjà reçu
  const page = Math.floor((Number(extra.skip) || 0) / 20) + 1;
  if (page > 25) return { metas: [] };
  const d = await T(`/discover/${kind(type)}`, { ...discoverParams(cat, cfg.a, extra.genre), page: String(page) });
  return { metas: (d.results || []).map((x) => preview(x, type)) };
}

async function meta(T, type, id) {
  let tmdbId = id.startsWith('tmdb:') ? id.slice(5) : null;
  if (!tmdbId) {
    const f = await T(`/find/${id}`, { external_source: 'imdb_id' });
    tmdbId = (type === 'movie' ? f.movie_results : f.tv_results)?.[0]?.id;
    if (!tmdbId) return { meta: null };
  }
  const d = await T(`/${kind(type)}/${tmdbId}`, { append_to_response: 'external_ids,credits' });
  const tt = d.external_ids?.imdb_id || null;
  const m = {
    id: tt || `tmdb:${tmdbId}`, type, name: d.title || d.name, poster: img(d.poster_path), background: img(d.backdrop_path, 'original'),
    description: d.overview, releaseInfo: (d.release_date || d.first_air_date || '').slice(0, 4), genres: (d.genres || []).map((g) => g.name),
    runtime: d.runtime ? `${d.runtime} min` : undefined, cast: (d.credits?.cast || []).slice(0, 6).map((c) => c.name),
    imdbRating: d.vote_average ? d.vote_average.toFixed(1) : undefined,
  };
  if (type === 'movie') {
    // Les addons de liens ne connaissent que les ids tt : la vidéo du film porte l'id tt
    if (tt) m.behaviorHints = { defaultVideoId: tt };
    return { meta: m };
  }
  // Épisodes : 20 saisons par appel (limite TMDB), saison 0 (bonus) comprise
  const seasons = (d.seasons || []).map((s) => s.season_number).slice(0, 40);
  const chunks = [];
  for (let i = 0; i < seasons.length; i += 20) chunks.push(seasons.slice(i, i + 20));
  const parts = await Promise.all(chunks.map((c) => T(`/tv/${tmdbId}`, { append_to_response: c.map((n) => `season/${n}`).join(',') })));
  const base = tt || `tmdb:${tmdbId}`;
  m.videos = parts.flatMap((p) => Object.entries(p).filter(([k]) => k.startsWith('season/')).flatMap(([, s]) => (s.episodes || []).map((e) => ({
    id: `${base}:${e.season_number}:${e.episode_number}`, title: e.name || `Épisode ${e.episode_number}`, season: e.season_number, episode: e.episode_number,
    released: e.air_date ? new Date(e.air_date).toISOString() : undefined, overview: e.overview, thumbnail: img(e.still_path, 'w300'),
  }))));
  return { meta: m };
}

// Collections Nuvio (dossiers avec image) : chaque dossier lit une rangée de CET addon, donc reste filtrée
async function collections(T, cfg, origin) {
  const src = (type, catalogId, genre) => ({ provider: 'addon', addonId: ID, type, catalogId, ...(genre && { genre }) });
  // Image d'un dossier : le fond d'un titre de la rangée (déjà filtrée), jamais deux fois le même
  const used = new Set();
  const cover = async (type, catId, genre) => {
    const cat = CATALOGS.find((c) => c[0] === catId && c[1] === type);
    const d = await T(`/discover/${kind(type)}`, discoverParams(cat, cfg.a, genre)).catch(() => ({}));
    const x = (d.results || []).find((r) => r.backdrop_path && !used.has(r.backdrop_path));
    if (x) used.add(x.backdrop_path);
    return img(x?.backdrop_path, 'w780');
  };
  const folder = async (id, title, sources, coverImageUrl, hideTitle = false) => ({ id, title, tileShape: 'LANDSCAPE', hideTitle, focusGifEnabled: false, sources, coverImageUrl });
  const tuile = (slug) => `${origin}/tuiles/tuile-${slug}.jpg`;
  // Un dossier après l'autre (et non en parallèle) : sinon deux dossiers prendraient la même image
  const each = async (list, fn) => { const out = []; for (const [i, x] of list.entries()) out.push(await fn(x, i)); return out; };
  const genres = await each(FILM_GENRES, async ([n], i) => {
    const serie = SERIE_GENRES.find(([s]) => s === n);
    return folder(`jeunesse-genre-${i}`, n, [src('movie', 'jeunesse-films', n), ...(serie ? [src('series', 'jeunesse-series', n)] : [])], await cover('movie', 'jeunesse-films', n));
  });
  // Studios et chaînes : vignette logo (le nom est dans le logo, donc pas de titre en dessous)
  const studios = await each(STUDIOS, async ([n, , slug], i) => folder(`jeunesse-studio-${i}`, n, [src('movie', 'jeunesse-studios', n)], tuile(slug), true));
  const chaines = await each(CHAINES, async ([n, , slug], i) => folder(`jeunesse-chaine-${i}`, n, [src('series', 'jeunesse-chaines', n)], tuile(slug), true));
  const coll = (id, title, folders) => ({ id, title, pinToTop: false, focusGlowEnabled: true, viewMode: 'TABBED_GRID', showAllTab: false, folders });
  return [coll('jeunesse-genres', 'Genres', genres), coll('jeunesse-studios', 'Studios', studios), coll('jeunesse-chaines', 'Chaînes', chaines)];
}

// Ordre de l'accueil Nuvio (même forme que celui du Catalogue FR)
const accueil = () => ({
  addon: ID,
  ordre: [
    { type: 'movie', id: 'jeunesse-films', titre: 'Films pour enfants' }, { type: 'series', id: 'jeunesse-series', titre: 'Séries pour enfants' },
    { collection: 'jeunesse-genres' },
    { type: 'movie', id: 'jeunesse-films-nouveaux', titre: 'Nouveaux films' }, { type: 'series', id: 'jeunesse-series-nouvelles', titre: 'Nouvelles séries' },
    { collection: 'jeunesse-studios' }, { type: 'movie', id: 'jeunesse-films-cultes', titre: 'Les grands classiques' }, { collection: 'jeunesse-chaines' },
  ],
});

// Lit « genre=Aventure&skip=20 » (dernier morceau de l'adresse Stremio)
const readExtra = (s) => Object.fromEntries(new URLSearchParams(s || '').entries());

// Point d'entrée : chemin après /jeunesse/ ; renvoie { status, body, maxAge }
async function handle(path, fetchImpl, origin = 'https://fr-bootstrapper.pages.dev') {
  const [conf, ...rest] = path.split('/').filter(Boolean).map(decodeURIComponent);
  const cfg = readConfig(conf || '');
  if (!cfg) return { status: 400, body: { error: 'lien Jeunesse FR invalide : repasse par le bootstrapper' } };
  const T = tmdbClient(cfg.t, fetchImpl);
  const last = (rest[rest.length - 1] || '').replace(/\.json$/, '');
  if (rest[0] === 'manifest.json') return { status: 200, body: manifest(), maxAge: 3600 };
  if (rest[0] === 'collections.json') return { status: 200, body: await collections(T, cfg, origin), maxAge: 86400 };
  if (rest[0] === 'accueil.json') return { status: 200, body: accueil(), maxAge: 86400 };
  if (rest[0] === 'catalog' && rest.length >= 3) {
    const extra = rest.length >= 4 ? readExtra(last) : {};
    const id = rest.length >= 4 ? rest[2] : last;
    return { status: 200, body: await catalog(T, cfg, rest[1], id, extra), maxAge: 21600 };
  }
  if (rest[0] === 'meta' && rest.length === 3) return { status: 200, body: await meta(T, rest[1], last), maxAge: 86400 };
  return { status: 404, body: { error: 'introuvable' } };
}

module.exports = { ID, AGES, handle, rating, isKidSafe, allowedCerts, readConfig, discoverParams, CATALOGS };
