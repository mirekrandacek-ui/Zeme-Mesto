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
type UiLanguage = "cs" | "en" | "es" | "de" | "fr";
type RoomLanguage =
  | UiLanguage
  | "pt-BR"
  | "de"
  | "fr"
  | "id"
  | "tr"
  | "pl"
  | "it";

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

const ENABLED_UI_LANGUAGES: readonly UiLanguage[] = [
  "en",
  "es",
  "de",
  "fr",
  "cs",
];

const ENABLED_GAME_LANGUAGES: readonly RoomLanguage[] = [
  "en",
  "es",
  "cs",
  "pt-BR",
  "de",
  "fr",
  "id",
  "tr",
  "pl",
  "it",
];

function isRoomLanguage(value: string | null): value is RoomLanguage {
  return ENABLED_GAME_LANGUAGES.includes(value as RoomLanguage);
}

const LANGUAGE_FLAGS: Record<RoomLanguage, string> = {
  cs: "🇨🇿",
  en: "🇬🇧",
  es: "🇪🇸",
  "pt-BR": "🇧🇷",
  de: "🇩🇪",
  fr: "🇫🇷",
  id: "🇮🇩",
  tr: "🇹🇷",
  pl: "🇵🇱",
  it: "🇮🇹",
};

const LANGUAGE_NAMES: Record<
  UiLanguage,
  Record<RoomLanguage, string>
> = {
  cs: {
    cs: "Čeština",
    en: "Angličtina",
    es: "Španělština",
    "pt-BR": "Brazilská portugalština",
    de: "Němčina",
    fr: "Francouzština",
    id: "Indonéština",
    tr: "Turečtina",
    pl: "Polština",
    it: "Italština",
  },
  en: {
    cs: "Czech",
    en: "English",
    es: "Spanish",
    "pt-BR": "Brazilian Portuguese",
    de: "German",
    fr: "French",
    id: "Indonesian",
    tr: "Turkish",
    pl: "Polish",
    it: "Italian",
  },
  es: {
    cs: "Checo",
    en: "Inglés",
    es: "Español",
    "pt-BR": "Portugués de Brasil",
    de: "Alemán",
    fr: "Francés",
    id: "Indonesio",
    tr: "Turco",
    pl: "Polaco",
    it: "Italiano",
  },
  de: {
    cs: "Tschechisch",
    en: "Englisch",
    es: "Spanisch",
    "pt-BR": "Brasilianisches Portugiesisch",
    de: "Deutsch",
    fr: "Französisch",
    id: "Indonesisch",
    tr: "Türkisch",
    pl: "Polnisch",
    it: "Italienisch",
  },

  fr: {
    cs: "Tchèque",
    en: "Anglais",
    es: "Espagnol",
    "pt-BR": "Portugais du Brésil",
    de: "Allemand",
    fr: "Français",
    id: "Indonésien",
    tr: "Turc",
    pl: "Polonais",
    it: "Italien",
  },

};

function languageOptionLabel(
  optionLanguage: RoomLanguage,
  uiLanguage: UiLanguage
) {
  return `${LANGUAGE_FLAGS[optionLanguage]} ${LANGUAGE_NAMES[uiLanguage][optionLanguage]}`;
}

