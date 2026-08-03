-- Run this in the Supabase SQL editor AFTER the app is deployed to Vercel.
-- Requires the "pg_cron" and "pg_net" extensions (enable them under
-- Database > Extensions in the Supabase dashboard first).
--
-- Replace <YOUR-DEPLOYED-URL> and <YOUR-CRON-SECRET> with the real values
-- (the same CRON_SECRET you set as a Vercel environment variable).

select cron.schedule(
  'send-due-reminders',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := 'https://<YOUR-DEPLOYED-URL>/api/cron/reminders',
    headers := jsonb_build_object('x-cron-secret', '<YOUR-CRON-SECRET>')
  );
  $$
);

-- To check scheduled jobs:
-- select * from cron.job;
-- To remove it:
-- select cron.unschedule('send-due-reminders');
