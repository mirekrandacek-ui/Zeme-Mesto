"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import {
  hideFreeBannerAdForNativeApp,
  isNativeAdMobAvailable,
  showFreeBannerAdForNativeApp,
} from "@/lib/admob";
import {
  isPlayBillingAvailable,
  PlayBilling,
  type BillingProduct,
} from "@/lib/playBilling";

type Tier = "free" | "premium" | "super_premium";
type RoomLanguage = "cs" | "en" | "es";

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

  const [tier, setTier] = useState<Tier>("free");
  const [language, setLanguage] = useState<RoomLanguage>("cs");
  const [gameLanguage, setGameLanguage] = useState<RoomLanguage>("cs");
  const [nativeFreeBannerShown, setNativeFreeBannerShown] = useState(false);
  const [showOtherModes, setShowOtherModes] = useState(false);
  const [billingProducts, setBillingProducts] = useState<BillingProduct[]>([]);
  const [billingReady, setBillingReady] = useState(false);
  const [purchaseBusy, setPurchaseBusy] =
    useState<"premium" | "super_premium" | null>(null);

  const en = language === "en";
  const es = language === "es";

  useEffect(() => {
    const savedUiLanguage = window.localStorage.getItem("zm_uiLanguage");
    const savedGameLanguage = window.localStorage.getItem("zm_gameLanguage");
    const deviceLanguage = window.navigator.language.toLowerCase();

    const detectedLanguage: RoomLanguage =
      deviceLanguage.startsWith("cs") || deviceLanguage.startsWith("sk")
        ? "cs"
        : deviceLanguage.startsWith("es")
          ? "es"
          : "en";

    const initialUiLanguage: RoomLanguage =
      savedUiLanguage === "cs" || savedUiLanguage === "en" || savedUiLanguage === "es"
        ? savedUiLanguage
        : detectedLanguage;

    const initialGameLanguage: RoomLanguage =
      savedGameLanguage === "cs" ||
      savedGameLanguage === "en" ||
      savedGameLanguage === "es"
        ? savedGameLanguage
        : initialUiLanguage;

    setLanguage(initialUiLanguage);
    setGameLanguage(initialGameLanguage);
  }, []);

  useEffect(() => {
    if (!isPlayBillingAvailable()) return;

    async function loadPlayBilling() {
      try {
        const connection = await PlayBilling.connect();
        if (!connection.ready) return;

        setBillingReady(true);

        const [productsResult, purchasesResult] = await Promise.all([
          PlayBilling.getProducts(),
          PlayBilling.getPurchases(),
        ]);

        setBillingProducts(productsResult.products ?? []);

        const ownedProducts = new Set(
          (purchasesResult.purchases ?? [])
            .filter((purchase) => purchase.purchaseState === 1)
            .flatMap((purchase) => purchase.productIds)
        );

        if (ownedProducts.has("super_premium")) {
          setTier("super_premium");
        } else if (ownedProducts.has("premium")) {
          setTier("premium");
        }
      } catch (error) {
        console.error("Google Play Billing init failed:", error);
      }
    }

    void loadPlayBilling();
  }, []);

  useEffect(() => {
    if (!isPlayBillingAvailable()) return;

    let active = true;
    let listenerHandle: { remove: () => Promise<void> } | undefined;

    void PlayBilling.addListener("purchaseUpdated", (event) => {
      if (!active || event.status !== "purchased") return;

      if (event.productIds.includes("super_premium")) {
        setTier("super_premium");
      } else if (event.productIds.includes("premium")) {
        setTier("premium");
      }
    }).then((handle) => {
      if (!active) {
        void handle.remove();
        return;
      }

      listenerHandle = handle;
    });

    return () => {
      active = false;
      if (listenerHandle) void listenerHandle.remove();
    };
  }, []);

  async function startPlayPurchase(
    productId: "premium" | "super_premium"
  ) {
    if (!isPlayBillingAvailable() || !billingReady) {
      window.alert(
        en
          ? "Google Play Billing is not ready."
          : es
            ? "Google Play Billing no está preparado."
            : "Google Play Billing zatím není připravený."
      );
      return;
    }

    if (!billingProducts.some((product) => product.productId === productId)) {
      window.alert(
        en
          ? "The product is not available."
          : es
            ? "El producto no está disponible."
            : "Produkt zatím není dostupný."
      );
      return;
    }

    setPurchaseBusy(productId);

    try {
      const result = await PlayBilling.purchase({
        productId,
        ...(productId === "super_premium" && tier === "premium"
          ? { offerId: "premium-upgrade" }
          : {}),
      });

      if (result.responseCode !== 0) {
        window.alert(result.debugMessage || "Google Play Billing error.");
      }
    } catch (error) {
      console.error("Google Play purchase failed:", error);
      window.alert(
        en
          ? "The purchase could not be started."
          : es
            ? "No se pudo iniciar la compra."
            : "Nákup se nepodařilo spustit."
      );
    } finally {
      setPurchaseBusy(null);
    }
  }

  const premiumPrice =
    billingProducts.find((product) => product.productId === "premium")
      ?.formattedPrice;

  const superPremiumProduct =
    billingProducts.find((product) => product.productId === "super_premium");

  const superPremiumPrice =
    superPremiumProduct?.formattedPrice;

  const superPremiumUpgradePrice =
    superPremiumProduct?.offers?.find(
      (offer) => offer.offerId === "premium-upgrade"
    )?.formattedPrice;

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

  useEffect(() => {
    let cancelled = false;

    async function updateHomeFreeBanner() {
      if (!isNativeAdMobAvailable()) {
        setNativeFreeBannerShown(false);
        return;
      }

      if (tier === "free") {
        if (!cancelled) setNativeFreeBannerShown(true);
        await showFreeBannerAdForNativeApp();
        return;
      }

      await hideFreeBannerAdForNativeApp();
      if (!cancelled) setNativeFreeBannerShown(false);
    }

    void updateHomeFreeBanner();

    return () => {
      cancelled = true;
    };
  }, [tier]);

  async function createRoom() {
    if (creating) return;

    setCreating(true);
    setStatus(en ? "creating room…" : es ? "creando sala…" : "vytvářím místnost…");

    const roomSettings = getRoomSettings();

    for (let attempt = 1; attempt <= 5; attempt++) {
      const roomCode = createRoomCode();
      const creatorToken = createCreatorToken();

      const { error } = await supabase.from("rooms").insert({
        code: roomCode,
        status: "lobby",
        letter: null,
        creator_token: creatorToken,
        language: gameLanguage,
        ...roomSettings,
      });

      if (!error) {
        if (typeof window !== "undefined") {
          localStorage.setItem(`zm_roomCreatorToken_${roomCode}`, creatorToken);
        }

        router.push(`/room/${roomCode}?ui=${language}`);
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

    router.push(`/room/${cleaned}?ui=${language}`);
  }

  return (
    <main
      style={{
        padding: 24,
        paddingTop: tier === "free"
          ? "calc(72px + env(safe-area-inset-top))"
          : 24,
        fontFamily: "system-ui",
        maxWidth: 520,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <h1
          style={{
            marginBottom: 8,
            lineHeight: 1.05,
          }}
        >
          {en ? (
            <>
              Stop:
              <br />
              Categories Word Game
            </>
          ) : es ? (
            <>
              Basta:
              <br />
              Juego de Categorías
            </>
          ) : (
            <span style={{ whiteSpace: "nowrap" }}>Země Město</span>
          )}
        </h1>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >

          <label aria-label={en ? "Application language" : es ? "Idioma de la aplicación" : "Jazyk aplikace"}>
            <span style={{ display: "block", marginBottom: 6, fontWeight: 700 }}>
              {en ? "Application language" : es ? "Idioma de la aplicación" : "Jazyk aplikace"}
            </span>

            <select
              value={language}
              onChange={(e) => {
                const selectedLanguage = e.target.value as RoomLanguage;
                setLanguage(selectedLanguage);
                window.localStorage.setItem("zm_uiLanguage", selectedLanguage);
              }}
              style={{ padding: 10, borderRadius: 8 }}
            >
              <option value="en">🇬🇧 English</option>
              <option value="es">🇪🇸 Español</option>
              <option value="cs">🇨🇿 Čeština</option>
            </select>
          </label>
        </div>
      </div>

      <p>
        {en
          ? "Create a room, share the link with other players and play together."
          : es
            ? "Crea una sala, comparte el enlace con los demás jugadores y jugad juntos."
            : "Vytvoř místnost, pošli odkaz ostatním hráčům a hrajte společně."}
      </p>

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
            {en ? "Your mode" : es ? "Tu modo" : "Tvůj režim"}: {tierLabel(tier)}
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
            {en ? "Active" : es ? "Activo" : "Aktivní"}
          </span>
        </div>

        {tier === "free" && (
          <p style={{ marginBottom: 0 }}>
            {en
              ? "Ads, up to 3 players. Fixed categories: Country, City, Name."
              : es
                ? "Con anuncios, hasta 3 jugadores. Categorías fijas: País, Ciudad, Nombre."
                : "Reklamy, až 3 hráči. Pevné kategorie: Země, Město, Jméno."}
          </p>
        )}

        {tier === "premium" && (
          <p style={{ marginBottom: 0 }}>
            {en
              ? "No ads, up to 5 players. Fixed basic categories: Country, City, Name, Animal, Thing, Plant."
              : es
                ? "Sin anuncios, hasta 5 jugadores. Categorías básicas fijas: País, Ciudad, Nombre, Animal, Cosa, Planta."
                : "Bez reklam, max. 5 hráčů. Pevně dané základní kategorie: Země, Město, Jméno, Zvíře, Věc, Rostlina."}
          </p>
        )}

        {tier === "super_premium" && (
          <div>
            <p>
              {en
                ? "No ads, unlimited players, category selection and ordering, optional time limit per round, number of rounds, and up to 5 custom categories."
                : es
                  ? "Sin anuncios, jugadores sin límite, selección y orden de categorías, límite de tiempo por ronda, número de rondas y hasta 5 categorías propias."
                  : "Bez reklam, neomezený počet hráčů, volba počtu a pořadí kategorií, časový limit na kolo, nastavení počtu kol a možnost vytvořit až 5 vlastních kategorií."}
            </p>

            <p style={{ marginBottom: 0 }}>
              {en
                ? "Categories: Country, City, Name, Animal, Thing, Plant, Film / Series, Actor / Actress, Singer / Band, Sport, Brand, Car / Motorbike, River / Mountain, Job, Colour."
                : es
                  ? "Categorías: País, Ciudad, Nombre, Animal, Cosa, Planta, Película / Serie, Actor / Actriz, Cantante / Banda, Deporte, Marca, Coche / Moto, Río / Montaña, Profesión, Color."
                  : "Kategorie: Země, Město, Jméno, Zvíře, Věc, Rostlina, Film / Seriál, Herec / Herečka, Zpěvák / Zpěvačka / Kapela, Sport, Značka, Auto / Moto, Řeka / Hora, Povolání, Barva."}
            </p>
          </div>
        )}

        <label style={{ display: "block", marginTop: 16 }}>
          <span style={{ display: "block", marginBottom: 6, fontWeight: 700 }}>
            {en ? "Game language" : es ? "Idioma del juego" : "Jazyk hry"}
          </span>

          <select
            value={gameLanguage}
            onChange={(e) => {
              const selectedGameLanguage = e.target.value as RoomLanguage;
              setGameLanguage(selectedGameLanguage);
              window.localStorage.setItem(
                "zm_gameLanguage",
                selectedGameLanguage
              );
            }}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 8,
            }}
          >
            <option value="en">🇬🇧 English</option>
            <option value="es">🇪🇸 Español</option>
            <option value="cs">🇨🇿 Čeština</option>
          </select>

          <span
            style={{
              display: "block",
              marginTop: 6,
              fontSize: 13,
              opacity: 0.75,
            }}
          >
            {en
              ? "You will write answers in this language and it will choose the alphabet type."
              : es
                ? "Escribirás las respuestas en este idioma y se elegirá el tipo de alfabeto según él."
                : "V tomto jazyce budeš psát odpovědi a zvolí se podle něj typ abecedy."}
          </span>

            <span
              style={{
                display: "block",
                marginTop: 6,
                fontSize: 13,
                opacity: 0.75,
              }}
            >
              {en
                ? "Accents do not matter – accented and non-accented answers count the same."
                : es
                  ? "Los acentos no importan – las respuestas con o sin acento cuentan igual."
                  : "Diakritika se neřeší – odpovědi s háčky a čárkami i bez nich se berou stejně."}
            </span>
        </label>

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
              : es
                ? "Creando…"
                : "Vytvářím…"
            : en
              ? "Create room"
              : es
                ? "Crear sala"
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
            : es
              ? "Ocultar otros modos"
              : "Skrýt další režimy"
          : en
            ? "Show other modes"
            : es
              ? "Mostrar otros modos"
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
            <h3 style={{ marginTop: 0 }}>Premium{premiumPrice ? ` – ${premiumPrice}` : ""}</h3>

            <p>
              {en
                ? "No ads, up to 5 players. Fixed basic categories: Country, City, Name, Animal, Thing, Plant. The local price will be shown during purchase."
                : es
                  ? "Sin anuncios, hasta 5 jugadores. Categorías básicas fijas: País, Ciudad, Nombre, Animal, Cosa, Planta. El precio local se mostrará durante la compra."
                  : "Bez reklam, max. 5 hráčů. Pevně dané základní kategorie: Země, Město, Jméno, Zvíře, Věc, Rostlina."}
            </p>

            <button
              type="button"
              disabled={
                tier === "premium" ||
                tier === "super_premium" ||
                purchaseBusy !== null
              }
              onClick={() => void startPlayPurchase("premium")}
              style={{ padding: 12, width: "100%" }}
            >
              {tier === "premium"
                ? en
                  ? "Active"
                  : es
                    ? "Activo"
                    : "Aktivní"
                : tier === "super_premium"
                  ? en
                    ? "Included in Super Premium"
                    : es
                      ? "Incluido en Super Premium"
                      : "Součást Super Premium"
                  : en
                    ? "Buy Premium"
                    : es
                      ? "Comprar Premium"
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
            <h3 style={{ marginTop: 0 }}>Super Premium{superPremiumPrice ? ` – ${superPremiumPrice}` : ""}</h3>

            <p>
              {en
                ? "No ads, unlimited players, all basic and extended categories included, category selection and ordering, optional time limit per round, number of rounds, and up to 5 custom categories. The local price will be shown during purchase."
                : es
                  ? "Sin anuncios, jugadores sin límite, todas las categorías básicas y ampliadas incluidas, selección y orden de categorías, límite de tiempo por ronda, número de rondas y hasta 5 categorías propias. El precio local se mostrará durante la compra."
                  : "Bez reklam, neomezený počet hráčů, všechny základní i rozšířené kategorie v ceně, volba počtu a pořadí kategorií, časový limit na kolo, nastavení počtu kol a možnost vytvořit až 5 vlastních kategorií."}
            </p>


            <p>
              {en
                ? "Categories: Country, City, Name, Animal, Thing, Plant, Film / Series, Actor / Actress, Singer / Band, Sport, Brand, Car / Motorbike, River / Mountain, Job, Colour."
                : es
                  ? "Categorías: País, Ciudad, Nombre, Animal, Cosa, Planta, Película / Serie, Actor / Actriz, Cantante / Banda, Deporte, Marca, Coche / Moto, Río / Montaña, Profesión, Color."
                  : "Kategorie: Země, Město, Jméno, Zvíře, Věc, Rostlina, Film / Seriál, Herec / Herečka, Zpěvák / Zpěvačka / Kapela, Sport, Značka, Auto / Moto, Řeka / Hora, Povolání, Barva."}
            </p>

            <button
              type="button"
              disabled={
                tier === "super_premium" ||
                purchaseBusy !== null
              }
              onClick={() => void startPlayPurchase("super_premium")}
              style={{ padding: 12, width: "100%" }}
            >
              {tier === "super_premium"
                ? en
                  ? "Active"
                  : es
                    ? "Activo"
                    : "Aktivní"
                : tier === "premium"
                  ? en
                    ? superPremiumUpgradePrice
                      ? `Upgrade to Super Premium for ${superPremiumUpgradePrice}`
                      : "Upgrade to Super Premium"
                    : es
                      ? superPremiumUpgradePrice
                        ? `Pasar a Super Premium por ${superPremiumUpgradePrice}`
                        : "Pasar a Super Premium"
                      : superPremiumUpgradePrice
                        ? `Upgradovat na Super Premium za ${superPremiumUpgradePrice}`
                        : "Upgradovat na Super Premium"
                  : en
                    ? "Buy Super Premium"
                    : es
                      ? "Comprar Super Premium"
                      : "Koupit Super Premium"}
            </button>
          </article>
        </section>
      )}

              <button
          type="button"
          onClick={() =>
            window.alert(
              en
                ? "Rating will be available after the app is released on Google Play."
                : es
                  ? "La valoración estará disponible después del lanzamiento en Google Play."
                  : "Hodnocení bude dostupné po vydání aplikace na Google Play."
            )
          }
          style={{
            marginTop: 14,
            padding: "9px 12px",
            width: "100%",
            border: "1px solid #b38b00",
            borderRadius: 8,
            background: "#fff5bf",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {en ? "Do you like the app?" : es ? "¿Te gusta la aplicación?" : "Líbí se vám aplikace?"}
        </button>

        <details
          style={{
            marginTop: 16,
            borderTop: "1px solid #ddd",
            paddingTop: 14,
          }}
        >
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>
            {en ? "I have a room code" : es ? "Tengo un código de sala" : "Mám kód místnosti"}
          </summary>

          <div style={{ marginTop: 12 }}>
            <input
              placeholder={en ? "Room code" : es ? "Código de sala" : "Kód místnosti"}
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") joinRoomByCode();
              }}
              style={{
                boxSizing: "border-box",
                padding: 12,
                width: "100%",
                textTransform: "uppercase",
                borderRadius: 8,
                border: "1px solid #bbb",
              }}
            />

            <button
              onClick={joinRoomByCode}
              style={{
                padding: 14,
                marginTop: 10,
                width: "100%",
                fontWeight: 700,
              }}
            >
              {en ? "Join" : es ? "Unirse" : "Připojit se"}
            </button>
          </div>
        </details>

      {status && <p style={{ marginTop: 16 }}>{status}</p>}
        <p style={{ marginTop: 18, fontSize: 13, textAlign: "center", opacity: 0.75 }}>
          <a href="/privacy" style={{ color: "inherit" }}>
            {en ? "Privacy Policy" : es ? "Política de privacidad" : "Zásady ochrany soukromí"}
          </a>
        </p>

    </main>
  );
}
