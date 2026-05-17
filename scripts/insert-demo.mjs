import pg from "pg";
import { randomUUID } from "crypto";

const { Client } = pg;
const DB = "postgresql://postgres:kwQaLWzfVmtsHBkQTAiloBdLEOZbzPjy@yamanote.proxy.rlwy.net:36654/railway";
const client = new Client({ connectionString: DB, ssl: false });

const today = new Date("2026-05-17");
const d = (y, m, day) => new Date(y, m - 1, day);

// IDs מוגדרים מראש לשימוש חוצה-קטגוריות
const IDS = {
  // Staff
  fala:     "71cfb312-a5dc-4f6a-a126-4962c28331b2", // קיים
  yonatan:  randomUUID(),
  michal:   randomUUID(),
  avi:      randomUUID(),
  doctor:   randomUUID(),
  nurse:    randomUUID(),

  // Occupants
  israel:   randomUUID(),
  david:    randomUUID(),
  yossi:    randomUUID(),
  moshe:    randomUUID(),
  avraham:  randomUUID(),
  rachel:   randomUUID(),
  sara:     randomUUID(),
  miriam:   randomUUID(),
  naama:    randomUUID(),
  hana:     randomUUID(),
  yaakov:   randomUUID(),
  ronit:    randomUUID(),

  // Cash flow categories
  catIncome:    randomUUID(),
  catSalary:    randomUUID(),
  catFood:      randomUUID(),
  catElec:      randomUUID(),
  catArnona:    randomUUID(),
  catMeds:      randomUUID(),
  catClean:     randomUUID(),
  catEquip:     randomUUID(),
};

