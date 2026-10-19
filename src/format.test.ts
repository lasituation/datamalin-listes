import { describe, expect, it } from 'vitest';

import { ecrireListes, lireListes, normaliserDomaine, trierParSuffixe } from './format';
import type { Listes } from './types';

describe('normaliserDomaine', () => {
  it('met en minuscules et retire espaces et point final', () => {
    expect(normaliserDomaine('  Ads.Example.COM. ')).toBe('ads.example.com');
  });

  it('garde les noms en punycode', () => {
    expect(normaliserDomaine('xn--bcher-kva.example')).toBe('xn--bcher-kva.example');
  });

  it('refuse adresses IP, jokers, labels vides ou mal formés', () => {
    for (const brut of ['1.2.3.4', '*.x.com', '', 'a..b', '-a.com', 'a-.com', 'com', 'a_b.com', `${'a'.repeat(64)}.com`]) {
      expect(normaliserDomaine(brut)).toBeNull();
    }
  });
});

describe('trierParSuffixe', () => {
  it('range les domaines par labels inversés, sans doublons', () => {
    expect(trierParSuffixe(['b.a.com', 'x.org', 'a.com', 'a.com'])).toEqual(['a.com', 'b.a.com', 'x.org']);
  });
});

const exemple: Listes = {
  version: '2026.10.20-1',
  canal: 'direct',
  sources: [{ nom: 'HaGeZi Multi LIGHT', version: '2026.1019.0859.37', licence: 'GPL-3.0', url: 'https://github.com/hagezi/dns-blocklists' }],
  categories: { ads: ['doubleclick.net', 'ads.x.com'], telemetry: ['metric.account-samsung.com'] },
  allowlist: { domaines: ['mtn.cm'], paquets: ['com.whatsapp'] },
};

describe('ecrireListes / lireListes', () => {
  it('relit exactement ce qui a été écrit (domaines triés par suffixe)', () => {
    const relu = lireListes(ecrireListes(exemple));
    expect(relu).toEqual({ ...exemple, categories: { ads: ['ads.x.com', 'doubleclick.net'], telemetry: ['metric.account-samsung.com'] } });
  });

  it('écrit la licence et les sources en tête de fichier', () => {
    const texte = ecrireListes(exemple);
    expect(texte).toContain('# licence: GPL-3.0');
    expect(texte).toContain('# source: HaGeZi Multi LIGHT | 2026.1019.0859.37 | GPL-3.0 | https://github.com/hagezi/dns-blocklists');
  });

  it('ignore une section inconnue et une ligne invalide', () => {
    const relu = lireListes('# version: v\n# canal: play\n[ads]\nok.com\n-bad\n[inconnue]\nx.com\n[telemetry]\nt.com\n');
    expect(relu.categories).toEqual({ ads: ['ok.com'], telemetry: ['t.com'] });
  });

  it('refuse un fichier sans version ni canal', () => {
    expect(() => lireListes('[ads]\nok.com\n')).toThrow();
  });
});
