import { describe, expect, it } from 'vitest';

import { compiler, listeEmbarquee, lireDossierMaison, ressemblePub, verifierPlay, type SourcesCompilation } from './compiler';
import type { HageziLue } from './sources';

const hagezi = (titre: string, domaines: string[]): HageziLue => ({ titre, version: '2026.1019.0859.37', domaines });
const maison = (domaine: string, deHagezi = false) => ({ domaine, source: deHagezi ? 'HaGeZi Samsung Tracker, revu' : 'test', deHagezi });

const sources: SourcesCompilation = {
  ads: hagezi("HaGeZi's Multi LIGHT", ['doubleclick.net', 'app-measurement.com', 'x.mtn.cm', 'samsungads.com']),
  telemetrie: [hagezi("HaGeZi's Samsung Tracker", ['metric.account-samsung.com', 'samsungads.com'])],
  maison: {
    trackers: [maison('app-measurement.com'), maison('appsflyer.com')],
    telemetry: [maison('crashlytics.com'), maison('metric.account-samsung.com', true)],
  },
  allowlistDomaines: [maison('mtn.cm')],
  allowlistPaquets: ['com.whatsapp'],
};

describe('compiler (direct)', () => {
  const l = compiler(sources, 'direct', '2026.10.20-1');

  it('range LIGHT en ads, les listes natives en telemetry, et donne la priorité aux listes maison', () => {
    expect(l.categories.ads).toEqual(['doubleclick.net']);
    expect(l.categories.trackers).toEqual(['app-measurement.com', 'appsflyer.com']);
    expect(l.categories.telemetry).toEqual(expect.arrayContaining(['crashlytics.com', 'metric.account-samsung.com', 'samsungads.com']));
  });

  it('retire de toutes les catégories un domaine de la liste blanche et ses sous-domaines', () => {
    expect(Object.values(l.categories).flat()).not.toContain('x.mtn.cm');
    expect(l.allowlist).toEqual({ domaines: ['mtn.cm'], paquets: ['com.whatsapp'] });
  });

  it('cite les sources HaGeZi utilisées et nos listes', () => {
    expect(l.sources.map((s) => s.nom)).toEqual(["HaGeZi's Multi LIGHT", "HaGeZi's Samsung Tracker", 'Listes maison DataMalin']);
  });
});

describe('compiler (play)', () => {
  const l = compiler(sources, 'play', '2026.10.20-1');

  it('ne garde ni ads ni trackers, ni aucune entrée venue de HaGeZi', () => {
    expect(l.categories.ads).toBeUndefined();
    expect(l.categories.trackers).toBeUndefined();
    expect(l.categories.telemetry).toEqual(['crashlytics.com']);
    expect(l.sources.map((s) => s.nom)).toEqual(['Listes maison DataMalin']);
  });

  it('passe le garde-fou', () => {
    expect(() => verifierPlay(l)).not.toThrow();
  });
});

describe('ressemblePub', () => {
  it('reconnaît les domaines publicitaires, y compris aux labels composés', () => {
    for (const d of ['samsungads.com', 'ads-api.tiktok.com', 'ad-format-sg.tiktokv.com', 'p16-ad.byteoversea.com', 'ad.intl.xiaomi.com', 'adserver.x.com', 'advertising.x.com', 'ads2.x.com']) {
      expect(ressemblePub(d), d).toBe(true);
    }
  });

  it('laisse les domaines ordinaires, y compris uploads et downloads', () => {
    for (const d of ['metric.account-samsung.com', 'firebase-settings.crashlytics.com', 'uploads.example.com', 'downloads.x.com', 'adobe.com']) {
      expect(ressemblePub(d), d).toBe(false);
    }
  });
});

describe('verifierPlay', () => {
  it('lève sur une liste play qui contient un domaine publicitaire, en le nommant', () => {
    const l = compiler({ ...sources, maison: { telemetry: [maison('samsungads.com')] } }, 'play', 'v');
    expect(() => verifierPlay(l)).toThrow('samsungads.com');
  });

  it('lève sur une liste play qui contient une catégorie ads', () => {
    const l = compiler(sources, 'direct', 'v');
    expect(() => verifierPlay({ ...l, canal: 'play' })).toThrow();
  });
});

describe('listeEmbarquee', () => {
  it('ne contient que nos propres entrées, sans pubs ni pisteurs', () => {
    const l = listeEmbarquee(sources, 'maison-x');
    expect(l.canal).toBe('play');
    expect(Object.values(l.categories).flat()).toEqual(['crashlytics.com']);
  });
});

describe('lireDossierMaison', () => {
  it('lit les fichiers par catégorie et la liste blanche', () => {
    const lu = lireDossierMaison({
      'trackers.txt': 'appsflyer.com # source: test\n',
      'allowlist.txt': 'mtn.cm # source: site MTN\n',
      'LISEZMOI.md': 'ignoré',
    });
    expect(lu.maison.trackers?.map((e) => e.domaine)).toEqual(['appsflyer.com']);
    expect(lu.allowlistDomaines.map((e) => e.domaine)).toEqual(['mtn.cm']);
  });
});
