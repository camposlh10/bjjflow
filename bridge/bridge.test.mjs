// npm test   (or: node --test bridge.test.mjs)
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { startBridge, VERSION } from './bridge.mjs';
import { startFakeControlId } from '../tools/device-simulator/controlid-device.mjs';

/** A stand-in for the cloud API that records what reaches it. */
async function fakeCloud() {
  const state = { up: false, received: [], results: [], commands: [] };
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString('utf8');
    if (req.url === '/api/v1/access/bridge/heartbeat') {
      if (req.headers['x-bridge-key'] !== 'bjjb_test') return end(res, 401, '');
      const commands = state.commands.splice(0);
      return end(res, 200, JSON.stringify({ commands, pollSeconds: 1 }));
    }
    const result = req.url.match(/^\/api\/v1\/access\/bridge\/commands\/(\d+)\/result$/);
    if (result) {
      state.results.push({ id: Number(result[1]), ...JSON.parse(body) });
      return end(res, 200, '{}');
    }
    if (!state.up) return end(res, 503, '');
    state.received.push({ url: req.url, key: req.headers['x-device-key'], body });
    end(res, req.url.includes('/bjjd_bad/') ? 401 : 200, '');
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  state.base = `http://127.0.0.1:${server.address().port}/api/v1`;
  state.close = () => new Promise((ok) => server.close(ok));
  return state;
}

function end(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(body);
}

async function waitFor(check, ms = 8000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await check()) return;
    await new Promise((ok) => setTimeout(ok, 50));
  }
  assert.fail('timed out waiting');
}

