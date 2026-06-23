"use client";

import { useEffect, useState } from "react";

export default function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!now) {
    // Avoid hydration mismatch: render nothing until mounted client-side
    return <div className="h-[1px]" />;
  }

  const hh = now.getHours().toString().padStart(2, "0");
  const mm = now.getMinutes().toString().padStart(2, "0");
  const ss = now.getSeconds().toString().padStart(2, "0");
  const dateStr = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col items-center select-none">
      <div className="font-num leading-none flex items-baseline gap-1 tabular-nums">
        <span className="text-[clamp(4rem,14vw,9rem)] font-semibold" style={{ color: "var(--paper)" }}>
          {hh}
        </span>
        <span className="text-[clamp(4rem,14vw,9rem)] font-semibold" style={{ color: "var(--ink-line)" }}>
          :
        </span>
        <span className="text-[clamp(4rem,14vw,9rem)] font-semibold" style={{ color: "var(--paper)" }}>
          {mm}
        </span>
        <span
          className="text-[clamp(1.5rem,4vw,2.5rem)] ml-2 font-medium"
          style={{ color: "var(--ice)" }}
        >
          {ss}
        </span>
      </div>
      <div
        className="font-display uppercase tracking-[0.2em] text-xs mt-2"
        style={{ color: "var(--paper-dim)" }}
      >
        {dateStr}
      </div>
    </div>
  );
}
