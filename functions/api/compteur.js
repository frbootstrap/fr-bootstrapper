// Nombre d'installations : un seul nombre stocké (KV « COMPTEUR »), rien sur les personnes
export async function onRequestGet({ env }) {
  const n = env.COMPTEUR ? Number(await env.COMPTEUR.get('installations')) || 0 : null;
  return Response.json({ n }, { headers: { 'Cache-Control': 'public, max-age=60' } });
}
