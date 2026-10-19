// Usage : node dist/embarquee.mjs <dossier maison> <apps-essentielles.json> <sortie.json>
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { genererEmbarquee, lirePaquetsEssentiels } from './embarquee';

const [dossier, essentielles, sortie] = process.argv.slice(2);
if (!dossier || !essentielles || !sortie) {
  console.error('Usage : embarquee <dossier maison> <apps-essentielles.json> <sortie.json>');
  process.exit(2);
}
const fichiers = Object.fromEntries(readdirSync(dossier).map((f) => [f, readFileSync(join(dossier, f), 'utf8')]));
const paquets = lirePaquetsEssentiels(JSON.parse(readFileSync(essentielles, 'utf8')));
const liste = genererEmbarquee(fichiers, paquets);
writeFileSync(sortie, `${JSON.stringify(liste, null, 2)}\n`);
console.log(`Liste embarquée ${liste.version} écrite dans ${sortie}`);
