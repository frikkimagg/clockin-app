import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getClientIp, isAllowedClockInIp } from "@/lib/network";

// Toggles clock-in / clock-out for an employee. If there's an open entry
// (clock_out is null), this closes it. Otherwise it opens a new one.
// companyId is only used when clocking in, for employees who can clock in
// for more than one company -- it's validated server-side against that
// employee's allowed companies so the choice can't be spoofed via the API.
//
// Network restriction: admins can set an allowed IP in app_settings (via
// the admin dashboard). If set, regular staff can only clock in/out from
// that IP. Admins themselves (e.g. an accountant doing payroll remotely)
// are exempt and can clock in from anywhere.
export async function POST(req: NextRequest) {
  try {
    const { employeeId, companyId, note } = await req.json();

    if (!employeeId) {
      return NextResponse.json({ error: "Missing employeeId." }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id, is_admin")
      .eq("id", employeeId)
      .single();

    if (employeeError) {
      return NextResponse.json({ error: employeeError.message }, { status: 500 });
    }

    if (!employee.is_admin) {
      const { data: setting, error: settingError } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "allowed_clock_in_ip")
        .maybeSingle();

      if (settingError) {
        return NextResponse.json({ error: settingError.message }, { status: 500 });
      }

      const clientIp = getClientIp(req);
      if (!isAllowedClockInIp(clientIp, setting?.value ?? null)) {
        return NextResponse.json(
          {
            error:
              "Clock-in only works from the office network. Ask an admin if you need help.",
          },
          { status: 403 }
        );
      }
    }

    const { data: openEntry, error: lookupError } = await supabase
      .from("time_entries")
      .select("id, clock_in")
      .eq("employee_id", employeeId)
      .is("clock_out", null)
      .order("clock_in", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 500 });
    }

    if (openEntry) {
      // Clock out
      const { data, error } = await supabase
        .from("time_entries")
        .update({ clock_out: new Date().toISOString() })
        .eq("id", openEntry.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ action: "clocked_out", entry: data });
    } else {
      // Clock in. Figure out which companies this employee is allowed to
      // use, so we can validate any companyId sent from the client and
      // auto-fill it when there's exactly one option.
      const { data: allowedLinks, error: allowedError } = await supabase
        .from("employee_companies")
        .select("company_id")
        .eq("employee_id", employeeId);

      if (allowedError) {
        return NextResponse.json({ error: allowedError.message }, { status: 500 });
      }

      const allowedCompanyIds = (allowedLinks ?? []).map((l) => l.company_id);

      let resolvedCompanyId: string | null = null;
      if (allowedCompanyIds.length === 1) {
        // Only one option -- no need for the employee to have chosen.
        resolvedCompanyId = allowedCompanyIds[0];
      } else if (allowedCompanyIds.length > 1) {
        // Multiple options -- a companyId must be provided and must be one
        // of this employee's allowed companies.
        if (!companyId || !allowedCompanyIds.includes(companyId)) {
          return NextResponse.json(
            { error: "Pick which company you're clocking in for." },
            { status: 400 }
          );
        }
        resolvedCompanyId = companyId;
      }
      // If allowedCompanyIds.length === 0, resolvedCompanyId stays null --
      // employee isn't tied to a specific company, same as before.

      const { data, error } = await supabase
        .from("time_entries")
        .insert({
          employee_id: employeeId,
          company_id: resolvedCompanyId,
          clock_in: new Date().toISOString(),
          note: note || null,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ action: "clocked_in", entry: data });
    }
  } catch (err) {
    console.error("Clock error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
