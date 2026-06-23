import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseServer } from "@/lib/supabase-server";

// Verifies a PIN against all active employees' hashes and returns the
// matching employee. PINs are short (4 digits), so we don't look up by PIN
// directly -- we hash-compare against stored hashes. With a small team this
// is cheap; if the roster grows large, switch to a PIN -> employee_id lookup
// table keyed by a fast hash instead.
export async function POST(req: NextRequest) {
  try {
    const { pin } = await req.json();

    if (!pin || typeof pin !== "string" || !/^\d{4,8}$/.test(pin)) {
      return NextResponse.json(
        { error: "Enter a valid PIN." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const { data: employees, error } = await supabase
      .from("employees")
      .select("id, name, pin_hash, company_id, is_admin, active")
      .eq("active", true);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    for (const emp of employees ?? []) {
      const matches = await bcrypt.compare(pin, emp.pin_hash);
      if (matches) {
        const { data: companyLinks, error: companiesError } = await supabase
          .from("employee_companies")
          .select("company_id, companies ( id, name )")
          .eq("employee_id", emp.id);

        if (companiesError) {
          return NextResponse.json({ error: companiesError.message }, { status: 500 });
        }

        const companies: { id: string; name: string }[] = [];
        for (const link of companyLinks ?? []) {
          const c = link.companies as
            | { id: string; name: string }
            | { id: string; name: string }[]
            | null;
          if (Array.isArray(c)) {
            companies.push(...c);
          } else if (c) {
            companies.push(c);
          }
        }

        return NextResponse.json({
          employee: {
            id: emp.id,
            name: emp.name,
            company_id: emp.company_id,
            is_admin: emp.is_admin,
            active: emp.active,
            companies,
          },
        });
      }
    }

    return NextResponse.json({ error: "PIN not recognized." }, { status: 401 });
  } catch (err) {
    console.error("Auth error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
