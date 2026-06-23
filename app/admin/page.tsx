"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PinPad from "../components/PinPad";

type Employee = {
  id: string;
  name: string;
  company_id: string | null;
  is_admin: boolean;
  active: boolean;
  companies?: { id: string; name: string }[];
};

type Company = { id: string; name: string };

type Entry = {
  id: string;
  clock_in: string;
  clock_out: string | null;
  note: string | null;
  employees: { id: string; name: string } | null;
  companies: { id: string; name: string } | null;
};

function formatDuration(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

// Always 24-hour time (hour12: false), regardless of the browser's locale
// defaults -- some locales/browsers show AM/PM even with dateStyle/timeStyle
// "short" unless this is set explicitly.
function formatDateTime(d: Date) {
  return d.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
    hour12: false,
  });
}

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Returns the start (midnight) of the 14-day period containing `anchor`,
// counting in fixed 14-day blocks from a fixed reference date. This keeps
// fortnight boundaries stable and predictable rather than drifting.
// Reference: Friday 19 June 2026, the start of the current pay fortnight.
function fortnightStart(anchor: Date) {
  const referenceFriday = new Date("2026-06-19T00:00:00");
  const dayMs = 86400000;
  const daysSince = Math.floor((anchor.getTime() - referenceFriday.getTime()) / dayMs);
  const fortnightIndex = Math.floor(daysSince / 14);
  return new Date(referenceFriday.getTime() + fortnightIndex * 14 * dayMs);
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [tab, setTab] = useState<"hours" | "payroll" | "team" | "settings">("hours");

  const [entries, setEntries] = useState<Entry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);

  const today = new Date();
  const defaultStart = fortnightStart(today);
  const defaultEnd = new Date(defaultStart.getTime() + 14 * 86400000 - 1000);

  const [rangeStart, setRangeStart] = useState(toDateInputValue(defaultStart));
  const [rangeEnd, setRangeEnd] = useState(toDateInputValue(defaultEnd));

  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newCompanyIds, setNewCompanyIds] = useState<string[]>([]);
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formBusy, setFormBusy] = useState(false);

  // Editing an existing employee's company assignments
  const [editingCompaniesFor, setEditingCompaniesFor] = useState<Employee | null>(null);
  const [editCompanyIds, setEditCompanyIds] = useState<string[]>([]);
  const [editCompaniesError, setEditCompaniesError] = useState<string | null>(null);
  const [editCompaniesBusy, setEditCompaniesBusy] = useState(false);

  // Manual entry add/edit
  const [manualOpen, setManualOpen] = useState(false);
  const [manualEditingId, setManualEditingId] = useState<string | null>(null);
  const [manualEmployeeId, setManualEmployeeId] = useState("");
  const [manualCompanyId, setManualCompanyId] = useState("");
  const [manualClockIn, setManualClockIn] = useState("");
  const [manualClockOut, setManualClockOut] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualBusy, setManualBusy] = useState(false);

  // Network restriction setting
  const [allowedIpInput, setAllowedIpInput] = useState("");
  const [allowedIpSaved, setAllowedIpSaved] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsSavedMessage, setSettingsSavedMessage] = useState(false);

  async function checkAdminPin(pin: string) {
    setAuthError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok || !data.employee?.is_admin) {
        setAuthError("That PIN doesn't have admin access.");
        return;
      }
      setAuthed(true);
    } catch {
      setAuthError("Couldn't connect. Try again.");
    }
  }

  async function loadAll() {
    setLoading(true);
    try {
      const [entriesRes, employeesRes, companiesRes, settingsRes] = await Promise.all([
        fetch("/api/admin/entries"),
        fetch("/api/admin/employees"),
        fetch("/api/admin/companies"),
        fetch("/api/admin/settings"),
      ]);
      const [entriesData, employeesData, companiesData, settingsData] = await Promise.all([
        entriesRes.json(),
        employeesRes.json(),
        companiesRes.json(),
        settingsRes.json(),
      ]);
      setEntries(entriesData.entries ?? []);
      setEmployees(employeesData.employees ?? []);
      setCompanies(companiesData.companies ?? []);
      const ip = settingsData.settings?.allowed_clock_in_ip ?? "";
      setAllowedIpSaved(ip || null);
      setAllowedIpInput(ip ?? "");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authed) loadAll();
  }, [authed]);

  async function addEmployee() {
    setFormError(null);
    if (!newName.trim()) {
      setFormError("Name is required.");
      return;
    }
    if (!/^\d{4,8}$/.test(newPin)) {
      setFormError("PIN must be 4-8 digits.");
      return;
    }
    setFormBusy(true);
    try {
      const res = await fetch("/api/admin/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          pin: newPin,
          companyIds: newCompanyIds,
          isAdmin: newIsAdmin,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Couldn't add employee.");
        return;
      }
      setNewName("");
      setNewPin("");
      setNewCompanyIds([]);
      setNewIsAdmin(false);
      loadAll();
    } catch {
      setFormError("Couldn't connect. Try again.");
    } finally {
      setFormBusy(false);
    }
  }

  function toggleNewCompany(companyId: string) {
    setNewCompanyIds((prev) =>
      prev.includes(companyId) ? prev.filter((id) => id !== companyId) : [...prev, companyId]
    );
  }

  async function toggleActive(emp: Employee) {
    await fetch(`/api/admin/employees/${emp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !emp.active }),
    });
    loadAll();
  }

  function openEditCompanies(emp: Employee) {
    setEditingCompaniesFor(emp);
    setEditCompanyIds((emp.companies ?? []).map((c) => c.id));
    setEditCompaniesError(null);
  }

  function toggleEditCompany(companyId: string) {
    setEditCompanyIds((prev) =>
      prev.includes(companyId) ? prev.filter((id) => id !== companyId) : [...prev, companyId]
    );
  }

  async function saveEditCompanies() {
    if (!editingCompaniesFor) return;
    setEditCompaniesBusy(true);
    setEditCompaniesError(null);
    try {
      const res = await fetch(`/api/admin/employees/${editingCompaniesFor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyIds: editCompanyIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditCompaniesError(data.error || "Couldn't save.");
        return;
      }
      setEditingCompaniesFor(null);
      loadAll();
    } catch {
      setEditCompaniesError("Couldn't connect. Try again.");
    } finally {
      setEditCompaniesBusy(false);
    }
  }

  // datetime-local inputs need "YYYY-MM-DDTHH:mm" in local time (no timezone
  // suffix), so we can't just use toISOString() -- that's UTC.
  function toDatetimeLocalValue(d: Date) {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  }

  function openManualAdd() {
    setManualEditingId(null);
    setManualEmployeeId(employees.find((e) => e.active)?.id ?? "");
    setManualCompanyId("");
    setManualClockIn(toDatetimeLocalValue(new Date()));
    setManualClockOut("");
    setManualNote("");
    setManualError(null);
    setManualOpen(true);
  }

  function openManualEdit(entry: Entry) {
    setManualEditingId(entry.id);
    setManualEmployeeId(entry.employees?.id ?? "");
    setManualCompanyId(entry.companies?.id ?? "");
    setManualClockIn(toDatetimeLocalValue(new Date(entry.clock_in)));
    setManualClockOut(entry.clock_out ? toDatetimeLocalValue(new Date(entry.clock_out)) : "");
    setManualNote(entry.note ?? "");
    setManualError(null);
    setManualOpen(true);
  }

  function closeManual() {
    setManualOpen(false);
    setManualEditingId(null);
    setManualError(null);
  }

  async function saveManualEntry() {
    setManualError(null);
    if (!manualEmployeeId) {
      setManualError("Pick an employee.");
      return;
    }
    if (!manualClockIn) {
      setManualError("Clock-in time is required.");
      return;
    }
    if (manualClockOut && new Date(manualClockOut) <= new Date(manualClockIn)) {
      setManualError("Clock-out must be after clock-in.");
      return;
    }

    setManualBusy(true);
    try {
      const payload = {
        employeeId: manualEmployeeId,
        companyId: manualCompanyId || null,
        clockIn: new Date(manualClockIn).toISOString(),
        clockOut: manualClockOut ? new Date(manualClockOut).toISOString() : null,
        note: manualNote.trim() || null,
      };

      const res = manualEditingId
        ? await fetch(`/api/admin/entries/${manualEditingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/entries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      const data = await res.json();
      if (!res.ok) {
        setManualError(data.error || "Couldn't save entry.");
        return;
      }

      closeManual();
      loadAll();
    } catch {
      setManualError("Couldn't connect. Try again.");
    } finally {
      setManualBusy(false);
    }
  }

  async function deleteManualEntry(id: string) {
    if (!confirm("Delete this entry? This can't be undone.")) return;
    await fetch(`/api/admin/entries/${id}`, { method: "DELETE" });
    loadAll();
  }

  async function saveAllowedIp() {
    setSettingsError(null);
    setSettingsSavedMessage(false);
    setSettingsBusy(true);
    try {
      const trimmed = allowedIpInput.trim();
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowedClockInIp: trimmed || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSettingsError(data.error || "Couldn't save.");
        return;
      }
      setAllowedIpSaved(trimmed || null);
      setSettingsSavedMessage(true);
      setTimeout(() => setSettingsSavedMessage(false), 2500);
    } catch {
      setSettingsError("Couldn't connect. Try again.");
    } finally {
      setSettingsBusy(false);
    }
  }

  function clearAllowedIp() {
    setAllowedIpInput("");
  }

  function shiftFortnight(direction: -1 | 1) {
    const start = new Date(rangeStart + "T00:00:00");
    const newStart = new Date(start.getTime() + direction * 14 * 86400000);
    const newEnd = new Date(newStart.getTime() + 14 * 86400000 - 1000);
    setRangeStart(toDateInputValue(newStart));
    setRangeEnd(toDateInputValue(newEnd));
  }

  function resetToCurrentFortnight() {
    const start = fortnightStart(new Date());
    const end = new Date(start.getTime() + 14 * 86400000 - 1000);
    setRangeStart(toDateInputValue(start));
    setRangeEnd(toDateInputValue(end));
  }

  // Inclusive range filter on clock_in, using the local-day boundaries of
  // the chosen start/end dates.
  const rangeStartMs = new Date(rangeStart + "T00:00:00").getTime();
  const rangeEndMs = new Date(rangeEnd + "T23:59:59.999").getTime();

  const payrollEntries = entries.filter((e) => {
    const t = new Date(e.clock_in).getTime();
    return t >= rangeStartMs && t <= rangeEndMs;
  });

  const payrollTotalMs = payrollEntries.reduce((sum, e) => {
    const inT = new Date(e.clock_in).getTime();
    const outT = e.clock_out ? new Date(e.clock_out).getTime() : Date.now();
    return sum + (outT - inT);
  }, 0);

  function downloadCsv() {
    const header = ["Employee", "Company", "Clock in", "Clock out", "Duration (h)", "Note"];
    const rows = payrollEntries.map((e) => {
      const inT = new Date(e.clock_in);
      const outT = e.clock_out ? new Date(e.clock_out) : null;
      const durMs = (outT ? outT.getTime() : Date.now()) - inT.getTime();
      const durHours = (durMs / 3600000).toFixed(2);
      return [
        e.employees?.name ?? "",
        e.companies?.name ?? "",
        formatDateTime(inT),
        outT ? formatDateTime(outT) : "Active",
        durHours,
        e.note ?? "",
      ];
    });

    const escapeCsv = (val: string) => {
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => escapeCsv(String(cell))).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll_${rangeStart}_to_${rangeEnd}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (!authed) {
    return (
      <main
        className="flex-1 flex flex-col items-center justify-center min-h-screen px-6 gap-8"
        style={{ background: "var(--ink)" }}
      >
        <div className="flex flex-col items-center gap-2">
          <span
            className="font-display uppercase tracking-[0.25em] text-xs"
            style={{ color: "var(--paper-dim)" }}
          >
            Admin Access
          </span>
          <p className="text-sm" style={{ color: "var(--paper-dim)" }}>
            Enter an admin PIN
          </p>
        </div>
        <PinPad onSubmit={checkAdminPin} />
        {authError && (
          <p className="text-sm" style={{ color: "var(--danger)" }} role="alert">
            {authError}
          </p>
        )}
        <Link href="/" className="text-xs underline-offset-4 hover:underline" style={{ color: "var(--paper-dim)" }}>
          Back to clock
        </Link>
      </main>
    );
  }

  // Compute today's currently-clocked-in list
  const openNow = entries.filter((e) => !e.clock_out);

  return (
    <main className="min-h-screen px-6 py-10 max-w-4xl mx-auto" style={{ background: "var(--ink)" }}>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-display text-2xl" style={{ color: "var(--paper)" }}>
            Admin
          </h1>
          <p className="text-sm" style={{ color: "var(--paper-dim)" }}>
            {openNow.length} clocked in right now
          </p>
        </div>
        <Link href="/" className="text-xs underline-offset-4 hover:underline" style={{ color: "var(--paper-dim)" }}>
          Back to clock
        </Link>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("hours")}
          className="font-display uppercase text-xs tracking-wide px-4 py-2 rounded-lg"
          style={{
            background: tab === "hours" ? "var(--ink-raised)" : "transparent",
            color: tab === "hours" ? "var(--paper)" : "var(--paper-dim)",
            border: "1px solid var(--ink-line)",
          }}
        >
          Hours
        </button>
        <button
          onClick={() => setTab("payroll")}
          className="font-display uppercase text-xs tracking-wide px-4 py-2 rounded-lg"
          style={{
            background: tab === "payroll" ? "var(--ink-raised)" : "transparent",
            color: tab === "payroll" ? "var(--paper)" : "var(--paper-dim)",
            border: "1px solid var(--ink-line)",
          }}
        >
          Payroll
        </button>
        <button
          onClick={() => setTab("team")}
          className="font-display uppercase text-xs tracking-wide px-4 py-2 rounded-lg"
          style={{
            background: tab === "team" ? "var(--ink-raised)" : "transparent",
            color: tab === "team" ? "var(--paper)" : "var(--paper-dim)",
            border: "1px solid var(--ink-line)",
          }}
        >
          Team
        </button>
        <button
          onClick={() => setTab("settings")}
          className="font-display uppercase text-xs tracking-wide px-4 py-2 rounded-lg"
          style={{
            background: tab === "settings" ? "var(--ink-raised)" : "transparent",
            color: tab === "settings" ? "var(--paper)" : "var(--paper-dim)",
            border: "1px solid var(--ink-line)",
          }}
        >
          Settings
        </button>
      </div>

      {loading && (
        <p className="text-sm" style={{ color: "var(--paper-dim)" }}>
          Loading…
        </p>
      )}

      {!loading && tab === "hours" && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-end">
            <button
              onClick={openManualAdd}
              className="font-display uppercase tracking-wide text-xs px-4 py-2 rounded-lg"
              style={{ background: "var(--ice)", color: "var(--ink)" }}
            >
              + Add manual entry
            </button>
          </div>
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--ink-line)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--ink-raised)" }}>
                <th className="text-left px-4 py-3 font-display uppercase text-xs tracking-wide" style={{ color: "var(--paper-dim)" }}>
                  Employee
                </th>
                <th className="text-left px-4 py-3 font-display uppercase text-xs tracking-wide" style={{ color: "var(--paper-dim)" }}>
                  Company
                </th>
                <th className="text-left px-4 py-3 font-display uppercase text-xs tracking-wide" style={{ color: "var(--paper-dim)" }}>
                  Clock in
                </th>
                <th className="text-left px-4 py-3 font-display uppercase text-xs tracking-wide" style={{ color: "var(--paper-dim)" }}>
                  Clock out
                </th>
                <th className="text-left px-4 py-3 font-display uppercase text-xs tracking-wide" style={{ color: "var(--paper-dim)" }}>
                  Duration
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center" style={{ color: "var(--paper-dim)" }}>
                    No entries yet.
                  </td>
                </tr>
              )}
              {entries.map((e) => {
                const inT = new Date(e.clock_in);
                const outT = e.clock_out ? new Date(e.clock_out) : null;
                const dur = outT ? outT.getTime() - inT.getTime() : Date.now() - inT.getTime();
                return (
                  <tr key={e.id} style={{ borderTop: "1px solid var(--ink-line)" }}>
                    <td className="px-4 py-3" style={{ color: "var(--paper)" }}>
                      {e.employees?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--paper-dim)" }}>
                      {e.companies?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-num" style={{ color: "var(--paper-dim)" }}>
                      {formatDateTime(inT)}
                    </td>
                    <td className="px-4 py-3 font-num" style={{ color: "var(--paper-dim)" }}>
                      {outT ? formatDateTime(outT) : "Active"}
                    </td>
                    <td className="px-4 py-3 font-num" style={{ color: !outT ? "var(--ice)" : "var(--paper)" }}>
                      {formatDuration(dur)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => openManualEdit(e)}
                        className="text-xs underline-offset-4 hover:underline mr-3"
                        style={{ color: "var(--paper-dim)" }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteManualEntry(e.id)}
                        className="text-xs underline-offset-4 hover:underline"
                        style={{ color: "var(--danger)" }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {!loading && tab === "payroll" && (
        <div className="flex flex-col gap-6">
          <div
            className="rounded-xl p-5 flex flex-wrap items-end gap-4"
            style={{ background: "var(--ink-raised)", border: "1px solid var(--ink-line)" }}
          >
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide" style={{ color: "var(--paper-dim)" }}>
                From
              </label>
              <input
                type="date"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                className="rounded-lg px-3 py-2 text-sm outline-none font-num"
                style={{ background: "var(--ink)", border: "1px solid var(--ink-line)", color: "var(--paper)" }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide" style={{ color: "var(--paper-dim)" }}>
                To
              </label>
              <input
                type="date"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="rounded-lg px-3 py-2 text-sm outline-none font-num"
                style={{ background: "var(--ink)", border: "1px solid var(--ink-line)", color: "var(--paper)" }}
              />
            </div>

            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => shiftFortnight(-1)}
                className="text-xs px-3 py-2 rounded-lg"
                style={{ border: "1px solid var(--ink-line)", color: "var(--paper-dim)" }}
              >
                ← Prev fortnight
              </button>
              <button
                onClick={resetToCurrentFortnight}
                className="text-xs px-3 py-2 rounded-lg"
                style={{ border: "1px solid var(--ink-line)", color: "var(--paper-dim)" }}
              >
                Current fortnight
              </button>
              <button
                onClick={() => shiftFortnight(1)}
                className="text-xs px-3 py-2 rounded-lg"
                style={{ border: "1px solid var(--ink-line)", color: "var(--paper-dim)" }}
              >
                Next fortnight →
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-sm" style={{ color: "var(--paper-dim)" }}>
              {payrollEntries.length} shift{payrollEntries.length === 1 ? "" : "s"} · total{" "}
              <span style={{ color: "var(--ice)" }}>{formatDuration(payrollTotalMs)}</span>
            </p>
            <button
              onClick={downloadCsv}
              disabled={payrollEntries.length === 0}
              className="font-display uppercase tracking-wide text-xs px-4 py-2 rounded-lg disabled:opacity-40"
              style={{ background: "var(--ice)", color: "var(--ink)" }}
            >
              Download CSV
            </button>
          </div>

          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--ink-line)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--ink-raised)" }}>
                  <th className="text-left px-4 py-3 font-display uppercase text-xs tracking-wide" style={{ color: "var(--paper-dim)" }}>
                    Employee
                  </th>
                  <th className="text-left px-4 py-3 font-display uppercase text-xs tracking-wide" style={{ color: "var(--paper-dim)" }}>
                    Company
                  </th>
                  <th className="text-left px-4 py-3 font-display uppercase text-xs tracking-wide" style={{ color: "var(--paper-dim)" }}>
                    Clock in
                  </th>
                  <th className="text-left px-4 py-3 font-display uppercase text-xs tracking-wide" style={{ color: "var(--paper-dim)" }}>
                    Clock out
                  </th>
                  <th className="text-left px-4 py-3 font-display uppercase text-xs tracking-wide" style={{ color: "var(--paper-dim)" }}>
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody>
                {payrollEntries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center" style={{ color: "var(--paper-dim)" }}>
                      No shifts in this period.
                    </td>
                  </tr>
                )}
                {payrollEntries.map((e) => {
                  const inT = new Date(e.clock_in);
                  const outT = e.clock_out ? new Date(e.clock_out) : null;
                  const dur = outT ? outT.getTime() - inT.getTime() : Date.now() - inT.getTime();
                  return (
                    <tr key={e.id} style={{ borderTop: "1px solid var(--ink-line)" }}>
                      <td className="px-4 py-3" style={{ color: "var(--paper)" }}>
                        {e.employees?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--paper-dim)" }}>
                        {e.companies?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-num" style={{ color: "var(--paper-dim)" }}>
                        {formatDateTime(inT)}
                      </td>
                      <td className="px-4 py-3 font-num" style={{ color: "var(--paper-dim)" }}>
                        {outT ? formatDateTime(outT) : "Active"}
                      </td>
                      <td className="px-4 py-3 font-num" style={{ color: !outT ? "var(--ice)" : "var(--paper)" }}>
                        {formatDuration(dur)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {payrollEntries.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: "1px solid var(--ink-line)", background: "var(--ink-raised)" }}>
                    <td colSpan={4} className="px-4 py-3 font-display uppercase text-xs tracking-wide text-right" style={{ color: "var(--paper-dim)" }}>
                      Total
                    </td>
                    <td className="px-4 py-3 font-num" style={{ color: "var(--ice)" }}>
                      {formatDuration(payrollTotalMs)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {!loading && tab === "team" && (
        <div className="flex flex-col gap-8">
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--ink-line)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--ink-raised)" }}>
                  <th className="text-left px-4 py-3 font-display uppercase text-xs tracking-wide" style={{ color: "var(--paper-dim)" }}>
                    Name
                  </th>
                  <th className="text-left px-4 py-3 font-display uppercase text-xs tracking-wide" style={{ color: "var(--paper-dim)" }}>
                    Company
                  </th>
                  <th className="text-left px-4 py-3 font-display uppercase text-xs tracking-wide" style={{ color: "var(--paper-dim)" }}>
                    Role
                  </th>
                  <th className="text-left px-4 py-3 font-display uppercase text-xs tracking-wide" style={{ color: "var(--paper-dim)" }}>
                    Status
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id} style={{ borderTop: "1px solid var(--ink-line)" }}>
                    <td className="px-4 py-3" style={{ color: "var(--paper)" }}>
                      {emp.name}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--paper-dim)" }}>
                      {emp.companies && emp.companies.length > 0
                        ? emp.companies.map((c) => c.name).join(", ")
                        : "—"}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--paper-dim)" }}>
                      {emp.is_admin ? "Admin" : "Staff"}
                    </td>
                    <td className="px-4 py-3" style={{ color: emp.active ? "var(--ice)" : "var(--paper-dim)" }}>
                      {emp.active ? "Active" : "Inactive"}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => openEditCompanies(emp)}
                        className="text-xs underline-offset-4 hover:underline mr-3"
                        style={{ color: "var(--paper-dim)" }}
                      >
                        Companies
                      </button>
                      <button
                        onClick={() => toggleActive(emp)}
                        className="text-xs underline-offset-4 hover:underline"
                        style={{ color: "var(--paper-dim)" }}
                      >
                        {emp.active ? "Deactivate" : "Reactivate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            className="rounded-xl p-6 flex flex-col gap-4 max-w-md"
            style={{ background: "var(--ink-raised)", border: "1px solid var(--ink-line)" }}
          >
            <h2 className="font-display uppercase text-sm tracking-wide" style={{ color: "var(--paper)" }}>
              Add team member
            </h2>
            <input
              placeholder="Full name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "var(--ink)", border: "1px solid var(--ink-line)", color: "var(--paper)" }}
            />
            <input
              placeholder="4-8 digit PIN"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              className="rounded-lg px-3 py-2 text-sm outline-none font-num"
              style={{ background: "var(--ink)", border: "1px solid var(--ink-line)", color: "var(--paper)" }}
            />
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-wide" style={{ color: "var(--paper-dim)" }}>
                Companies{" "}
                <span style={{ color: "var(--paper-dim)" }}>
                  (pick 2+ if they should choose at clock-in)
                </span>
              </span>
              <div className="flex flex-col gap-2">
                {companies.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 text-sm"
                    style={{ color: "var(--paper-dim)" }}
                  >
                    <input
                      type="checkbox"
                      checked={newCompanyIds.includes(c.id)}
                      onChange={() => toggleNewCompany(c.id)}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm" style={{ color: "var(--paper-dim)" }}>
              <input
                type="checkbox"
                checked={newIsAdmin}
                onChange={(e) => setNewIsAdmin(e.target.checked)}
              />
              Grant admin access
            </label>
            {formError && (
              <p className="text-sm" style={{ color: "var(--danger)" }}>
                {formError}
              </p>
            )}
            <button
              onClick={addEmployee}
              disabled={formBusy}
              className="font-display uppercase tracking-wide text-sm rounded-lg h-11 disabled:opacity-50"
              style={{ background: "var(--ice)", color: "var(--ink)" }}
            >
              Add member
            </button>
          </div>
        </div>
      )}

      {!loading && tab === "settings" && (
        <div className="flex flex-col gap-6 max-w-md">
          <div
            className="rounded-xl p-6 flex flex-col gap-4"
            style={{ background: "var(--ink-raised)", border: "1px solid var(--ink-line)" }}
          >
            <h2 className="font-display uppercase text-sm tracking-wide" style={{ color: "var(--paper)" }}>
              Office network restriction
            </h2>
            <p className="text-sm" style={{ color: "var(--paper-dim)" }}>
              When set, staff can only clock in or out from this IP address.
              Admins always bypass this and can clock in from anywhere.
              Leave it blank so clock-in works from any network.
            </p>

            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide" style={{ color: "var(--paper-dim)" }}>
                Allowed IP address
              </label>
              <input
                type="text"
                value={allowedIpInput}
                onChange={(e) => setAllowedIpInput(e.target.value)}
                placeholder="e.g. 203.0.113.5 — leave blank to allow any network"
                className="rounded-lg px-3 py-2 text-sm outline-none font-num"
                style={{ background: "var(--ink)", border: "1px solid var(--ink-line)", color: "var(--paper)" }}
              />
            </div>

            <p className="text-xs" style={{ color: "var(--paper-dim)" }}>
              Currently{" "}
              {allowedIpSaved ? (
                <span style={{ color: "var(--ice)" }}>restricted to {allowedIpSaved}</span>
              ) : (
                <span style={{ color: "var(--paper-dim)" }}>unrestricted — works from any network</span>
              )}
              .
            </p>

            {settingsError && (
              <p className="text-sm" style={{ color: "var(--danger)" }}>
                {settingsError}
              </p>
            )}
            {settingsSavedMessage && (
              <p className="text-sm" style={{ color: "var(--ice)" }}>
                Saved.
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={clearAllowedIp}
                disabled={settingsBusy}
                className="flex-1 font-display uppercase tracking-wide text-xs rounded-lg h-11"
                style={{ border: "1px solid var(--ink-line)", color: "var(--paper-dim)" }}
              >
                Clear (allow anywhere)
              </button>
              <button
                onClick={saveAllowedIp}
                disabled={settingsBusy}
                className="flex-1 font-display uppercase tracking-wide text-xs rounded-lg h-11 disabled:opacity-50"
                style={{ background: "var(--ice)", color: "var(--ink)" }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {editingCompaniesFor && (
        <div
          className="fixed inset-0 flex items-center justify-center px-4 z-50"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setEditingCompaniesFor(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4"
            style={{ background: "var(--ink-raised)", border: "1px solid var(--ink-line)" }}
          >
            <h2 className="font-display uppercase text-sm tracking-wide" style={{ color: "var(--paper)" }}>
              {editingCompaniesFor.name}'s companies
            </h2>
            <p className="text-xs" style={{ color: "var(--paper-dim)" }}>
              Pick 2 or more if they should choose which company at clock-in.
              Pick one for a fixed assignment, or none if it doesn't apply.
            </p>

            <div className="flex flex-col gap-2">
              {companies.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 text-sm"
                  style={{ color: "var(--paper-dim)" }}
                >
                  <input
                    type="checkbox"
                    checked={editCompanyIds.includes(c.id)}
                    onChange={() => toggleEditCompany(c.id)}
                  />
                  {c.name}
                </label>
              ))}
            </div>

            {editCompaniesError && (
              <p className="text-sm" style={{ color: "var(--danger)" }}>
                {editCompaniesError}
              </p>
            )}

            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setEditingCompaniesFor(null)}
                disabled={editCompaniesBusy}
                className="flex-1 font-display uppercase tracking-wide text-xs rounded-lg h-11"
                style={{ border: "1px solid var(--ink-line)", color: "var(--paper-dim)" }}
              >
                Cancel
              </button>
              <button
                onClick={saveEditCompanies}
                disabled={editCompaniesBusy}
                className="flex-1 font-display uppercase tracking-wide text-xs rounded-lg h-11 disabled:opacity-50"
                style={{ background: "var(--ice)", color: "var(--ink)" }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {manualOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center px-4 z-50"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={closeManual}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4"
            style={{ background: "var(--ink-raised)", border: "1px solid var(--ink-line)" }}
          >
            <h2 className="font-display uppercase text-sm tracking-wide" style={{ color: "var(--paper)" }}>
              {manualEditingId ? "Edit entry" : "Add manual entry"}
            </h2>
            <p className="text-xs" style={{ color: "var(--paper-dim)" }}>
              Use this when someone forgot to clock in or out.
            </p>

            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide" style={{ color: "var(--paper-dim)" }}>
                Employee
              </label>
              <select
                value={manualEmployeeId}
                onChange={(e) => setManualEmployeeId(e.target.value)}
                className="rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "var(--ink)", border: "1px solid var(--ink-line)", color: "var(--paper)" }}
              >
                <option value="">Select employee</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                    {emp.active ? "" : " (inactive)"}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide" style={{ color: "var(--paper-dim)" }}>
                Company <span style={{ color: "var(--paper-dim)" }}>(optional)</span>
              </label>
              <select
                value={manualCompanyId}
                onChange={(e) => setManualCompanyId(e.target.value)}
                className="rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "var(--ink)", border: "1px solid var(--ink-line)", color: "var(--paper)" }}
              >
                <option value="">No company</option>
                {(employees.find((e) => e.id === manualEmployeeId)?.companies?.length
                  ? employees.find((e) => e.id === manualEmployeeId)!.companies!
                  : companies
                ).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide" style={{ color: "var(--paper-dim)" }}>
                Clock in
              </label>
              <input
                type="datetime-local"
                value={manualClockIn}
                onChange={(e) => setManualClockIn(e.target.value)}
                className="rounded-lg px-3 py-2 text-sm outline-none font-num"
                style={{ background: "var(--ink)", border: "1px solid var(--ink-line)", color: "var(--paper)" }}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide" style={{ color: "var(--paper-dim)" }}>
                Clock out <span style={{ color: "var(--paper-dim)" }}>(leave blank if still in)</span>
              </label>
              <input
                type="datetime-local"
                value={manualClockOut}
                onChange={(e) => setManualClockOut(e.target.value)}
                className="rounded-lg px-3 py-2 text-sm outline-none font-num"
                style={{ background: "var(--ink)", border: "1px solid var(--ink-line)", color: "var(--paper)" }}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide" style={{ color: "var(--paper-dim)" }}>
                Note <span style={{ color: "var(--paper-dim)" }}>(optional)</span>
              </label>
              <input
                type="text"
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="e.g. Forgot to clock out, added by admin"
                className="rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "var(--ink)", border: "1px solid var(--ink-line)", color: "var(--paper)" }}
              />
            </div>

            {manualError && (
              <p className="text-sm" style={{ color: "var(--danger)" }}>
                {manualError}
              </p>
            )}

            <div className="flex gap-2 mt-2">
              <button
                onClick={closeManual}
                disabled={manualBusy}
                className="flex-1 font-display uppercase tracking-wide text-xs rounded-lg h-11"
                style={{ border: "1px solid var(--ink-line)", color: "var(--paper-dim)" }}
              >
                Cancel
              </button>
              <button
                onClick={saveManualEntry}
                disabled={manualBusy}
                className="flex-1 font-display uppercase tracking-wide text-xs rounded-lg h-11 disabled:opacity-50"
                style={{ background: "var(--ice)", color: "var(--ink)" }}
              >
                {manualEditingId ? "Save changes" : "Add entry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
