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
  filaments: Record<string, { material: string; color: string; hex: string }>;
  spools: SeedSpool[];
  movements: SeedMovement[];
  settings: { kwhPriceCents: number; failurePct: number; purgePct: number; minMarginPct: number; formulaMarginPct: number; business: { name: string; trade: string; phone: string; email: string; city: string; quoteValidDays: number; footer: string } };
  channels: { name: string; commissionPct: number }[];
  suppliers: { key: string; name: string; phone: string; brands: string; note: string }[];
  supplies: { key: string; name: string; unit: string; costCents: number; minimum: number; note: string; supplierKey: string | null }[];
  supplyMovements: { supplyKey: string; on: string; kind: 'purchase' | 'use'; qty: number; note: string }[];
  printers: {
    key: string;
    name: string;
    costCents: number;
    lifeHours: number;
    maintenanceCentsPerHour: number;
    kw: number;
    hours: number;
    purchasedOn: string;
    tasks: { task: string; everyHours: number; lastHours: number; lastOn: string | null }[];
  }[];
  products: SeedProduct[];
  collections: { name: string; parts: { productKey: string; qty: number }[]; extrasCents: number; priceCents: number | null; tags: string[]; note: string }[];
  expenses: { on: string; concept: string; category: string; amountCents: number; recurring: boolean }[];
}

