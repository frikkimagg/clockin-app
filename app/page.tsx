"use client";

import { useState } from "react";
import Link from "next/link";
import PinPad from "./components/PinPad";
import LiveClock from "./components/LiveClock";
import ElapsedSince from "./components/ElapsedSince";

type Company = { id: string; name: string };

type Employee = {
  id: string;
  name: string;
  company_id: string | null;
  is_admin: boolean;
  companies: Company[];
};

type MyHoursEntry = {
  id: string;
  clock_in: string;
  clock_out: string | null;
  companies: { id: string; name: string } | null;
};

type Screen =
  | { step: "pin" }
  | { step: "confirm"; employee: Employee; clockedIn: boolean; since?: string }
  | { step: "pickCompany"; employee: Employee }
  | { step: "done"; employee: Employee; action: "clocked_in" | "clocked_out" };

function formatDuration(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function formatDateTime(d: Date) {
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short", hour12: false });
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>({ step: "pin" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [myHoursOpen, setMyHoursOpen] = useState(false);
  const [myHoursLoading, setMyHoursLoading] = useState(false);
  const [myHoursEntries, setMyHoursEntries] = useState<MyHoursEntry[] | null>(null);
  const [myHoursTotalMs, setMyHoursTotalMs] = useState(0);
  const [myHoursError, setMyHoursError] = useState<string | null>(null);

  async function handlePin(pin: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "PIN not recognized.");
        setLoading(false);
        return;
      }

      const statusRes = await fetch(`/api/status?employeeId=${data.employee.id}`);
      const statusData = await statusRes.json();

      setScreen({
        step: "confirm",
        employee: data.employee,
        clockedIn: statusData.clockedIn,
        since: statusData.openEntry?.clock_in,
      });
    } catch {
      setError("Couldn't connect. Check your network and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function performClock(employee: Employee, companyId?: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: employee.id, companyId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setLoading(false);
        return;
      }
      setScreen({ step: "done", employee, action: data.action });
      setTimeout(() => {
        setScreen({ step: "pin" });
        resetMyHours();
      }, 2200);
    } catch {
      setError("Couldn't connect. Check your network and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleConfirm() {
    if (screen.step !== "confirm") return;

    // Clocking out, or clocking in with 0-1 companies: no company choice
    // needed, go straight ahead. Clocking in with 2+ companies: ask first.
    if (!screen.clockedIn && screen.employee.companies.length > 1) {
      setScreen({ step: "pickCompany", employee: screen.employee });
      return;
    }

    performClock(screen.employee);
  }

  function handlePickCompany(companyId: string) {
    if (screen.step !== "pickCompany") return;
    performClock(screen.employee, companyId);
  }

  function resetMyHours() {
    setMyHoursOpen(false);
    setMyHoursEntries(null);
    setMyHoursTotalMs(0);
    setMyHoursError(null);
  }

  async function toggleMyHours(employeeId: string) {
    if (myHoursOpen) {
      setMyHoursOpen(false);
      return;
    }
    setMyHoursOpen(true);
    if (myHoursEntries !== null) return; // already loaded for this session
    setMyHoursLoading(true);
    setMyHoursError(null);
    try {
      const res = await fetch(`/api/my-hours?employeeId=${employeeId}`);
      const data = await res.json();
      if (!res.ok) {
        setMyHoursError(data.error || "Couldn't load your hours.");
        return;
      }
      setMyHoursEntries(data.entries ?? []);
      setMyHoursTotalMs(data.totalMs ?? 0);
    } catch {
      setMyHoursError("Couldn't connect. Try again.");
    } finally {
      setMyHoursLoading(false);
    }
  }

  function cancel() {
    setScreen({ step: "pin" });
    setError(null);
    resetMyHours();
  }

  return (
    <main
      className="flex-1 flex flex-col items-center justify-between min-h-screen px-6 py-10"
      style={{ background: "var(--ink)" }}
    >
      <div className="w-full flex justify-between items-start max-w-sm">
        <span
          className="font-display uppercase tracking-[0.25em] text-xs"
          style={{ color: "var(--paper-dim)" }}
        >
          Time Clock
        </span>
        <Link
          href="/admin"
          className="text-xs underline-offset-4 hover:underline"
          style={{ color: "var(--paper-dim)" }}
        >
          Admin
        </Link>
      </div>

      <div className="flex flex-col items-center gap-10 flex-1 justify-center w-full">
        <LiveClock />

        {screen.step === "pin" && (
          <div className="flex flex-col items-center gap-4 w-full">
            <p
              className="font-display uppercase tracking-[0.15em] text-xs"
              style={{ color: "var(--paper-dim)" }}
            >
              Enter your PIN
            </p>
            <PinPad onSubmit={handlePin} disabled={loading} />
          </div>
        )}

        {screen.step === "confirm" && (
          <div
            className="flex flex-col items-center gap-6 w-full max-w-xs rounded-2xl p-8"
            style={{ background: "var(--ink-raised)", border: "1px solid var(--ink-line)" }}
          >
            <div className="flex flex-col items-center gap-1">
              <span
                className="font-display text-2xl"
                style={{ color: "var(--paper)" }}
              >
                {screen.employee.name}
              </span>
              {screen.clockedIn && screen.since && (
                <span className="text-sm" style={{ color: "var(--paper-dim)" }}>
                  Clocked in for <ElapsedSince since={screen.since} />
                </span>
              )}
              {!screen.clockedIn && (
                <span className="text-sm" style={{ color: "var(--paper-dim)" }}>
                  Not currently clocked in
                </span>
              )}
            </div>

            <button
              onClick={handleConfirm}
              disabled={loading}
              className="font-display uppercase tracking-wide text-sm w-full rounded-xl h-16 transition-all disabled:opacity-50"
              style={{
                background: screen.clockedIn ? "var(--amber)" : "var(--ice)",
                color: "var(--ink)",
              }}
            >
              {screen.clockedIn ? "Clock Out" : "Clock In"}
            </button>

            <button
              onClick={() => toggleMyHours(screen.employee.id)}
              className="text-xs underline-offset-4 hover:underline"
              style={{ color: "var(--paper-dim)" }}
            >
              {myHoursOpen ? "Hide my hours" : "My hours this fortnight"}
            </button>

            {myHoursOpen && (
              <div className="w-full flex flex-col gap-2 -mt-2">
                {myHoursLoading && (
                  <p className="text-xs text-center" style={{ color: "var(--paper-dim)" }}>
                    Loading…
                  </p>
                )}
                {myHoursError && (
                  <p className="text-xs text-center" style={{ color: "var(--danger)" }}>
                    {myHoursError}
                  </p>
                )}
                {!myHoursLoading && !myHoursError && myHoursEntries && (
                  <>
                    <p
                      className="text-xs text-center"
                      style={{ color: "var(--paper-dim)" }}
                    >
                      {myHoursEntries.length} shift{myHoursEntries.length === 1 ? "" : "s"} ·{" "}
                      <span style={{ color: "var(--ice)" }}>{formatDuration(myHoursTotalMs)}</span>
                    </p>
                    {myHoursEntries.length === 0 ? (
                      <p className="text-xs text-center" style={{ color: "var(--paper-dim)" }}>
                        No shifts yet this fortnight.
                      </p>
                    ) : (
                      <div
                        className="flex flex-col gap-1 max-h-48 overflow-y-auto rounded-lg p-2"
                        style={{ background: "var(--ink)", border: "1px solid var(--ink-line)" }}
                      >
                        {myHoursEntries.map((e) => {
                          const inT = new Date(e.clock_in);
                          const outT = e.clock_out ? new Date(e.clock_out) : null;
                          const dur = outT
                            ? outT.getTime() - inT.getTime()
                            : Date.now() - inT.getTime();
                          return (
                            <div
                              key={e.id}
                              className="flex justify-between items-baseline text-xs px-2 py-1.5"
                              style={{ borderBottom: "1px solid var(--ink-line)" }}
                            >
                              <div className="flex flex-col">
                                <span className="font-num" style={{ color: "var(--paper)" }}>
                                  {formatDateTime(inT)}
                                </span>
                                {e.companies?.name && (
                                  <span style={{ color: "var(--paper-dim)" }}>
                                    {e.companies.name}
                                  </span>
                                )}
                              </div>
                              <span
                                className="font-num"
                                style={{ color: !outT ? "var(--ice)" : "var(--paper-dim)" }}
                              >
                                {outT ? formatDuration(dur) : "Active"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <button
              onClick={cancel}
              disabled={loading}
              className="text-xs underline-offset-4 hover:underline"
              style={{ color: "var(--paper-dim)" }}
            >
              Not you? Go back
            </button>
          </div>
        )}

        {screen.step === "pickCompany" && (
          <div
            className="flex flex-col items-center gap-6 w-full max-w-xs rounded-2xl p-8"
            style={{ background: "var(--ink-raised)", border: "1px solid var(--ink-line)" }}
          >
            <div className="flex flex-col items-center gap-1">
              <span className="font-display text-xl" style={{ color: "var(--paper)" }}>
                {screen.employee.name}
              </span>
              <span className="text-sm" style={{ color: "var(--paper-dim)" }}>
                Which company are you clocking in for?
              </span>
            </div>

            <div className="flex flex-col gap-3 w-full">
              {screen.employee.companies.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handlePickCompany(c.id)}
                  disabled={loading}
                  className="font-display uppercase tracking-wide text-sm w-full rounded-xl h-14 transition-all disabled:opacity-50"
                  style={{
                    background: "var(--ink)",
                    border: "1px solid var(--ink-line)",
                    color: "var(--paper)",
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <button
              onClick={cancel}
              disabled={loading}
              className="text-xs underline-offset-4 hover:underline"
              style={{ color: "var(--paper-dim)" }}
            >
              Not you? Go back
            </button>
          </div>
        )}

        {screen.step === "done" && (
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
              style={{
                background:
                  screen.action === "clocked_in" ? "var(--ice-dim)" : "var(--amber-dim)",
                color: screen.action === "clocked_in" ? "var(--ice)" : "var(--amber)",
              }}
            >
              ✓
            </div>
            <p className="font-display text-lg" style={{ color: "var(--paper)" }}>
              {screen.action === "clocked_in" ? "Clocked in" : "Clocked out"}, {screen.employee.name}
            </p>
          </div>
        )}

        {error && (
          <p className="text-sm" style={{ color: "var(--danger)" }} role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="h-4" />
    </main>
  );
}
