/**
 * Beit Haosher - Automatic Database Backup
 * Saves a JSON dump of all tables to OneDrive/backups/beit-haosher/
 * Run daily via Windows Task Scheduler
 */

import pg from "pg";
import fs from "fs";
import path from "path";

const { Client } = pg;

const DB_URL =
  "postgresql://postgres:kwQaLWzfVmtsHBkQTAiloBdLEOZbzPjy@yamanote.proxy.rlwy.net:36654/railway";

const BACKUP_DIR = path.join(
  process.env.USERPROFILE || "C:\\Users\\peles",
  "OneDrive",
  "מסמכים",
  "backups",
  "beit-haosher"
);

const MAX_BACKUPS = 30; // שמור 30 גיבויים אחרונים

async function backup() {
  const client = new Client({ connectionString: DB_URL, ssl: false });

  try {
    console.log("מתחבר לבסיס הנתונים...");
    await client.connect();

    // קבל רשימת כל הטבלאות
    const tablesResult = await client.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    const tables = tablesResult.rows.map((r) => r.tablename);
    console.log(`טבלאות שנמצאו: ${tables.join(", ")}`);

    // גבה כל טבלה
    const backup = {
      timestamp: new Date().toISOString(),
      tables: {},
    };

    for (const table of tables) {
      const result = await client.query(`SELECT * FROM "${table}"`);
      backup.tables[table] = result.rows;
      console.log(`  ${table}: ${result.rows.length} שורות`);
    }

    // צור תיקיית גיבויים אם לא קיימת
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // שמור קובץ גיבוי עם תאריך
    const date = new Date().toISOString().slice(0, 10);
    const time = new Date().toISOString().slice(11, 19).replace(/:/g, "-");
    const filename = `backup_${date}_${time}.json`;
    const filepath = path.join(BACKUP_DIR, filename);

    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2), "utf8");
    console.log(`\nגיבוי נשמר: ${filepath}`);

    // מחק גיבויים ישנים (שמור רק MAX_BACKUPS אחרונים)
    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith("backup_") && f.endsWith(".json"))
      .sort();

    if (files.length > MAX_BACKUPS) {
      const toDelete = files.slice(0, files.length - MAX_BACKUPS);
      for (const f of toDelete) {
        fs.unlinkSync(path.join(BACKUP_DIR, f));
        console.log(`מחק גיבוי ישן: ${f}`);
      }
    }

    console.log("\nגיבוי הושלם בהצלחה!");
  } catch (err) {
    console.error("שגיאה בגיבוי:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

backup();
