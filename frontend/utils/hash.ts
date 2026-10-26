import * as Crypto from "expo-crypto";
import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 as nobleSha256 } from "@noble/hashes/sha2.js";
import {
  bytesToHex,
  hexToBytes,
  utf8ToBytes,
} from "@noble/hashes/utils.js";

const PBKDF2_PREFIX = "pbkdf2-sha256";
const PBKDF2_ITERATIONS = 8_000;
const DERIVED_KEY_LENGTH = 32;
const SALT_LENGTH_BYTES = 16;

/**
 * SHA-256 helper retained for legacy PIN verification.
 * New PIN verifiers must use PBKDF2.
 */
export function sha256(input: string): string {
  return bytesToHex(nobleSha256(utf8ToBytes(input)));
}

/**
 * Verifies the previous PIN format:
 * SHA-256(salt + ":" + PIN).
 */
export function hashLegacyPin(pin: string, salt: string): string {
  return sha256(`${salt}:${pin}`);
}

/**
 * Generates a cryptographically random salt.
 *
 * Format:
 * pbkdf2-sha256$600000$<32 hexadecimal characters>
 */
export async function createPinSalt(): Promise<string> {
  const randomBytes = await Crypto.getRandomBytesAsync(SALT_LENGTH_BYTES);

  return [
    PBKDF2_PREFIX,
    PBKDF2_ITERATIONS.toString(),
    bytesToHex(randomBytes),
  ].join("$");
}

/**
 * Derives a PIN verifier using PBKDF2-HMAC-SHA-256.
 */
export async function hashPin(
  pin: string,
  salt: string
): Promise<string> {
  if (typeof pin !== "string") {
    throw new Error("Invalid PIN: expected a string.");
  }

  if (typeof salt !== "string") {
    throw new Error(
      `Invalid PIN salt type: expected string, received ${typeof salt}. ` +
        "Check that every createPinSalt() call uses await."
    );
  }

  const parts = salt.split("$");

  if (parts.length !== 3) {
    throw new Error("Invalid PIN hashing format.");
  }

  const [algorithm, iterationText, saltHex] = parts;

  if (algorithm !== PBKDF2_PREFIX) {
    throw new Error("Unsupported PIN hashing format.");
  }

  const iterations = Number(iterationText);

  if (
    !Number.isSafeInteger(iterations) ||
    iterations !== PBKDF2_ITERATIONS ||
    !/^[0-9a-f]{32}$/i.test(saltHex)
  ) {
    throw new Error("Invalid PIN hashing parameters.");
  }

  const derivedKey = await pbkdf2Async(
    nobleSha256,
    utf8ToBytes(pin),
    hexToBytes(saltHex),
    {
      c: iterations,
      dkLen: DERIVED_KEY_LENGTH,
    }
  );

  return bytesToHex(derivedKey);
}

/**
 * Returns true only when the stored salt matches our supported
 * PBKDF2 format.
 */
export function isPbkdf2Salt(
  salt: string | null | undefined
): boolean {
  if (typeof salt !== "string") {
    return false;
  }

  const parts = salt.split("$");

  if (parts.length !== 3 || parts[0] !== PBKDF2_PREFIX) {
    return false;
  }

  return (
    parts[1] === PBKDF2_ITERATIONS.toString() &&
    /^[0-9a-f]{32}$/i.test(parts[2])
  );
}

/**
 * Identifies hashes known to be broken by an older implementation.
 */
export function isLegacyBrokenHash(
  hash: string | null | undefined
): boolean {
  return Boolean(hash && hash.includes("NaN"));
}
