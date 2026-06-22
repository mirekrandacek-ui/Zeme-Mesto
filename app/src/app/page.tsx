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
  const [showOtherModes, setShowOtherModes] = useState(false);

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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <h1 style={{ marginBottom: 8 }}>{en ? "Stop: Categories Word Game" : "Země Město"}</h1>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={() =>
              window.alert(
                en
                  ? "Rating will be available after the app is released on Google Play."
                  : "Hodnocení bude dostupné po vydání aplikace na Google Play."
              )
            }
            style={{
              padding: "9px 12px",
              border: "1px solid #b38b00",
              borderRadius: 8,
              background: "#fff5bf",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {en ? "Do you like the app?" : "Líbí se vám aplikace?"}
          </button>

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
      </div>

      <p>{en ? "Create a room, share the link with other players and play together." : "Vytvoř místnost, pošli odkaz ostatním hráčům a hrajte společně."}</p>

      <section
        style={{
          border: "2px solid #2563eb",
          borderRadius: 12,
          padding: 16,
          marginTop: 16,
          background: "#f8fbff",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <h2 style={{ margin: 0 }}>
            {en ? "Your mode" : "Tvůj režim"}: {tierLabel(tier)}
          </h2>

          <span
            style={{
              padding: "4px 9px",
              borderRadius: 999,
              background: "#dbeafe",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {en ? "Active" : "Aktivní"}
          </span>
        </div>

        {tier === "free" && (
          <p style={{ marginBottom: 0 }}>
            {en
              ? "Ads, up to 3 players. Fixed categories: Country, City, Name."
              : "Reklamy, až 3 hráči. Pevné kategorie: Země, Město, Jméno."}
          </p>
        )}

        {tier === "premium" && (
          <p style={{ marginBottom: 0 }}>
            {en
              ? "No ads, up to 5 players. Fixed basic categories: Country, City, Name, Animal, Thing, Plant."
              : "Bez reklam, max. 5 hráčů. Pevně dané základní kategorie: Země, Město, Jméno, Zvíře, Věc, Rostlina."}
          </p>
        )}

        {tier === "super_premium" && (
          <div>
            <p>
              {en
                ? "No ads, unlimited players, category selection and ordering, and up to 5 custom categories."
                : "Bez reklam, neomezený počet hráčů, volba počtu a pořadí kategorií a možnost vytvořit až 5 vlastních kategorií."}
            </p>

            <p style={{ marginBottom: 0 }}>
              {en
                ? "Categories: Country, City, Name, Animal, Thing, Plant, Film / Series, Actor / Actress, Singer / Band, Sport, Brand, Car / Motorbike, River / Mountain, Job, Colour."
                : "Kategorie: Země, Město, Jméno, Zvíře, Věc, Rostlina, Film / Seriál, Herec / Herečka, Zpěvák / Zpěvačka / Kapela, Sport, Značka, Auto / Moto, Řeka / Hora, Povolání, Barva."}
            </p>
          </div>
        )}

        <button
          onClick={createRoom}
          disabled={creating}
          style={{
            padding: 16,
            marginTop: 16,
            width: "100%",
            fontWeight: 700,
            fontSize: 17,
          }}
        >
          {creating
            ? en
              ? "Creating…"
              : "Vytvářím…"
            : en
              ? "Create room"
              : "Vytvořit místnost"}
        </button>
      </section>

      <button
        type="button"
        onClick={() => setShowOtherModes((value) => !value)}
        style={{
          marginTop: 14,
          padding: 12,
          width: "100%",
          background: "transparent",
          border: "1px solid #aaa",
          borderRadius: 8,
          fontWeight: 700,
        }}
      >
        {showOtherModes
          ? en
            ? "Hide other modes"
            : "Skrýt další režimy"
          : en
            ? "Show other modes"
            : "Zobrazit další režimy"}
      </button>

      {showOtherModes && (
        <section style={{ marginTop: 14 }}>
          <article
            style={{
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: 14,
              marginBottom: 12,
            }}
          >
            <h3 style={{ marginTop: 0 }}>Premium – 69 Kč</h3>

            <p>
              {en
                ? "No ads, up to 5 players. Fixed basic categories: Country, City, Name, Animal, Thing, Plant. The local price will be shown during purchase."
                : "Bez reklam, max. 5 hráčů. Pevně dané základní kategorie: Země, Město, Jméno, Zvíře, Věc, Rostlina."}
            </p>

            <button
              type="button"
              disabled={tier === "premium" || tier === "super_premium"}
              onClick={() =>
                window.alert(
                  en
                    ? "Google Play purchases will be connected before release."
                    : "Nákup přes Google Play zapojíme před vydáním aplikace."
                )
              }
              style={{ padding: 12, width: "100%" }}
            >
              {tier === "premium"
                ? en
                  ? "Active"
                  : "Aktivní"
                : tier === "super_premium"
                  ? en
                    ? "Included in Super Premium"
                    : "Součást Super Premium"
                  : en
                    ? "Buy Premium"
                    : "Koupit Premium"}
            </button>
          </article>

          <article
            style={{
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: 14,
            }}
          >
            <h3 style={{ marginTop: 0 }}>Super Premium – 129 Kč</h3>

            <p>
              {en
                ? "No ads, unlimited players, all basic and extended categories included, category selection and ordering, and up to 5 custom categories. The local price will be shown during purchase."
                : "Bez reklam, neomezený počet hráčů, všechny základní i rozšířené kategorie v ceně, volba počtu a pořadí kategorií a možnost vytvořit až 5 vlastních kategorií."}
            </p>

            <p>
              {en
                ? "Categories: Country, City, Name, Animal, Thing, Plant, Film / Series, Actor / Actress, Singer / Band, Sport, Brand, Car / Motorbike, River / Mountain, Job, Colour."
                : "Kategorie: Země, Město, Jméno, Zvíře, Věc, Rostlina, Film / Seriál, Herec / Herečka, Zpěvák / Zpěvačka / Kapela, Sport, Značka, Auto / Moto, Řeka / Hora, Povolání, Barva."}
            </p>

            <button
              type="button"
              disabled={tier === "super_premium"}
              onClick={() =>
                window.alert(
                  en
                    ? "Google Play purchases will be connected before release."
                    : "Nákup přes Google Play zapojíme před vydáním aplikace."
                )
              }
              style={{ padding: 12, width: "100%" }}
            >
              {tier === "super_premium"
                ? en
                  ? "Active"
                  : "Aktivní"
                : tier === "premium"
                  ? en
                    ? "Upgrade to Super Premium"
                    : "Upgradovat na Super Premium za 60 Kč"
                  : en
                    ? "Buy Super Premium"
                    : "Koupit Super Premium"}
            </button>
          </article>
        </section>
      )}

      <details style={{ marginTop: 20, opacity: 0.75 }}>
        <summary style={{ cursor: "pointer" }}>
          {en ? "Developer mode" : "Vývojářský režim"}
        </summary>

        <label style={{ display: "block", marginTop: 10 }}>
          {en ? "Test active mode" : "Testovací aktivní režim"}
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as Tier)}
            style={{
              display: "block",
              marginTop: 6,
              padding: 12,
              width: "100%",
            }}
          >
            <option value="free">Free</option>
            <option value="premium">Premium</option>
            <option value="super_premium">Super Premium</option>
          </select>
        </label>
      </details>

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
