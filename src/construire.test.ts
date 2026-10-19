import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { beforeEach, describe, expect, it } from 'vitest';

import { construire, SOURCES_HAGEZI, type Manifeste } from './construire';
import { lireListes } from './format';

const entete = (titre: string) => `# Title: ${titre}\n# Version: 2026.1019.0859.37\n`;
const light = (n: number) => entete("HaGeZi's Multi LIGHT") + Array.from({ length: n }, (_, i) => `d${i}.pub-exemple.com`).join('\n');
const natif = (marque: string, n = 10) => entete(`HaGeZi's ${marque} Tracker`) + Array.from({ length: n }, (_, i) => `t${i}.${marque}.com`).join('\n');

function sourcesFactices(nLight = 30_000, nNatif = 10): Record<string, string> {
  return Object.fromEntries([
    [SOURCES_HAGEZI.ads, light(nLight)],
    ...SOURCES_HAGEZI.telemetrie.map((f) => [f, natif(f.replace(/^native\.|-onlydomains\.txt$/g, ''), nNatif)]),
  ]);
}

let dossier: string;
let dossierMaison: string;
const telechargeur = (textes: Record<string, string>) => async (url: string) => {
  const fichier = url.split('/').pop() ?? '';
  const texte = textes[fichier];
  if (texte === undefined) throw new Error(`introuvable ${fichier}`);
  return texte;
};
const options = (textes = sourcesFactices(), maintenant = new Date('2026-10-20T12:15:00Z')) => ({
  dossier,
  dossierMaison,
  paquetsEssentiels: ['com.whatsapp'],
  maintenant,
  telecharger: telechargeur(textes),
});
const manifeste = (): Manifeste => JSON.parse(readFileSync(join(dossier, 'manifest.json'), 'utf8'));

beforeEach(() => {
  dossier = mkdtempSync(join(tmpdir(), 'listes-'));
  dossierMaison = mkdtempSync(join(tmpdir(), 'maison-'));
  writeFileSync(join(dossierMaison, 'telemetry.txt'), 'sentry.io # source: test\n');
  writeFileSync(join(dossierMaison, 'allowlist.txt'), 'mtn.cm # source: test\n');
});

describe('construire', () => {
  it('écrit les deux fichiers gzip et un manifeste qui les décrit exactement', async () => {
    const r = await construire(options());
    expect(r).toEqual({ publie: true, version: '2026.10.20-1', erreurs: [] });
    const m = manifeste();
    for (const canal of ['play', 'direct'] as const) {
      const octets = readFileSync(join(dossier, m.canaux[canal].fichier));
      expect(m.canaux[canal].fichier).toBe(`2026.10.20-1.${canal}.txt.gz`);
      expect(m.canaux[canal].sha256).toBe(createHash('sha256').update(octets).digest('hex'));
      expect(m.canaux[canal].octets).toBe(octets.length);
      expect(lireListes(gunzipSync(octets).toString('utf8')).canal).toBe(canal);
    }
    expect(m.canaux.direct.domaines.ads).toBe(30_000);
    expect(m.canaux.play.domaines.ads).toBeUndefined();
    expect(m.comptes["HaGeZi's Multi LIGHT"]).toBe(30_000);
  });

  it('numérote les constructions du même jour et garde les 3 dernières versions', async () => {
    for (let i = 0; i < 4; i++) await construire(options());
    expect(manifeste().version).toBe('2026.10.20-4');
    const versions = new Set(readdirSync(dossier).filter((f) => f.endsWith('.gz')).map((f) => f.split('.').slice(0, 3).join('.')));
    expect([...versions].sort()).toEqual(['2026.10.20-2', '2026.10.20-3', '2026.10.20-4']);
  }, 20_000); // quatre constructions de 30 000 domaines

  it("ne publie rien si une source manque : l'ancienne version reste servie", async () => {
    await construire(options());
    const textes = sourcesFactices();
    delete textes[SOURCES_HAGEZI.telemetrie[0] ?? ''];
    const r = await construire(options(textes));
    expect(r.publie).toBe(false);
    expect(r.erreurs.join()).toContain(SOURCES_HAGEZI.telemetrie[0]);
    expect(manifeste().version).toBe('2026.10.20-1');
  });

  it('refuse une liste LIGHT de moins de 30 000 domaines', async () => {
    const r = await construire(options(sourcesFactices(29_999)));
    expect(r.publie).toBe(false);
    expect(existsSync(join(dossier, 'manifest.json'))).toBe(false);
  });

  it('refuse une source tombée sous 70 % de la version précédente', async () => {
    await construire(options(sourcesFactices(30_000, 10)));
    const r = await construire(options(sourcesFactices(30_000, 6)));
    expect(r.publie).toBe(false);
    expect(manifeste().version).toBe('2026.10.20-1');
  });

  it('refuse un fichier direct trop gros', async () => {
    const r = await construire({ ...options(), octetsMax: 1000 });
    expect(r.publie).toBe(false);
  });

  it('refuse une liste play qui contiendrait un domaine publicitaire', async () => {
    mkdirSync(dossierMaison, { recursive: true });
    writeFileSync(join(dossierMaison, 'telemetry.txt'), 'samsungads.com # source: test\n');
    const r = await construire(options());
    expect(r.publie).toBe(false);
    expect(r.erreurs.join()).toContain('samsungads.com');
  });
});
