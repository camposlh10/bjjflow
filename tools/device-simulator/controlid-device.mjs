#!/usr/bin/env node
// A fake Control iD device: answers the Access API calls the bridge uses to
// enroll and remove members (login, load/create/modify/destroy objects,
// remote face enrollment, photo removal), keeping users and cards in memory.
//
//   node tools/device-simulator/controlid-device.mjs [--port 8099] [--password admin]
//
// Point the bridge's config.json devices entry at 127.0.0.1:<port>.
// Face capture succeeds after 1 s; a member whose name contains "duplicate"
// fails with FACE_EXISTS, like a face already registered to someone else.

import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function startFakeControlId({ port = 0, login = 'admin', password = 'admin', quiet = true } = {}) {
  const state = { users: new Map(), cards: [], faces: new Set(), sessions: new Set(), calls: [] };
  const log = (line) => quiet || console.log(line);

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://device');
    const endpoint = url.pathname.slice(1);
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const text = Buffer.concat(chunks).toString('utf8');
    // Card values are 64-bit: keep them as strings when parsing.
    const body = text ? JSON.parse(text.replace(/"value":(\d+)/g, '"value":"$1"')) : {};
    state.calls.push(endpoint);
    log(`${req.method} /${endpoint} ${text.slice(0, 120)}`);

    if (endpoint === 'login.fcgi') {
      if (body.login !== login || body.password !== password) return reply(res, 401, { error: 'Invalid login' });
      const session = Math.random().toString(36).slice(2);
      state.sessions.add(session);
      return reply(res, 200, { session });
    }
    if (!state.sessions.has(url.searchParams.get('session'))) return reply(res, 401, { error: 'Invalid session' });

    switch (endpoint) {
      case 'logout.fcgi':
        state.sessions.delete(url.searchParams.get('session'));
        return reply(res, 200, {});
      case 'load_objects.fcgi': {
        if (body.object === 'users') {
          const user = state.users.get(Number(body.where?.users?.id));
          return reply(res, 200, { users: user ? [user] : [] });
        }
        const userId = Number(body.where?.cards?.user_id);
        return reply(res, 200, { cards: state.cards.filter((c) => c.user_id === userId) });
      }
      case 'create_objects.fcgi': {
        if (body.object === 'users') {
          for (const user of body.values) {
            if (state.users.has(user.id)) return reply(res, 400, { error: 'UNIQUE constraint failed: users.id' });
            state.users.set(user.id, user);
          }
          return reply(res, 200, { ids: body.values.map((u) => u.id) });
        }
        for (const card of body.values) {
          if (state.cards.some((c) => c.value === card.value)) return reply(res, 400, { error: 'UNIQUE constraint failed: cards.value' });
          state.cards.push({ value: card.value, user_id: Number(card.user_id) });
        }
        return reply(res, 200, { ids: body.values.map((_, i) => i + 1) });
      }
      case 'modify_objects.fcgi': {
        const user = state.users.get(Number(body.where?.users?.id));
        if (user) Object.assign(user, body.values);
        return reply(res, 200, { changes: user ? 1 : 0 });
      }
      case 'destroy_objects.fcgi': {
        if (body.object === 'users') {
          const id = Number(body.where?.users?.id);
          const had = state.users.delete(id);
          return reply(res, 200, { changes: had ? 1 : 0 });
        }
        const userId = Number(body.where?.cards?.user_id);
        const before = state.cards.length;
        state.cards = state.cards.filter((c) => c.user_id !== userId);
        return reply(res, 200, { changes: before - state.cards.length });
      }
      case 'user_destroy_image.fcgi':
        state.faces.delete(Number(body.user_id));
        return reply(res, 200, {});
      case 'remote_enroll.fcgi': {
        await new Promise((ok) => setTimeout(ok, 1000));
        const user = state.users.get(Number(body.user_id));
        if (/duplicate/i.test(user?.name ?? '')) {
          return reply(res, 200, { success: false, error: 'FACE_EXISTS', info: { match_user_id: 7, match_confidence: 1900 } });
        }
        state.faces.add(Number(body.user_id));
        return reply(res, 200, { success: true, user_id: body.user_id, device_id: 478435, user_image: 'BASE64-JPEG-NOT-FORWARDED' });
      }
      default:
        return reply(res, 404, { error: `unknown endpoint ${endpoint}` });
    }
  });
  await new Promise((ok) => server.listen(port, '127.0.0.1', ok));
  return { port: server.address().port, state, close: () => new Promise((ok) => server.close(ok)) };
}

function reply(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(text) });
  res.end(text);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
  const device = await startFakeControlId({ port: Number(opt('port', 8099)), password: opt('password', 'admin'), quiet: false });
  console.log(`Fake Control iD device on 127.0.0.1:${device.port}`);
}
