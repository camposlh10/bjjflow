#!/usr/bin/env node
// BJJ Flow Bridge: runs on the gym's front-desk computer.
//
// 1. Relay: access devices on the gym's network send their notifications here
//    (plain HTTP on the LAN, same paths as the cloud API). Each one is saved
//    to disk and answered at once, then forwarded to the cloud over HTTPS in
//    order. If the internet is down, notifications wait on disk and go out
//    when it's back, so no passage is lost and devices never see an error.
// 2. Commands: the bridge checks in with the cloud every few seconds and runs
//    the commands waiting for it: PING, an HTTP call to a device listed in
//    allowedDeviceHosts, or enrolling/removing a member on a device listed in
//    devices (whose admin login stays here, never in the cloud). It only ever
//    calls out, so it works behind any router.
//
// No dependencies: needs Node.js 20 or newer.
//
//   node bridge.mjs                 uses ./config.json
//   node bridge.mjs path/to/config.json

import { createServer } from 'node:http';
import { appendFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as controlid from './drivers/controlid.mjs';

export const VERSION = '0.2.0';

/** Device drivers by vendor, for enrolling and removing members. */
const DRIVERS = { controlid };

const RELAY_PREFIX = '/api/v1/access/';
const FORWARD_HEADERS = ['content-type', 'x-device-key'];
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const LOG_MAX_BYTES = 5 * 1024 * 1024;

/** Starts the relay and the cloud check-in. Returns { port, close(), queueDepth() }. */
export async function startBridge(rawConfig) {
  const config = normalizeConfig(rawConfig);
  const queueDir = join(config.dataDir, 'queue');
  const failedDir = join(config.dataDir, 'failed');
  await mkdir(queueDir, { recursive: true });
  await mkdir(failedDir, { recursive: true });

  const log = makeLogger(config);
  let closed = false;
  let seq = 0;
  let wakeForwarder = () => {};
  let pollSeconds = config.pollSeconds;

  // ---------- relay: device -> disk ----------
  const server = createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        const depth = await queueDepth();
        return send(res, 200, JSON.stringify({ ok: true, version: VERSION, queueDepth: depth }), 'application/json');
      }
      const path = new URL(req.url, 'http://bridge').pathname;
      if (req.method !== 'POST' || !path.startsWith(RELAY_PREFIX)) {
        return send(res, 404, '');
      }
      const body = await readBody(req);
      const headers = {};
      for (const name of FORWARD_HEADERS) {
        if (req.headers[name]) headers[name] = String(req.headers[name]);
      }
      const item = {
        path: path.slice('/api/v1'.length),
        headers,
        body: body.toString('utf8'),
        receivedAt: new Date().toISOString(),
      };
      const name = `${Date.now().toString().padStart(15, '0')}-${String(seq++).padStart(6, '0')}.json`;
      const tmp = join(queueDir, `${name}.tmp`);
      await writeFile(tmp, JSON.stringify(item));
      await rename(tmp, join(queueDir, name));
      wakeForwarder();
      // Answer like the cloud does for device notifications: 200, empty.
      send(res, 200, '');
    } catch (error) {
      log(`relay error: ${error.message}`);
      send(res, error.statusCode ?? 500, '');
    }
  });
  await new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(config.listenPort, config.listenHost, ok);
  });
  const port = server.address().port;
  log(`BJJ Flow Bridge ${VERSION} listening on ${config.listenHost}:${port}, cloud ${config.server}`);

  // ---------- forwarder: disk -> cloud, oldest first ----------
  const forwarder = (async () => {
    let backoff = 1000;
    while (!closed) {
      const next = (await pendingFiles())[0];
      if (!next) {
        await new Promise((ok) => {
          wakeForwarder = ok;
          setTimeout(ok, 5000);
        });
        continue;
      }
      const file = join(queueDir, next);
      let item;
      try {
        item = JSON.parse(await readFile(file, 'utf8'));
      } catch (error) {
        log(`unreadable queue file ${next}: ${error.message}`);
        await rename(file, join(failedDir, next)).catch(() => rm(file, { force: true }));
        continue;
      }
      let status = 0;
      try {
        const response = await fetch(config.server + item.path, {
          method: 'POST',
          headers: item.headers,
          body: item.body,
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
        });
        status = response.status;
        await response.arrayBuffer();
      } catch (error) {
        log(`cloud unreachable (${error.cause?.code ?? error.name}); ${await queueDepth()} waiting`);
      }
      if (status >= 200 && status < 300) {
        await rm(file, { force: true });
        backoff = 1000;
      } else if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
        // Refused for good (wrong device key...): keep it aside, move on.
        log(`cloud refused ${item.path.replace(/\/[^/]*_[0-9a-f]{20,}/, '/<key>')} with ${status}; kept in failed/`);
        await rename(file, join(failedDir, next)).catch(() => rm(file, { force: true }));
        backoff = 1000;
      } else {
        if (status) log(`cloud answered ${status}; retrying`);
        await sleep(backoff, () => closed);
        backoff = Math.min(backoff * 2, 60000);
      }
    }
  })();

  // ---------- check-in: commands from the cloud ----------
  const checkIn = (async () => {
    while (!closed) {
      try {
        const response = await cloud('/access/bridge/heartbeat', {
          version: VERSION,
          queueDepth: await queueDepth(),
        });
        if (response.ok) {
          const answer = await response.json();
          pollSeconds = answer.pollSeconds || pollSeconds;
          for (const command of answer.commands ?? []) {
            const outcome = await runCommand(command);
            await cloud(`/access/bridge/commands/${command.id}/result`, outcome).catch((error) =>
              log(`could not report command ${command.id}: ${error.message}`),
            );
          }
        } else {
          log(`check-in refused: ${response.status}${response.status === 401 ? ' (check bridgeKey)' : ''}`);
          await response.arrayBuffer();
        }
      } catch (error) {
        // Offline: the relay keeps queueing meanwhile.
      }
      await sleep(pollSeconds * 1000, () => closed);
    }
  })();

  async function runCommand(command) {
    try {
      if (command.type === 'PING') {
        return { success: true, result: `pong from bridge ${VERSION}` };
      }
      if (command.type === 'DEVICE_HTTP') {
        const { method = 'POST', url, headers = {}, body } = command.payload ?? {};
        const target = new URL(url);
        if (!config.allowedDeviceHosts.includes(target.hostname)) {
          return { success: false, result: `host ${target.hostname} is not in allowedDeviceHosts` };
        }
        const response = await fetch(target, {
          method,
          headers,
          body: body == null ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
          redirect: 'error',
          signal: AbortSignal.timeout(10000),
        });
        const text = await response.text();
        return {
          success: response.ok,
          result: JSON.stringify({ status: response.status, body: text.slice(0, 3500) }),
        };
      }
      if (command.type === 'DEVICE_ENROLL' || command.type === 'DEVICE_REMOVE') {
        const payload = command.payload ?? {};
        const device = config.devices.find((d) => d.host === payload.host);
        if (!device) {
          return fail(`device ${payload.host} is not in this bridge's config.json (devices)`);
        }
        const driver = DRIVERS[device.vendor ?? payload.vendor];
        if (!driver) return fail(`no driver for vendor ${device.vendor ?? payload.vendor}`);
        const done =
          command.type === 'DEVICE_ENROLL' ? await driver.enroll(device, payload) : await driver.remove(device, payload);
        log(`${command.type} user ${payload.userId} on ${device.host}: ok`);
        return { success: true, result: JSON.stringify(done) };
      }
      return { success: false, result: `unknown command type ${command.type}` };
    } catch (error) {
      log(`${command.type} failed: ${error.message}`);
      return fail(error instanceof controlid.DeviceError ? error.message : `${error.name}: ${error.message}`);
    }
  }

  function fail(message) {
    return { success: false, result: JSON.stringify({ error: String(message).slice(0, 3900) }) };
  }

  function cloud(path, body) {
    return fetch(config.server + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-bridge-key': config.bridgeKey },
      body: JSON.stringify(body),
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
  }

  async function pendingFiles() {
    return (await readdir(queueDir)).filter((f) => f.endsWith('.json')).sort();
  }

  async function queueDepth() {
    return (await pendingFiles()).length;
  }

  return {
    port,
    queueDepth,
    async close() {
      closed = true;
      wakeForwarder();
      await new Promise((ok) => server.close(ok));
      await Promise.allSettled([forwarder, checkIn]);
    },
  };
}

