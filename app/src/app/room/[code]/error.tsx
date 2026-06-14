"use client";

import { useEffect } from "react";

export default function RoomError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Room error:", error);
  }, [error]);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 520, margin: "0 auto" }}>
      <h1>Něco se pokazilo</h1>

      <p>
        Místnost se nepodařilo správně načíst. Zkus stránku obnovit, případně se vrať na hlavní stránku a připoj se znovu přes kód místnosti.
      </p>

      <button onClick={reset} style={{ padding: 12, marginRight: 8 }}>
        Zkusit znovu
      </button>

      <button onClick={() => window.location.reload()} style={{ padding: 12, marginRight: 8 }}>
        Obnovit stránku
      </button>

      <a href="/" style={{ display: "inline-block", marginTop: 16 }}>
        Hlavní stránka
      </a>
    </main>
  );
}
