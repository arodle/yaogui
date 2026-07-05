DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO yaogui', r.tablename);
  END LOOP;

  FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER SEQUENCE public.%I OWNER TO yaogui', r.sequencename);
  END LOOP;
END $$;

GRANT USAGE, CREATE ON SCHEMA public TO yaogui;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO yaogui;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO yaogui;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO yaogui;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO yaogui;