function normalizeConfig(raw) {
  const server = String(raw.server ?? '').replace(/\/+$/, '');
  if (!/^https?:\/\//.test(server)) throw new Error('config.server must be the API base, e.g. https://.../api/v1');
  if (!raw.bridgeKey) throw new Error('config.bridgeKey is required (shown once in the CRM)');
  return {
    server,
    bridgeKey: String(raw.bridgeKey),
    listenHost: raw.listenHost ?? '0.0.0.0',
    listenPort: raw.listenPort ?? 8085,
    dataDir: resolve(raw.dataDir ?? 'data'),
    pollSeconds: raw.pollSeconds ?? 5,
    // Devices the bridge may log in to: [{ host, vendor, login, password }].
    devices: (raw.devices ?? []).map((d) => ({ ...d, host: String(d.host) })),
    allowedDeviceHosts: [
      ...(raw.allowedDeviceHosts ?? []).map(String),
      ...(raw.devices ?? []).map((d) => String(d.host).split(':')[0]),
    ],
    logToFile: raw.logToFile ?? true,
    quiet: raw.quiet ?? false,
  };
}

function makeLogger(config) {
  const file = join(config.dataDir, 'bridge.log');
  return (message) => {
    const line = `${new Date().toISOString()} ${message}`;
    if (!config.quiet) console.log(line);
    if (!config.logToFile) return;
    void (async () => {
      try {
        const info = await stat(file).catch(() => null);
        if (info && info.size > LOG_MAX_BYTES) await rename(file, `${file}.1`);
        await appendFile(file, `${line}\n`);
      } catch {
        // Logging must never stop the bridge.
      }
    })();
  };
}

function readBody(req) {
  return new Promise((ok, fail) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        const error = new Error('body too large');
        error.statusCode = 413;
        req.destroy();
        fail(error);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => ok(Buffer.concat(chunks)));
    req.on('error', fail);
  });
}

function send(res, status, body, type = 'text/plain') {
  if (res.headersSent) return;
  res.writeHead(status, { 'content-type': type, 'content-length': Buffer.byteLength(body) });
  res.end(body);
}

/** Sleeps, but wakes early (checked every 250 ms) once stop() is true. */
async function sleep(ms, stop) {
  const end = Date.now() + ms;
  while (Date.now() < end && !stop()) {
    await new Promise((ok) => setTimeout(ok, Math.min(250, end - Date.now())));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const configPath = resolve(process.argv[2] ?? join(fileURLToPath(new URL('.', import.meta.url)), 'config.json'));
  const raw = JSON.parse(await readFile(configPath, 'utf8'));
  if (raw.dataDir && !raw.dataDir.match(/^([a-zA-Z]:|\/)/)) raw.dataDir = join(configPath, '..', raw.dataDir);
  if (!raw.dataDir) raw.dataDir = join(configPath, '..', 'data');
  const bridge = await startBridge(raw);
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, async () => {
      await bridge.close();
      process.exit(0);
    });
  }
}
