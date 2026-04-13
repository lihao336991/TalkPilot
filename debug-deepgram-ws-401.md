# Debug Session: deepgram-ws-401

- Status: OPEN
- Started At: 2026-04-09
- Symptom: Deepgram WebSocket closes with code `1006`, reason `Received bad response code from server: 401`
- Scope: `src/features/live/services/DeepgramStreamingService.ts`, `src/features/live/services/DeepgramTokenService.ts`

## Hypotheses

1. The temporary token returned by `deepgram-token` is structurally present but invalid for Deepgram realtime WebSocket authentication.
2. The WebSocket subprotocol authentication format in React Native is not accepted by Deepgram, even though the token fetch succeeds.
3. The fetched token is expired or near-expired by the time the WebSocket connection is attempted.
4. The Edge Function returns a payload shape/value different from what the client expects, causing the wrong token string to be used.
5. The app is connecting to Deepgram with a mismatched realtime URL/query combination that rejects the provided token.

## Evidence Log

- Initial evidence from user terminal:
  - `[Deepgram] WebSocket closed, code: 1006 reason: Received bad response code from server: 401`
  - `[Deepgram] WebSocket error: Event ...`
- Pre-fix runtime evidence:
  - Deepgram token function returned `200`, keys `deepgram_token` + `expires_in`
  - Returned token shape looked valid: JWT-like, `tokenLength=457`, `expiresIn=600`
  - WS connect attempt used `authMode=subprotocol-array`
  - WS never opened, then closed with `code=1006`, `reason=Received bad response code from server: 401`

## Evidence Analysis

- H1 confirmed partially: the function returns a token, but that alone does not prove the WS auth path is correct.
- H2 confirmed as root cause: the token is valid-looking, but subprotocol-based auth still gets 401 in React Native.
- H3 rejected by evidence: the token had a fresh 600s TTL and was used immediately.
- H4 rejected by evidence: payload shape is correct and client uses `deepgram_token`.
- H5 weakened: URL/query shape is standard `/v1/listen`; evidence points more strongly to auth transport.
- Post-fix first verification:
  - WS now opens successfully.
  - No `Results` / transcript evidence has been captured yet.
  - New likely bottleneck is downstream of handshake: audio send path or server result path.
 - User verification:
   - User reports: “现在有文字了”.
   - This confirms the main user-visible failure is fixed.

## Root Cause

- Deepgram temporary JWT was valid, but passing it through `Sec-WebSocket-Protocol` from React Native was rejected with 401.
- Switching the RN WebSocket handshake to `Authorization: Bearer <temporary JWT>` resolved the connection failure.

## Next Step

- Runtime instrumentation added.
  - `DeepgramTokenService.ts`
    - cached token hit
    - Supabase access token shape
    - Edge Function response shape
    - Deepgram token shape / expiry window
  - `DeepgramStreamingService.ts`
    - WS connect attempt with auth mode + URL
    - WS open / error / close with traceId
- Debug server env:
  - `.dbg/deepgram-ws-401.env`
  - `DEBUG_SERVER_URL=http://10.200.4.178:7777/event`
- Minimal fix applied:
  - changed React Native WS auth from `['token', token]`
  - to `headers: { Authorization: 'Bearer <token>' }`
- Additional instrumentation added:
  - audio frame send counters
  - interim result receipt
  - final result receipt
- Waiting for explicit user confirmation before cleanup.
