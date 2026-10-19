import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import { compiler, lireDossierMaison, verifierPlay, type SourcesCompilation } from './compiler';
import { ecrireListes } from './format';
import { lireHagezi, type HageziLue } from './sources';
import type { Canal, Categorie, Listes, Source } from './types';

// Construction quotidienne des fichiers servis par l'API. Rien n'est publié si un contrôle échoue : l'ancienne version
// reste servie (spec, « Contrôles avant publication »).

export const URL_HAGEZI = 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/wildcard/';
export const SOURCES_HAGEZI = {
  ads: 'light-onlydomains.txt',
  telemetrie: [
    'native.samsung-onlydomains.txt',
    'native.xiaomi-onlydomains.txt',
    'native.oppo-realme-onlydomains.txt',
    'native.vivo-onlydomains.txt',
    'native.huawei-onlydomains.txt',
    'native.tiktok-onlydomains.txt',
  ],
} as const;

const LIGHT_MIN = 30_000;
const BAISSE_MAX = 0.7;
const OCTETS_MAX = 2_000_000;
const VERSIONS_GARDEES = 3;

export type FichierCanal = { fichier: string; sha256: string; octets: number; domaines: Partial<Record<Categorie, number>> };
export type Manifeste = {
  version: string;
  date: string;
  sources: Source[];
  /** Nombre de domaines de chaque source HaGeZi (contrôle de baisse d'une version à l'autre). */
  comptes: Record<string, number>;
  canaux: Record<Canal, FichierCanal>;
};

export type OptionsConstruction = {
  dossier: string;
  dossierMaison: string;
  paquetsEssentiels: string[];
  maintenant: Date;
  telecharger: (url: string) => Promise<string>;
  /** Taille maximale du fichier `direct` compressé (2 Mo par défaut). */
  octetsMax?: number;
};

export function lireManifeste(dossier: string): Manifeste | null {
  const chemin = join(dossier, 'manifest.json');
  return existsSync(chemin) ? (JSON.parse(readFileSync(chemin, 'utf8')) as Manifeste) : null;
}

function prochaineVersion(precedente: string | undefined, maintenant: Date): string {
  const jour = maintenant.toISOString().slice(0, 10).replaceAll('-', '.');
  const n = precedente?.startsWith(`${jour}-`) ? Number(precedente.slice(jour.length + 1)) + 1 : 1;
  return `${jour}-${n}`;
}

function ecrireAtomique(chemin: string, contenu: Buffer | string): void {
  writeFileSync(`${chemin}.tmp`, contenu);
  renameSync(`${chemin}.tmp`, chemin);
}

const versionDe = (fichier: string) => fichier.replace(/\.(play|direct)\.txt\.gz$/, '');
const ordre = (v: string) => {
  const [jour = '', n = '0'] = v.split('-');
  return [jour, Number(n)] as const;
};

function nettoyer(dossier: string): void {
  const fichiers = readdirSync(dossier).filter((f) => f.endsWith('.txt.gz'));
  const versions = [...new Set(fichiers.map(versionDe))].sort((a, b) => {
    const [ja, na] = ordre(a);
    const [jb, nb] = ordre(b);
    return ja === jb ? nb - na : ja < jb ? 1 : -1;
  });
  const gardees = new Set(versions.slice(0, VERSIONS_GARDEES));
  for (const f of fichiers) if (!gardees.has(versionDe(f))) unlinkSync(join(dossier, f));
}

const compte = (l: Listes) =>
  Object.fromEntries(Object.entries(l.categories).map(([c, d]) => [c, d.length])) as Partial<Record<Categorie, number>>;

export async function construire(o: OptionsConstruction): Promise<{ publie: boolean; version?: string; erreurs: string[] }> {
  const erreurs: string[] = [];
  const precedent = lireManifeste(o.dossier);
  const lire = async (fichier: string): Promise<HageziLue | null> => {
    try {
      return lireHagezi(await o.telecharger(URL_HAGEZI + fichier));
    } catch (e) {
      erreurs.push(`${fichier} : ${(e as Error).message}`);
      return null;
    }
  };
  const ads = await lire(SOURCES_HAGEZI.ads);
  const natives: HageziLue[] = [];
  for (const f of SOURCES_HAGEZI.telemetrie) {
    const lue = await lire(f);
    if (lue) natives.push(lue);
  }
  let maison: Pick<SourcesCompilation, 'maison' | 'allowlistDomaines'> | null = null;
  try {
    maison = lireDossierMaison(
      Object.fromEntries(readdirSync(o.dossierMaison).map((f) => [f, readFileSync(join(o.dossierMaison, f), 'utf8')])),
    );
  } catch (e) {
    erreurs.push(`listes maison : ${(e as Error).message}`);
  }
  if (!ads || !maison || erreurs.length > 0) return { publie: false, erreurs };

  if (ads.domaines.length < LIGHT_MIN) erreurs.push(`${ads.titre} : ${ads.domaines.length} domaines (minimum ${LIGHT_MIN})`);
  const comptes = Object.fromEntries([ads, ...natives].map((l) => [l.titre, l.domaines.length]));
  for (const [nom, n] of Object.entries(comptes)) {
    const avant = precedent?.comptes[nom];
    if (avant !== undefined && n < avant * BAISSE_MAX) erreurs.push(`${nom} : ${n} domaines contre ${avant} la fois précédente`);
  }

  const version = prochaineVersion(precedent?.version, o.maintenant);
  const s: SourcesCompilation = { ads, telemetrie: natives, ...maison, allowlistPaquets: o.paquetsEssentiels };
  const listes: Record<Canal, Listes> = { play: compiler(s, 'play', version), direct: compiler(s, 'direct', version) };
  try {
    verifierPlay(listes.play);
  } catch (e) {
    erreurs.push((e as Error).message);
  }
  const octets: Record<Canal, Buffer> = {
    play: gzipSync(Buffer.from(ecrireListes(listes.play)), { level: 9 }),
    direct: gzipSync(Buffer.from(ecrireListes(listes.direct)), { level: 9 }),
  };
  const max = o.octetsMax ?? OCTETS_MAX;
  if (octets.direct.length > max) erreurs.push(`fichier direct de ${octets.direct.length} octets (maximum ${max})`);
  if (erreurs.length > 0) return { publie: false, erreurs };

  mkdirSync(o.dossier, { recursive: true });
  const canaux = {} as Record<Canal, FichierCanal>;
  for (const canal of ['play', 'direct'] as const) {
    const fichier = `${version}.${canal}.txt.gz`;
    ecrireAtomique(join(o.dossier, fichier), octets[canal]);
    canaux[canal] = {
      fichier,
      sha256: createHash('sha256').update(octets[canal]).digest('hex'),
      octets: octets[canal].length,
      domaines: compte(listes[canal]),
    };
  }
  const manifeste: Manifeste = { version, date: o.maintenant.toISOString(), sources: listes.direct.sources, comptes, canaux };
  ecrireAtomique(join(o.dossier, 'manifest.json'), `${JSON.stringify(manifeste, null, 2)}\n`);
  nettoyer(o.dossier);
  return { publie: true, version, erreurs: [] };
}
