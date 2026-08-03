# תזכורות המשפחה

מערכת תזכורות ומועדים לבני הבית: כל אחד מזין מועדים (תורים, אירועים וכו'),
מסמן למי הם רלוונטיים, ומקבל תזכורת בדפדפן (ובמייל כגיבוי) בזמן שהוגדר. יש גם
שורת חיפוש שמאפשרת לשאול בשפה טבעית ("מתי התור שלי לרופא?").

## הרצה מקומית

```bash
npm install
npm run dev
```

יש למלא את `.env.local` (ראה `.env.local.example` לרשימת המשתנים).

## הקמה מאפס (חד-פעמי)

### 1. Supabase (מסד נתונים)

1. צרו פרויקט חדש ב-[supabase.com](https://supabase.com) (חינמי).
2. ב-SQL editor, הריצו את `supabase/migrations/0001_init.sql`.
3. תחת Project Settings → API, העתיקו את ה-`Project URL` וה-`service_role` key
   (לא ה-anon key!) אל `SUPABASE_URL` ו-`SUPABASE_SERVICE_ROLE_KEY`.

### 2. מפתחות VAPID (Web Push)

```bash
npx web-push generate-vapid-keys --json
```

הכניסו את הערכים ל-`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, ול-
`NEXT_PUBLIC_VAPID_PUBLIC_KEY` (זהה ל-`VAPID_PUBLIC_KEY`).

### 3. Resend (מייל גיבוי)

1. הרשמו בחינם ב-[resend.com](https://resend.com).
2. צרו API key והכניסו ל-`RESEND_API_KEY`.
3. ברירת המחדל שולחת מ-`onboarding@resend.dev` (תקין לבדיקות/שימוש אישי; כדי
   לשלוח לכל בני המשפחה בלי הגבלות כדאי בהמשך לאמת דומיין משלכם ב-Resend
   ולעדכן את הכתובת ב-`lib/email.ts`).

### 4. Anthropic API (חיפוש בשפה טבעית)

צרו API key ב-[console.anthropic.com](https://console.anthropic.com) והכניסו
ל-`ANTHROPIC_API_KEY`.

### 5. CRON_SECRET

בחרו מחרוזת אקראית ארוכה כלשהי (לדוגמה `openssl rand -hex 32`) והכניסו
ל-`CRON_SECRET`. זה מגן על נקודת הקצה ששולחת תזכורות מפני קריאות לא מורשות.

### 6. פריסה ל-Vercel

1. חברו את הריפו ל-[vercel.com](https://vercel.com) (חינמי).
2. הוסיפו את כל משתני הסביבה מ-`.env.local` תחת Project Settings →
   Environment Variables.
3. פרסו.

### 7. תזמון שליחת תזכורות (pg_cron)

לאחר הפריסה, הריצו את `supabase/cron-setup.sql` ב-SQL editor של Supabase
(אחרי הפעלת ההרחבות `pg_cron` ו-`pg_net` תחת Database → Extensions), עם ה-URL
שקיבלתם מ-Vercel וה-`CRON_SECRET` שבחרתם.

## שימוש

1. היכנסו לאתר - בפעם הראשונה תוצג טופס הקמה: שם המשפחה + השם שלכם. זה ייצור
   קישור אישי (`/u/<token>`) - שמרו אותו/הוסיפו לעמוד הבית בטלפון.
2. מהעמוד האישי אפשר להוסיף בני משפחה נוספים - כל אחד מקבל קישור אישי משלו
   (מוצג פעם אחת בלבד בעת היצירה - יש לשלוח לו את הקישור).
3. הוספת מועד: כותרת, תאריך ושעה, למי הוא רלוונטי (כולם או בני משפחה נבחרים),
   ואילו תזכורות לקבל.
4. לחצו "הפעל התראות בדפדפן" כדי לקבל תזכורות Push (נדרש בכל מכשיר/דפדפן
   בנפרד).
5. שורת החיפוש למעלה עונה על שאלות חופשיות לגבי המועדים שלכם.

## מה לא נכלל בגרסה הזו

מועדים חוזרים (recurring), שליחת תזכורות אמיתיות ל-WhatsApp (מתוכנן לשלב
הבא, דרך Twilio WhatsApp API), ריבוי משפחות באותה מערכת.
