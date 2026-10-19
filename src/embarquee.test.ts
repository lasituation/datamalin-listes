import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { genererEmbarquee, lirePaquetsEssentiels } from './embarquee';
import { lireListes } from './format';

const racine = join(__dirname, '../../..');
const dossierMaison = join(__dirname, '../maison');
const fichiersMaison = () => Object.fromEntries(readdirSync(dossierMaison).map((f) => [f, readFileSync(join(dossierMaison, f), 'utf8')]));

describe('genererEmbarquee', () => {
  it('a une version stable tant que les listes maison ne changent pas', () => {
    const a = genererEmbarquee({ 'telemetry.txt': 'sentry.io # source: test\n' }, ['com.whatsapp']);
    const b = genererEmbarquee({ 'telemetry.txt': 'sentry.io # source: test\n' }, ['com.whatsapp']);
    const c = genererEmbarquee({ 'telemetry.txt': 'bugsnag.com # source: test\n' }, ['com.whatsapp']);
    expect(a.version).toMatch(/^maison-[0-9a-f]{8}$/);
    expect(a.version).toBe(b.version);
    expect(c.version).not.toBe(a.version);
    expect(lireListes(a.texte).version).toBe(a.version);
  });

  it('refuse d’embarquer une entrée maison qui ressemble à de la pub (garde-fou Play)', () => {
    expect(() => genererEmbarquee({ 'telemetry.txt': 'adx.vendor.com # source: test\n' }, [])).toThrow('adx.vendor.com');
  });

  it('lit les listes maison du dépôt sans erreur et sans entrée publicitaire', () => {
    const { texte } = genererEmbarquee(fichiersMaison(), []);
    const l = lireListes(texte);
    expect(l.categories.ads).toBeUndefined();
    expect(l.categories.trackers).toBeUndefined();
  });

  // Dans le monorepo DataMalin seulement : l'app embarque une copie générée de cette liste.
  const cible = join(racine, 'apps/mobile/src/features/bouclier/liste-embarquee.json');
  const essentielles = join(racine, 'content/apps-essentielles.json');
  it.skipIf(!existsSync(cible) || !existsSync(essentielles))(
    "la copie embarquée dans l'app est à jour (sinon : npm run embarquee -w @datamalin/listes)",
    () => {
      const attendu = genererEmbarquee(fichiersMaison(), lirePaquetsEssentiels(JSON.parse(readFileSync(essentielles, 'utf8'))));
      expect(JSON.parse(readFileSync(cible, 'utf8'))).toEqual(attendu);
    },
  );
});
