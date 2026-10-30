# FR Bootstrapper

Page qui installe d'un coup une sélection d'addons francophones sur un compte **Stremio** ou **Nuvio**.

- Le mot de passe Stremio/Nuvio part directement du navigateur vers Stremio/Nuvio.
- Les clés (debrid, TMDB, trackers) servent à fabriquer les liens d'addons dans `functions/api/liens.js`, puis sont oubliées : rien n'est enregistré. Seul un compteur d'installations (un nombre, dans le KV `COMPTEUR`) est tenu, sans rien sur les personnes.
- Limite d'essais (`lib/limite.js`, base D1 `LIMITE`) : 30 « Vérifier »/« Installer » par connexion et par 10 minutes, contre le test de clés volées à la chaîne. Seule une empreinte SHA-256 de l'IP (qui change toutes les 10 minutes) est gardée, puis effacée. Sans la base, pas de limite.
- On n'installe que les addons qui marcheront avec les clés fournies (voir `lib/addons.js`).
- Cette page n'héberge aucun contenu : elle configure des addons tiers sur le compte de la personne.

## Structure

- `public/` : la page (`index.html`, `style.css`)
- `functions/api/liens.js`, `functions/api/verifier.js` : fonctions Cloudflare Pages
- `lib/addons.js` : formats de configuration de chaque addon
- `test/` : `npm test`

Police Figtree (SIL Open Font License), servie depuis `public/fonts/` : aucune requête vers Google.

Licence MIT.
