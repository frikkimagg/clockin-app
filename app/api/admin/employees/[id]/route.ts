import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseServer } from "@/lib/supabase-server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await req.json();
    const supabase = getSupabaseServer();

    const update: Record<string, unknown> = {};
    if (typeof body.name === "string") update.name = body.name;
    if (typeof body.active === "boolean") update.active = body.active;
    if (typeof body.isAdmin === "boolean") update.is_admin = body.isAdmin;

    if (typeof body.pin === "string") {
      if (!/^\d{4,8}$/.test(body.pin)) {
        return NextResponse.json(
          { error: "PIN must be 4-8 digits." },
          { status: 400 }
        );
      }
      update.pin_hash = await bcrypt.hash(body.pin, 10);
    }

    // companyIds, if provided, replaces the employee's full set of allowed
    // companies. company_id (singular) is kept in sync as a "primary"
    // reference for backward compatibility, set to the first id or null.
    if (Array.isArray(body.companyIds)) {
      const ids: string[] = body.companyIds.filter(Boolean);
      update.company_id = ids[0] ?? null;

      const { error: deleteError } = await supabase
        .from("employee_companies")
        .delete()
        .eq("employee_id", id);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      if (ids.length > 0) {
        const { error: insertError } = await supabase
          .from("employee_companies")
          .insert(ids.map((companyId) => ({ employee_id: id, company_id: companyId })));

        if (insertError) {
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }
      }
    }

    const { data, error } = await supabase
      .from("employees")
      .update(update)
      .eq("id", id)
      .select("id, name, company_id, is_admin, active")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ employee: data });
  } catch (err) {
    console.error("Employee update error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
