// Fabrique les liens d'installation des addons à partir des clés de la personne.
// Règle : on n'installe que les addons qui marcheront avec les clés fournies.
// Formats relevés sur la page /configure de chaque addon (octobre 2026).

const b64 = (obj) => Buffer.from(JSON.stringify(obj), 'utf8').toString('base64');
const b64url = (obj) => b64(obj).replace(/\+/g, '-').replace(/\//g, '_');

// AllDebrid toujours en premier, TorBox en secours
const debridList = ({ alldebrid, torbox }) => [
  alldebrid && { service: 'alldebrid', apiKey: alldebrid },
  torbox && { service: 'torbox', apiKey: torbox },
].filter(Boolean);

// Quel addon comprend quelle clé tracker (et sous quel nom)
const TRACKERS = {
  tr4ker: { uwu: 'tr4ker_key', sf: 'fallback_private' },
  c411: { uwu: 'c411_key', sf: 'priority_private' },
  yggreborn: { uwu: 'yggreborn_key', sf: 'priority_private' },
  nekobt: { uwu: 'nekobt_key' },
  abn: { sf: 'fallback_private' },
  generationfree: { sf: 'intermediary_private' },
  g3mini: { sf: 'intermediary_private' },
  theoldschool: { sf: 'intermediary_private' },
  nostradamus: { sf: 'fallback_private' },
};

// Le « jeton de lecture » TMDB (v4) contient la clé courte (v3) dans son champ aud
function tmdbKeys(token) {
  if (!token) return null;
  try {
    const { aud } = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return /^[0-9a-f]{32}$/.test(aud) ? { token, key: aud } : null;
  } catch {
    return null;
  }
}

// Mot de passe pour les comptes créés chez les addons : lettres + chiffres, comme ils l'exigent
const newPassword = () => `${Buffer.from(crypto.getRandomValues(new Uint8Array(12))).toString('base64url')}7a`;

// Lumio accepte une config sans compte (comme sa page /configure pour un visiteur non connecté)
async function lumioAnon({ alldebrid, torbox }) {
  const r = await fetch('https://mylumio.tv/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: null,
      profile: 'Profil',
      payload: {
        ...LUMIO_DEFAULTS,
        ...(alldebrid && { ak: alldebrid }),
        ...(torbox && { tk: torbox }),
        ...(alldebrid && torbox && { dp: 'ad' }),
      },
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !(data.manifest || data.id)) throw new Error(data.detail || `refusé (${r.status})`);
  return { url: data.manifest || `https://mylumio.tv/${data.id}/manifest.json` };
}

// Preset « essentiel », français + multi ; VOSTFR puis VFQ en dernier recours
const LUMIO_DEFAULTS = {
  v: 2, pf: 'essentiel', pfb: '', dm: 'detailed', nc: 4, nr: 60, mpr: 20, age: 0, res: [1, 2, 3, 4, 5],
  qua: ['webrip', 'hdrip', 'webdl', 'bluray', 'remux'], cam: 1, hdr: 0, xv: [], t3: 0, t3p: 0, pxs: 1, lg: ['fr', 'multi', 'vostfr', 'vfq'],
  alg: ['vostfr', 'fr'], lgv: 0, ch: 0, atm: 0, xa: [], unr: 0, szmin: 0, szmax: 0, brmin: 0, brmax: 0, ban: [], pref: [],
  sb: 'quality', fb: 'close', cd: 0, bm: 0, st: 1, sd: 1, ddv: 0, ah: ['1fichier', 'rapidgator', 'turbobit'], dp: '', kh: 0, shd: 1, shx: [],
};

// WaCustom crée un compte par config : on renvoie les identifiants pour que la personne les note
async function waCustom(keys, tmdb) {
  const password = newPassword();
  const r = await fetch('https://wacustom.nipva.com/user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      password,
      config: {
        // 1fichier seul : les torrents sont déjà couverts par les autres addons
        debrid_services: debridList(keys).map(({ service, apiKey }) => ({ service, api_key: apiKey, hosts: ['1fichier'] })),
        // TorBox prend le relais si le lien ne passe pas chez AllDebrid
        ...(keys.alldebrid && keys.torbox && {
          resilient_enabled: true, resilient_mode: 'sequential', resilient_max_fallbacks: 3, resilient_same_debrid_only: false,
        }),
        tmdb_api_token: tmdb.token,
        languages: [],
        // pas de champ resolutions : une liste vide filtre TOUT (contrairement à languages)
        max_results_per_resolution: 0,
        max_size_gb: 0,
        stream_request_timeout: 20,
        show_only_cached: false, // liens directs 1fichier : pas de notion de cache
        deduplicate_results: true,
      },
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.addon_url) throw new Error(data.detail || data.error || `refusé (${r.status})`);
  return { url: data.addon_url, account: { id: data.uuid, password } };
}

// Stream-Fusion (instance publique epsilon) : compte uuid + mot de passe, config scellée chez eux
const SF = 'https://streamfusion.stremio-epsilon.ca';
async function streamFusion({ alldebrid, torbox }, trackers) {
  const csrf = (await (await fetch(`${SF}/api/config/csrf?_=${Date.now()}`, { cache: 'no-store' })).json()).token;
  if (!csrf) throw new Error('jeton CSRF introuvable');
  const sfTrackers = Object.keys(TRACKERS).filter((t) => TRACKERS[t].sf);
  const config = {
    addonHost: SF,
    apiKey: '',
    pseudo: null,
    service: [alldebrid && 'AllDebrid', torbox && 'TorBox'].filter(Boolean),
    debridDownloader: alldebrid ? 'AllDebrid' : 'TorBox',
    ...(alldebrid && { ADToken: alldebrid }),
    ...(torbox && { TBToken: torbox }),
    ...Object.fromEntries(sfTrackers.flatMap((t) => [[t, !!trackers[t]], [`${t}ApiKey`, trackers[t] || '']])),
    indexerCategories: {
      ...Object.fromEntries(sfTrackers.map((t) => [t, trackers[t] ? TRACKERS[t].sf : 'disabled'])),
      // Torr9 a fermé : on le coupe explicitement chez Stream-Fusion
      // utopeer, meiliCache et zilean : valeurs imposées par l'instance epsilon (« Configuration illégale » sinon)
      torr9: 'disabled', utopeer: 'public', zilean: 'fallback_private', jackett: 'disabled', meiliCache: 'public',
    },
    maxSize: 200,
    exclusionKeywords: [],
    languages: ['multi', 'fr'],
    sort: 'quality',
    resultsPerQuality: 10,
    maxResults: 30,
    minCachedResults: 10,
    rdMinCachedBeforeCheck: 3,
    minPostgresResults: 20,
    postgresMaxAgeDays: 7,
    exclusion: ['cam', '480p', 'unknown'],
    jackett: false,
    zilean: true,
    utopeer: true,
    torrenting: false,
    debrid: true,
    metadataProvider: 'tmdb',
    stremthru: false,
    mediaflow: false,
  };
  const password = newPassword();
  const r = await fetch(`${SF}/api/config/account/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: JSON.stringify({ config, password, pseudo: null }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.token) throw new Error(data.detail || `refusé (${r.status})`);
  return { url: `${SF}/${data.token}/manifest.json`, account: { id: data.uuid, password } };
}

// Instance publique d'AIOSources : elle vérifie la clé debrid et renvoie le lien perso.
// Elle exige l'en-tête Origin de sa propre page. Liens en cache SEULEMENT (pas de
// téléchargement non caché, choix de Belouga), français d'abord puis les plus gros fichiers.
const AIO = 'https://aiosources.nipva.com';
async function aioSources({ alldebrid, torbox }) {
  const services = { ...(alldebrid && { alldebrid }), ...(torbox && { torbox }) };
  const r = await fetch(`${AIO}/api/public/install`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: AIO },
    body: JSON.stringify({
      services,
      preferences: {
        language: 'fr',
        mode: 'all',
        cached_only: true,
        services: Object.keys(services),
        sorting: [{ field: 'language', direction: 'desc' }, { field: 'size', direction: 'desc' }],
      },
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.manifest_url) throw new Error(data.error || `refusé (${r.status})`);
  return { url: data.manifest_url };
}

// Demande au debrid si la clé est bonne ; renvoie un message à afficher, ou null si c'est bon
// (ou si le debrid ne répond pas : on ne bloque personne pour une panne chez eux)
async function checkDebrid(service, key) {
  try {
    if (service === 'torbox') {
      const r = await fetch('https://api.torbox.app/v1/api/user/me', { headers: { Authorization: `Bearer ${key}` } });
      if (r.status === 401 || r.status === 403) return 'TorBox refuse cette clé : recopie-la depuis torbox.app/settings';
      return null;
    }
    const r = await fetch('https://api.alldebrid.com/v4/user?agent=frbootstrapper', { headers: { Authorization: `Bearer ${key}` } });
    const d = await r.json();
    if (d.status === 'success') return d.data?.user?.isPremium === false ? 'ton compte AllDebrid n’est pas premium : les addons ne pourront rien lire' : null;
    if (d.error?.code === 'AUTH_BLOCKED') return 'AllDebrid bloque cette clé par sécurité : accepte la demande d’autorisation reçue par e-mail ou sur alldebrid.com (dans tes notifications), puis clique à nouveau sur « Vérifier »';
    if (/^AUTH_/.test(d.error?.code || '')) return 'AllDebrid refuse cette clé : recopie-la depuis alldebrid.com/apikeys';
    return null;
  } catch {
    return null;
  }
}

// Stream-Fusion epsilon sait vérifier les clés de nos trackers (sauf NekoBT) ; même règle que checkDebrid :
// on ne bloque personne pour une panne, on le dit seulement
async function checkTracker(name, key) {
  try {
    const csrf = (await (await fetch(`${SF}/api/config/csrf?_=${Date.now()}`, { cache: 'no-store' })).json()).token;
    const r = await fetch(`${SF}/api/config/validate_indexer_key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ indexer: name, api_key: key }),
    });
    const { status } = await r.json();
    if (status === 'valid') return {};
    if (status === 'invalid') return { error: 'le tracker refuse cette clé : recopie-la depuis ton profil sur le site du tracker' };
  } catch { /* vérificateur injoignable */ }
  return { note: 'le tracker ne répond pas pour l’instant, impossible de vérifier (la clé sera quand même utilisée)' };
}

