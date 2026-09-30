import * as SQLite from "expo-sqlite";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

const DB_KEY_NAME = "safecycle_db_key_v1";
const DB_MIGRATED_FLAG = "safecycle_db_encrypted_v1";

// Once encryption is on, the app uses this file name. Keeping it different
// from the legacy plaintext "safecycle.db" means migration never has to
// overwrite or rename anything: it writes a new file, verifies it, and only
// then deletes the old one.
const ENCRYPTED_DB_NAME = "safecycle-encrypted.db";

type RowCounts = Record<string, number>;

/**
 * Random 32-byte database key, created on first run and kept in the OS
 * keystore (iOS Keychain / Android Keystore) via expo-secure-store.
 *
 * It is NOT gated behind biometrics (requireAuthentication): the app has to
 * open the database before the PIN screen, because the lock screen reads the
 * PIN state from it.
 *
 * Protects against: a copy of the DB file taken from a backup, `adb backup`,
 * or filesystem access without the app's keystore entry.
 * Does NOT protect against: a rooted/jailbroken device or anything running
 * inside the app's own process, because the app can always read its own key.
 */
async function getOrCreateDbKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DB_KEY_NAME);
  if (existing && /^[0-9a-f]{64}$/i.test(existing)) {
    return existing;
  }

  const bytes = await Crypto.getRandomBytesAsync(32);
  const key = Array.from(bytes)
    .map((b: number) => b.toString(16).padStart(2, "0"))
    .join("");

  await SecureStore.setItemAsync(DB_KEY_NAME, key);
  return key;
}

// Raw key material (x'..' form) so SQLCipher uses the 32 random bytes
// directly instead of treating them as a human passphrase. The key is hex we
// generated ourselves, so interpolating it here cannot inject SQL.
function keyPragma(hexKey: string) {
  return `PRAGMA key = "x'${hexKey}'";`;
}

// Plain SQLite silently ignores PRAGMA key, which would leave the file
async function hasSqlCipher(db: SQLite.SQLiteDatabase): Promise<boolean> {
  try {
    const row = await db.getFirstAsync<{ cipher_version: string }>("PRAGMA cipher_version;");
    return Boolean(row?.cipher_version);
  } catch {
    return false;
  }
}

async function canRead(db: SQLite.SQLiteDatabase): Promise<boolean> {
  try {
    await db.getAllAsync("SELECT count(*) FROM sqlite_master;");
    return true;
  } catch {
    return false;
  }
}

async function rowCounts(db: SQLite.SQLiteDatabase): Promise<RowCounts> {
  const tables = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master
     WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'android_%';`
  );

  const counts: RowCounts = {};
  for (const table of tables) {
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM "${table.name}";`
    );
    counts[table.name] = row?.count ?? 0;
  }
  return counts;
}

function sameCounts(a: RowCounts, b: RowCounts) {
  const names = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const name of names) {
    if ((a[name] ?? 0) !== (b[name] ?? 0)) return false;
  }
  return true;
}

async function openWithKey(name: string, key: string) {
  const db = await SQLite.openDatabaseAsync(name);
  await db.execAsync(keyPragma(key));
  return db;
}

export async function openEncryptedDatabase(
  legacyName: string
): Promise<SQLite.SQLiteDatabase> {
  const key = await getOrCreateDbKey();
  const alreadyMigrated = (await SecureStore.getItemAsync(DB_MIGRATED_FLAG)) === "true";

  // ---- Normal path: already encrypted -------------------------------------
  if (alreadyMigrated) {
    const db = await openWithKey(ENCRYPTED_DB_NAME, key);

    if (!(await hasSqlCipher(db))) {
      throw new Error("SQLCipher is not available in this build; refusing to open the encrypted database.");
    }
    if (!(await canRead(db))) {
      throw new Error(
        "Could not read the encrypted database with the stored key. Do not clear the key without investigating."
      );
    }
    return db;
  }

  // ---- First run since the update ------------------------------------------
  const legacy = await SQLite.openDatabaseAsync(legacyName);

  // Expo Go (or a build without the plugin) has no SQLCipher. Never mark the
  // database as encrypted in that case.
  if (!(await hasSqlCipher(legacy))) {
    if (__DEV__) {
      console.warn(
        "[dbEncryption] SQLCipher is NOT available in this build (Expo Go?). " +
          "Running with an UNENCRYPTED database. Use a development build to test encryption."
      );
      return legacy;
    }
    await legacy.closeAsync();
    throw new Error("SQLCipher is not available in this build; refusing to store health data unencrypted.");
  }

  if (!(await canRead(legacy))) {
    await legacy.closeAsync();
    throw new Error(`"${legacyName}" is not readable as plaintext; refusing to modify it automatically.`);
  }

  const before = await rowCounts(legacy);
  const isFreshInstall = Object.keys(before).length === 0;

  // Fresh install: nothing to migrate, just start encrypted.
  if (isFreshInstall) {
    await legacy.closeAsync();
    await SQLite.deleteDatabaseAsync(legacyName).catch(() => {});
    await SQLite.deleteDatabaseAsync(ENCRYPTED_DB_NAME).catch(() => {});
    const db = await openWithKey(ENCRYPTED_DB_NAME, key);
    await SecureStore.setItemAsync(DB_MIGRATED_FLAG, "true");
    return db;
  }
  await SQLite.deleteDatabaseAsync(ENCRYPTED_DB_NAME).catch(() => {
    // Clears a half-finished earlier attempt; fine if nothing was there.
  });

  const directory = String(SQLite.defaultDatabaseDirectory).replace(/\/$/, "");
  const encryptedPath = `${directory}/${ENCRYPTED_DB_NAME}`;

  await legacy.execAsync(`ATTACH DATABASE '${encryptedPath}' AS encrypted KEY "x'${key}'";`);
  await legacy.getAllAsync(`SELECT sqlcipher_export('encrypted');`);
  await legacy.execAsync(`DETACH DATABASE encrypted;`);
  await legacy.closeAsync();

  const encrypted = await openWithKey(ENCRYPTED_DB_NAME, key);

  if (!(await canRead(encrypted))) {
    await encrypted.closeAsync();
    throw new Error(`Encrypted copy could not be read back. "${legacyName}" was NOT modified or deleted.`);
  }

  const after = await rowCounts(encrypted);
  if (!sameCounts(before, after)) {
    await encrypted.closeAsync();
    throw new Error(
      `Row counts differ after encrypting (before ${JSON.stringify(before)}, after ${JSON.stringify(after)}). ` +
        `"${legacyName}" was NOT modified or deleted.`
    );
  }

  // Verified. Now the plaintext copy can go.
  await SQLite.deleteDatabaseAsync(legacyName).catch((error) => {
    console.error(
      `Encrypted copy verified, but deleting the old plaintext "${legacyName}" failed. ` +
        "Remove it manually so health data is not left on disk unencrypted.",
      error
    );
  });

  await SecureStore.setItemAsync(DB_MIGRATED_FLAG, "true");
  return encrypted;
}
