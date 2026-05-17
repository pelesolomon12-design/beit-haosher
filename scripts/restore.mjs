/**
 * Beit Haosher - Database Restore
 * Usage: node scripts/restore.mjs
 */

import pg from "pg";
import fs from "fs";
import path from "path";
import https from "https";
import readline from "readline";

const { Client } = pg;

const DB_URL =
  "postgresql://postgres:kwQaLWzfVmtsHBkQTAiloBdLEOZbzPjy@yamanote.proxy.rlwy.net:36654/railway";

const GITHUB_TOKEN = process.env.GITHUB_BACKUP_TOKEN;
const BACKUP_REPO = "pelesolomon12-design/beit-haosher-backup";

const LOCAL_BACKUP_DIR = path.join(
  process.env.USERPROFILE || "C:\\Users\\peles",
  "OneDrive", "מסמכים", "backups", "beit-haosher"
);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

function githubGet(path) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: "api.github.com", path, method: "GET",
        headers: { Authorization: `token ${GITHUB_TOKEN}`, "User-Agent": "beit-haosher-restore" } },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve(JSON.parse(data)));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { headers: { Authorization: `token ${GITHUB_TOKEN}`, "User-Agent": "beit-haosher-restore" } },
      (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          return downloadFile(res.headers.location).then(resolve).catch(reject);
        }
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve(data));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function restore() {
  console.log("\nמאיפה לשחזר?");
  console.log("  [1] GitHub (מומלץ — תמיד עדכני)");
  console.log("  [2] OneDrive (קבצים מקומיים)");

  const source = await ask("\nבחר: ");

  let backup;
  let selectedName;

  if (source.trim() === "1") {
    // שחזור מ-GitHub
    console.log("\nמוריד רשימת גיבויים מ-GitHub...");
    const files = await githubGet(`/repos/${BACKUP_REPO}/contents/`);

    if (!Array.isArray(files) || files.length === 0) {
      console.log("לא נמצאו גיבויים ב-GitHub.");
      rl.close(); process.exit(1);
    }

    const backups = files
      .filter(f => f.name.startsWith("backup_") && f.name.endsWith(".json"))
      .sort((a, b) => b.name.localeCompare(a.name)); // חדש ראשון

    console.log("\nגיבויים זמינים ב-GitHub:\n");
    backups.forEach((f, i) => {
      const date = f.name.replace("backup_", "").replace(".json", "");
      console.log(`  [${i + 1}] ${date}`);
    });

    const choice = await ask("\nבחר מספר: ");
    const idx = parseInt(choice) - 1;
    if (isNaN(idx) || idx < 0 || idx >= backups.length) {
      console.log("בחירה לא תקינה."); rl.close(); process.exit(1);
    }

    selectedName = backups[idx].name;
    console.log(`\nמוריד ${selectedName}...`);
    const content = await downloadFile(backups[idx].download_url);
    backup = JSON.parse(content);

  } else {
    // שחזור מ-OneDrive
    const files = fs.readdirSync(LOCAL_BACKUP_DIR)
      .filter(f => f.startsWith("backup_") && f.endsWith(".json"))
      .sort().reverse();

    if (files.length === 0) {
      console.log("לא נמצאו גיבויים מקומיים."); rl.close(); process.exit(1);
    }

    console.log("\nגיבויים זמינים ב-OneDrive:\n");
    files.forEach((f, i) => {
      const date = f.replace("backup_", "").replace(".json", "");
      const size = (fs.statSync(path.join(LOCAL_BACKUP_DIR, f)).size / 1024).toFixed(1);
      console.log(`  [${i + 1}] ${date}  (${size} KB)`);
    });

    const choice = await ask("\nבחר מספר: ");
    const idx = parseInt(choice) - 1;
    if (isNaN(idx) || idx < 0 || idx >= files.length) {
      console.log("בחירה לא תקינה."); rl.close(); process.exit(1);
    }

    selectedName = files[idx];
    backup = JSON.parse(fs.readFileSync(path.join(LOCAL_BACKUP_DIR, selectedName), "utf8"));
  }

  console.log(`\nגיבוי מתאריך: ${backup.timestamp}`);
  const confirm = await ask(`\nשחזר? זה ימחק את כל הנתונים הנוכחיים! (כן/לא): `);

  if (confirm.trim() !== "כן") {
    console.log("בוטל."); rl.close(); process.exit(0);
  }
  rl.close();

  const client = new Client({ connectionString: DB_URL, ssl: false });
  await client.connect();

  try {
    for (const [table, rows] of Object.entries(backup.tables)) {
      await client.query(`DELETE FROM "${table}"`);
      for (const row of rows) {
        const keys = Object.keys(row);
        const values = Object.values(row);
        const cols = keys.map(k => `"${k}"`).join(", ");
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
        await client.query(`INSERT INTO "${table}" (${cols}) VALUES (${placeholders})`, values);
      }
      if (rows.length > 0) console.log(`  ${table}: שוחזרו ${rows.length} שורות`);
    }
    console.log("\nשחזור הושלם בהצלחה!");
  } catch (err) {
    console.error("שגיאה:", err.message);
  } finally {
    await client.end();
  }
}

restore();
