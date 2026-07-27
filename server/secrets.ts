import fs from "node:fs";
import path from "node:path";
import { env, paths } from "./config";

export type SecretSource = "local-secret-file" | "environment" | null;

export function validateKimiApiKey(value: string) {
  const key = value.trim();
  if (key.length < 16 || key.length > 512 || /[\r\n]/.test(key)) {
    throw new Error("Kimi API Key 格式不正确");
  }
  return key;
}

export function readKimiApiKey() {
  if (fs.existsSync(paths.kimiApiKey)) {
    return validateKimiApiKey(fs.readFileSync(paths.kimiApiKey, "utf8"));
  }
  return env.moonshotApiKey ? validateKimiApiKey(env.moonshotApiKey) : "";
}

export function getKimiSecretStatus(): {
  configured: boolean;
  source: SecretSource;
  hint: string | null;
} {
  const source: SecretSource = fs.existsSync(paths.kimiApiKey)
    ? "local-secret-file"
    : env.moonshotApiKey
      ? "environment"
      : null;
  const key = source ? readKimiApiKey() : "";
  return {
    configured: Boolean(key),
    source,
    hint: key ? `••••${key.slice(-4)}` : null,
  };
}

export function saveKimiApiKey(value: string) {
  const key = validateKimiApiKey(value);
  fs.mkdirSync(paths.secrets, { recursive: true, mode: 0o700 });
  fs.chmodSync(paths.secrets, 0o700);
  const temporary = path.join(paths.secrets, `.kimi-api-key-${process.pid}.tmp`);
  fs.writeFileSync(temporary, `${key}\n`, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temporary, paths.kimiApiKey);
  fs.chmodSync(paths.kimiApiKey, 0o600);
}

export function removeKimiApiKey() {
  fs.rmSync(paths.kimiApiKey, { force: true });
}
