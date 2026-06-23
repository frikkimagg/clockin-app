import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { currentFortnightRange } from "@/lib/fortnight";

// Returns the current fortnight's shifts for one employee, plus a running
// total. This is self-service (no admin PIN needed) -- an employee can
// look up their own hours after entering their own PIN, but only ever sees
// their own data since employeeId comes from their own authenticated PIN
// check on the client, not something they can pick.
export async function GET(req: NextRequest) {
  const employeeId = req.nextUrl.searchParams.get("employeeId");
  if (!employeeId) {
    return NextResponse.json({ error: "Missing employeeId." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServer();
    const { start, end } = currentFortnightRange();

    const { data, error } = await supabase
      .from("time_entries")
      .select("id, clock_in, clock_out, companies ( id, name )")
      .eq("employee_id", employeeId)
      .gte("clock_in", start.toISOString())
      .lte("clock_in", end.toISOString())
      .order("clock_in", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const totalMs = (data ?? []).reduce((sum, e) => {
      const inT = new Date(e.clock_in).getTime();
      const outT = e.clock_out ? new Date(e.clock_out).getTime() : Date.now();
      return sum + (outT - inT);
    }, 0);

    return NextResponse.json({
      entries: data ?? [],
      totalMs,
      fortnightStart: start.toISOString(),
      fortnightEnd: end.toISOString(),
    });
  } catch (err) {
    console.error("My-hours error:", err);
    return NextResponse.json(
      { error: "Couldn't load your hours. Try again." },
      { status: 500 }
    );
  }
}
