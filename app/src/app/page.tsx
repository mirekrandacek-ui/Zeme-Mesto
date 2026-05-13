"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

export default function Home() {
  const router = useRouter();
  const [status, setStatus] = useState("připraveno");

  async function createRoom() {
    setStatus("vytvářím místnost…");

    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { error } = await supabase.from("rooms").insert({
      code: roomCode,
    });

    if (error) {
      setStatus(`❌ ${error.message}`);
      return;
    }

    router.push(`/room/${roomCode}`);
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Země • Město</h1>

      <button onClick={createRoom} style={{ padding: 12, marginTop: 12 }}>
        Vytvořit hru
      </button>

      <p style={{ marginTop: 12 }}>{status}</p>
    </main>
  );
}