const HOME_TEXT = {
  cs: {
    appTitleFirstLine: "Země Město",
    appTitleSecondLine: "",
    applicationLanguage: "Jazyk aplikace",
    creatingRoom: "vytvářím místnost…",
    roomCreateError: "❌ Místnost se nepodařilo vytvořit. Zkus to znovu.",
    uniqueRoomCodeError:
      "❌ Nepodařilo se vytvořit unikátní kód místnosti. Zkus to znovu.",
    roomCodeRequired: "❗ Zadej kód místnosti.",
    yourMode: "Tvůj režim",
    active: "Aktivní",
    gameLanguage: "Jazyk hry",
    gameLanguageHelp:
      "V tomto jazyce budeš psát odpovědi a zvolí se podle něj typ abecedy.",
    diacriticsHelp:
      "Diakritika se neřeší – odpovědi s háčky a čárkami i bez nich se berou stejně.",
    likeApp: "Líbí se vám aplikace?",
    haveRoomCode: "Mám kód místnosti",
    roomCode: "Kód místnosti",
    join: "Připojit se",
    privacyPolicy: "Zásady ochrany soukromí",
    intro: "Vytvoř místnost, pošli odkaz ostatním hráčům a hrajte společně.",
    billingNotReady: "Google Play Billing zatím není připravený.",
    productUnavailable: "Produkt zatím není dostupný.",
    purchaseWindowError: "Nákupní okno se nepodařilo otevřít.",
    purchaseStartError: "Nákup se nepodařilo spustit.",
    freeDescription:
      "Reklamy, až 3 hráči. Pevné kategorie: Země, Město, Jméno.",
    premiumDescription:
      "Bez reklam, max. 5 hráčů. Pevně dané základní kategorie: Země, Město, Jméno, Zvíře, Věc, Rostlina.",
    superPremiumDescription:
      "Bez reklam, neomezený počet hráčů, volba počtu a pořadí kategorií, časový limit na kolo, nastavení počtu kol a možnost vytvořit až 5 vlastních kategorií.",
    superPremiumCategories:
      "Kategorie: Země, Město, Jméno, Zvíře, Věc, Rostlina, Film / Seriál, Herec / Herečka, Zpěvák / Zpěvačka / Kapela, Sport, Značka, Auto / Moto, Řeka / Hora, Povolání, Barva.",
    creating: "Vytvářím…",
    createRoom: "Vytvořit místnost",
    hideOtherModes: "Skrýt další režimy",
    showOtherModes: "Zobrazit další režimy",
    includedInSuperPremium: "Součást Super Premium",
    buyPremium: "Koupit Premium",
    superPremiumPurchaseDescription:
      "Bez reklam, neomezený počet hráčů, všechny základní i rozšířené kategorie v ceně, volba počtu a pořadí kategorií, časový limit na kolo, nastavení počtu kol a možnost vytvořit až 5 vlastních kategorií.",
    upgradeToSuperPremium: "Upgradovat na Super Premium",
    upgradeToSuperPremiumFor: "Upgradovat na Super Premium za",
    buySuperPremium: "Koupit Super Premium",
    ratingUnavailable:
      "Hodnocení bude dostupné po vydání aplikace na Google Play.",
  },
  en: {
    appTitleFirstLine: "Stop:",
    appTitleSecondLine: "Categories Word Game",
    applicationLanguage: "Application language",
    creatingRoom: "creating room…",
    roomCreateError: "❌ The room could not be created. Try again.",
    uniqueRoomCodeError:
      "❌ Could not create a unique room code. Try again.",
    roomCodeRequired: "❗ Enter a room code.",
    yourMode: "Your mode",
    active: "Active",
    gameLanguage: "Game language",
    gameLanguageHelp:
      "You will write answers in this language and it will choose the alphabet type.",
    diacriticsHelp:
      "Accents do not matter – accented and non-accented answers count the same.",
    likeApp: "Do you like the app?",
    haveRoomCode: "I have a room code",
    roomCode: "Room code",
    join: "Join",
    privacyPolicy: "Privacy Policy",
    intro: "Create a room, share the link with other players and play together.",
    billingNotReady: "Google Play Billing is not ready.",
    productUnavailable: "The product is not available.",
    purchaseWindowError: "The purchase window could not be opened.",
    purchaseStartError: "The purchase could not be started.",
    freeDescription:
      "Ads, up to 3 players. Fixed categories: Country, City, Name.",
    premiumDescription:
      "No ads, up to 5 players. Fixed basic categories: Country, City, Name, Animal, Thing, Plant.",
    superPremiumDescription:
      "No ads, unlimited players, category selection and ordering, optional time limit per round, number of rounds, and up to 5 custom categories.",
    superPremiumCategories:
      "Categories: Country, City, Name, Animal, Thing, Plant, Film / Series, Actor / Actress, Singer / Band, Sport, Brand, Car / Motorbike, River / Mountain, Job, Colour.",
    creating: "Creating…",
    createRoom: "Create room",
    hideOtherModes: "Hide other modes",
    showOtherModes: "Show other modes",
    includedInSuperPremium: "Included in Super Premium",
    buyPremium: "Buy Premium",
    superPremiumPurchaseDescription:
      "No ads, unlimited players, all basic and extended categories included, category selection and ordering, optional time limit per round, number of rounds, and up to 5 custom categories.",
    upgradeToSuperPremium: "Upgrade to Super Premium",
    upgradeToSuperPremiumFor: "Upgrade to Super Premium for",
    buySuperPremium: "Buy Super Premium",
    ratingUnavailable:
      "Rating will be available after the app is released on Google Play.",
  },
  es: {
    appTitleFirstLine: "Basta:",
    appTitleSecondLine: "Juego de Categorías",
    applicationLanguage: "Idioma de la aplicación",
    creatingRoom: "creando sala…",
    roomCreateError:
      "❌ No se pudo crear la sala. Inténtalo de nuevo.",
    uniqueRoomCodeError:
      "❌ No se pudo crear un código de sala único. Inténtalo de nuevo.",
    roomCodeRequired: "❗ Introduce el código de la sala.",
    yourMode: "Tu modo",
    active: "Activo",
    gameLanguage: "Idioma del juego",
    gameLanguageHelp:
      "Escribirás las respuestas en este idioma y se elegirá el tipo de alfabeto según él.",
    diacriticsHelp:
      "Los acentos no importan – las respuestas con o sin acento cuentan igual.",
    likeApp: "¿Te gusta la aplicación?",
    haveRoomCode: "Tengo un código de sala",
    roomCode: "Código de sala",
    join: "Unirse",
    privacyPolicy: "Política de privacidad",
    intro: "Crea una sala, comparte el enlace con los demás jugadores y jugad juntos.",
    billingNotReady: "Google Play Billing no está preparado.",
    productUnavailable: "El producto no está disponible.",
    purchaseWindowError: "No se pudo abrir la ventana de compra.",
    purchaseStartError: "No se pudo iniciar la compra.",
    freeDescription:
      "Con anuncios, hasta 3 jugadores. Categorías fijas: País, Ciudad, Nombre.",
    premiumDescription:
      "Sin anuncios, hasta 5 jugadores. Categorías básicas fijas: País, Ciudad, Nombre, Animal, Cosa, Planta.",
    superPremiumDescription:
      "Sin anuncios, jugadores sin límite, selección y orden de categorías, límite de tiempo por ronda, número de rondas y hasta 5 categorías propias.",
    superPremiumCategories:
      "Categorías: País, Ciudad, Nombre, Animal, Cosa, Planta, Película / Serie, Actor / Actriz, Cantante / Banda, Deporte, Marca, Coche / Moto, Río / Montaña, Profesión, Color.",
    creating: "Creando…",
    createRoom: "Crear sala",
    hideOtherModes: "Ocultar otros modos",
    showOtherModes: "Mostrar otros modos",
    includedInSuperPremium: "Incluido en Super Premium",
    buyPremium: "Comprar Premium",
    superPremiumPurchaseDescription:
      "Sin anuncios, jugadores sin límite, todas las categorías básicas y ampliadas incluidas, selección y orden de categorías, límite de tiempo por ronda, número de rondas y hasta 5 categorías propias.",
    upgradeToSuperPremium: "Pasar a Super Premium",
    upgradeToSuperPremiumFor: "Pasar a Super Premium por",
    buySuperPremium: "Comprar Super Premium",
    ratingUnavailable:
      "La valoración estará disponible después del lanzamiento en Google Play.",
  },

  de: {
    appTitleFirstLine: "Stadt Land Fluss:",
    appTitleSecondLine: "Wortspiel",
    applicationLanguage: "App-Sprache",
    creatingRoom: "Raum wird erstellt…",
    roomCreateError:
      "❌ Der Raum konnte nicht erstellt werden. Versuche es erneut.",
    uniqueRoomCodeError:
      "❌ Es konnte kein eindeutiger Raumcode erstellt werden. Versuche es erneut.",
    roomCodeRequired: "❗ Gib einen Raumcode ein.",
    yourMode: "Dein Modus",
    active: "Aktiv",
    gameLanguage: "Spielsprache",
    gameLanguageHelp:
      "Du schreibst die Antworten in dieser Sprache. Das passende Alphabet wird automatisch ausgewählt.",
    diacriticsHelp:
      "Sonderzeichen sind optional – Antworten mit und ohne sie werden gleich gewertet.",
    likeApp: "Gefällt dir die App?",
    haveRoomCode: "Ich habe einen Raumcode",
    roomCode: "Raumcode",
    join: "Beitreten",
    privacyPolicy: "Datenschutzerklärung",
    intro:
      "Erstelle einen Raum, teile den Link mit den anderen Spielern und spielt gemeinsam.",
    billingNotReady: "Google Play Billing ist noch nicht bereit.",
    productUnavailable: "Das Produkt ist derzeit nicht verfügbar.",
    purchaseWindowError: "Das Kauffenster konnte nicht geöffnet werden.",
    purchaseStartError: "Der Kauf konnte nicht gestartet werden.",
    freeDescription:
      "Werbung, bis zu 3 Spieler. Feste Kategorien: Land, Stadt, Name.",
    premiumDescription:
      "Keine Werbung, bis zu 5 Spieler. Feste Grundkategorien: Land, Stadt, Name, Tier, Gegenstand, Pflanze.",
    superPremiumDescription:
      "Keine Werbung, unbegrenzt viele Spieler, Auswahl und Reihenfolge der Kategorien, optionales Zeitlimit pro Runde, Anzahl der Runden und bis zu 5 eigene Kategorien.",
    superPremiumCategories:
      "Kategorien: Land, Stadt, Name, Tier, Gegenstand, Pflanze, Film / Serie, Schauspieler / Schauspielerin, Sänger / Sängerin / Band, Sportart, Marke, Auto / Motorrad, Fluss / Berg, Beruf, Farbe.",
    creating: "Wird erstellt…",
    createRoom: "Raum erstellen",
    hideOtherModes: "Weitere Modi ausblenden",
    showOtherModes: "Weitere Modi anzeigen",
    includedInSuperPremium: "In Super Premium enthalten",
    buyPremium: "Premium kaufen",
    superPremiumPurchaseDescription:
      "Keine Werbung, unbegrenzt viele Spieler, alle Grund- und Zusatzkategorien enthalten, Auswahl und Reihenfolge der Kategorien, optionales Zeitlimit pro Runde, Anzahl der Runden und bis zu 5 eigene Kategorien.",
    upgradeToSuperPremium: "Auf Super Premium upgraden",
    upgradeToSuperPremiumFor: "Auf Super Premium upgraden für",
    buySuperPremium: "Super Premium kaufen",
    ratingUnavailable:
      "Die Bewertung ist verfügbar, sobald die App bei Google Play veröffentlicht wurde.",
  },

  fr: {
    appTitleFirstLine: "Petit Bac:",
    appTitleSecondLine: "Jeu de catégories",
    applicationLanguage: "Langue de l’application",
    creatingRoom: "création de la salle…",
    roomCreateError: "❌ Impossible de créer la salle. Réessaie.",
    uniqueRoomCodeError: "❌ Impossible de créer un code de salle unique. Réessaie.",
    roomCodeRequired: "❗ Saisis un code de salle.",
    yourMode: "Ton mode",
    active: "Actif",
    gameLanguage: "Langue du jeu",
    gameLanguageHelp: "Tu écriras les réponses dans cette langue et l’alphabet adapté sera choisi automatiquement.",
    diacriticsHelp: "Les accents ne sont pas obligatoires – les réponses avec ou sans accents comptent de la même façon.",
    likeApp: "Tu aimes l’application ?",
    haveRoomCode: "J’ai un code de salle",
    roomCode: "Code de salle",
    join: "Rejoindre",
    privacyPolicy: "Politique de confidentialité",
    intro: "Crée une salle, partage le lien avec les autres joueurs et jouez tous ensemble.",
    billingNotReady: "La facturation Google Play n’est pas encore prête.",
    productUnavailable: "Le produit n’est pas disponible.",
    purchaseWindowError: "Impossible d’ouvrir la fenêtre d’achat.",
    purchaseStartError: "Impossible de démarrer l’achat.",
    freeDescription: "Publicités, jusqu’à 3 joueurs. Catégories fixes : Pays, Ville, Prénom.",
    premiumDescription: "Sans publicité, jusqu’à 5 joueurs. Catégories de base fixes : Pays, Ville, Prénom, Animal, Objet, Plante.",
    superPremiumDescription: "Sans publicité, nombre de joueurs illimité, sélection et ordre des catégories, limite de temps facultative par manche, nombre de manches et jusqu’à 5 catégories personnalisées.",
    superPremiumCategories: "Catégories : Pays, Ville, Prénom, Animal, Objet, Plante, Film / Série, Acteur / Actrice, Chanteur / Chanteuse / Groupe, Sport, Marque, Voiture / Moto, Rivière / Montagne, Métier, Couleur.",
    creating: "Création…",
    createRoom: "Créer une salle",
    hideOtherModes: "Masquer les autres modes",
    showOtherModes: "Afficher les autres modes",
    includedInSuperPremium: "Inclus dans Super Premium",
    buyPremium: "Acheter Premium",
    superPremiumPurchaseDescription: "Sans publicité, nombre de joueurs illimité, toutes les catégories de base et supplémentaires incluses, sélection et ordre des catégories, limite de temps facultative par manche, nombre de manches et jusqu’à 5 catégories personnalisées.",
    upgradeToSuperPremium: "Passer à Super Premium",
    upgradeToSuperPremiumFor: "Passer à Super Premium pour",
    buySuperPremium: "Acheter Super Premium",
    ratingUnavailable: "L’évaluation sera disponible après la publication de l’application sur Google Play.",
  },
} as const;

