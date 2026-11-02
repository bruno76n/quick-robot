import { z } from 'zod';
import { HexColor, Id, Name } from './common';

const Pct = z.number().min(0).max(99);

export const BusinessInfo = z.object({
  name: z.string().trim().max(120),
  trade: z.string().trim().max(120),
  phone: z.string().trim().max(60),
  email: z.string().trim().max(120),
  city: z.string().trim().max(120),
  quoteValidDays: z.number().int().min(0).max(365),
  footer: z.string().trim().max(1000),
});
export type BusinessInfo = z.infer<typeof BusinessInfo>;

export const Settings = z.object({
  kwhPriceCents: z.number().int(),
  failurePct: z.number(),
  purgePct: z.number(),
  minMarginPct: z.number(),
  formulaMarginPct: z.number(),
  business: BusinessInfo,
});
export type Settings = z.infer<typeof Settings>;

/** PATCH /settings — any subset. */
export const UpdateSettingsInput = z
  .object({
    kwhPriceCents: z.number().int().min(0).max(100_000),
    failurePct: Pct,
    purgePct: Pct,
    minMarginPct: z.number().min(0).max(95),
    formulaMarginPct: z.number().min(0).max(95),
    business: BusinessInfo.partial(),
  })
  .partial();
export type UpdateSettingsInput = z.input<typeof UpdateSettingsInput>;

export const Channel = z.object({ id: Id, name: z.string(), commissionPct: z.number(), position: z.number().int() });
export type Channel = z.infer<typeof Channel>;
export const ChannelInput = z.object({ name: Name, commissionPct: z.number().min(0).max(95).default(0) });
export type ChannelInput = z.input<typeof ChannelInput>;
export const UpdateChannelInput = ChannelInput.partial();
export type UpdateChannelInput = z.input<typeof UpdateChannelInput>;

export const SettingsBundle = z.object({ settings: Settings, channels: z.array(Channel) });
export type SettingsBundle = z.infer<typeof SettingsBundle>;

export const Catalog = z.object({
  materials: z.array(z.string()),
  colors: z.array(z.object({ name: z.string(), hex: HexColor })),
  brands: z.array(z.string()),
});
export type Catalog = z.infer<typeof Catalog>;
