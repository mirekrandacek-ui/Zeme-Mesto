"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type Tier = "free" | "premium" | "super_premium";
type RoomLanguage = "cs" | "en";

const FREE_CATEGORIES = ["Země", "Město", "Jméno"];

const PREMIUM_CATEGORIES = ["Země", "Město", "Jméno", "Zvíře", "Věc", "Rostlina"];

const EXTENDED_CATEGORIES = [
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

const EXTENDED_CATEGORY_PRICE_CZK = 25;

function createRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createCreatorToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function tierLabel(tier: Tier) {
  if (tier === "premium") return "Premium";
  if (tier === "super_premium") return "Super Premium";
  return "Free";
}

function uniqueNonEmpty(values: unknown[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (typeof value !== "string") continue;

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

  const [status, setStatus] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [creating, setCreating] = useState(false);

  // Dočasný testovací přepínač, než napojíme skutečné platby.
  const [tier, setTier] = useState<Tier>("free");
  const [language, setLanguage] = useState<RoomLanguage>("cs");

  const en = language === "en";

  function getRoomSettings() {
    if (tier === "premium") {
      return {
        creator_tier: "premium",
        max_players: 5,
        active_categories: PREMIUM_CATEGORIES,
        custom_category: null,
        ads_enabled: false,
      };
    }

    if (tier === "super_premium") {
      return {
        creator_tier: "super_premium",
        max_players: 999,
        active_categories: [...PREMIUM_CATEGORIES, ...EXTENDED_CATEGORIES],
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
    setStatus(en ? "creating room…" : "vytvářím místnost…");

    const roomSettings = getRoomSettings();

    for (let attempt = 1; attempt <= 5; attempt++) {
      const roomCode = createRoomCode();
      const creatorToken = createCreatorToken();

      const { error } = await supabase.from("rooms").insert({
        code: roomCode,
        status: "lobby",
        letter: null,
        creator_token: creatorToken,
        language: language,
        ...roomSettings,
      });

      if (!error) {
        if (typeof window !== "undefined") {
          localStorage.setItem(`zm_roomCreatorToken_${roomCode}`, creatorToken);
        }

        router.push(`/room/${roomCode}`);
        return;
      }

      if (error.code !== "23505") {
        setStatus(`❌ ${error.message}`);
        setCreating(false);
        return;
      }
    }

    setStatus(en ? "❌ Could not create a unique room code. Try again." : "❌ Nepodařilo se vytvořit unikátní kód místnosti. Zkus to znovu.");
    setCreating(false);
  }

  function joinRoomByCode() {
    const cleaned = roomCodeInput
      .trim()
      .replace(/\s+/g, "")
      .toUpperCase();

    if (!cleaned) {
      setStatus(en ? "❗ enter a room code" : "❗ zadej kód místnosti");
      return;
    }

    router.push(`/room/${cleaned}`);
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 520, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h1 style={{ marginBottom: 8 }}>{en ? "Country • City" : "Země Město"}</h1>

        <label aria-label="Jazyk hry">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as RoomLanguage)}
            style={{ padding: 10, borderRadius: 8 }}
          >
            <option value="en">🇬🇧 English</option>
            <option value="cs">🇨🇿 Čeština</option>
          </select>
        </label>
      </div>

      <p>{en ? "Create a room, share the link with other players and play together." : "Vytvoř místnost, pošli odkaz ostatním hráčům a hrajte společně."}</p>

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>{en ? "Test room version" : "Testovací verze místnosti"}</h2>

        <label style={{ display: "block", marginTop: 10 }}>
          {en ? "Version" : "Verze"}
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
            {en
              ? "Free: ads, up to 3 players, fixed categories Country / City / Name."
              : "Free: reklamy, až 3 hráči, pevné kategorie Země / Město / Jméno."}
          </p>
        )}

        {tier === "premium" && (
          <p style={{ opacity: 0.75, fontSize: 14, marginTop: 10 }}>
            {en
              ? "Premium – CZK 69: no ads, max. 5 players. Fixed basic categories: Country, City, Name, Animal, Thing, Plant."
              : "Premium – 69 Kč: bez reklam, max. 5 hráčů. Pevně dané základní kategorie: Země, Město, Jméno, Zvíře, Věc, Rostlina."}
          </p>
        )}

        {tier === "super_premium" && (
          <div style={{ opacity: 0.75, fontSize: 14, marginTop: 10 }}>
            <p>
              {en
                ? "Super Premium – CZK 129: no ads, unlimited players, all basic and extended categories included, category type and order selection, up to 5 custom categories."
                : "Super Premium – 129 Kč: bez reklam, neomezený počet hráčů, všechny základní i rozšířené kategorie v ceně, volba typu kategorií a jejich pořadí, možnost vytvořit si až 5 vlastních kategorií."}
            </p>

            <p style={{ marginBottom: 0 }}>
              {en
                ? "Categories in Super Premium: Country, City, Name, Animal, Thing, Plant, Film / Series, Actor / Actress, Singer / Band, Sport, Brand, Car / Motorbike, River / Mountain, Job, Colour."
                : "Kategorie v Super Premium: Země, Město, Jméno, Zvíře, Věc, Rostlina, Film / Seriál, Herec / Herečka, Zpěvák / Zpěvačka / Kapela, Sport, Značka, Auto / Moto, Řeka / Hora, Povolání, Barva."}
            </p>
          </div>
        )}
</section>

      <button
        onClick={createRoom}
        disabled={creating}
        style={{ padding: 14, marginTop: 16, width: "100%" }}
      >
        {creating ? (en ? "Creating…" : "Vytvářím…") : en ? "Create game" : "Vytvořit hru"}
      </button>

      <div style={{ marginTop: 28, borderTop: "1px solid #ddd", paddingTop: 20 }}>
        <h2>{en ? "Join a room" : "Připojit se k místnosti"}</h2>

        <input
          placeholder={en ? "Room code" : "Kód místnosti"}
          value={roomCodeInput}
          onChange={(e) => setRoomCodeInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") joinRoomByCode();
          }}
          style={{ padding: 12, width: "100%", textTransform: "uppercase" }}
        />

        <button onClick={joinRoomByCode} style={{ padding: 14, marginTop: 12, width: "100%" }}>
          {en ? "Join" : "Připojit se"}
        </button>
      </div>

      {status && <p style={{ marginTop: 16 }}>{status}</p>}
    </main>
  );
}