type HomeTextKey = keyof typeof HOME_TEXT.cs;

function getHomeText(language: UiLanguage, key: HomeTextKey) {
  return HOME_TEXT[language][key];
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
  const [language, setLanguage] = useState<UiLanguage>("cs");
  const [gameLanguage, setGameLanguage] = useState<RoomLanguage>("cs");
  const [nativeFreeBannerShown, setNativeFreeBannerShown] = useState(false);
  const [showOtherModes, setShowOtherModes] = useState(false);
  const [billingProducts, setBillingProducts] = useState<BillingProduct[]>([]);
  const [billingReady, setBillingReady] = useState(false);
  const [purchaseBusy, setPurchaseBusy] =
    useState<"premium" | "super_premium" | null>(null);

  const en = language === "en";
  const es = language === "es";
  const h = (key: HomeTextKey) => getHomeText(language, key);

  useEffect(() => {
    const savedUiLanguage = window.localStorage.getItem("zm_uiLanguage");
    const savedGameLanguage = window.localStorage.getItem("zm_gameLanguage");
    const deviceLanguage = window.navigator.language.toLowerCase();

    const detectedLanguage: UiLanguage =
      deviceLanguage.startsWith("cs") || deviceLanguage.startsWith("sk")
        ? "cs"
        : deviceLanguage.startsWith("es")
          ? "es"
          : deviceLanguage.startsWith("de")
            ? "de"
            : deviceLanguage.startsWith("fr")
              ? "fr"
              : "en";

    const initialUiLanguage: UiLanguage =
      savedUiLanguage === "cs" ||
      savedUiLanguage === "en" ||
      savedUiLanguage === "es" ||
      savedUiLanguage === "de" ||
      savedUiLanguage === "fr"
        ? savedUiLanguage
        : detectedLanguage;

    const initialGameLanguage: RoomLanguage =
      isRoomLanguage(savedGameLanguage)
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
      window.alert(h("billingNotReady"));
      return;
    }

    if (!billingProducts.some((product) => product.productId === productId)) {
      window.alert(h("productUnavailable"));
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
        console.error("Google Play Billing error:", result.debugMessage);
        window.alert(h("purchaseWindowError"));
      }
    } catch (error) {
      console.error("Google Play purchase failed:", error);
      window.alert(h("purchaseStartError"));
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
    setStatus(h("creatingRoom"));

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
        console.error("Room creation failed:", error);
        setStatus(h("roomCreateError"));
        setCreating(false);
        return;
      }
    }

    setStatus(h("uniqueRoomCodeError"));
    setCreating(false);
  }

  function joinRoomByCode() {
    const cleaned = roomCodeInput
      .trim()
      .replace(/\s+/g, "")
      .toUpperCase();

    if (!cleaned) {
      setStatus(h("roomCodeRequired"));
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
          <span style={{ whiteSpace: "nowrap" }}>
            {h("appTitleFirstLine")}
          </span>
          {h("appTitleSecondLine") && (
            <>
              <br />
              {h("appTitleSecondLine")}
            </>
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

          <label aria-label={h("applicationLanguage")}>
            <span style={{ display: "block", marginBottom: 6, fontWeight: 700 }}>
              {h("applicationLanguage")}
            </span>

            <select
              value={language}
              onChange={(e) => {
                const selectedLanguage = e.target.value as UiLanguage;
                setLanguage(selectedLanguage);
                window.localStorage.setItem("zm_uiLanguage", selectedLanguage);
              }}
              style={{ padding: 10, borderRadius: 8 }}
            >
              {ENABLED_UI_LANGUAGES.map((optionLanguage) => (
                <option key={optionLanguage} value={optionLanguage}>
                  {languageOptionLabel(optionLanguage, language)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <p>{h("intro")}</p>

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
            {h("yourMode")}: {tierLabel(tier)}
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
            {h("active")}
          </span>
        </div>

        {tier === "free" && (
          <p style={{ marginBottom: 0 }}>{h("freeDescription")}</p>
        )}

        {tier === "premium" && (
          <p style={{ marginBottom: 0 }}>{h("premiumDescription")}</p>
        )}

        {tier === "super_premium" && (
          <div>
            <p>{h("superPremiumDescription")}</p>
            <p style={{ marginBottom: 0 }}>
              {h("superPremiumCategories")}
            </p>
          </div>
        )}

        <label style={{ display: "block", marginTop: 16 }}>
          <span style={{ display: "block", marginBottom: 6, fontWeight: 700 }}>
            {h("gameLanguage")}
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
            {ENABLED_GAME_LANGUAGES.map((optionLanguage) => (
              <option key={optionLanguage} value={optionLanguage}>
                {languageOptionLabel(optionLanguage, language)}
              </option>
            ))}
          </select>

          <span
            style={{
              display: "block",
              marginTop: 6,
              fontSize: 13,
              opacity: 0.75,
            }}
          >
            {h("gameLanguageHelp")}
          </span>

            <span
              style={{
                display: "block",
                marginTop: 6,
                fontSize: 13,
                opacity: 0.75,
              }}
            >
              {h("diacriticsHelp")}
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
          {creating ? h("creating") : h("createRoom")}
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
        {showOtherModes ? h("hideOtherModes") : h("showOtherModes")}
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
            <h3 style={{ marginTop: 0 }}>
              Premium{premiumPrice ? ` – ${premiumPrice}` : ""}
            </h3>

            <p>{h("premiumDescription")}</p>

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
                ? h("active")
                : tier === "super_premium"
                  ? h("includedInSuperPremium")
                  : h("buyPremium")}
            </button>
          </article>

          <article
            style={{
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: 14,
            }}
          >
            <h3 style={{ marginTop: 0 }}>
              Super Premium
              {superPremiumPrice ? ` – ${superPremiumPrice}` : ""}
            </h3>

            <p>{h("superPremiumPurchaseDescription")}</p>
            <p>{h("superPremiumCategories")}</p>

            <button
              type="button"
              disabled={tier === "super_premium" || purchaseBusy !== null}
              onClick={() => void startPlayPurchase("super_premium")}
              style={{ padding: 12, width: "100%" }}
            >
              {tier === "super_premium"
                ? h("active")
                : tier === "premium"
                  ? superPremiumUpgradePrice
                    ? `${h("upgradeToSuperPremiumFor")} ${superPremiumUpgradePrice}`
                    : h("upgradeToSuperPremium")
                  : h("buySuperPremium")}
            </button>
          </article>
        </section>
      )}

              <button
          type="button"
          onClick={() =>
            window.alert(h("ratingUnavailable"))
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
          {h("likeApp")}
        </button>

        <details
          style={{
            marginTop: 16,
            borderTop: "1px solid #ddd",
            paddingTop: 14,
          }}
        >
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>
            {h("haveRoomCode")}
          </summary>

          <div style={{ marginTop: 12 }}>
            <input
              placeholder={h("roomCode")}
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
              {h("join")}
            </button>
          </div>
        </details>

      {status && <p style={{ marginTop: 16 }}>{status}</p>}
        <p style={{ marginTop: 18, fontSize: 13, textAlign: "center", opacity: 0.75 }}>
          <a href="/privacy" style={{ color: "inherit" }}>
            {h("privacyPolicy")}
          </a>
        </p>

    </main>
  );
}
