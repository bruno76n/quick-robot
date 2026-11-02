// Settings, channels and pick lists (docs/12 §4).
import { z } from 'zod';
import { calendarDate, cents, id, LIMITS, name, note, pct, short } from './common';

export const business = z.object({
  name: z.string().trim().max(LIMITS.name), trade: z.string().trim().max(LIMITS.name), phone: short, email: z.string().trim().max(LIMITS.name),
  city: z.string().trim().max(LIMITS.name), quoteValidDays: z.number().int().min(0).max(365), footer: note,
});
export const settingsView = z.object({
  kwhPriceCents: z.number().int(), failurePct: z.number(), purgePct: z.number(), minMarginPct: z.number(), formulaMarginPct: z.number(),
  business, lastBackupOn: calendarDate.nullable(),
});
export const channelView = z.object({ id, name: z.string(), commissionPct: z.number(), position: z.number().int() });
export const catalogEntry = z.object({ name: z.string(), hex: z.string().nullable().optional() });
export const catalogs = z.object({
  materials: z.array(catalogEntry), colors: z.array(catalogEntry), brands: z.array(catalogEntry),
  customerTypes: z.array(catalogEntry), expenseCategories: z.array(catalogEntry),
});
export const settingsOutput = z.object({ settings: settingsView, channels: z.array(channelView), catalogs });

export const updateSettingsInput = z.object({
  kwhPriceCents: cents(10_000_000).optional(), failurePct: pct.optional(), purgePct: pct.optional(), minMarginPct: pct.optional(), formulaMarginPct: pct.optional(),
  business: business.partial().optional(),
}).strict();
export const addChannelInput = z.object({ name, commissionPct: pct });
export const updateChannelInput = z.object({ name: name.optional(), commissionPct: pct.optional(), position: z.number().int().min(0).max(1000).optional() });

export type SettingsView = z.infer<typeof settingsView>;
export type ChannelView = z.infer<typeof channelView>;
export type Catalogs = z.infer<typeof catalogs>;
export type SettingsOutput = z.infer<typeof settingsOutput>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsInput>;
export type AddChannelInput = z.infer<typeof addChannelInput>;
export type UpdateChannelInput = z.infer<typeof updateChannelInput>;