export interface SeedProduct {
  key: string;
  name: string;
  printerKey: string;
  minutes: number;
  batchSize: number;
  extrasCents: number;
  supplies: { supplyKey: string; qty: number }[];
  filaments: { filamentKey: keyof typeof FILAMENTS; grams: number }[];
  priceCents: number;
  mode: 'value' | 'formula';
  tags: string[];
  note: string;
  parentKey: string | null;
  tracksStock: boolean;
  spec: { layer?: string; infill?: string; walls?: string; supports?: string; nozzle?: string; bed?: string; file?: string; note?: string } | null;
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
  const P = (o: Partial<SeedProduct> & Pick<SeedProduct, 'key' | 'name'>): SeedProduct => ({
    printerKey: 'p1', minutes: 0, batchSize: 1, extrasCents: 0, supplies: [], filaments: [], priceCents: 0, mode: 'value', tags: [], note: '', parentKey: null, tracksStock: false, spec: null, ...o,
  });
  const fig = { supplies: [{ supplyKey: 'i2', qty: 1 }, { supplyKey: 'i3', qty: 1 }], priceCents: 25000, tags: ['Coleccionable'], tracksStock: true };
  const products: SeedProduct[] = [
    P({ key: 'pr1', name: 'Llavero con nombre', tracksStock: true, printerKey: 'p2', minutes: 18, batchSize: 10, supplies: [{ supplyKey: 'i1', qty: 1 }], spec: { layer: '0.20', infill: '15', walls: '3', supports: 'No', nozzle: '215', bed: '60', file: '~/Modelos/llavero-nombre.3mf', note: 'Entran 10 por placa. El nombre va en la cara de arriba.' }, filaments: [{ filamentKey: 'f5', grams: 6 }], priceCents: 5000, tags: ['Regalo'], note: 'Un llavero suelto se vende como detalle: $50 es un billete.' }),
    P({ key: 'pr2', name: 'Servilletero con logo', minutes: 150, filaments: [{ filamentKey: 'f2', grams: 45 }], priceCents: 12000, tags: ['Negocio', 'Personalizado'] }),
    P({ key: 'pr3', name: 'Spider-Man · salto', ...fig, minutes: 270, spec: { layer: '0.16', infill: '10', walls: '2', supports: 'Árbol', nozzle: '220', bed: '55', file: '~/Modelos/spiderman-salto.3mf', note: 'Imprimir de pie. Quitar los soportes con cuidado en las manos.' }, filaments: [{ filamentKey: 'f1', grams: 40 }], note: 'Blanco minimalista para escritorio.' }),
    P({ key: 'pr4', name: 'Spider-Man · trepando', ...fig, minutes: 240, filaments: [{ filamentKey: 'f1', grams: 38 }] }),
    P({ key: 'pr5', name: 'Doctor Doom · busto', ...fig, minutes: 300, filaments: [{ filamentKey: 'f1', grams: 42 }] }),
    P({ key: 'pr6', name: 'Hulk · puño', ...fig, minutes: 252, filaments: [{ filamentKey: 'f1', grams: 40 }] }),
    P({ key: 'pr8', name: 'Soporte de celular PETG', tracksStock: true, minutes: 192, filaments: [{ filamentKey: 'f6', grams: 55 }], mode: 'formula', note: 'Material técnico: aquí sí cobro costo + margen.' }),
    P({ key: 'pr9', name: 'Letrero de taquería', minutes: 360, extrasCents: 1200, filaments: [{ filamentKey: 'f5', grams: 55 }, { filamentKey: 'f1', grams: 30 }], priceCents: 45000, tags: ['Personalizado', 'Negocio'] }),
    P({ key: 'pr10', name: 'Spider-Man · salto (silk morado)', ...fig, minutes: 270, filaments: [{ filamentKey: 'f4', grams: 40 }], parentKey: 'pr3' }),
  ];
  const supplies: Seed['supplies'] = [
    { key: 'i1', name: 'Argolla de llavero', unit: 'pza', costCents: 50, minimum: 30, note: 'Paquete de 200', supplierKey: 'pv4' },
    { key: 'i2', name: 'Caja de regalo', unit: 'pza', costCents: 450, minimum: 5, note: '', supplierKey: 'pv5' },
    { key: 'i3', name: 'Imán de base', unit: 'pza', costCents: 150, minimum: 10, note: '', supplierKey: 'pv4' },
    { key: 'i4', name: 'Bolsa de empaque', unit: 'pza', costCents: 80, minimum: 20, note: 'Para envíos y entregas', supplierKey: 'pv5' },
  ];
  const supplyMovements: Seed['supplyMovements'] = [
    { supplyKey: 'i1', on: addDays(today, -45), kind: 'purchase', qty: 200, note: 'Compra de 200 piezas' },
    { supplyKey: 'i2', on: addDays(today, -45), kind: 'purchase', qty: 8, note: 'Compra de 8 cajas' },
    { supplyKey: 'i3', on: addDays(today, -45), kind: 'purchase', qty: 60, note: 'Compra de 60 imanes' },
    { supplyKey: 'i4', on: addDays(today, -40), kind: 'purchase', qty: 100, note: 'Compra de 100 bolsas' },
    { supplyKey: 'i4', on: addDays(today, -10), kind: 'use', qty: -22, note: 'Entregas del mes' },
    { supplyKey: 'i2', on: addDays(today, -8), kind: 'use', qty: -2, note: 'Regalo de cumpleaños' },
  ];
  // The mockup's print history spends the supplies of the pieces that came out well (usarInsumos).
  const goodRuns: [productKey: string, daysAgo: number, qty: number][] = [['pr5', 3, 1], ['pr6', 5, 1], ['pr1', 6, 10], ['pr3', 15, 1]];
  for (const [key, daysAgo, qty] of goodRuns) {
    const p = products.find((x) => x.key === key)!;
    for (const r of p.supplies) supplyMovements.push({ supplyKey: r.supplyKey, on: addDays(today, -daysAgo), kind: 'use', qty: -r.qty * qty, note: p.name + (qty > 1 ? ' × ' + qty : '') });
  }
  return {
    workspaceName: 'Quick Robot',
    filaments: FILAMENTS,
    spools,
    movements,
    settings: {
      kwhPriceCents: 300, failurePct: 5, purgePct: 5, minMarginPct: 30, formulaMarginPct: 50,
      business: { name: 'Quick Robot', trade: 'Impresión 3D', phone: '', email: '', city: 'Guadalajara, Jalisco', quoteValidDays: 7, footer: 'Se requiere un anticipo del 50% para iniciar la producción. El saldo se paga al entregar.' },
    },
    channels: [
      { name: 'Facebook', commissionPct: 0 },
      { name: 'WhatsApp', commissionPct: 0 },
      { name: 'Efectivo', commissionPct: 0 },
      { name: 'Mercado Libre', commissionPct: 17 },
      { name: 'Terminal', commissionPct: 3.6 },
    ],
    suppliers: [
      { key: 'pv1', name: 'Sunlu Oficial', phone: 'Mercado Libre', brands: 'Sunlu', note: 'Envío en 2 a 3 días. Mejor precio en 4 rollos o más.' },
      { key: 'pv2', name: 'Bambu Lab Store', phone: 'tienda en línea', brands: 'Bambu Lab', note: 'Rollos con carrete reutilizable.' },
      { key: 'pv3', name: 'eSUN México', phone: '33 5555 0101', brands: 'eSUN', note: '' },
      { key: 'pv4', name: 'Tornillería y mercería Centro', phone: '33 5555 0188', brands: '', note: 'Argollas, imanes y herrajes.' },
      { key: 'pv5', name: 'Empaques Guadalajara', phone: '33 5555 0123', brands: '', note: 'Cajas y bolsas.' },
    ],
    supplies,
    supplyMovements,
    printers: [
      {
        key: 'p1', name: 'Bambu Lab P1S', costCents: 1_200_000, lifeHours: 5000, maintenanceCentsPerHour: 60, kw: 0.12, hours: 312, purchasedOn: addDays(today, -120),
        tasks: [
          { task: 'Cambiar la boquilla', everyHours: 300, lastHours: 120, lastOn: addDays(today, -50) },
          { task: 'Lubricar ejes', everyHours: 200, lastHours: 100, lastOn: addDays(today, -70) },
          { task: 'Limpiar la cama', everyHours: 100, lastHours: 260, lastOn: addDays(today, -9) },
        ],
      },
      {
        key: 'p2', name: 'Ender 3 V3 SE', costCents: 380_000, lifeHours: 4000, maintenanceCentsPerHour: 80, kw: 0.15, hours: 128, purchasedOn: addDays(today, -100),
        tasks: [
          { task: 'Cambiar la boquilla', everyHours: 250, lastHours: 0, lastOn: null },
          { task: 'Nivelar la cama', everyHours: 80, lastHours: 40, lastOn: addDays(today, -25) },
          { task: 'Revisar las correas', everyHours: 300, lastHours: 0, lastOn: null },
        ],
      },
    ],
    products,
    collections: [
      { name: 'Colección Doomsday blanca', parts: [{ productKey: 'pr3', qty: 1 }, { productKey: 'pr4', qty: 1 }, { productKey: 'pr5', qty: 1 }, { productKey: 'pr6', qty: 1 }], extrasCents: 2500, priceCents: 100000, tags: ['Coleccionable', 'Edición limitada'], note: 'Las cuatro figuras en caja, como set de oficina. Cada figura también se vende suelta.' },
      { name: 'Spider-Man · 2 poses', parts: [{ productKey: 'pr3', qty: 1 }, { productKey: 'pr4', qty: 1 }], extrasCents: 1000, priceCents: 45000, tags: ['Regalo'], note: 'Las dos poses de Spider-Man juntas, con tarjeta.' },
    ],
    expenses: [
      { on: addDays(today, -75), concept: 'Renta del espacio de trabajo', category: 'Renta o espacio', amountCents: 120000, recurring: true },
      { on: addDays(today, -75), concept: 'Internet', category: 'Servicios', amountCents: 40000, recurring: true },
      { on: addDays(today, -20), concept: 'Boquillas y refacciones', category: 'Mantenimiento y refacciones', amountCents: 38000, recurring: false },
      { on: addDays(today, -14), concept: 'Publicidad en Facebook', category: 'Publicidad', amountCents: 30000, recurring: false },
      { on: addDays(today, -28), concept: 'Espátulas, pinzas y lijas', category: 'Herramientas', amountCents: 45000, recurring: false },
    ],
  };
}
