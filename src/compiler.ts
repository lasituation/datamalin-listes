import { trierParSuffixe } from './format';
import { lireMaison, type EntreeMaison, type HageziLue } from './sources';
import { CATEGORIES, type Canal, type Categorie, type Listes, type Source } from './types';

// Compilation d'un fichier de listes par canal (spec : docs/superpowers/specs/2026-10-19-listes-de-blocage-design.md).

export type SourcesCompilation = {
  /** HaGeZi Multi LIGHT (canal `direct` seulement). */
  ads: HageziLue | null;
  /** HaGeZi Native Tracker (canal `direct` seulement). */
  telemetrie: HageziLue[];
  maison: Partial<Record<Categorie, EntreeMaison[]>>;
  allowlistDomaines: EntreeMaison[];
  allowlistPaquets: string[];
};

const HAGEZI = { licence: 'GPL-3.0', url: 'https://github.com/hagezi/dns-blocklists' };
const MAISON: Source = {
  nom: 'Listes maison DataMalin',
  version: '',
  licence: 'GPL-3.0-or-later',
  url: 'https://github.com/lasituation/datamalin-listes',
};
/** Catégories jamais livrées dans la version Google Play (D19, spec). */
const INTERDITES_PLAY: readonly Categorie[] = ['ads', 'trackers'];

const suffixes = (d: string) => d.split('.').map((_, i, labels) => labels.slice(i).join('.'));

/**
 * Une seule catégorie par domaine, priorité maison > télémétrie native > `ads`. `play` (ou `sansHagezi`) : aucune
 * entrée venue de HaGeZi ; `play` : ni `ads` ni `trackers`. La liste blanche retire le domaine et ses sous-domaines.
 */
export function compiler(s: SourcesCompilation, canal: Canal, version: string, options: { sansHagezi?: boolean } = {}): Listes {
  const avecHagezi = canal === 'direct' && !options.sansHagezi;
  const autorises = new Set(s.allowlistDomaines.map((e) => e.domaine));
  const attribues = new Map<string, Categorie>();
  const ajouter = (domaine: string, categorie: Categorie) => {
    if (attribues.has(domaine) || suffixes(domaine).some((x) => autorises.has(x))) return;
    attribues.set(domaine, categorie);
  };

  for (const categorie of CATEGORIES) {
    if (canal === 'play' && INTERDITES_PLAY.includes(categorie)) continue;
    for (const e of s.maison[categorie] ?? []) if (avecHagezi || !e.deHagezi) ajouter(e.domaine, categorie);
  }
  const sources: Source[] = [];
  if (avecHagezi) {
    for (const liste of s.telemetrie) {
      liste.domaines.forEach((d) => ajouter(d, 'telemetry'));
      sources.push({ nom: liste.titre, version: liste.version, ...HAGEZI });
    }
    if (s.ads) {
      s.ads.domaines.forEach((d) => ajouter(d, 'ads'));
      sources.unshift({ nom: s.ads.titre, version: s.ads.version, ...HAGEZI });
    }
  }
  sources.push({ ...MAISON, version });

  const categories: Partial<Record<Categorie, string[]>> = {};
  for (const [domaine, categorie] of attribues) (categories[categorie] ??= []).push(domaine);
  for (const categorie of Object.keys(categories) as Categorie[]) categories[categorie] = trierParSuffixe(categories[categorie] ?? []);
  return {
    version,
    canal,
    sources,
    categories,
    allowlist: { domaines: trierParSuffixe(autorises), paquets: [...new Set(s.allowlistPaquets)].sort() },
  };
}

/**
 * Détecteur (pas un filtre) de domaines publicitaires : label contenant `ads` (sauf `uploads`/`downloads`), `advert`,
 * `adserv`, `adlog`, `admob`, ou segment séparé par `-`/`_` égal à `ad`, `adx`, `ad<chiffres>`, `ads<chiffres>`.
 */
export function ressemblePub(domaine: string): boolean {
  return domaine.split('.').some((label) => {
    const sansMots = label.replace(/(up|down)loads/g, '');
    if (/ads|advert|adserv|adlog|admob/.test(sansMots)) return true;
    return label.split(/[-_]/).some((segment) => /^(ad|adx|ad\d+|ads\d*)$/.test(segment));
  });
}

/** Garde-fou de la version Play : lève, en les nommant, si des domaines publicitaires ou une catégorie interdite s'y trouvent. */
export function verifierPlay(l: Listes): void {
  if (l.canal !== 'play') return;
  const interdites = INTERDITES_PLAY.filter((c) => l.categories[c]);
  if (interdites.length > 0) throw new Error(`Liste play : catégories interdites ${interdites.join(', ')}`);
  const fautifs = Object.values(l.categories).flat().filter(ressemblePub);
  if (fautifs.length > 0) throw new Error(`Liste play : domaines publicitaires ${fautifs.join(', ')}`);
}

/** Liste embarquée dans l'app : nos seules entrées (jamais de HaGeZi dans l'APK, D21), sans pubs ni pisteurs. */
export function listeEmbarquee(s: SourcesCompilation, version: string): Listes {
  return compiler(s, 'play', version, { sansHagezi: true });
}

/** Contenu du dossier `maison/` (nom de fichier → texte) : `<catégorie>.txt` et `allowlist.txt`. */
export function lireDossierMaison(fichiers: Record<string, string>): Pick<SourcesCompilation, 'maison' | 'allowlistDomaines'> {
  const maison: Partial<Record<Categorie, EntreeMaison[]>> = {};
  for (const categorie of CATEGORIES) {
    const texte = fichiers[`${categorie}.txt`];
    if (texte !== undefined) maison[categorie] = lireMaison(texte, `${categorie}.txt`);
  }
  const allow = fichiers['allowlist.txt'];
  return { maison, allowlistDomaines: allow === undefined ? [] : lireMaison(allow, 'allowlist.txt') };
}
