#!/usr/bin/env node
// Pretends to be a Control iD device in Monitor mode, so the integration can be
// tested without hardware. Sends the same requests the device sends.
//
//   node tools/device-simulator/controlid.mjs --key bjjd_... --user 12
//   node tools/device-simulator/controlid.mjs --key bjjd_... --user 12 --log 500 --resend
//   node tools/device-simulator/controlid.mjs --key bjjd_... --user 12 --denied
//   node tools/device-simulator/controlid.mjs --key bjjd_... --alive
//
// Options:
//   --server  API base (default http://localhost:8080/api/v1)
//   --key     the device key shown in the CRM when the device was registered
//   --user    the user id stored on the device (the BJJ Flow id, or any id
//             staff link once in the review queue)
//   --log     access log id (default: random); same id twice = a resend
//   --time    ISO date-time of the passage (default: now)
//   --denied  send an "Access Denied" log instead (must be ignored)
//   --resend  send the same notification twice (must count once)
//   --alive   send only a heartbeat (device_is_alive)

const args = parseArgs(process.argv.slice(2));
const server = (args.server ?? 'http://localhost:8080/api/v1').replace(/\/+$/, '');
if (!args.key) fail('--key is required');
const base = `${server}/access/vendors/controlid/${args.key}`;
const deviceId = 478435;

if (args.alive) {
  await send('device_is_alive', { access_logs: 0, device_id: deviceId, time: unix(new Date()) });
} else {
  if (!args.user) fail('--user is required');
  const logId = String(args.log ?? Math.floor(Math.random() * 1_000_000));
  const time = args.time ? new Date(args.time) : new Date();
  const body = {
    object_changes: [
      {
        object: 'access_logs',
        type: 'inserted',
        values: {
          id: logId,
          time: String(unix(time)),
          event: args.denied ? '6' : '7',
          device_id: String(deviceId),
          identifier_id: '0',
          user_id: String(args.user),
          portal_id: '1',
          identification_rule_id: '0',
          card_value: '0',
          log_type_id: '-1',
        },
      },
    ],
    device_id: deviceId,
  };
  await send('dao', body);
  if (args.resend) await send('dao', body);
}

async function send(endpoint, body) {
  const url = `${base}/${endpoint}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    redirect: 'manual',
  });
  const text = await response.text();
  console.log(`POST .../${endpoint} -> ${response.status}${text ? ` ${text}` : ''}`);
  if (response.status >= 300) process.exitCode = 1;
}

function unix(date) {
  return Math.floor(date.getTime() / 1000);
}

function parseArgs(list) {
  const out = {};
  for (let i = 0; i < list.length; i++) {
    const name = list[i].replace(/^--/, '');
    const next = list[i + 1];
    if (next === undefined || next.startsWith('--')) out[name] = true;
    else out[name] = list[++i];
  }
  return out;
}

function fail(message) {
  console.error(message);
  process.exit(2);
}
