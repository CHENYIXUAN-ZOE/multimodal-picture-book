export const SESSION_COOKIE = "mpb_demo_session";
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signingKey(password: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(`multimodal-picture-book:${password}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createSessionToken(password: string) {
  const payload = toBase64Url(
    encoder.encode(
      JSON.stringify({
        version: 1,
        expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
      }),
    ),
  );
  const signature = await crypto.subtle.sign("HMAC", await signingKey(password), encoder.encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(token: string | undefined, password: string | undefined) {
  if (!token || !password || password.length < 12) return false;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;
  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await signingKey(password),
      fromBase64Url(signature),
      encoder.encode(payload),
    );
    if (!valid) return false;
    const parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as {
      version?: number;
      expiresAt?: number;
    };
    return parsed.version === 1 && Number(parsed.expiresAt) > Date.now();
  } catch {
    return false;
  }
}

export async function passwordsMatch(input: string, expected: string) {
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(input)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const leftBytes = new Uint8Array(left);
  const rightBytes = new Uint8Array(right);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < Math.max(leftBytes.length, rightBytes.length); index += 1) {
    difference |= (leftBytes[index] || 0) ^ (rightBytes[index] || 0);
  }
  return difference === 0;
}
