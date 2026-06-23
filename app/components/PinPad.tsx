"use client";

import { useState } from "react";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

export default function PinPad({
  onSubmit,
  disabled,
  maxLength = 8,
}: {
  onSubmit: (pin: string) => void;
  disabled?: boolean;
  maxLength?: number;
}) {
  const [pin, setPin] = useState("");

  function press(key: string) {
    if (disabled) return;
    if (key === "back") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (key === "") return;
    if (pin.length >= maxLength) return;
    const next = pin + key;
    setPin(next);
  }

  function submit() {
    if (pin.length < 4 || disabled) return;
    onSubmit(pin);
    setPin("");
  }

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-xs">
      {/* PIN dots */}
      <div className="flex gap-3 h-4 items-center" aria-live="polite">
        {Array.from({ length: Math.max(pin.length, 4) }).map((_, i) => (
          <span
            key={i}
            className="w-3.5 h-3.5 rounded-full transition-colors"
            style={{
              background: i < pin.length ? "var(--ice)" : "transparent",
              border: `2px solid ${i < pin.length ? "var(--ice)" : "var(--ink-line)"}`,
            }}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 w-full">
        {KEYS.map((key, i) => {
          if (key === "") return <div key={i} />;
          if (key === "back") {
            return (
              <button
                key={i}
                onClick={() => press("back")}
                disabled={disabled}
                aria-label="Backspace"
                className="font-num text-2xl rounded-xl h-16 flex items-center justify-center transition-colors active:scale-95"
                style={{ color: "var(--paper-dim)" }}
              >
                ⌫
              </button>
            );
          }
          return (
            <button
              key={i}
              onClick={() => press(key)}
              disabled={disabled}
              className="font-num text-3xl rounded-xl h-16 flex items-center justify-center transition-colors active:scale-95"
              style={{
                background: "var(--ink-raised)",
                border: "1px solid var(--ink-line)",
                color: "var(--paper)",
              }}
            >
              {key}
            </button>
          );
        })}
      </div>

      <button
        onClick={submit}
        disabled={pin.length < 4 || disabled}
        className="font-display uppercase tracking-wide text-sm w-full rounded-xl h-14 transition-all disabled:opacity-30"
        style={{
          background: pin.length >= 4 ? "var(--ice)" : "var(--ink-raised)",
          color: pin.length >= 4 ? "var(--ink)" : "var(--paper-dim)",
          border: "1px solid var(--ink-line)",
        }}
      >
        Enter
      </button>
    </div>
  );
}
