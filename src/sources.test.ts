import { describe, expect, it } from 'vitest';

import { lireHagezi, lireMaison } from './sources';

const LIGHT = `# Title: HaGeZi's Multi LIGHT - basic protection
# Description: Cleans the Internet and protects your privacy!
# Homepage: https://github.com/hagezi/dns-blocklists
# License: https://github.com/hagezi/dns-blocklists/blob/main/LICENSE
# Expires: 8 hours
# Last modified: 19 Oct 2026 08:59 UTC
# Version: 2026.1019.0859.37
# Number of entries: 65249
#
telemetry.001-studio.com
ad.001zb.com
sst.013.nl
`;

describe('lireHagezi', () => {
  it('lit le titre, la version et les domaines', () => {
    expect(lireHagezi(LIGHT)).toEqual({
      titre: "HaGeZi's Multi LIGHT - basic protection",
      version: '2026.1019.0859.37',
      domaines: ['telemetry.001-studio.com', 'ad.001zb.com', 'sst.013.nl'],
    });
  });

  it('refuse un fichier sans en-tête de version', () => {
    expect(() => lireHagezi('ad.001zb.com\n')).toThrow();
  });
});

describe('lireMaison', () => {
  it('lit une entrée avec sa source', () => {
    expect(lireMaison('appsflyer.com  # source: observé A05 19/10/2026\n', 'trackers.txt')).toEqual([
      { domaine: 'appsflyer.com', source: 'observé A05 19/10/2026', deHagezi: false },
    ]);
  });

  it('ignore lignes vides et commentaires de tête', () => {
    expect(lireMaison('# En-tête du fichier\n\n', 'trackers.txt')).toEqual([]);
  });

  it('refuse une entrée sans source, avec le fichier et la ligne', () => {
    expect(() => lireMaison('# tête\nappsflyer.com\n', 'trackers.txt')).toThrow('trackers.txt:2 : source manquante');
  });

  it('refuse un domaine invalide', () => {
    expect(() => lireMaison('*.x.com # source: test\n', 'trackers.txt')).toThrow('trackers.txt:1');
  });

  it('marque les entrées reprises de HaGeZi', () => {
    const [entree] = lireMaison('metric.account-samsung.com # source: HaGeZi Samsung Tracker, revu le 20/10/2026\n', 'telemetry.txt');
    expect(entree?.deHagezi).toBe(true);
  });

  it('ne marque pas une entrée maison qui cite seulement un ticket du dépôt HaGeZi comme preuve', () => {
    const [entree] = lireMaison('dlmgr.gtm.svcmot.com  # source: Motorola OTA, https://github.com/hagezi/dns-blocklists/issues/9856\n', 'os_updates.txt');
    expect(entree?.deHagezi).toBe(false);
  });
});
