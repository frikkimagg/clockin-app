import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

// Updates an existing time entry -- used by admins to fix a missed clock-out,
// correct a wrong time, or add a note.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await req.json();
    const supabase = getSupabaseServer();

    const update: Record<string, unknown> = {};

    if (typeof body.clockIn === "string") {
      const d = new Date(body.clockIn);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid clock-in time." }, { status: 400 });
      }
      update.clock_in = d.toISOString();
    }

    if (typeof body.clockOut === "string") {
      if (body.clockOut === "") {
        update.clock_out = null; // explicitly reopen the entry
      } else {
        const d = new Date(body.clockOut);
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json({ error: "Invalid clock-out time." }, { status: 400 });
        }
        update.clock_out = d.toISOString();
      }
    }

    if (typeof body.note === "string") {
      update.note = body.note || null;
    }

    if (typeof body.companyId !== "undefined") {
      update.company_id = body.companyId || null;
    }

    // If both ends are present in the update (or one is being changed while
    // the other already exists), make sure clock_out stays after clock_in.
    if (update.clock_in || update.clock_out) {
      const { data: existing, error: fetchError } = await supabase
        .from("time_entries")
        .select("clock_in, clock_out")
        .eq("id", id)
        .single();

      if (fetchError) {
        return NextResponse.json({ error: fetchError.message }, { status: 500 });
      }

      const finalIn = new Date((update.clock_in as string) ?? existing.clock_in);
      const finalOutRaw = "clock_out" in update ? update.clock_out : existing.clock_out;
      const finalOut = finalOutRaw ? new Date(finalOutRaw as string) : null;

      if (finalOut && finalOut.getTime() <= finalIn.getTime()) {
        return NextResponse.json(
          { error: "Clock-out must be after clock-in." },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabase
      .from("time_entries")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ entry: data });
  } catch (err) {
    console.error("Admin entry update error:", err);
    return NextResponse.json(
      { error: "Couldn't update entry. Try again." },
      { status: 500 }
    );
  }
}

// Deletes a manually-created or erroneous entry.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = getSupabaseServer();
    const { error } = await supabase.from("time_entries").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("Admin entry delete error:", err);
    return NextResponse.json(
      { error: "Couldn't delete entry. Try again." },
      { status: 500 }
    );
  }
}
