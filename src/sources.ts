import { normaliserDomaine } from './format';

// Lecture des sources : listes HaGeZi (format « Wildcard Domains ») et listes maison du dossier `maison/`.

export type HageziLue = { titre: string; version: string; domaines: string[] };

export function lireHagezi(texte: string): HageziLue {
  let titre = '';
  let version = '';
  const domaines: string[] = [];
  for (const brute of texte.split('\n')) {
    const ligne = brute.trim();
    if (ligne.startsWith('#')) {
      const [, cle, valeur] = /^#\s*(Title|Version):\s*(.*)$/.exec(ligne) ?? [];
      if (cle === 'Title') titre = valeur ?? '';
      if (cle === 'Version') version = valeur ?? '';
      continue;
    }
    const domaine = normaliserDomaine(ligne);
    if (domaine) domaines.push(domaine);
  }
  if (!version) throw new Error('Liste HaGeZi sans en-tête « Version »');
  return { titre, version, domaines };
}

/** Entrée d'une liste maison ; `deHagezi` : reprise d'une liste HaGeZi (jamais embarquée dans l'app, D21). */
export type EntreeMaison = { domaine: string; source: string; deHagezi: boolean };

/** Une entrée par ligne, `domaine  # source: …` ; une entrée sans source ou invalide arrête la lecture. */
export function lireMaison(texte: string, fichier: string): EntreeMaison[] {
  const entrees: EntreeMaison[] = [];
  texte.split('\n').forEach((brute, i) => {
    const ligne = brute.trim();
    if (!ligne || ligne.startsWith('#')) return;
    const [partieDomaine = '', ...commentaire] = ligne.split('#');
    const source = /^\s*source:\s*(.+)$/.exec(commentaire.join('#'))?.[1]?.trim();
    if (!source) throw new Error(`${fichier}:${i + 1} : source manquante`);
    const domaine = normaliserDomaine(partieDomaine);
    if (!domaine) throw new Error(`${fichier}:${i + 1} : domaine invalide « ${partieDomaine.trim()} »`);
    entrees.push({ domaine, source, deHagezi: /hagezi/i.test(source) });
  });
  return entrees;
}
