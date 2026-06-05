"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

function createRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function Home() {
  const router = useRouter();

  const [status, setStatus] = useState("připraveno");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [creating, setCreating] = useState(false);

  async function createRoom() {
    if (creating) return;

    setCreating(true);
    setStatus("vytvářím místnost…");

    // malá pojistka proti náhodné duplicitě kódu
    for (let attempt = 1; attempt <= 5; attempt++) {
      const roomCode = createRoomCode();

      const { error } = await supabase.from("rooms").insert({
        code: roomCode,
        status: "lobby",
        letter: null,
      });

      if (!error) {
        router.push(`/room/${roomCode}`);
        return;
      }

      // 23505 = duplicitní unique key; zkusíme jiný kód
      if (error.code !== "23505") {
        setStatus(`❌ ${error.message}`);
        setCreating(false);
        return;
      }
    }

    setStatus("❌ Nepodařilo se vytvořit unikátní kód místnosti. Zkus to znovu.");
    setCreating(false);
  }

  function joinRoomByCode() {
    const cleaned = roomCodeInput
      .trim()
      .replace(/\s+/g, "")
      .toUpperCase();

    if (!cleaned) {
      setStatus("❗ zadej kód místnosti");
      return;
    }

    router.push(`/room/${cleaned}`);
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 520, margin: "0 auto" }}>
      <h1>Země • Město</h1>

      <p>
        Vytvoř místnost, pošli odkaz ostatním hráčům a hrajte společně na mobilech.
      </p>

      <button
        onClick={createRoom}
        disabled={creating}
        style={{ padding: 14, marginTop: 12, width: "100%" }}
      >
        {creating ? "Vytvářím…" : "Vytvořit hru"}
      </button>

      <div style={{ marginTop: 28, borderTop: "1px solid #ddd", paddingTop: 20 }}>
        <h2>Připojit se k místnosti</h2>

        <input
          placeholder="Kód místnosti"
          value={roomCodeInput}
          onChange={(e) => setRoomCodeInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") joinRoomByCode();
          }}
          style={{ padding: 12, width: "100%", textTransform: "uppercase" }}
        />

        <button onClick={joinRoomByCode} style={{ padding: 14, marginTop: 12, width: "100%" }}>
          Připojit se
        </button>
      </div>

      <p style={{ marginTop: 16 }}>{status}</p>
    </main>
  );
}
