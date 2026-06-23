import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

// Returns all app settings as a simple key -> value map.
export async function GET() {
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase.from("app_settings").select("key, value");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const settings: Record<string, string | null> = {};
    for (const row of data ?? []) {
      settings[row.key] = row.value;
    }

    return NextResponse.json({ settings });
  } catch (err) {
    console.error("Settings fetch error:", err);
    return NextResponse.json(
      { error: "Couldn't load settings. Try again." },
      { status: 500 }
    );
  }
}

// Updates one or more settings. Body: { allowedClockInIp?: string | null }
// An empty string or null clears the restriction (clock-in works anywhere).
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = getSupabaseServer();

    if (typeof body.allowedClockInIp !== "undefined") {
      const value = body.allowedClockInIp ? String(body.allowedClockInIp).trim() : null;

      // Basic IPv4 sanity check -- doesn't need to be exhaustive, just
      // catches obvious typos before they lock out the whole team.
      if (value && !/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) {
        return NextResponse.json(
          { error: "That doesn't look like a valid IPv4 address." },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "allowed_clock_in_ip", value, updated_at: new Date().toISOString() });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Settings update error:", err);
    return NextResponse.json(
      { error: "Couldn't save settings. Try again." },
      { status: 500 }
    );
  }
}
