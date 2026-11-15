// Control iD Access API driver (iDFace, iDAccess, iDFlex, iDBlock).
// Source: controlid.com.br/docs/access-api-en/ (session management,
// create/modify/destroy/load objects, remote enrollment, user photos).
//
// The device's user id is the member's BJJ Flow user id, so the passages the
// device reports resolve to the member with no mapping.

const ENROLL_TIMEOUT_MS = 90_000; // the member walks up and looks at the camera
const CALL_TIMEOUT_MS = 10_000;

export class DeviceError extends Error {}

/** Registers (or updates) the member and their face or card on the device. */
export async function enroll(device, { userId, name, method, cardValue }) {
  const api = await session(device);
  try {
    const found = await api.call('load_objects.fcgi', { object: 'users', where: { users: { id: userId } } });
    if ((found.users ?? []).length > 0) {
      await api.call('modify_objects.fcgi', { object: 'users', values: { name }, where: { users: { id: userId } } });
    } else {
      await api.call('create_objects.fcgi', {
        object: 'users',
        values: [{ id: userId, registration: String(userId), name }],
      });
    }

    if (method === 'FACE') {
      // The device captures and keeps the face; sync returns the photo too,
      // which is dropped here and never leaves the gym.
      const result = await api.call(
        'remote_enroll.fcgi',
        { type: 'face', user_id: userId, save: true, sync: true, auto: true, countdown: 5, message: 'Olhe para a camera' },
        ENROLL_TIMEOUT_MS,
      );
      if (result.success === false || result.error) {
        const match = result.info?.match_user_id;
        throw new DeviceError(
          match ? `Face already registered for user ${match} on this device` : `Face capture failed: ${result.error ?? 'unknown error'}`,
        );
      }
      return { method, userId, device: device.host };
    }

    if (method === 'CARD') {
      if (!/^\d{1,20}$/.test(String(cardValue ?? ''))) throw new DeviceError('Invalid card value');
      const cards = await api.call('load_objects.fcgi', { object: 'cards', where: { cards: { user_id: userId } } });
      if (!(cards.cards ?? []).some((c) => String(c.value) === String(cardValue))) {
        // Card values are unsigned 64-bit: written as a raw JSON number, not via
        // JS numbers, so large values keep every digit.
        await api.callRaw(
          'create_objects.fcgi',
          `{"object":"cards","values":[{"value":${cardValue},"user_id":${Number(userId)}}]}`,
        );
      }
      return { method, userId, device: device.host, cardValue: String(cardValue) };
    }

    throw new DeviceError(`Unknown method ${method}`);
  } finally {
    await api.logout();
  }
}

/** Removes the member, their cards and face photo from the device. */
export async function remove(device, { userId }) {
  const api = await session(device);
  try {
    await api.call('destroy_objects.fcgi', { object: 'cards', where: { cards: { user_id: userId } } });
    // The docs don't say whether deleting a user also deletes the face, so the
    // photo is removed explicitly.
    await api.call('user_destroy_image.fcgi', { user_id: String(userId) }).catch(() => null);
    await api.call('destroy_objects.fcgi', { object: 'users', where: { users: { id: userId } } });
    return { removed: true, userId, device: device.host };
  } finally {
    await api.logout();
  }
}

async function session(device) {
  const base = `http://${device.host}`;
  const post = async (endpoint, body, timeout = CALL_TIMEOUT_MS, raw = false) => {
    let response;
    try {
      response = await fetch(`${base}/${endpoint}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: raw ? body : JSON.stringify(body ?? {}),
        redirect: 'error',
        signal: AbortSignal.timeout(timeout),
      });
    } catch (error) {
      throw new DeviceError(
        error.name === 'TimeoutError'
          ? `${endpoint.split('?')[0]}: no answer from ${device.host}`
          : `Cannot reach ${device.host}: ${error.cause?.code ?? error.message}`,
      );
    }
    const text = await response.text();
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      // some calls answer with no or non-JSON body
    }
    if (!response.ok) {
      throw new DeviceError(`${endpoint.split('?')[0]} failed (${response.status}): ${json.error ?? text.slice(0, 200)}`);
    }
    return json;
  };

  const login = await post('login.fcgi', { login: device.login ?? 'admin', password: device.password ?? 'admin' });
  if (!login.session) throw new DeviceError(`Login to ${device.host} failed (check login/password in config.json)`);
  const q = `?session=${encodeURIComponent(login.session)}`;
  return {
    call: (endpoint, body, timeout) => post(endpoint + q, body, timeout),
    callRaw: (endpoint, body) => post(endpoint + q, body, CALL_TIMEOUT_MS, true),
    logout: () => post('logout.fcgi' + q, {}).catch(() => null),
  };
}