async function run() {
  await client.connect();
  console.log("מחובר. מתחיל הכנסת נתוני דמו...\n");

  // ─── 1. ניקוי נתונים קיימים ─────────────────────────────────────────
  console.log("מנקה נתונים קיימים...");
  const tables = [
    "medication_logs","medications","sos_medication_logs","patient_sos_allergies","sos_medications",
    "schedule_event_staff","schedule_events","patient_shopping_lists","purchase_transactions",
    "shopping_list","target_inventory","cash_flow_transactions","cash_flow_opening_balances",
    "cash_flow_categories","cash_flow_credit_cards","cash_flow_settings",
    "deposit_history","daily_tasks","daily_notes","weekly_notes","events",
    "push_subscriptions","webauthn_credentials",
    "occupants",
  ];
  for (const t of tables) await client.query(`DELETE FROM "${t}"`);
  await client.query(`DELETE FROM staff_members WHERE id != $1`, [IDS.fala]);
  console.log("✓ ניקוי הושלם\n");

  // ─── 2. עובדים ───────────────────────────────────────────────────────
  console.log("מוסיף עובדים...");
  const staff = [
    { id: IDS.yonatan, name: "יונתן כהן",       color: "#AED6F1", role: "staff"      },
    { id: IDS.michal,  name: "מיכל לוי",         color: "#A9DFBF", role: "staff"      },
    { id: IDS.avi,     name: "אבי מזרחי",         color: "#FAD7A0", role: "management" },
    { id: IDS.doctor,  name: 'ד"ר שמואל ברק',    color: "#D7BDE2", role: "management" },
    { id: IDS.nurse,   name: "אחות רחל גבאי",    color: "#F9A8D4", role: "staff"      },
  ];
  for (const s of staff)
    await client.query(`INSERT INTO staff_members (id,name,color,role,is_active) VALUES ($1,$2,$3,$4,true)`,
      [s.id, s.name, s.color, s.role]);
  console.log(`✓ ${staff.length + 1} עובדים\n`);

  // ─── 3. מטופלים ──────────────────────────────────────────────────────
  console.log("מוסיף מטופלים...");
  const occupants = [
    // --- מתחילים השבוע ---
    { id: IDS.israel, name: "ישראל ישראלי", room: "room-alef", gender: "זכר",
      addiction: "אלכוהול", religious: true,
      join: d(2026,5,14), end: d(2026,8,14), months: 3, paid: 0,
      prob: "בטוח", deposits: 1500, initial: 1500,
      phone: "052-1111111", contact: "שרה ישראלי", cPhone: "054-2222222", rel: "אמא",
      notes: "מגיע מקריית שמונה, מוטיבציה גבוהה, ראשון בטיפול",
      safe: "ארנק, שעון יד, טבעת נישואין", borrowed: "" },

    { id: IDS.hana, name: "חנה ישראלי", room: "room-chet", gender: "נקבה",
      addiction: "תרופות", religious: false,
      join: d(2026,5,16), end: d(2026,8,16), months: 3, paid: 0,
      prob: "בטוח", deposits: 2000, initial: 2000,
      phone: "054-3333333", contact: "דוד ישראלי", cPhone: "050-4444444", rel: "אח",
      notes: "הופנתה ע\"י פסיכיאטר. חרדה חברתית. נדרשת תמיכה מיוחדת בהתחלה",
      safe: "תכשיטים, 500₪ מזומן", borrowed: "" },

    // --- אמצע טיפול (חודש 2) ---
    { id: IDS.yossi, name: "יוסי לוי", room: "room-alef", gender: "זכר",
      addiction: "סמים", religious: false,
      join: d(2026,3,20), end: d(2026,6,20), months: 3, paid: 1,
      prob: "בטוח", deposits: 1000, initial: 1000,
      phone: "053-5555555", contact: "דינה לוי", cPhone: "052-6666666", rel: "אמא",
      notes: "התקדמות טובה. משתתף פעיל בקבוצות. מחפש עבודה לאחר שחרור",
      safe: "אחרת: מפתחות דירה, טלפון ישן", borrowed: "ספורט ביגוד ×2" },

    { id: IDS.naama, name: "נעמה דוד", room: "room-chet", gender: "נקבה",
      addiction: "הימורים", religious: true,
      join: d(2026,3,25), end: d(2026,6,25), months: 3, paid: 1,
      prob: "אולי", deposits: 800, initial: 800,
      phone: "054-7777777", contact: "יעקב דוד", cPhone: "050-8888888", rel: "אבא",
      notes: "התלבטות לגבי המשך. פגישת הערכה נקבעה לשבוע הבא",
      safe: "כרטיס אשראי (חסום), תעודת זהות", borrowed: "" },

    { id: IDS.yaakov, name: "יעקב אזולאי", room: "room-bet", gender: "זכר",
      addiction: "אלכוהול", religious: true,
      join: d(2026,3,18), end: d(2026,6,18), months: 3, paid: 1,
      prob: "בטוח", deposits: 3000, initial: 3000,
      phone: "050-9999999", contact: "רבקה אזולאי", cPhone: "054-1010101", rel: "בן/בת זוג",
      notes: "עסקאי לשעבר. מחויב מאוד. מדריך קבוצת אנונימיים",
      safe: "שעון יקר, 2,000₪ מזומן, מסמכים", borrowed: "ספרים ×3" },

    // --- אמצע טיפול (חודש 3) ---
    { id: IDS.david, name: "דוד כהן", room: "room-bet", gender: "זכר",
      addiction: "סמים", religious: false,
      join: d(2026,2,20), end: d(2026,6,20), months: 4, paid: 2,
      prob: "בטוח", deposits: 2500, initial: 2500,
      phone: "052-2020202", contact: "יוסף כהן", cPhone: "053-3030303", rel: "אבא",
      notes: "שלב 3 בתכנית. התקדמות מצוינת. מתכנן לגור בדיור מוגן",
      safe: "מפתחות רכב, ארנק", borrowed: "" },

    { id: IDS.miriam, name: "מרים לוי", room: "room-tet", gender: "נקבה",
      addiction: "תרופות", religious: false,
      join: d(2026,2,25), end: d(2026,6,25), months: 4, paid: 2,
      prob: "בטוח", deposits: 1200, initial: 1200,
      phone: "050-4040404", contact: "אבי לוי", cPhone: "054-5050505", rel: "בן",
      notes: "אחרי ניתוח גב. תלות בכאב-מפסיקים. שיפור ניכר בתפקוד",
      safe: "תרופות מרשם (בידי הצוות), 300₪", borrowed: "" },

    { id: IDS.rachel, name: "רחל אברהם", room: "room-tet", gender: "נקבה",
      addiction: "אלכוהול", religious: true,
      join: d(2026,2,18), end: d(2026,6,18), months: 4, paid: 2,
      prob: "אולי", deposits: 500, initial: 500,
      phone: "053-6060606", contact: "שמחה אברהם", cPhone: "052-7070707", rel: "בן/בת זוג",
      notes: "שלב 3. משפחה תומכת. שוקלת הארכה של חודש נוסף",
      safe: "תכשיטים, ארנק", borrowed: "מגבות ×2" },

    // --- לקראת סיום, מתלבטים ---
    { id: IDS.moshe, name: "משה פרץ", room: "room-gimel", gender: "זכר",
      addiction: "סמים", religious: false,
      join: d(2026,2,10), end: d(2026,5,25), months: 3, paid: 3,
      prob: "אולי", deposits: 700, initial: 700,
      phone: "050-8080808", contact: "לאה פרץ", cPhone: "054-9090909", rel: "אמא",
      notes: "שוקל הארכה. פגישת משפחה מתוכננת. עדיין לא מוכן לשחרור",
      safe: "טבעת, 200₪ מזומן", borrowed: "" },

    { id: IDS.avraham, name: "אברהם מזרחי", room: "room-gimel", gender: "זכר",
      addiction: "הימורים", religious: true,
      join: d(2026,2,15), end: d(2026,5,20), months: 3, paid: 3,
      prob: "אולי", deposits: 1800, initial: 1800,
      phone: "052-1212121", contact: "יוסי מזרחי", cPhone: "053-3434343", rel: "אח",
      notes: "הצלחה גדולה בטיפול CBT. עובד עם עו\"ס לשיקום כלכלי",
      safe: "1,500₪ מזומן, תעודת זהות", borrowed: "" },

    { id: IDS.sara, name: "שרה כהן", room: "room-tet", gender: "נקבה",
      addiction: "מין", religious: false,
      join: d(2026,2,1), end: d(2026,5,30), months: 3, paid: 3,
      prob: "בטוח שלא", deposits: 900, initial: 900,
      phone: "054-5656565", contact: "מנחם כהן", cPhone: "050-7878787", rel: "בן/בת זוג",
      notes: "מסיימת תכנית. כבר קבעה דירה. מוכנה לשחרור",
      safe: "מפתחות דירה חדשה, 400₪", borrowed: "שמיכה ×1" },

    { id: IDS.ronit, name: "רונית בן-דוד", room: "room-chet", gender: "נקבה",
      addiction: "אלכוהול", religious: false,
      join: d(2026,2,5), end: d(2026,5,28), months: 3, paid: 3,
      prob: "אולי", deposits: 1100, initial: 1100,
      phone: "053-9090909", contact: "גיל בן-דוד", cPhone: "052-1234567", rel: "בן/בת זוג",
      notes: "סיום מוצלח. מתלבטת להישאר עוד חודש בגלל חוסר דיור",
      safe: "כרטיס בנק, אחרת: מסמכי גירושין", borrowed: "" },
  ];

  for (const o of occupants) {
    await client.query(`
      INSERT INTO occupants (id,name,room_id,gender,is_religious,addiction_type,
        join_date,end_date_time,staying_probability,planned_months,paid_months,
        deposits,initial_deposit,safe_items,borrowed_items,notes,
        client_phone,contact_name,contact_phone,contact_relationship)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [o.id, o.name, o.room, o.gender, o.religious, o.addiction,
       o.join, o.end, o.prob, o.months, o.paid,
       o.deposits, o.initial, o.safe, o.borrowed, o.notes,
       o.phone, o.contact, o.cPhone, o.rel]);
  }
  console.log(`✓ ${occupants.length} מטופלים\n`);

  // ─── 4. תרופות ────────────────────────────────────────────────────────
  console.log("מוסיף תרופות...");
  const allDays = null; // כל הימים

  const medsData = [
    // ישראל ישראלי - 2 תרופות בוקר + 2 תרופות לילה
    { pid: IDS.israel, name: "נלטרקסון 50מג",        dosage: "1 כדור", times: ["בוקר"],           specific: "08:00" },
    { pid: IDS.israel, name: "סרטרלין 100מג",         dosage: "1 כדור", times: ["בוקר"],           specific: "08:00" },
    { pid: IDS.israel, name: "מירטזפין 30מג",         dosage: "1 כדור", times: ["לילה"],           specific: "22:00" },
    { pid: IDS.israel, name: 'ויטמין B קומפלקס',      dosage: "1 כמוסה",times: ["בוקר","לילה"],   specific: "08:00,22:00" },

    // דוד כהן - 2 תרופות פעמיים ביום
    { pid: IDS.david,  name: "מתדון 40מג",            dosage: "40מג נוזל", times: ["בוקר"],         specific: "07:30" },
    { pid: IDS.david,  name: "קווטיאפין 25מג",        dosage: "1 כדור",    times: ["לילה"],         specific: "21:00" },
    { pid: IDS.david,  name: "אסציטלופרם 10מג",       dosage: "1 כדור",    times: ["בוקר"],         specific: "08:00" },

    // יוסי לוי - 1-5 תרופות פעמיים ביום
    { pid: IDS.yossi,  name: "סובוקסון 8מג",          dosage: "1 טבלית",   times: ["בוקר","צהריים"], specific: "08:00,13:00" },
    { pid: IDS.yossi,  name: "ריספרידון 2מג",         dosage: "1 כדור",    times: ["בוקר","לילה"],  specific: "08:00,22:00" },

    // משה פרץ - 2 תרופות בוקר, 2 לילה
    { pid: IDS.moshe,  name: "גבפנטין 300מג",         dosage: "1 כמוסה",   times: ["בוקר"],         specific: "08:00" },
    { pid: IDS.moshe,  name: "ליתיום 400מג",           dosage: "1 כדור",    times: ["בוקר","לילה"],  specific: "08:00,22:00" },
    { pid: IDS.moshe,  name: "קלונזפם 0.5מג",         dosage: "חצי כדור",  times: ["לילה"],         specific: "22:00" },

    // אברהם מזרחי
    { pid: IDS.avraham, name: "אנטבוס 250מג",         dosage: "1 כדור",    times: ["בוקר"],         specific: "08:00" },
    { pid: IDS.avraham, name: "פלואוקסטין 20מג",      dosage: "1 כמוסה",   times: ["בוקר"],         specific: "08:00" },
    { pid: IDS.avraham, name: "מלטונין 5מג",           dosage: "1 כדור",    times: ["לילה"],         specific: "21:30" },

    // רחל אברהם
    { pid: IDS.rachel, name: "נלטרקסון 50מג",         dosage: "1 כדור",    times: ["בוקר"],         specific: "08:00" },
    { pid: IDS.rachel, name: "ונלפקסין 75מג",          dosage: "1 כמוסה",   times: ["בוקר"],         specific: "08:00" },
    { pid: IDS.rachel, name: "זולפידם 5מג",            dosage: "1 כדור",    times: ["לילה"],         specific: "22:00" },

    // שרה כהן
    { pid: IDS.sara,   name: "פארוקסטין 20מג",        dosage: "1 כדור",    times: ["בוקר"],         specific: "08:30" },
    { pid: IDS.sara,   name: "קווטיאפין 50מג",        dosage: "1 כדור",    times: ["לילה"],         specific: "21:00" },

    // מרים לוי
    { pid: IDS.miriam, name: "טרמדול 50מג",            dosage: "1 כמוסה",   times: ["בוקר","צהריים","אחה\"צ"], specific: "08:00,13:00,17:00" },
    { pid: IDS.miriam, name: "אומפרזול 20מג",          dosage: "1 כמוסה",   times: ["בוקר"],         specific: "07:30" },
    { pid: IDS.miriam, name: "קלונזפם 0.5מג",         dosage: "חצי כדור",  times: ["לילה"],         specific: "22:00" },

    // נעמה דוד
    { pid: IDS.naama,  name: "סרטרלין 50מג",           dosage: "1 כדור",    times: ["בוקר"],         specific: "08:00" },
    { pid: IDS.naama,  name: "אלפרזולם 0.25מג",       dosage: "חצי כדור",  times: ["בוקר","לילה"],  specific: "08:00,22:00" },

    // חנה ישראלי
    { pid: IDS.hana,   name: "ציפרלקס 10מג",           dosage: "1 כדור",    times: ["בוקר"],         specific: "08:00" },
    { pid: IDS.hana,   name: "הידרוקסיזין 25מג",       dosage: "1 כדור",    times: ["בוקר","לילה"],  specific: "08:00,22:00" },

    // יעקב אזולאי
    { pid: IDS.yaakov, name: "אקמפרוסט 333מג",         dosage: "2 כדורים",  times: ["בוקר","צהריים","לילה"], specific: "08:00,13:00,20:00" },
    { pid: IDS.yaakov, name: "מירטזפין 15מג",          dosage: "1 כדור",    times: ["לילה"],         specific: "22:00" },
    { pid: IDS.yaakov, name: 'אומגה 3',                dosage: "2 כמוסות",  times: ["בוקר"],         specific: "08:00" },

    // רונית בן-דוד
    { pid: IDS.ronit,  name: "נלטרקסון 50מג",         dosage: "1 כדור",    times: ["בוקר"],         specific: "08:00" },
    { pid: IDS.ronit,  name: "דולוקסטין 60מג",        dosage: "1 כמוסה",   times: ["בוקר"],         specific: "08:00" },
    { pid: IDS.ronit,  name: "זולפידם 10מג",           dosage: "1 כדור",    times: ["לילה"],         specific: "22:00" },
  ];

  for (const m of medsData) {
    await client.query(`
      INSERT INTO medications (id,patient_id,name,dosage,time_of_day,specific_times,start_date,is_active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,true)`,
      [randomUUID(), m.pid, m.name, m.dosage, m.times, m.specific, d(2026,5,14)]);
  }
  console.log(`✓ ${medsData.length} תרופות למטופלים\n`);

  // תרופות SOS
  console.log("מוסיף תרופות SOS...");
  const sosMeds = [
    { name: "דיאזפם 5מג",     desc: "למשבר חרדה חריף. מתן רק לאחר אישור רופא.", cooldown: 8 },
    { name: "הלופרידול 5מג",  desc: "לאפיזודה פסיכוטית חריפה. הזרקה IM בלבד.", cooldown: 12 },
    { name: "פרומתזין 25מג",  desc: "לבחילות חמורות, הקאות, חוסר שינה קיצוני.", cooldown: 6 },
  ];
  for (const s of sosMeds)
    await client.query(`INSERT INTO sos_medications (id,name,description,cooldown_hours,is_active) VALUES ($1,$2,$3,$4,true)`,
      [randomUUID(), s.name, s.desc, s.cooldown]);
  console.log(`✓ 3 תרופות SOS\n`);

  // ─── 5. לוח שבועי ─────────────────────────────────────────────────────
  console.log("מוסיף לוח שבועי...");

  // אירועי לוח שנה שבועיים (קבועים)
  const calEvents = [
    { name: "תפילת שחרית",                time: "07:00", end: "07:45", color: "blue"   },
    { name: "ארוחת בוקר",                 time: "08:00", end: "09:00", color: "green"  },
    { name: "קבוצה טיפולית — שיחה",       time: "09:00", end: "10:30", color: "purple" },
    { name: "פגישות אישיות עם מטפל",      time: "10:30", end: "12:00", color: "purple" },
    { name: "ארוחת צהריים",               time: "13:00", end: "14:00", color: "green"  },
    { name: "פעילות גופנית",              time: "15:00", end: "16:30", color: "orange" },
    { name: "סדנת אמנות/יצירה",           time: "16:30", end: "18:00", color: "orange" },
    { name: "ערב חופשי — סלון",           time: "19:00", end: "21:00", color: "gray"   },
    { name: "כיבוי אורות",                time: "23:00", end: "23:30", color: "gray"   },
  ];

  // הכנסת אירועים לשבועיים קדימה
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const date = new Date(today);
    date.setDate(today.getDate() + dayOffset);
    const dateStr = date.toISOString().slice(0, 10);

    for (const ev of calEvents) {
      await client.query(`
        INSERT INTO events (id,date,name,time,color)
        VALUES ($1,$2,$3,$4,$5)`,
        [randomUUID(), dateStr, ev.name, ev.time, ev.color]);
    }
  }
  console.log("✓ לוח שבועי — אירועים יומיים\n");

  // ─── 6. משמרות צוות ────────────────────────────────────────────────────
  console.log("מוסיף משמרות...");
  const staffCycle = [IDS.fala, IDS.yonatan, IDS.michal]; // רוטציה

  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const date = new Date(today);
    date.setDate(today.getDate() + dayOffset);
    const dateStr = date.toISOString().slice(0, 10);
    const dayOfWeek = date.getDay(); // 0=ראשון

    const shifts = [
      { title: "משמרת בוקר",   start: "07:00", end: "15:00", staffId: staffCycle[dayOffset % 3] },
      { title: "משמרת אחה\"צ", start: "15:00", end: "23:00", staffId: staffCycle[(dayOffset + 1) % 3] },
      { title: "משמרת לילה",  start: "23:00", end: "07:00", staffId: staffCycle[(dayOffset + 2) % 3] },
    ];

    for (const sh of shifts) {
      const evId = randomUUID();
      await client.query(`
        INSERT INTO schedule_events (id,date,title,start_time,end_time,layer,staff_member_id)
        VALUES ($1,$2,$3,$4,$5,'staff',$6)`,
        [evId, dateStr, sh.title, sh.start, sh.end, sh.staffId]);
      await client.query(`INSERT INTO schedule_event_staff (id,event_id,staff_member_id) VALUES ($1,$2,$3)`,
        [randomUUID(), evId, sh.staffId]);
    }

    // רופא — יום שלישי (dayOfWeek=2)
    if (dayOfWeek === 2) {
      const evId = randomUUID();
      await client.query(`
        INSERT INTO schedule_events (id,date,title,start_time,end_time,layer,staff_member_id)
        VALUES ($1,$2,'ביקור רופא','10:00','14:00','management',$3)`,
        [evId, dateStr, IDS.doctor]);
      await client.query(`INSERT INTO schedule_event_staff (id,event_id,staff_member_id) VALUES ($1,$2,$3)`,
        [randomUUID(), evId, IDS.doctor]);
    }

    // אחות — ראשון (0) ורביעי (3)
    if (dayOfWeek === 0 || dayOfWeek === 3) {
      const evId = randomUUID();
      await client.query(`
        INSERT INTO schedule_events (id,date,title,start_time,end_time,layer,staff_member_id)
        VALUES ($1,$2,'סבב אחות — חלוקת תרופות','08:00','12:00','staff',$3)`,
        [evId, dateStr, IDS.nurse]);
      await client.query(`INSERT INTO schedule_event_staff (id,event_id,staff_member_id) VALUES ($1,$2,$3)`,
        [randomUUID(), evId, IDS.nurse]);
    }
  }
  console.log("✓ משמרות לשבועיים\n");

  // ─── 7. רשימת קניות ────────────────────────────────────────────────────
  console.log("מוסיף רשימת קניות...");
  const shopping = [
    // מטבח
    { name: "flour",      nameHeb: "קמח לבן 5 ק\"ג",   cat: "אוכל ושתייה",    cur: 1, target: 4, fromTarget: true  },
    { name: "oil",        nameHeb: "שמן זית 1 ל'",      cat: "אוכל ושתייה",    cur: 2, target: 6, fromTarget: true  },
    { name: "sugar",      nameHeb: "סוכר 1 ק\"ג",       cat: "אוכל ושתייה",    cur: 0, target: 3, fromTarget: true  },
    { name: "coffee",     nameHeb: "קפה נמס 200 גרם",   cat: "אוכל ושתייה",    cur: 1, target: 3, fromTarget: true  },
    { name: "rice",       nameHeb: "אורז פרסי 1 ק\"ג",  cat: "אוכל ושתייה",    cur: 3, target: 8, fromTarget: true  },
    // רפואי
    { name: "bandages",   nameHeb: "בנדות סטרילי",      cat: "מוצרים רפואיים", cur: 5, target: 20, fromTarget: true },
    { name: "alcohol",    nameHeb: "אלכוהול 70% 500מל", cat: "מוצרים רפואיים", cur: 1, target: 4, fromTarget: true  },
    { name: "painkillers",nameHeb: "אקמול 500מג × 24",  cat: "מוצרים רפואיים", cur: 2, target: 5, fromTarget: true  },
    // לא ברשימת יעד
    { name: "flowers",    nameHeb: "פרחים לסלון",        cat: "מוצרים נלווים",  cur: 0, target: 1, fromTarget: false },
  ];
  for (const s of shopping) {
    await client.query(`
      INSERT INTO shopping_list (id,product_name,product_name_hebrew,category,current_quantity,target_quantity,needed_quantity,is_from_target_list)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [randomUUID(), s.name, s.nameHeb, s.cat, s.cur, s.target, Math.max(0, s.target - s.cur), s.fromTarget]);
  }
  console.log(`✓ ${shopping.length} פריטים ברשימת קניות\n`);

  // ─── 8. תזרים מזומנים ─────────────────────────────────────────────────
  console.log("מוסיף תזרים מזומנים...");

  // עדכן שנה פעילה
  await client.query(`INSERT INTO cash_flow_settings (id,active_year) VALUES ('default',2026)
    ON CONFLICT (id) DO UPDATE SET active_year=2026`);

  // קטגוריות
  const cats = [
    { id: IDS.catIncome,  name: "שכר טיפול",      type: "income"  },
    { id: IDS.catSalary,  name: "שכר עובדים",      type: "expense" },
    { id: IDS.catFood,    name: "מזון וצריכה",      type: "expense" },
    { id: IDS.catElec,    name: "חשמל ומים",        type: "expense" },
    { id: IDS.catArnona,  name: "ארנונה",            type: "expense" },
    { id: IDS.catMeds,    name: "תרופות וציוד רפואי",type: "expense" },
    { id: IDS.catClean,   name: "ניקיון ותחזוקה",   type: "expense" },
    { id: IDS.catEquip,   name: "ציוד שונה",         type: "expense" },
  ];
  for (const c of cats)
    await client.query(`INSERT INTO cash_flow_categories (id,name,type) VALUES ($1,$2,$3)`, [c.id, c.name, c.type]);

  // עסקאות מאי 2026
  const transactions = [
    // הכנסות — שכר טיפול מטופלים
    ...occupants.map(o => ({
      date: d(2026,5,1), year: 2026, month: 5, type: "income",
      amount: [8500,9000,9500,10000,10500,11000,11500,12000,13000][Math.floor(Math.random()*9)],
      catId: IDS.catIncome, catLabel: "שכר טיפול",
      method: "העברה בנקאית", desc: `שכר טיפול — ${o.name}`
    })),

    // הוצאות מאי
    { date: d(2026,5,1),  year: 2026, month: 5, type: "expense", amount: 9200,  catId: IDS.catSalary, catLabel: "שכר עובדים",       method: "העברה בנקאית", desc: "משכורת פלא" },
    { date: d(2026,5,1),  year: 2026, month: 5, type: "expense", amount: 8800,  catId: IDS.catSalary, catLabel: "שכר עובדים",       method: "העברה בנקאית", desc: "משכורת יונתן כהן" },
    { date: d(2026,5,1),  year: 2026, month: 5, type: "expense", amount: 8500,  catId: IDS.catSalary, catLabel: "שכר עובדים",       method: "העברה בנקאית", desc: "משכורת מיכל לוי" },
    { date: d(2026,5,1),  year: 2026, month: 5, type: "expense", amount: 14000, catId: IDS.catSalary, catLabel: "שכר עובדים",       method: "העברה בנקאית", desc: "משכורת אבי מזרחי (מנהל)" },
    { date: d(2026,5,5),  year: 2026, month: 5, type: "expense", amount: 15200, catId: IDS.catFood,   catLabel: "מזון וצריכה",      method: "כרטיס אשראי",  desc: "קניות מזון שבועיות × 4" },
    { date: d(2026,5,3),  year: 2026, month: 5, type: "expense", amount: 3800,  catId: IDS.catElec,   catLabel: "חשמל ומים",        method: "העברה בנקאית", desc: "חשבון חשמל מאי" },
    { date: d(2026,5,3),  year: 2026, month: 5, type: "expense", amount: 5400,  catId: IDS.catMeds,   catLabel: "תרופות",            method: "כרטיס אשראי",  desc: "תרופות מרשם — בית מרקחת" },
    { date: d(2026,5,7),  year: 2026, month: 5, type: "expense", amount: 2200,  catId: IDS.catClean,  catLabel: "ניקיון",            method: "מזומן",         desc: "חומרי ניקיון וכביסה" },
    { date: d(2026,5,10), year: 2026, month: 5, type: "expense", amount: 1800,  catId: IDS.catEquip,  catLabel: "ציוד שונה",         method: "כרטיס אשראי",  desc: "ציוד משרד ומטבח" },
    // ארנונה — כל חודשיים
    { date: d(2026,5,15), year: 2026, month: 5, type: "expense", amount: 4200,  catId: IDS.catArnona, catLabel: "ארנונה",            method: "העברה בנקאית", desc: "ארנונה מאי-יוני 2026" },

    // תחזית 30 יום קדימה — יוני 2026
    ...occupants.slice(0,10).map(o => ({
      date: d(2026,6,1), year: 2026, month: 6, type: "income",
      amount: [8500,9000,9500,10000,10500,11000][Math.floor(Math.random()*6)],
      catId: IDS.catIncome, catLabel: "שכר טיפול",
      method: "העברה בנקאית", desc: `שכר טיפול יוני — ${o.name}`, status: "pending"
    })),
    { date: d(2026,6,1),  year: 2026, month: 6, type: "expense", amount: 9200,  catId: IDS.catSalary, catLabel: "שכר עובדים", method: "העברה בנקאית", desc: "משכורת פלא — יוני",          status: "pending" },
    { date: d(2026,6,1),  year: 2026, month: 6, type: "expense", amount: 8800,  catId: IDS.catSalary, catLabel: "שכר עובדים", method: "העברה בנקאית", desc: "משכורת יונתן — יוני",        status: "pending" },
    { date: d(2026,6,1),  year: 2026, month: 6, type: "expense", amount: 8500,  catId: IDS.catSalary, catLabel: "שכר עובדים", method: "העברה בנקאית", desc: "משכורת מיכל — יוני",         status: "pending" },
    { date: d(2026,6,1),  year: 2026, month: 6, type: "expense", amount: 14000, catId: IDS.catSalary, catLabel: "שכר עובדים", method: "העברה בנקאית", desc: "משכורת אבי — יוני",          status: "pending" },
    { date: d(2026,6,5),  year: 2026, month: 6, type: "expense", amount: 15000, catId: IDS.catFood,   catLabel: "מזון וצריכה",method: "כרטיס אשראי",  desc: "מזון יוני (תחזית)",          status: "pending" },
    { date: d(2026,6,3),  year: 2026, month: 6, type: "expense", amount: 3800,  catId: IDS.catElec,   catLabel: "חשמל ומים",  method: "העברה בנקאית", desc: "חשמל יוני (תחזית)",          status: "pending" },
    { date: d(2026,6,3),  year: 2026, month: 6, type: "expense", amount: 5000,  catId: IDS.catMeds,   catLabel: "תרופות",      method: "כרטיס אשראי",  desc: "תרופות יוני (תחזית)",        status: "pending" },
    { date: d(2026,6,7),  year: 2026, month: 6, type: "expense", amount: 2000,  catId: IDS.catClean,  catLabel: "ניקיון",      method: "מזומן",         desc: "ניקיון יוני (תחזית)",        status: "pending" },
  ];

  for (const t of transactions) {
    await client.query(`
      INSERT INTO cash_flow_transactions
        (id,date,year,month,type,amount,category_id,category_label,payment_method,status,description)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [randomUUID(), t.date, t.year, t.month, t.type, t.amount,
       t.catId, t.catLabel, t.method, t.status || "completed", t.desc]);
  }
  console.log(`✓ ${transactions.length} עסקאות תזרים\n`);

  // ─── 9. סיכום ─────────────────────────────────────────────────────────
  console.log("═══════════════════════════════════════");
  console.log("✅ כל נתוני הדמו הוכנסו בהצלחה!");
  console.log("═══════════════════════════════════════");
  console.log("לחיצה אחת על האתר תראה:");
  console.log(" • 12 מטופלים בשלבים שונים");
  console.log(" • 6 עובדים + רופא + אחות");
  console.log(` • ${medsData.length} תרופות + 3 SOS`);
  console.log(" • לוח שבועי מלא לשבועיים");
  console.log(` • ${shopping.length} פריטים ברשימת קניות`);
  console.log(` • ${transactions.length} עסקאות תזרים (מאי + תחזית יוני)`);

  await client.end();
}

run().catch(async e => {
  console.error("שגיאה:", e.message);
  await client.end();
  process.exit(1);
});
