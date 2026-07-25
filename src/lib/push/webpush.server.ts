// Envío de Web Push (VAPID + aes128gcm) implementado con Web Crypto.
// Compatible con el runtime de servidor (Workers). No usa la librería `web-push` de Node.
// Server-only: el sufijo .server.ts impide que llegue al navegador.

const enc = new TextEncoder();

/** Los tipos DOM exigen ArrayBuffer estricto; nuestros Uint8Array siempre lo son. */
const bs = (u: Uint8Array): BufferSource => u as unknown as BufferSource;

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", bs(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, bs(data)));
}

/** JWT ES256 firmado con la clave privada VAPID (d en base64url). */
async function vapidJwt(audience: string, subject: string, publicKey: string, privateKey: string) {
  const raw = b64urlToBytes(publicKey); // 0x04 || X || Y
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: bytesToB64url(raw.slice(1, 33)),
    y: bytesToB64url(raw.slice(33, 65)),
    d: privateKey,
    ext: true,
  };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);

  const header = bytesToB64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = bytesToB64url(
    enc.encode(
      JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, sub: subject }),
    ),
  );
  const unsigned = `${header}.${body}`;
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(unsigned)),
  );
  return `${unsigned}.${bytesToB64url(sig)}`;
}

/** Cifra el payload según RFC 8291 (aes128gcm). */
async function encryptPayload(plaintext: string, p256dh: string, authSecret: string): Promise<Uint8Array> {
  const uaPublic = b64urlToBytes(p256dh);
  const authKey = b64urlToBytes(authSecret);

  const asKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", asKeys.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", bs(uaPublic), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asKeys.privateKey, 256),
  );

  const prkKey = await hmac(authKey, shared);
  const keyInfo = concat(enc.encode("WebPush: info\0"), uaPublic, asPublic, new Uint8Array([1]));
  const ikm = await hmac(prkKey, keyInfo);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);

  const aesKey = await crypto.subtle.importKey("raw", bs(cek), { name: "AES-GCM" }, false, ["encrypt"]);
  const record = concat(enc.encode(plaintext), new Uint8Array([2])); // delimitador de padding
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: bs(nonce) }, aesKey, bs(record)),
  );

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, ciphertext);
}

export interface PushSub {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

/** Devuelve el status HTTP del push service (404/410 = suscripción expirada). */
export async function sendWebPush(
  sub: PushSub,
  payload: unknown,
  vapid: VapidConfig,
  ttlSeconds = 3600,
): Promise<number> {
  const audience = new URL(sub.endpoint).origin;
  const jwt = await vapidJwt(audience, vapid.subject, vapid.publicKey, vapid.privateKey);
  const body = await encryptPayload(JSON.stringify(payload), sub.p256dh, sub.auth);

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(ttlSeconds),
    },
    body: body as unknown as BodyInit,
  });
  return res.status;
}
