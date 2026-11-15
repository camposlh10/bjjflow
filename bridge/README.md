# BJJ Flow Bridge

A small program for the gym's front-desk computer. It sits between the gym's
access devices (turnstiles, face, card and fingerprint readers) and BJJ Flow.

- **Relay with offline queue.** Devices send their notifications to the bridge
  over the gym's network (plain HTTP, the same paths as the BJJ Flow API). The
  bridge saves each one to disk, answers the device at once, and forwards it to
  BJJ Flow over HTTPS, oldest first. If the internet drops, notifications wait
  in `data/queue` and go out when it's back. Nothing is lost on a restart.
- **Commands from the cloud.** Every few seconds the bridge checks in with BJJ
  Flow and runs the commands waiting for it (a connection test now; enrolling
  members on devices later). It only ever calls out, so no router setup is
  needed. It only talks to device addresses listed in `allowedDeviceHosts`.

Use it when a device can't reach the internet itself, can't use HTTPS (for
example Control iD Monitor), or when passages must survive internet outages.

## Install (Windows)

1. Install [Node.js](https://nodejs.org) 20 or newer.
2. Copy this folder to the computer, e.g. `C:\BJJFlowBridge`.
3. In the CRM, go to **Dispositivos → Bridges → Registrar bridge** and copy the key
   (shown only once).
4. Copy `config.example.json` to `config.json` and fill it in:
   - `server`: the BJJ Flow API address (already filled for production)
   - `bridgeKey`: the key from step 3
   - `allowedDeviceHosts`: the IP address of each device on the gym's network
5. In PowerShell **as Administrator**, in this folder:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\install-windows.ps1
   ```

   It starts the bridge now and at every boot, restarts it if it stops, and opens
   the port on the firewall for private networks. It prints the address to give
   the devices.
6. Give this computer a fixed IP in the gym's router, so devices always find it.

The CRM shows the bridge as **online** within a few seconds; **Testar conexão**
sends a round trip through it.

To remove it: `uninstall-windows.ps1` (as Administrator).

## Pointing devices at the bridge

Use the same settings the CRM shows for the device, but with the bridge's
address instead of the BJJ Flow server:

| Device setting | Value |
| --- | --- |
| Server / hostname | this computer's IP, e.g. `192.168.0.10` |
| Port | `8085` (or `listenPort` from `config.json`) |
| Path | the same path the CRM shows, starting with `api/v1/access/...` |

Devices using the generic API post to `http://<bridge>:8085/api/v1/access/hardware/events`
with their `X-Device-Key` header, as they would to the cloud. The bridge answers
`200` at once; the result of each scan shows in the CRM.

## Files

- `data/queue/` notifications waiting to reach BJJ Flow
- `data/failed/` notifications BJJ Flow refused for good (e.g. wrong device key)
- `data/bridge.log` activity log (rotates at 5 MB)
- `GET http://<bridge>:8085/health` version and queue size

## Development

```bash
npm test
node bridge.mjs path/to/config.json
```

No dependencies; Node.js 20+.
