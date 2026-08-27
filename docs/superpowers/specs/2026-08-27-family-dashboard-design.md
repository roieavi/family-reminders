# Family Dashboard + ניהול לו"ז יומי — עיצוב

תאריך: 2026-08-27

## רקע ומטרה

הוספת שני חלקים חדשים לאפליקציה:

1. **מסך ניהול "לו"ז יומי"** — אזור חדש באפליקציה (תחת `/u/[token]`) לניהול משימות/תורנויות יומיות ופתקים חופשיים, באותו סגנון של מסך ניהול המשפחה הקיים.
2. **מסך דשבורד לטאבלט קבוע** — תצוגה נפרדת (`/d/[dashboardToken]`), landscape, ללא ניווט, שרצה קבוע על טאבלט מוצמד לקיר בבית ומציגה: שעה/תאריך/מזג אוויר, לו"ז היום, משימות ותורנויות, וסרט פתקים רץ.

זהו האפליקציה של משפחה יחידה בלבד (ראו הערה ב-`/api/families` — לא ניתן ליצור משפחה שנייה), כך שכל הטבלאות החדשות ממשיכות להיות מסוננות לפי `family_id` בהתאם לתבנית הקיימת, אך בפועל תמיד תהיה משפחה אחת.

## החלטות מרכזיות (מתוך שיחת התכנון)

- משימה יומית תומכת בשתי תבניות חזרתיות: **יומיומית** (חוזרת כל יום) ו**חד-פעמית** (עם תאריך יעד).
- משימה יכולה להיות משויכת למספר בני משפחה; **הסימון "בוצע" הוא נפרד לכל בן/בת משפחה** משויך/ת (לא סימון גורף אחד).
- פתקים (Sticky Notes) מתאפסים אוטומטית כל יום — מוצגים רק פתקי "היום".
- כל בן משפחה מחובר יכול לנהל את מסך "לו"ז יומי" (ליצור/לערוך/למחוק משימות ופתקים) — אין הרשאת אדמין נפרדת.
- מזג האוויר נשלף מ-Open-Meteo (חינמי, ללא מפתח API).
- מיקום המשפחה (למזג אוויר) ניתן לעריכה במסך ניהול המשפחה הקיים.
- הדשבורד בטאבלט ניגש דרך קישור ייעודי ברמת המשפחה (לא קשור לבן משפחה ספציפי) — טוקן חדש, לא טוקן אישי.
- פריסת הדשבורד: עמודת לו"ז ועמודת משימות בחלוקה שווה (50/50), ופתקים כסרט טקסט רץ (marquee) לרוחב מלא בתחתית המסך במקום עמודה שלישית.

## מודל נתונים (מיגרציה חדשה)

```sql
alter table families add column dashboard_token text unique;
alter table families add column latitude double precision;
alter table families add column longitude double precision;
alter table families add column location_label text; -- לתצוגה, למשל "תל אביב"

create table chores (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  title text not null,
  recurrence text not null check (recurrence in ('daily', 'once')),
  once_date date, -- נדרש כש recurrence = 'once'
  active boolean not null default true,
  created_by uuid not null references members(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table chore_members (
  chore_id uuid not null references chores(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  primary key (chore_id, member_id)
);

create table chore_completions (
  id uuid primary key default gen_random_uuid(),
  chore_id uuid not null references chores(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  completion_date date not null, -- "יום ישראלי" שאליו שייך הסימון
  completed_at timestamptz not null default now(),
  unique (chore_id, member_id, completion_date)
);

create table sticky_notes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade, -- מי כתב
  text text not null,
  note_date date not null, -- "יום ישראלי" שאליו שייך הפתק, מתאפס למחרת
  created_at timestamptz not null default now()
);
```

הערת עיצוב: סימון "בוצע" הוא שורה בטבלת `chore_completions` (ולא boolean על ה-chore עצמו), כדי שהתאפסות יומית תקרה אוטומטית בלי צורך ב-cron — המסך פשוט בודק אם קיימת רשומה עבור (chore, member, היום).

**החלטה טכנית (ברירת מחדל, לא נדרש אישור פעיל):**
- תאריך עברי: פונקציית המרה עצמאית ב-`lib/hebrewDate.ts`, ללא ספרייה חיצונית.
- מזג אוויר: proxy קטן דרך Open-Meteo עם caching קצר בצד השרת (כדי לא להפציץ את ה-API מפולינג הדשבורד).

## API

