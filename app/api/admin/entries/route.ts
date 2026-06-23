import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

// Returns time entries joined with employee + company names, for the admin
// dashboard. Optionally filtered by date range.
export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  try {
    const supabase = getSupabaseServer();

    let query = supabase
      .from("time_entries")
      .select(
        `id, clock_in, clock_out, note,
         employees ( id, name ),
         companies ( id, name )`
      )
      .order("clock_in", { ascending: false });

    if (from) query = query.gte("clock_in", from);
    if (to) query = query.lte("clock_in", to);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ entries: data });
  } catch (err) {
    console.error("Admin entries error:", err);
    return NextResponse.json(
      { error: "Couldn't load entries. Try again." },
      { status: 500 }
    );
  }
}

// Manually creates a time entry, for when someone forgot to clock in or out.
// clock_out may be omitted to create an open (still-active) entry.
export async function POST(req: NextRequest) {
  try {
    const { employeeId, companyId, clockIn, clockOut, note } = await req.json();

    if (!employeeId || !clockIn) {
      return NextResponse.json(
        { error: "Employee and clock-in time are required." },
        { status: 400 }
      );
    }

    const clockInDate = new Date(clockIn);
    if (Number.isNaN(clockInDate.getTime())) {
      return NextResponse.json({ error: "Invalid clock-in time." }, { status: 400 });
    }

    let clockOutDate: Date | null = null;
    if (clockOut) {
      clockOutDate = new Date(clockOut);
      if (Number.isNaN(clockOutDate.getTime())) {
        return NextResponse.json({ error: "Invalid clock-out time." }, { status: 400 });
      }
      if (clockOutDate.getTime() <= clockInDate.getTime()) {
        return NextResponse.json(
          { error: "Clock-out must be after clock-in." },
          { status: 400 }
        );
      }
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("time_entries")
      .insert({
        employee_id: employeeId,
        company_id: companyId || null,
        clock_in: clockInDate.toISOString(),
        clock_out: clockOutDate ? clockOutDate.toISOString() : null,
        note: note || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ entry: data });
  } catch (err) {
    console.error("Admin entry create error:", err);
    return NextResponse.json(
      { error: "Couldn't create entry. Try again." },
      { status: 500 }
    );
  }
}
