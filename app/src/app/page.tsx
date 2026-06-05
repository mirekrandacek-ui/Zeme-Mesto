"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type Tier = "free" | "premium" | "super_premium";

const FREE_CATEGORIES = ["Země", "Město", "Jméno"];

const PREMIUM_CATEGORIES = ["Země", "Město", "Jméno", "Zvíře", "Věc", "Rostlina"];

const SUPER_PREMIUM_BASE_CATEGORIES = [
  "Země",
  "Město",
  "Jméno",
  "Zvíře",
  "Věc",
  "Rostlina",
  "Film / Seriál",
  "Herec / Herečka",
  "Zpěvák / Zpěvačka / Kapela",
  "Sport",
  "Značka",
  "Auto / Moto",
  "Řeka / Hora",
  "Povolání",
  "Barva",
];

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

  const [superSelectedCategories, setSuperSelectedCategories] = useState<string[]>(
    SUPER_PREMIUM_BASE_CATEGORIES
  );

  const [superCustomCategories, setSuperCustomCategories] = useState(["", "", "", "", ""]);

  function toggleSuperCategory(category: string) {
    setSuperSelectedCategories((prev) => {
      if (prev.includes(category)) {
        return prev.filter((item) => item !== category);
      }

      return [...prev, category];
    });
  }

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
      const customCategories = uniqueNonEmpty(superCustomCategories);
      const activeCategories = uniqueNonEmpty([
        ...superSelectedCategories,
        ...customCategories,
      ]);

      return {
        creator_tier: "super_premium",
        max_players: 999,
        active_categories: activeCategories.length > 0 ? activeCategories : ["Země"],
        custom_category: customCategories.join(" | ") || null,
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
            <option value="free">Free – až 3 hráči, Země / Město / Jméno</option>
            <option value="premium">Premium – až 5 hráčů, Země / Město / Jméno / Zvíře / Věc / Rostlina + 1 vlastní</option>
            <option value="super_premium">Super Premium – neomezeně hráčů, vlastní výběr kategorií</option>
          </select>
        </label>

        {tier === "premium" && (
          <>
            <p style={{ opacity: 0.75, fontSize: 14, marginTop: 10 }}>
              Premium obsahuje: Země / Město / Jméno / Zvíře / Věc / Rostlina.
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
          <div style={{ marginTop: 16 }}>
            <h3>Výběr kategorií Super Premium</h3>

            <div style={{ display: "grid", gap: 8 }}>
              {SUPER_PREMIUM_BASE_CATEGORIES.map((category) => (
                <label key={category} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={superSelectedCategories.includes(category)}
                    onChange={() => toggleSuperCategory(category)}
                  />
                  {category}
                </label>
              ))}
            </div>

            <h3 style={{ marginTop: 16 }}>Vlastní kategorie</h3>
            <p style={{ opacity: 0.75 }}>
              Můžeš přidat až 5 vlastních kategorií.
            </p>

            {superCustomCategories.map((value, index) => (
              <input
                key={index}
                placeholder={`Vlastní kategorie ${index + 1}`}
                value={value}
                onChange={(e) => {
                  const next = [...superCustomCategories];
                  next[index] = e.target.value;
                  setSuperCustomCategories(next);
                }}
                style={{ display: "block", marginTop: 8, padding: 12, width: "100%" }}
              />
            ))}
          </div>
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