- `/api/chores` — `GET` (רשימת משימות פעילות + סטטוס השלמה של היום לכל חבר משויך), `POST` (יצירה)
- `/api/chores/[id]` — `PATCH`, `DELETE`
- `/api/chores/[id]/completions` — `POST { member_id }` (סימון/ביטול סימון להיום; toggle)
- `/api/sticky-notes` — `GET` (פתקי היום בלבד), `POST { text }`
- `/api/sticky-notes/[id]` — `DELETE`
- `/api/weather` — `GET`, שולף לפי lat/lon של המשפחה (proxy ל-Open-Meteo)
- `/api/dashboard/[dashboardToken]` — `GET` מרוכז: אירועי היום, משימות + השלמות היום, פתקי היום, מזג אוויר, שמות/צבעי בני משפחה. זו נקודת הקריאה היחידה של הטאבלט.
- כתיבות מהדשבורד (סימון משימה) הולכות ל-`/api/chores/[id]/completions`, מאומתות רק דרך `dashboardToken` (לא טוקן אישי) — הדשבורד הוא מכשיר פיזי מהימן בבית. בחירת "מי מסמן" נעשית בלחיצה על אווטאר בן/בת המשפחה בשורת המשימה, ו-`member_id` נשלח מפורשות בבקשה.
- הוספת/מחיקת פתקים מתבצעת רק דרך מסך הניהול (`/u/[token]/chores`), לא מהדשבורד עצמו.

אימות: `dashboardToken` הוא טוקן ברמת המשפחה (עמודה `families.dashboard_token`), מנוגן/מנוהל באותה תבנית כמו טוקן אישי — ניתן ליצור מחדש ("קישור חדש") ממסך ניהול המשפחה. בקשות ל-`/api/dashboard/[dashboardToken]` ולנקודות הכתיבה שהדשבורד קורא להן מאמתות מול עמודה זו במקום header של טוקן אישי.

## מסך ניהול "לו"ז יומי" (`/u/[token]/chores`)

פריט חדש בתפריט הצד (`SideMenu`), באותו סגנון של מסך ניהול המשפחה:

- רשימת משימות מחולקת לשתי קבוצות: **יומיומיות** ו**חד-פעמיות**
- טופס הוספה/עריכה (בדומה ל-`EventForm` הקיים): כותרת, סוג חזרתיות (יומיומי/חד-פעמי + בורר תאריך אם חד-פעמי), שיוך בני משפחה (multi-toggle כמו ב-events)
- ניהול פתקי היום: רשימה + הוספה (טקסט חופשי) + מחיקה

במסך ניהול המשפחה הקיים (`family/`) מתווספים:

- שדה מיקום — חיפוש עיר עם geocoding דרך Open-Meteo, שומר lat/lon + label לתצוגה
- לחצן "קישור לדשבורד" שמציג/יוצר מחדש את ה-URL של הטאבלט (`/d/<dashboard_token>`), באותה תבנית UX כמו יצירת/חידוש קישור אישי לבן משפחה

## מסך הדשבורד לטאבלט (`/d/[dashboardToken]`)

מסך עצמאי לגמרי (לא תחת `/u`), ללא ניווט/תפריט, מיועד לרוץ קבוע על טאבלט בעמדת landscape:

```
┌─────────────────────────────────────────────────────────┐
│  14:32 | יום שלישי, ה' בכסלו תשפ"ו | 27.11.2025 | ☀ 21°  │  ← At a Glance
├──────────────────────────┬────────────────────────────────┤
│      לו"ז היום (50%)      │      תורנויות ומשימות (50%)     │
│  08:00 ● רופא (דנה)       │  ☐ הורדת זבל   [👤👤]           │
│  16:00 ● חוג (יונתן)      │  ☑ שיעורים     [👤]            │
│         ...               │  ☐ ריקון מדיח  [👤👤👤]         │
├─────────────────────────────────────────────────────────┤
│ ⇠ "בהצלחה במבחן היום דנה!"    ⋅    "תזכורת: לקנות חלב" ⇠  │  ← סקרולר פתקים (רץ)
└─────────────────────────────────────────────────────────┘
```

- **At a Glance**: שעה (מתעדכנת כל שנייה בצד הלקוח), תאריך עברי + לועזי, מזג אוויר מקומי
- **עמודת לו"ז**: אירועי היום מטבלת `events` הקיימת, בצבע הייעודי של כל בן משפחה (`memberColors` הקיים), חלוקה לפי שעות
- **עמודת תורנויות ומשימות**: כל שורה מציגה אווטארים של המשויכים; לחיצה על אווטאר מסמנת/מבטלת סימון עבורו בלבד
- **סקרולר פתקים**: סרט טקסט רץ (marquee) לרוחב מלא בתחתית המסך; אם אין פתקים היום — מוסתר
- רענון: פולינג לנתונים (אירועים/משימות/פתקים) כאחת לדקה בערך; שעון מקומי מתעדכן כל שנייה; מזג אוויר מתרענן כל 15 דקות

## היקף

הכולל: מיגרציית DB אחת, endpoints חדשים, מסך ניהול חדש (`/u/[token]/chores`), תוספות קטנות למסך ניהול המשפחה (מיקום + קישור דשבורד), ומסך דשבורד עצמאי חדש (`/d/[dashboardToken]`). לא כולל: הרשאות admin נפרדות, היסטוריית ביצוע משימות (רק "היום"), עריכת פתקים אחרי יצירה (רק מחיקה).
