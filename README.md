# DataMalin — listes de blocage

Construction des listes de blocage du bouclier de [DataMalin](https://github.com/lasituation), l'app qui fait baisser
la consommation de data mobile au Cameroun. Le bouclier est un VPN local qui ne capte que le DNS : il répond « bloqué »
aux domaines de ces listes, sur le téléphone, sans rien envoyer à un serveur.

## Contenu

- `src/` : lecture des sources, compilation par canal, contrôles avant publication, construction quotidienne.
- `maison/` : nos listes, une entrée par ligne avec sa source (`domaine  # source: …`).
- Deux canaux : `direct` (APK hors Google Play, toutes les catégories) et `play` (version Google Play : nos listes
  seulement, sans publicités ni pisteurs).

## Format des fichiers produits

Texte UTF-8 compressé en gzip : en-têtes `# version:`, `# canal:`, `# licence:`, `# source:`, puis une section par
catégorie (`[ads]`, `[trackers]`, `[telemetry]`, `[os_updates]`, `[app_updates]`, `[cloud_sync]`) et la liste blanche
(`[allowlist.domaines]`, `[allowlist.paquets]`). Un domaine bloque aussi ses sous-domaines.

## Sources et attribution

- [HaGeZi DNS Blocklists](https://github.com/hagezi/dns-blocklists) (GPL-3.0) : Multi LIGHT et Native Tracker
  (Samsung, Xiaomi, OPPO/Realme, Vivo, Huawei, TikTok), pour le canal `direct`.
- Listes maison DataMalin.

## Licence

GPL-3.0-or-later. Voir [LICENSE](LICENSE).
