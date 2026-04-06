import * as SQLite from "expo-sqlite";
import { createAllTables } from "./schema";

const db = SQLite.openDatabaseSync("stealthdetect.db");

const initDB = async () => {
    db.withTransactionSync(() => {
        db.execSync(createAllTables);
    });
};

export default initDB();

/* Typescript version of db.js:

// Imports: SQLite Database & DAOs (Data Access Objects)
import * as SQLite from "expo-sqlite";
import { ScanSessionDao } from "./dao/scanSessionDao";

// Initialize and export the database connection
const db = SQLite.openDatabaseSync("stealthdetect.db");

// Initialize the database schema at once, create all necessary tables if they don't exist
const initDB = async () => {
    db.withTransactionSync(async () => {
        db.execSync(require('./schema').createAllTables);
    });
}

export default initDB();

*/