test('queues while the cloud is down, then delivers each notification once, in order', async () => {
  const cloud = await fakeCloud();
  const dataDir = await mkdtemp(join(tmpdir(), 'bridge-'));
  const bridge = await startBridge({
    server: cloud.base, bridgeKey: 'bjjb_test', listenHost: '127.0.0.1', listenPort: 0,
    dataDir, pollSeconds: 1, quiet: true, logToFile: false,
  });
  const local = `http://127.0.0.1:${bridge.port}`;
  try {
    for (const id of ['1', '2', '3']) {
      const response = await fetch(`${local}/api/v1/access/vendors/controlid/bjjd_good/dao`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: `{"log":"${id}"}`,
      });
      assert.equal(response.status, 200, 'device always gets 200 at once');
    }
    await fetch(`${local}/api/v1/access/hardware/events`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-device-key': 'bjjd_hw' }, body: '{"externalMemberId":"9"}',
    });
    assert.equal(await bridge.queueDepth(), 4);
    assert.equal(cloud.received.length, 0);

    cloud.up = true;
    await waitFor(async () => (await bridge.queueDepth()) === 0);
    assert.deepEqual(cloud.received.map((r) => r.body), ['{"log":"1"}', '{"log":"2"}', '{"log":"3"}', '{"externalMemberId":"9"}']);
    assert.equal(cloud.received[0].url, '/api/v1/access/vendors/controlid/bjjd_good/dao');
    assert.equal(cloud.received[3].key, 'bjjd_hw', 'device key header is forwarded');

    // Refused for good: set aside, the queue keeps moving.
    await fetch(`${local}/api/v1/access/vendors/controlid/bjjd_bad/dao`, { method: 'POST', body: '{}' });
    await fetch(`${local}/api/v1/access/vendors/controlid/bjjd_good/dao`, { method: 'POST', body: '{"log":"4"}' });
    await waitFor(async () => (await bridge.queueDepth()) === 0);
    assert.equal(cloud.received.at(-1).body, '{"log":"4"}');
    assert.equal((await readdir(join(dataDir, 'failed'))).length, 1);

    // Only the access API is relayed.
    assert.equal((await fetch(`${local}/api/v1/auth/login`, { method: 'POST', body: '{}' })).status, 404);
    const health = await (await fetch(`${local}/health`)).json();
    assert.equal(health.version, VERSION);
  } finally {
    await bridge.close();
    await cloud.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('survives a restart with notifications still on disk', async () => {
  const cloud = await fakeCloud();
  const dataDir = await mkdtemp(join(tmpdir(), 'bridge-'));
  const config = {
    server: cloud.base, bridgeKey: 'bjjb_test', listenHost: '127.0.0.1', listenPort: 0,
    dataDir, pollSeconds: 1, quiet: true, logToFile: false,
  };
  try {
    const first = await startBridge(config);
    await fetch(`http://127.0.0.1:${first.port}/api/v1/access/vendors/controlid/bjjd_good/dao`, { method: 'POST', body: '{"log":"kept"}' });
    await first.close();

    cloud.up = true;
    const second = await startBridge(config);
    await waitFor(async () => cloud.received.length === 1);
    assert.equal(cloud.received[0].body, '{"log":"kept"}');
    await second.close();
  } finally {
    await cloud.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('runs commands from the cloud and only calls allowed device hosts', async () => {
  const cloud = await fakeCloud();
  const device = createServer((req, res) => end(res, 200, '{"session":"abc"}'));
  await new Promise((ok) => device.listen(0, '127.0.0.1', ok));
  const devicePort = device.address().port;
  const dataDir = await mkdtemp(join(tmpdir(), 'bridge-'));
  cloud.commands.push(
    { id: 1, type: 'PING', payload: null },
    { id: 2, type: 'DEVICE_HTTP', payload: { method: 'POST', url: `http://127.0.0.1:${devicePort}/login.fcgi`, body: { login: 'admin' } } },
    { id: 3, type: 'DEVICE_HTTP', payload: { url: 'http://10.9.9.9/login.fcgi' } },
  );
  const bridge = await startBridge({
    server: cloud.base, bridgeKey: 'bjjb_test', listenHost: '127.0.0.1', listenPort: 0,
    dataDir, pollSeconds: 1, quiet: true, logToFile: false, allowedDeviceHosts: ['127.0.0.1'],
  });
  try {
    await waitFor(() => cloud.results.length === 3);
    const byId = Object.fromEntries(cloud.results.map((r) => [r.id, r]));
    assert.equal(byId[1].success, true);
    assert.match(byId[1].result, /pong/);
    assert.equal(byId[2].success, true);
    assert.deepEqual(JSON.parse(byId[2].result), { status: 200, body: '{"session":"abc"}' });
    assert.equal(byId[3].success, false);
    assert.match(byId[3].result, /not in allowedDeviceHosts/);
  } finally {
    await bridge.close();
    await cloud.close();
    await new Promise((ok) => device.close(ok));
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('enrolls and removes members on a Control iD device with credentials kept locally', async () => {
  const cloud = await fakeCloud();
  const device = await startFakeControlId({ password: 'secret-pass' });
  const host = `127.0.0.1:${device.port}`;
  const dataDir = await mkdtemp(join(tmpdir(), 'bridge-'));
  cloud.commands.push(
    { id: 10, type: 'DEVICE_ENROLL', payload: { vendor: 'controlid', host, userId: 42, name: 'Ana Souza', method: 'FACE' } },
    { id: 11, type: 'DEVICE_ENROLL', payload: { vendor: 'controlid', host, userId: 42, name: 'Ana S.', method: 'CARD', cardValue: '528281023086' } },
    { id: 12, type: 'DEVICE_ENROLL', payload: { vendor: 'controlid', host, userId: 43, name: 'Duplicate Face', method: 'FACE' } },
    { id: 13, type: 'DEVICE_ENROLL', payload: { vendor: 'controlid', host: '10.0.0.99', userId: 44, name: 'X', method: 'FACE' } },
  );
  const bridge = await startBridge({
    server: cloud.base, bridgeKey: 'bjjb_test', listenHost: '127.0.0.1', listenPort: 0,
    dataDir, pollSeconds: 1, quiet: true, logToFile: false,
    devices: [{ host, vendor: 'controlid', login: 'admin', password: 'secret-pass' }],
  });
  try {
    await waitFor(() => cloud.results.length === 4, 15000);
    const byId = Object.fromEntries(cloud.results.map((r) => [r.id, r]));
    assert.equal(byId[10].success, true);
    assert.doesNotMatch(byId[10].result, /BASE64/, 'the face photo never goes to the cloud');
    assert.ok(device.state.faces.has(42));
    assert.equal(device.state.users.get(42).name, 'Ana S.', 'second enrollment updates the user');
    assert.equal(byId[11].success, true);
    assert.deepEqual(device.state.cards, [{ value: '528281023086', user_id: 42 }]);
    assert.equal(byId[12].success, false);
    assert.match(JSON.parse(byId[12].result).error, /already registered for user 7/);
    assert.equal(byId[13].success, false);
    assert.match(JSON.parse(byId[13].result).error, /not in this bridge's config/);

    cloud.commands.push({ id: 14, type: 'DEVICE_REMOVE', payload: { vendor: 'controlid', host, userId: 42 } });
    await waitFor(() => cloud.results.length === 5);
    assert.equal(cloud.results[4].success, true);
    assert.equal(device.state.users.has(42), false);
    assert.equal(device.state.faces.has(42), false);
    assert.deepEqual(device.state.cards, []);
    assert.equal(device.state.sessions.size, 0, 'every session is logged out');
  } finally {
    await bridge.close();
    await cloud.close();
    await device.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});
