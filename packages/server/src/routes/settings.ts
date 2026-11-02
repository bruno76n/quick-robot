// Settings and channels (docs/12 §4).
import { addChannelInput, updateChannelInput, updateSettingsInput } from '@app/contract';
import { body, idParam, noContent, ok } from '../http';
import { addChannel, getSettingsOutput, removeChannel, updateChannel, updateSettings } from '../usecases/settings';
import type { Router } from './router';

export function settingsRoutes(r: Router) {
  r.get('/settings', 'settings.read', async (c) => ok(c, await getSettingsOutput(c.get('deps'), c.get('ctx'))));
  r.patch('/settings', 'settings.update', async (c) => ok(c, await updateSettings(c.get('deps'), c.get('ctx'), await body(c, updateSettingsInput))));
  r.post('/channels', 'channel.create', async (c) => ok(c, await addChannel(c.get('deps'), c.get('ctx'), await body(c, addChannelInput)), 201));
  r.patch('/channels/:id', 'channel.update', async (c) => ok(c, await updateChannel(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'channel'), await body(c, updateChannelInput))));
  r.delete('/channels/:id', 'channel.delete', async (c) => { await removeChannel(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'channel')); return noContent(c); });
}
