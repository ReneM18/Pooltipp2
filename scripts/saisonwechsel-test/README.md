Datenbank-Test für supabase/saisonwechsel.sql (lokales PostgreSQL, nicht Supabase):

    createdb t
    psql -d t -f setup.sql
    psql -d t -f ../../supabase/saisonwechsel.sql
    psql -d t -f ../../supabase/saisonwechsel.sql   # zweimal: muss gefahrlos sein
    psql -d t -f test.sql                           # jede Zeile "ok: ..."
