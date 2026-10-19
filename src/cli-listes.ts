// Construction quotidienne. Variables : LISTES_DIR (obligatoire), MAISON_DIR (défaut : maison),
// APPS_ESSENTIELLES (défaut : ../../content/apps-essentielles.json). Code de sortie 1 si rien n'est publié.
import { readFileSync } from 'node:fs';
import { setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net';

import { construire } from './construire';
import { lirePaquetsEssentiels } from './embarquee';

const dossier = process.env.LISTES_DIR;
if (!dossier) {
  console.error('LISTES_DIR manquant');
  process.exit(2);
}
const essentielles = process.env.APPS_ESSENTIELLES ?? '../../content/apps-essentielles.json';

// Node 22 essaie IPv6 puis IPv4 avec 250 ms par tentative : trop court sur une connexion lente (ETIMEDOUT observé).
setDefaultAutoSelectFamilyAttemptTimeout(5000);

async function telecharger(url: string): Promise<string> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(180_000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } catch (e) {
    const cause = (e as { cause?: { code?: string; message?: string } }).cause;
    throw new Error(cause ? `${(e as Error).message} (${cause.code ?? cause.message})` : (e as Error).message);
  }
}

const resultat = await construire({
  dossier,
  dossierMaison: process.env.MAISON_DIR ?? 'maison',
  paquetsEssentiels: lirePaquetsEssentiels(JSON.parse(readFileSync(essentielles, 'utf8'))),
  maintenant: new Date(),
  telecharger,
});
if (resultat.publie) {
  console.log(`Listes ${resultat.version} publiées dans ${dossier}`);
} else {
  console.error(`Rien n'est publié :\n- ${resultat.erreurs.join('\n- ')}`);
  process.exit(1);
}
