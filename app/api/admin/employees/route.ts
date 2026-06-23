import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseServer } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("employees")
      .select(
        `id, name, company_id, is_admin, active,
         employee_companies ( companies ( id, name ) )`
      )
      .order("name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Flatten employee_companies -> companies into a simple array per
    // employee, so the admin UI doesn't need to know about the join table.
    // Supabase's generated types can represent the nested "companies"
    // relation as either an object or an array depending on inference, so
    // we normalize both shapes here rather than fighting the type checker.
    const employees = (data ?? []).map((emp) => {
      const links = emp.employee_companies ?? [];
      const companyList: { id: string; name: string }[] = [];

      for (const link of links) {
        const c = link.companies as
          | { id: string; name: string }
          | { id: string; name: string }[]
          | null;
        if (Array.isArray(c)) {
          companyList.push(...c);
        } else if (c) {
          companyList.push(c);
        }
      }

      return {
        ...emp,
        companies: companyList,
        employee_companies: undefined,
      };
    });

    return NextResponse.json({ employees });
  } catch (err) {
    console.error("Employees list error:", err);
    return NextResponse.json(
      { error: "Couldn't load employees. Try again." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, pin, companyIds, isAdmin } = await req.json();

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    if (!pin || typeof pin !== "string" || !/^\d{4,8}$/.test(pin)) {
      return NextResponse.json(
        { error: "PIN must be 4-8 digits." },
        { status: 400 }
      );
    }

    const ids: string[] = Array.isArray(companyIds) ? companyIds.filter(Boolean) : [];

    const supabase = getSupabaseServer();

    // Make sure this PIN doesn't collide with an existing active employee's PIN
    const { data: employees, error: lookupError } = await supabase
      .from("employees")
      .select("pin_hash")
      .eq("active", true);

    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 500 });
    }

    for (const emp of employees ?? []) {
      if (await bcrypt.compare(pin, emp.pin_hash)) {
        return NextResponse.json(
          { error: "That PIN is already in use. Pick a different one." },
          { status: 409 }
        );
      }
    }

    const pin_hash = await bcrypt.hash(pin, 10);

    // company_id keeps the first selected company as a simple "primary"
    // reference for backward compatibility; the real source of truth for
    // clock-in choices is the employee_companies join table below.
    const { data, error } = await supabase
      .from("employees")
      .insert({
        name,
        pin_hash,
        company_id: ids[0] ?? null,
        is_admin: !!isAdmin,
      })
      .select("id, name, company_id, is_admin, active")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (ids.length > 0) {
      const { error: linkError } = await supabase
        .from("employee_companies")
        .insert(ids.map((companyId) => ({ employee_id: data.id, company_id: companyId })));

      if (linkError) {
        return NextResponse.json({ error: linkError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ employee: data });
  } catch (err) {
    console.error("Employee create error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
