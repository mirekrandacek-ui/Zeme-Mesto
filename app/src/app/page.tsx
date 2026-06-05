"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type Tier = "free" | "premium" | "super_premium";

const FREE_CATEGORIES = ["Země", "Město", "Jméno"];

const PREMIUM_CATEGORIES = ["Země", "Město", "Jméno", "Zvíře", "Věc", "Rostlina"];

function createRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function tierLabel(tier: Tier) {
  if (tier === "premium") return "Premium";
  if (tier === "super_premium") return "Super Premium";
  return "Free";
}

function uniqueNonEmpty(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const cleaned = value.trim();
    if (!cleaned) continue;

    const key = cleaned.toLocaleLowerCase("cs-CZ");
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

export default function Home() {
  const router = useRouter();

  const [status, setStatus] = useState("připraveno");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [creating, setCreating] = useState(false);

  // Dočasný testovací přepínač, než napojíme skutečné platby.
  const [tier, setTier] = useState<Tier>("free");
  const [premiumCustomCategory, setPremiumCustomCategory] = useState("");

  function getRoomSettings() {
    if (tier === "premium") {
      const custom = premiumCustomCategory.trim();
      const activeCategories = uniqueNonEmpty(
        custom ? [...PREMIUM_CATEGORIES, custom] : PREMIUM_CATEGORIES
      );

      return {
        creator_tier: "premium",
        max_players: 5,
        active_categories: activeCategories,
        custom_category: custom || null,
        ads_enabled: false,
      };
    }

    if (tier === "super_premium") {
      return {
        creator_tier: "super_premium",
        max_players: 999,
        active_categories: PREMIUM_CATEGORIES,
        custom_category: null,
        ads_enabled: false,
      };
    }

    return {
      creator_tier: "free",
      max_players: 3,
      active_categories: FREE_CATEGORIES,
      custom_category: null,
      ads_enabled: true,
    };
  }

  async function createRoom() {
    if (creating) return;

    setCreating(true);
    setStatus("vytvářím místnost…");

    const roomSettings = getRoomSettings();

    for (let attempt = 1; attempt <= 5; attempt++) {
      const roomCode = createRoomCode();

      const { error } = await supabase.from("rooms").insert({
        code: roomCode,
        status: "lobby",
        letter: null,
        ...roomSettings,
      });

      if (!error) {
        router.push(`/room/${roomCode}`);
        return;
      }

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

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Testovací verze místnosti</h2>

        <label style={{ display: "block", marginTop: 10 }}>
          Verze
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as Tier)}
            style={{ display: "block", marginTop: 6, padding: 12, width: "100%" }}
          >
            <option value="free">Free</option>
            <option value="premium">Premium</option>
            <option value="super_premium">Super Premium</option>
          </select>
        </label>

        {tier === "free" && (
          <p style={{ opacity: 0.75, fontSize: 14, marginTop: 10 }}>
            Free: reklamy, až 3 hráči, pevné kategorie Země / Město / Jméno.
          </p>
        )}

        {tier === "premium" && (
          <>
            <p style={{ opacity: 0.75, fontSize: 14, marginTop: 10 }}>
              Premium: bez reklam, až 5 hráčů, pevné kategorie Země / Město / Jméno /
              Zvíře / Věc / Rostlina + 1 vlastní volitelná kategorie.
            </p>

            <label style={{ display: "block", marginTop: 12 }}>
              Vlastní volitelná kategorie
              <input
                placeholder="Např. Jídlo"
                value={premiumCustomCategory}
                onChange={(e) => setPremiumCustomCategory(e.target.value)}
                style={{ display: "block", marginTop: 6, padding: 12, width: "100%" }}
              />
            </label>
          </>
        )}

        {tier === "super_premium" && (
          <p style={{ opacity: 0.75, fontSize: 14, marginTop: 10 }}>
            Super Premium: bez reklam, neomezený počet hráčů. Kategorie si nastavíš po vytvoření místnosti v lobby.
          </p>
        )}

        <p style={{ opacity: 0.75, marginBottom: 0 }}>
          Vybráno: <b>{tierLabel(tier)}</b>
        </p>
      </section>

      <button
        onClick={createRoom}
        disabled={creating}
        style={{ padding: 14, marginTop: 16, width: "100%" }}
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
