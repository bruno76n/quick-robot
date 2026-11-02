// Calendar dates as YYYY-MM-DD; "today" is always passed in (core has no clock).
export const daysBetween = (fromIso: string, toIso: string) => Math.round((Date.parse(`${toIso}T12:00:00Z`) - Date.parse(`${fromIso}T12:00:00Z`)) / 864e5);
export const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
