// Types des listes de blocage. Ce paquet est publié sous GPL-3.0-or-later (voir LICENSE et README.md).

/** Catégories du contrat du pont du bouclier (ShieldModule.types.ts). */
export const CATEGORIES = ['ads', 'trackers', 'telemetry', 'os_updates', 'app_updates', 'cloud_sync'] as const;
export type Categorie = (typeof CATEGORIES)[number];

/** `play` : version Google Play (sans pubs, D19) ; `direct` : APK hors Play (D24). */
export type Canal = 'play' | 'direct';

export type Source = { nom: string; version: string; licence: string; url: string };

export type Listes = {
  version: string;
  canal: Canal;
  sources: Source[];
  categories: Partial<Record<Categorie, string[]>>;
  allowlist: { domaines: string[]; paquets: string[] };
};
