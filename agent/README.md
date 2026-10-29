# Reception agent

A small program for each **reception PC**. It does two jobs:

1. **Reads the scale.** It connects to the scale indicator's serial port and works out when the weight has settled. Each stable weight is **signed with the station's secret**. The floor web app saves a bale as a scale weight only if that signature checks out, so nobody can type or edit a weight in the browser and pass it off as one from the scale. A reading works for one bale only and expires after two minutes.
2. **Prints bale tickets** on a Zebra label printer, using ZPL sent over the network.

The web app in this PC's browser talks to the agent at `http://127.0.0.1:7171`. The agent accepts only the floor server's address (`ALLOWED_ORIGIN`), so other websites can't read the scale or print.

## Set up a reception PC

1. Install **Node.js 20 or newer** from https://nodejs.org.
2. Copy this `agent` folder to the PC and run `npm install` inside it.
3. In the web app, go to **Admin → Scales**, add the station (for example `HAF-R1`) and open **Agent settings for this PC**.
4. Copy `.env.example` to `.env` and paste in those settings. Then set:
   - `SCALE_PORT` to the indicator's port: `COM3` on Windows (see Device Manager), `/dev/ttyUSB0` on Linux.
   - `SCALE_BAUD` to the indicator's speed, usually 9600.
   - `PRINTER` to the label printer's address, for example `tcp://192.168.1.50:9100`.
5. Run `npm start`. To start it automatically, run it as a Windows service (for example with NSSM) or a systemd service.

Check it's working: open http://127.0.0.1:7171/health on the PC.

## Matching your scale indicator

Indicators send lines like `ST,GS,+  98.50kg`. `WEIGHT_PATTERN` picks out the number and `STABLE_PATTERN` spots the indicator's own "stable" flag. Change them if your indicator's output looks different. The agent also requires the weight to stay within `STABLE_TOLERANCE_KG` for `STABLE_MS` before treating it as stable.

## Testing without a scale

```bash
SCALE_PORT=sim PRINTER=file:./labels.zpl npm start
```

The simulator pretends bales are put on and taken off the scale every few seconds, and labels are written to `labels.zpl`. The tests run with `npm test`.
