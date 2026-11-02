/**
 * DEVELOPMENT SEED ONLY — the mockup's sample data ("Quick Robot"). Never imported by the product code.
 * Faithful to the mockup's generator (filamentos, rollos, movs), with dates relative to `today`.
 * Plain data: the dev runner applies it through the server's use cases.
 */

export interface SeedSpool {
  key: string;
  material: string;
  color: string;
  hex: string;
  brand: string;
  costCents: number;
  shippingCents: number;
  grams: number;
  purchasedOn: string;
}

export interface SeedMovement {
  spoolKey: string;
  on: string;
  kind: 'consumption' | 'failure' | 'waste';
  grams: number;
  note: string;
}

export interface Seed {
  workspaceName: string;
  spools: SeedSpool[];
  movements: SeedMovement[];
}

const addDays = (today: string, n: number) => {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const FILAMENTS = {
  f1: { material: 'PLA', color: 'Blanco', hex: '#f1f1ee' },
  f2: { material: 'PLA', color: 'Negro', hex: '#26242b' },
  f3: { material: 'PLA', color: 'Gris claro', hex: '#b9b7bf' },
  f4: { material: 'PLA Silk', color: 'Morado', hex: '#7b4bd0' },
  f5: { material: 'PLA', color: 'Rojo', hex: '#d8283f' },
  f6: { material: 'PETG', color: 'Negro', hex: '#34323a' },
  f7: { material: 'TPU 95A', color: 'Azul', hex: '#2f6fd0' },
} as const;

// id, filament, brand, cost, shipping, grams, days ago, grams left before the two failures below
const SPOOLS: [string, keyof typeof FILAMENTS, string, number, number, number, number, number][] = [
  ['r1', 'f1', 'Bambu Lab', 350, 40, 1000, -40, 734],
  ['r2', 'f2', 'eSUN', 320, 40, 1000, -40, 427],
  ['r3', 'f3', 'Bambu Lab', 380, 0, 1000, -12, 940],
  ['r4', 'f4', 'Sunlu', 430, 40, 1000, -38, 85],
  ['r5', 'f5', 'eSUN', 330, 40, 1000, -34, 600],
  ['r6', 'f6', 'Sunlu', 420, 40, 1000, -30, 800],
  ['r7', 'f7', 'Sunlu', 390, 40, 500, -22, 300],
  ['r8', 'f1', 'Sunlu', 330, 40, 1000, -6, 1000],
];

const PARTS: [SeedMovement['kind'], number, string][] = [
  ['consumption', 0.4, 'Lote de llaveros'],
  ['consumption', 0.28, 'Pedido a un cliente'],
  ['failure', 0.1, 'Fallo: se despegó de la cama'],
  ['waste', 0.04, 'Purga al cambiar de color'],
  ['consumption', 0.18, 'Piezas del catálogo'],
];

export function quickRobotSeed(today: string): Seed {
  const spools: SeedSpool[] = [];
  const movements: SeedMovement[] = [];
  SPOOLS.forEach(([key, fil, brand, cost, shipping, grams, daysAgo, left], i) => {
    spools.push({ key, ...FILAMENTS[fil], brand, costCents: cost * 100, shippingCents: shipping * 100, grams, purchasedOn: addDays(today, daysAgo) });
    const used = grams - left;
    if (used <= 0) return;
    let rest = used;
    PARTS.forEach(([kind, p, note], k) => {
      const g = k === PARTS.length - 1 ? rest : Math.round(used * p);
      rest -= g;
      movements.push({ spoolKey: key, on: addDays(today, -Math.max(1, 36 - k * 7 - i)), kind, grams: -g, note });
    });
  });
  movements.push(
    { spoolKey: 'r1', on: addDays(today, -1), kind: 'failure', grams: -14, note: 'Fallo: Doctor Doom · busto' },
    { spoolKey: 'r2', on: addDays(today, -18), kind: 'failure', grams: -17, note: 'Fallo: Servilletero con logo' },
  );
  return { workspaceName: 'Quick Robot', spools, movements };
}
