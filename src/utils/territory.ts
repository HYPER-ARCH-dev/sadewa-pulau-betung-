import { DusunRecord } from '../types';

/**
 * Format dynamic dusun label based on scheme: Dusun [Nomor] [Nama Opsional]
 * Default without customName: "Dusun 1", "Dusun 2"
 * With customName (e.g. "Betung Indah"): "Dusun 1 Betung Indah"
 * If customName is empty/cleared: "Dusun 1"
 */
export function formatDusunLabel(
  dusun: { id?: string; number?: number; customName?: string; name?: string },
  defaultIndex: number = 0
): string {
  if (!dusun) return 'Dusun 1';

  let num = dusun.number;
  let custom = (dusun.customName || '').trim();

  // If number is not explicitly set, try to derive from id or index or parsing name
  if (num === undefined || num === null || isNaN(num)) {
    if (dusun.name) {
      const matchName = dusun.name.match(/^Dusun\s+(\d+)\s*(.*)$/i);
      if (matchName) {
        num = parseInt(matchName[1], 10);
        if (!custom && matchName[2]) {
          custom = matchName[2].trim();
        }
      }
    }
    if (num === undefined || isNaN(num)) {
      if (dusun.id) {
        const matchId = dusun.id.match(/\d+/);
        if (matchId) {
          num = parseInt(matchId[0], 10);
        }
      }
    }
    if (num === undefined || isNaN(num)) {
      num = defaultIndex + 1;
    }
  }

  if (custom) {
    return `Dusun ${num} ${custom}`;
  }
  return `Dusun ${num}`;
}

/**
 * Parse a raw Dusun object into structured number & customName
 */
export function parseDusunDetails(
  dusun: { id?: string; number?: number; customName?: string; name?: string },
  defaultIndex: number = 0
): { number: number; customName: string; label: string } {
  let num = dusun.number;
  let custom = (dusun.customName || '').trim();

  if (num === undefined || num === null || isNaN(num)) {
    if (dusun.name) {
      const matchName = dusun.name.match(/^Dusun\s+(\d+)\s*(.*)$/i);
      if (matchName) {
        num = parseInt(matchName[1], 10);
        if (!custom && matchName[2]) {
          custom = matchName[2].trim();
        }
      }
    }
    if (num === undefined || isNaN(num)) {
      if (dusun.id) {
        const matchId = dusun.id.match(/\d+/);
        if (matchId) num = parseInt(matchId[0], 10);
      }
    }
    if (num === undefined || isNaN(num)) {
      num = defaultIndex + 1;
    }
  }

  const label = custom ? `Dusun ${num} ${custom}` : `Dusun ${num}`;
  return { number: num, customName: custom, label };
}

/**
 * Ensure an array of DusunRecords has formatted name property
 */
export function normalizeTerritories(territories: DusunRecord[]): DusunRecord[] {
  if (!Array.isArray(territories)) return [];
  return territories.map((d, idx) => {
    const { number, customName, label } = parseDusunDetails(d, idx);
    return {
      ...d,
      number,
      customName,
      name: label
    };
  });
}
