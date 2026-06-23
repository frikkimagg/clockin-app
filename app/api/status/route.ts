import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const employeeId = req.nextUrl.searchParams.get("employeeId");
  if (!employeeId) {
    return NextResponse.json({ error: "Missing employeeId." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("time_entries")
      .select("id, clock_in")
      .eq("employee_id", employeeId)
      .is("clock_out", null)
      .order("clock_in", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      clockedIn: !!data,
      openEntry: data ?? null,
    });
  } catch (err) {
    console.error("Status error:", err);
    return NextResponse.json(
      { error: "Couldn't check status. Try again." },
      { status: 500 }
    );
  }
}
