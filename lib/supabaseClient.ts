import { createClient } from "@supabase/supabase-js";

// Verbindung zu unserem Supabase-Projekt (kostenloser Free-Tier).
// URL und "anon"-Key kommen aus Umgebungsvariablen, die in Vercel unter
// Project Settings -> Environment Variables gesetzt werden müssen:
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY
//
// Der "anon"-Key ist bewusst öffentlich nutzbar (dafür gemacht, im Browser
// zu laufen) – der Zugriff auf echte Daten wird später über Row Level
// Security (RLS) in Supabase selbst eingeschränkt, nicht durch Geheimhaltung
// dieses Keys.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fehlt eine der beiden Variablen (z.B. weil sie in Vercel noch nicht
  // gesetzt wurden), bekommen wir hier eine klare Fehlermeldung statt eines
  // kryptischen Absturzes irgendwo tief im Code.
  console.warn(
    "Supabase-Umgebungsvariablen fehlen: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Diese müssen in Vercel unter Project Settings -> Environment Variables gesetzt sein."
  );
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "", {
  auth: {
    // Explizit statt nur auf die (identischen) Standardwerte zu vertrauen –
    // damit ist zweifelsfrei klar, dass die Sitzung im Browser gespeichert
    // und nach einem Neuladen automatisch wiederhergestellt werden soll.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
