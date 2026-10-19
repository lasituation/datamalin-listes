import { CATEGORIES, type Canal, type Categorie, type Listes, type Source } from './types';

// Format texte des listes servies au bouclier : en-têtes `# clé: valeur`, puis une section par catégorie et la liste
// blanche. Lisible ligne à ligne (le téléphone le lit en flux) et forme source au sens de la GPL.

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const PAQUET = /^[a-zA-Z][\w]*(\.[a-zA-Z_][\w]*)+$/;
const LICENCE =
  'GPL-3.0-or-later (HaGeZi DNS Blocklists, https://github.com/hagezi/dns-blocklists, GPL-3.0) ; listes maison DataMalin';

/** Domaine en minuscules, sans point final ; null si ce n'est pas un nom de domaine (IP, joker, label invalide). */
export function normaliserDomaine(brut: string): string | null {
  const d = brut.trim().toLowerCase().replace(/\.$/, '');
  if (d.length === 0 || d.length > 253) return null;
  const labels = d.split('.');
  if (labels.length < 2 || !labels.every((l) => LABEL.test(l))) return null;
  if (labels.every((l) => /^\d+$/.test(l))) return null;
  return d;
}

const cleSuffixe = (d: string) => d.split('.').reverse().join('.');

/** Domaines sans doublons, rangés par labels inversés (`a.com`, `b.a.com`, `x.org`) : meilleure compression. */
export function trierParSuffixe(domaines: Iterable<string>): string[] {
  return [...new Set(domaines)]
    .map((d) => [cleSuffixe(d), d] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, d]) => d);
}

export function ecrireListes(l: Listes): string {
  const lignes = [
    '# DataMalin — listes de blocage',
    `# version: ${l.version}`,
    `# canal: ${l.canal}`,
    `# licence: ${LICENCE}`,
    ...l.sources.map((s) => `# source: ${s.nom} | ${s.version} | ${s.licence} | ${s.url}`),
  ];
  for (const categorie of CATEGORIES) {
    const domaines = l.categories[categorie];
    if (domaines) lignes.push(`[${categorie}]`, ...trierParSuffixe(domaines));
  }
  lignes.push('[allowlist.domaines]', ...trierParSuffixe(l.allowlist.domaines));
  lignes.push('[allowlist.paquets]', ...[...new Set(l.allowlist.paquets)].sort());
  return `${lignes.join('\n')}\n`;
}

export function lireListes(texte: string): Listes {
  let version = '';
  let canal: Canal | null = null;
  const sources: Source[] = [];
  const categories: Partial<Record<Categorie, string[]>> = {};
  const allowlist = { domaines: [] as string[], paquets: [] as string[] };
  let section: string | null = null;
  for (const brute of texte.split('\n')) {
    const ligne = brute.trim();
    if (!ligne) continue;
    if (ligne.startsWith('#')) {
      const [, cle, valeur] = /^#\s*([a-z]+):\s*(.*)$/.exec(ligne) ?? [];
      if (cle === 'version') version = valeur ?? '';
      if (cle === 'canal' && (valeur === 'play' || valeur === 'direct')) canal = valeur;
      if (cle === 'source') {
        const [nom = '', v = '', licence = '', url = ''] = (valeur ?? '').split(' | ');
        sources.push({ nom, version: v, licence, url });
      }
      continue;
    }
    const entete = /^\[([a-z_.]+)\]$/.exec(ligne);
    if (entete) {
      section = entete[1] ?? null;
      if ((CATEGORIES as readonly string[]).includes(section ?? '')) categories[section as Categorie] ??= [];
      continue;
    }
    if (section === 'allowlist.paquets') {
      if (PAQUET.test(ligne)) allowlist.paquets.push(ligne);
      continue;
    }
    const domaine = normaliserDomaine(ligne);
    if (!domaine) continue;
    if (section === 'allowlist.domaines') allowlist.domaines.push(domaine);
    else if ((CATEGORIES as readonly string[]).includes(section ?? '')) categories[section as Categorie]?.push(domaine);
  }
  if (!version || !canal) throw new Error('Listes sans version ou sans canal');
  return { version, canal, sources, categories, allowlist };
}