// mine : liens déjà en main (« j'ai déjà un compte ») pour lumio, wacustom, streamfusion
// skip : noms des addons décochés par la personne (rien n'est fabriqué ni créé pour eux)
async function buildLinks({ alldebrid, torbox, tmdbToken, trackers = {}, mine = {}, skip = [], notes = true }) {
  const keys = { alldebrid, torbox };
  const debrid = debridList(keys);
  const [first] = debrid; // Torrentio et TorrentsDB : un seul debrid, AllDebrid s'il y est
  const tmdb = tmdbKeys(tmdbToken);
  const has = (addon) => Object.keys(TRACKERS).some((t) => trackers[t] && TRACKERS[t][addon]);
  const keysFor = (addon) => Object.fromEntries(
    Object.keys(TRACKERS).filter((t) => TRACKERS[t][addon]).map((t) => [TRACKERS[t][addon], trackers[t] || '']),
  );
  const link = async (url) => ({ url });

  const builders = [
    ['Lumio', () => (mine.lumio ? link(mine.lumio) : lumioAnon(keys))],
    ['AIOSources', () => aioSources(keys)],
    (mine.streamfusion || has('sf')) && ['Stream-Fusion', () => (mine.streamfusion ? link(mine.streamfusion) : streamFusion(keys, trackers))],
    (mine.wacustom || tmdb) && ['WaCustom', () => (mine.wacustom ? link(mine.wacustom) : waCustom(keys, tmdb))],
    // UwU marche sans clé tracker pour les animés (Nyaa)
    ['UwU-FR', () => link(`https://uwu.creepso.com/${b64({
      alldebrid_key: alldebrid || null,
      torbox_key: torbox || null,
      tmdb_key: tmdb ? tmdb.key : null,
      ...Object.fromEntries(Object.entries(keysFor('uwu')).map(([k, v]) => [k, v || null])),
      sort_priority: ['lang', 'fidelity', 'resolution', 'seeders'],
      exc_cam: true,
      limit_global_enabled: true,
      limit_global_val: '10',
      fallback_vo: true,
      dedup_results: true,
      debrid_preferred: first.service,
      debrid_merge: true,
      addon_host: 'uwu.creepso.com',
      sort_languages: ['MULTI_VF', 'VF', 'VOSTFR', 'DICE_MULTI_VF', 'DICE_MULTI_SUBS'],
      quality_mode: 'fidelity',
    })}/manifest.json`)],
    // nocatalog : pas de rangée « Other / AllDebrid » (contenu du compte debrid) sur l'accueil
    ['Torrentio', () => link(`https://torrentio.strem.fun/debridoptions=nocatalog|${first.service}=${encodeURIComponent(first.apiKey)}/manifest.json`)],
    ['Comet', () => link(`https://comet.feels.legal/${b64({
      maxResultsPerResolution: 0,
      maxSize: 0,
      cachedOnly: true,
      removeTrash: true,
      resultFormat: ['all'],
      debridServices: debrid,
      enableTorrent: false,
    })}/manifest.json`)],
    ['TorrentsDB', () => link(`https://torrentsdb.com/${b64({ [first.service]: first.apiKey, debridoptions: ['nocatalog'] })}/manifest.json`)],
    ['Anime Catalogs', () => link(`${animeUrl(notes)}/manifest.json`)],
    // Sous-titres FR, anglais en secours (rien d'autre), sans traductions IA
    // Sous-titres, avant OpenSubtitles (choix de Belouga) ; 10 par langue (sinon ~1 000 lignes anglaises). Le préfixe est un id au hasard, comme leur page.
    ['SubSense', () => link(`https://subsense.nepiraw.com/${Math.random().toString(36).slice(2, 10).padEnd(8, '0')}-${encodeURIComponent(JSON.stringify({ languages: ['fr', 'en'], maxSubtitles: 10 }))}/manifest.json`)],
    ['OpenSubtitles v3+', () => link('https://opensubtitles.stremio.homes/fr%7Cen/ai-translated=false%7Cfrom=all%7Cauto-adjustment=false/manifest.json')],
    // FKStream en tout dernier : ses rangées d'accueil passent sous celles d'Anime Catalogs
    ['FKStream', () => link(`https://streamio.fankai.fr/${b64url({
      customSourcesOnly: false,
      streamFilter: 'all',
      debridServices: debrid,
      debridStreamProxyPassword: '',
      maxActorsDisplay: 'all',
      defaultSort: 'last_update',
    })}/manifest.json`)],
  ].filter((b) => b && !skip.includes(b[0]));

  return Promise.all(builders.map(async ([name, build]) => {
    const t0 = Date.now();
    try {
      // Un addon en panne ne doit pas faire attendre tous les autres
      const late = new Promise((_, no) => setTimeout(() => no(new Error('trop lent (15 s)')), 15000));
      return { name, ...(await Promise.race([build(), late])), ms: Date.now() - t0 };
    } catch (err) {
      console.error(`lien ${name} :`, err.message);
      return { name, error: err.message, ms: Date.now() - t0 };
    }
  }));
}

// Anime Catalogs (catalogues seulement, pas de liens) ; clé RPDB gratuite publique = notes sur les affiches. Rangées en anglais.
const animeUrl = (notes) => `https://1fe84bc728af-stremio-anime-catalogs.baby-beamup.club/${encodeURIComponent(JSON.stringify({
  cinemeta: 'on',
  ratings: 'on',
  ...(notes && { rpdbkey: 't0-free-rpdb-blocks' }),
  search: 'on',
  'anilist_trending-now': 'on',
  'anilist_popular-this-season': 'on',
  'anilist_upcoming-next-season': 'on',
  'myanimelist_top-all-time': 'on',
  'myanimelist_top-movies': 'on',
}))}`;

module.exports = { buildLinks, checkDebrid, checkTracker, tmdbKeys, TRACKERS };
