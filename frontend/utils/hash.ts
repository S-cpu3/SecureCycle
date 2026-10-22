import * as Crypto from "expo-crypto";
import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 as nobleSha256 } from "@noble/hashes/sha2.js";
import {
  bytesToHex,
  hexToBytes,
  utf8ToBytes,
} from "@noble/hashes/utils.js";

const PBKDF2_PREFIX = "pbkdf2-sha256";
const PBKDF2_ITERATIONS = 600_000;
const DERIVED_KEY_LENGTH = 32;
const SALT_LENGTH_BYTES = 16;

/**
 * SHA-256 retained for legacy PIN verification.
 * New PINs must use PBKDF2 instead.
 */
export function sha256(input: string): string {
  return bytesToHex(nobleSha256(utf8ToBytes(input)));
}

/**
 * Legacy PIN format: SHA-256(salt + ":" + PIN).
 * Used only to verify existing PIN records.
 */
export function hashLegacyPin(pin: string, salt: string): string {
  return sha256(`${salt}:${pin}`);
}

/**
 * Creates a cryptographically random salt for PBKDF2.
 * The returned string contains the algorithm, iteration count,
 * and random salt bytes encoded as hexadecimal.
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
 * Derives a PBKDF2-HMAC-SHA-256 PIN hash.
 *
 * The salt must be the string returned by createPinSalt()
 * or a valid stored PBKDF2 salt in the same format.
 */
export async function hashPin(
  pin: string,
  salt: string
): Promise<string> {
  // Prevent "salt.split is not a function" when a Promise or
  // another non-string value is accidentally passed.
  if (typeof salt !== "string") {
    throw new Error(
      `Invalid PIN salt type: expected string, received ${typeof salt}. ` +
        "Make sure createPinSalt() is called with await."
    );
  }

  const parts = salt.split("$");

  if (parts.length !== 3) {
    throw new Error("Invalid PIN hashing format");
  }

  const [algorithm, iterationText, saltHex] = parts;

  if (algorithm !== PBKDF2_PREFIX) {
    throw new Error("Unsupported PIN hashing format");
  }

  const iterations = Number(iterationText);

  if (
    !Number.isSafeInteger(iterations) ||
    iterations !== PBKDF2_ITERATIONS ||
    !/^[0-9a-f]{32}$/i.test(saltHex)
  ) {
    throw new Error("Invalid PIN hashing parameters");
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
 * Returns true only for a valid salt in the supported PBKDF2 format.
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
 * Detects hashes known to be broken by the previous implementation.
 */
export function isLegacyBrokenHash(
  hash: string | null | undefined
): boolean {
  return Boolean(hash && hash.includes("NaN"));
}
