# FR Bootstrapper

Page qui installe d'un coup une sélection d'addons francophones sur un compte **Stremio** ou **Nuvio**.

- Le mot de passe Stremio/Nuvio part directement du navigateur vers Stremio/Nuvio.
- Les clés (debrid, TMDB, trackers) servent à fabriquer les liens d'addons dans `api/liens.js`, puis sont oubliées : rien n'est enregistré, aucune statistique.
- On n'installe que les addons qui marcheront avec les clés fournies (voir `lib/addons.js`).
- Cette page n'héberge aucun contenu : elle configure des addons tiers sur le compte de la personne.

## Structure

- `public/` : la page (`index.html`, `style.css`)
- `api/liens.js`, `api/verifier.js` : fonctions Vercel
- `lib/addons.js` : formats de configuration de chaque addon
- `test/` : `npm test`

Licence MIT.
