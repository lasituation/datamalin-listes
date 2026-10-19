import { createHash } from 'node:crypto';

import { lireDossierMaison, listeEmbarquee, verifierPlay, type SourcesCompilation } from './compiler';
import { ecrireListes } from './format';

/**
 * Liste embarquée dans l'app (nos entrées seulement). Sa version est une empreinte du contenu, pas une date : elle ne
 * change que si les listes maison changent.
 */
export function genererEmbarquee(fichiersMaison: Record<string, string>, paquets: string[]): { version: string; texte: string } {
  const s: SourcesCompilation = { ads: null, telemetrie: [], ...lireDossierMaison(fichiersMaison), allowlistPaquets: paquets };
  const brouillon = ecrireListes(listeEmbarquee(s, 'maison'));
  const version = `maison-${createHash('sha256').update(brouillon).digest('hex').slice(0, 8)}`;
  const liste = listeEmbarquee(s, version);
  verifierPlay(liste); // la liste embarquée part dans l'APK Play aussi (D19)
  return { version, texte: ecrireListes(liste) };
}

/** Paquets de `content/apps-essentielles.json` (`{ apps: [{ paquet }] }`). */
export function lirePaquetsEssentiels(json: unknown): string[] {
  const apps = (json as { apps?: { paquet?: unknown }[] }).apps ?? [];
  return apps.map((a) => a.paquet).filter((p): p is string => typeof p === 'string');
}
