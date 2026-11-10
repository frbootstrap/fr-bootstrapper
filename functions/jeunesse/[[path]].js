// Addon Jeunesse FR, servi par Cloudflare : /jeunesse/<config>/manifest.json, /catalog/…, /meta/…
import { handle, readConfig } from '../../lib/jeunesse.js';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };

export async function onRequestGet({ request, params, waitUntil }) {
  const path = (params.path || []).join('/');
  const [conf, ...rest] = path.split('/');
  const cfg = readConfig(decodeURIComponent(conf || ''));
  // Mise en cache SANS le jeton de la personne : une rangée est la même pour tous les enfants du même âge, une fiche pour tous
  const shared = cfg && rest[0] !== 'manifest.json'
    // v2 : à augmenter quand la forme des réponses change (sinon l'ancienne reste servie jusqu'à 24 h) ; le site dans la clé : l'aperçu ne sert pas ses liens au site principal
    ? new Request(`https://cache.jeunesse/v2/${new URL(request.url).host}/${rest[0] === 'meta' ? 'tous' : `age-${cfg.a}`}/${rest.join('/')}`)
    : null;
  const cache = globalThis.caches?.default;
  if (shared && cache) {
    const hit = await cache.match(shared);
    if (hit) return hit;
  }
  let out;
  try {
    out = await handle(path, undefined, new URL(request.url).origin);
  } catch (err) {
    // TMDB en panne ou jeton refusé : liste vide plutôt qu'une erreur (l'appli affiche juste une rangée vide)
    console.error('jeunesse :', err.message);
    out = { status: 200, body: rest[0] === 'meta' ? { meta: null } : { metas: [] }, maxAge: 60 };
  }
  const res = new Response(JSON.stringify(out.body), {
    status: out.status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${out.maxAge || 0}`, ...CORS },
  });
  if (shared && cache && out.status === 200 && out.maxAge > 60) waitUntil(cache.put(shared, res.clone()));
  return res;
}

export const onRequestOptions = () => new Response(null, { headers: CORS });
