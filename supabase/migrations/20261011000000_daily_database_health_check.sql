-- Keep a small daily database health check in the migration history.
-- Supabase Cron runs this SQL inside Postgres at 00:00 UTC each day.

create extension if not exists pg_cron;

select cron.schedule(
  'daily-database-health-check',
  '0 0 * * *',
  'select 1;'
);
