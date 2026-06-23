"use client";

import { useEffect, useState } from "react";

export default function ElapsedSince({ since }: { since: string }) {
  const [elapsed, setElapsed] = useState("00:00:00");

  useEffect(() => {
    function tick() {
      const start = new Date(since).getTime();
      const diff = Math.max(0, Date.now() - start);
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(
        `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s
          .toString()
          .padStart(2, "0")}`
      );
    }
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [since]);

  return <span className="font-num tabular-nums">{elapsed}</span>;
}
