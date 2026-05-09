# OneConnect

<div align="center">
  <img src="mobile/assets/logo.jpeg" alt="OneConnect logo" width="200" />
</div>

Mobile video calling app (Expo / React Native) with a Bun + Elysia API: auth, contacts, WebRTC calls, and realtime signaling.

## Features

### Account, contacts, and auth

- **Sign in / sign up** : Better Auth on the server; mobile keeps the session in **Expo Secure Store**
- **Sign out** : Disconnects signaling and clears local auth state
- **Contacts** : List people you’ve added, **search** by name (2+ characters), and **add** users as contacts
- **Start a call** : From a contact, choose **audio** or **video** (separate actions on the home screen)

### Call flows (before you’re connected)

- **Outgoing** : “Calling…” UI, **outgoing ringtone**, optional **local camera preview** on video calls, **cancel** to hang up before answer
- **Incoming** : Shows name and **audio vs video**, **incoming ringtone**, **accept** or **decline**
- **Permissions** : **Microphone** required for all calls; **camera** requested only for **video** calls (Android flow in `callPermissions`)

### During a call : audio & video controls

- **Mute / unmute mic** : Toggles your microphone; local **WebRTC audio tracks** are enabled/disabled
- **Camera on / off** : **Video calls only**; turns your **camera track** off (your face stops sending); shows **“Camera off”** / camera-off state in the UI
- **Flip camera** : **Front ↔ back** on video (`camera-reverse` control)
- **Speaker** : Toggle **loudspeaker vs earpiece-style** routing via **expo-av** (defaults: speaker-friendly for **video**, earpiece-style bias for **pure audio** on Android)
- **Remote state** : When the other person mutes or stops video, updates come over the socket (`media:toggle-audio`, `media:toggle-video`) so you see their **mic/video off** state

### During a call : UI & feedback

- **Active call timer** : Elapsed time while connected
- **Video layout** : **Remote** is the main stage by default; **local** is a **picture-in-picture** tile you can **tap to swap** who is full-screen
- **Front-camera mirror** : Local preview **mirrors** on the front camera for a natural selfie view
- **Controls chrome** : **Tap** the call surface to show controls; they **auto-hide** after a few seconds while the call is active
- **Audio-only call screen** : Large avatar initial, **mic pulse**, and **active-speaker-style** glow instead of video tiles
- **Haptics** : Light feedback when starting a call from the contact list

### Connection & backend

- **WebRTC** : Peer connection with **SDP offer/answer**, **ICE candidates**, and **server-fetched ICE servers** (`GET /calls/ice-servers`: STUN/TURN, Twilio NTS or coturn when configured)
- **WebSocket signaling** : Call lifecycle and media state over **`/ws/signaling`**
- **Resilience** : **ICE restart / reconnecting** path when connectivity is flaky (caller-side retries with a limit)
- **Call history** : Server-side history; **`GET /calls/history`** (see OpenAPI)
- **Push** : **Expo push** for incoming-call style alerts with **custom notification sounds** (ringtones in `app.json`)
- **API docs** : **OpenAPI / Scalar** at **`/swagger`** on the backend

## Repo layout

| Path       | Role |
|-----------|------|
| `mobile/` | **OneConnect** : Expo Router, NativeWind, react-native-webrtc |
| `server/` | REST + WebSockets : Better Auth, Drizzle ORM (PostgreSQL) |

---

## Backend (`server/`)

**Stack:** [Bun](https://bun.sh), [Elysia](https://elysiajs.com/), Better Auth, Drizzle, Resend (signup OTP).

1. Install [Bun](https://bun.sh) and PostgreSQL.

2. Copy env and edit values:

   ```bash
   cd server && cp .env.example .env
   ```

3. Apply schema (your usual Drizzle workflow):

   ```bash
   bun run db:push
   # or: bun run db:migrate
   ```

4. Run API:

   ```bash
   bun run dev
   ```

- **HTTP:** `http://localhost:3000` (override with `PORT` / `HOST`)
- **OpenAPI / Scalar:** `/swagger`
- **Health:** `GET /health`

Required secrets and options are documented in `server/.env.example` (database, Better Auth, JWT, TURN/Twilio, Resend, optional Expo push).

---

## Mobile app (`mobile/`)

**Stack:** Expo SDK 54, expo-router, TanStack Query, Zustand.

1. Install dependencies:

   ```bash
   cd mobile && npm install
   ```

2. Point the app at your API (defaults in `src/constants` target the deployed server; override for local dev):

   ```bash
   export EXPO_PUBLIC_API_URL=http://YOUR_MACHINE_IP:3000
   export EXPO_PUBLIC_WS_URL=ws://YOUR_MACHINE_IP:3000/ws/signaling
   npx expo start
   ```

   Use your LAN IP when testing on a physical device; the Android emulator usually reaches the host via `10.0.2.2`.

3. Scripts: `npm start`, `npm run android`, `npm run ios`, `npm run web`.

Camera and microphone are required for calls; see `app.json` for permission strings.

---

## Production builds

EAS profiles in `mobile/eas.json` can set `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_WS_URL` for staging/production.
