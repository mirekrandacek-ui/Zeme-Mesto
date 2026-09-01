"use client";

import { Share } from "@capacitor/share";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import {
  isNativeAdMobAvailable,
  showFreeBannerAdForNativeApp,
  showFreeRewardedAdForNativeApp,
} from "@/lib/admob";
import {
  acknowledgePlayPurchase,
  isPlayBillingAvailable,
  PlayBilling,
  type BillingProduct,
  verifyPlayPurchase,
} from "@/lib/playBilling";
import {
  consumeFreeRound,
  FREE_ROUND_BLOCK_SIZE,
  getFreeQuotaState,
  unlockFreeRoundBlock,
} from "@/lib/freeQuota";
import { useStableViewportUnit } from "@/lib/useStableViewportUnit";

import {
  categoryHelpText,
  gameLanguageInstructionText,
  gameLanguageNameText,
  getUiRules,
  getUiText,
  roomFullMessage,
  stopPressedMessage,
  type GameLanguage,
  type UiLanguage,
  type UiTextKey,
} from "./uiText";
import roomStyles from "./page.module.css";

type RoomStatus = "lobby" | "drawing" | "playing" | "scoring" | "finished";
type PlayerStatus = "active" | "waiting";
type Player = { id: string; name: string; status?: PlayerStatus };
type MyPlayer = { id: string; name: string; status?: PlayerStatus };
type RoundLite = { id: string; round_no: number; letter: string; status: string; deadline_at?: string | null };
type AnswerRow = { player_id: string; category: string; value: string };
type ScoreRow = { player_id: string; round?: number; category: string; points: number };

const CZECH_LETTERS = [
  "A",
  "B",
  "C",
  "Č",
  "D",
  "E",
  "F",
  "G",
  "H",
  "CH",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "R",
  "Ř",
  "S",
  "Š",
  "T",
  "U",
  "V",
  "Z",
  "Ž",
];

const ENGLISH_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const SPANISH_LETTERS = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("");
const GERMAN_LETTERS = [
  "A", "Ä", "B", "C", "D", "E", "F", "G", "H", "I",
  "J", "K", "L", "M", "N", "O", "Ö", "P", "Q", "R",
  "S", "T", "U", "Ü", "V", "W", "X", "Y", "Z",
];

const TURKISH_LETTERS = [
  "A", "B", "C", "Ç", "D", "E", "F", "G", "Ğ", "H",
  "I", "İ", "J", "K", "L", "M", "N", "O", "Ö", "P",
  "R", "S", "Ş", "T", "U", "Ü", "V", "Y", "Z",
];

const POLISH_LETTERS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J",
  "K", "L", "Ł", "M", "N", "O", "P", "R", "S", "T",
  "U", "W", "Z",
];

const ITALIAN_LETTERS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "L",
  "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V",
  "Z",
];
const ROLL_MS = 1500;
const TICK_MS = 35;
const ROUND_TIME_LIMIT_OPTIONS = [30, 60, 90, 120, 180] as const;
const ROUND_COUNT_LIMIT_OPTIONS = [5, 10, 15, 20] as const;

type RoundTimeLimitSeconds = (typeof ROUND_TIME_LIMIT_OPTIONS)[number] | null;
type RoundCountLimit = (typeof ROUND_COUNT_LIMIT_OPTIONS)[number] | null;

function parseRoundTimeLimit(value: unknown): RoundTimeLimitSeconds {
  const parsed = Number(value);
  return (ROUND_TIME_LIMIT_OPTIONS as readonly number[]).includes(parsed)
    ? (parsed as RoundTimeLimitSeconds)
    : null;
}

function parseRoundCountLimit(value: unknown): RoundCountLimit {
  const parsed = Number(value);
  return (ROUND_COUNT_LIMIT_OPTIONS as readonly number[]).includes(parsed)
    ? (parsed as RoundCountLimit)
    : null;
}

const DEFAULT_ACTIVE_CATEGORIES = ["Země", "Město", "Jméno"];

const PREMIUM_CATEGORIES = ["Země", "Město", "Jméno", "Zvíře", "Věc", "Rostlina"];

const SUPER_PREMIUM_EXTRA_CATEGORIES = [
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

const CATEGORY_PRODUCT_ID: Record<string, string> = {
  "Film / Seriál": "category_film_serial",
  "Herec / Herečka": "category_actor",
  "Zpěvák / Zpěvačka / Kapela": "category_music",
  Sport: "category_sport",
  Značka: "category_brand",
  "Auto / Moto": "category_auto_moto",
  "Řeka / Hora": "category_river_mountain",
  Povolání: "category_job",
  Barva: "category_color",
};

const CATEGORY_PRODUCT_IDS = new Set(Object.values(CATEGORY_PRODUCT_ID));

const ALL_PREDEFINED_CATEGORIES = [...PREMIUM_CATEGORIES, ...SUPER_PREMIUM_EXTRA_CATEGORIES];

const CATEGORY_LABELS_EN: Record<string, string> = {
  Země: "Country",
  Město: "City",
  Jméno: "Name",
  Zvíře: "Animal",
  Věc: "Thing",
  Rostlina: "Plant",
  "Film / Seriál": "Film / Series",
  "Herec / Herečka": "Actor / Actress",
  "Zpěvák / Zpěvačka / Kapela": "Singer / Band",
  Sport: "Sport",
  Značka: "Brand",
  "Auto / Moto": "Car / Motorbike",
  "Řeka / Hora": "River / Mountain",
  Povolání: "Job",
  Barva: "Colour",
};

const CATEGORY_LABELS_ES: Record<string, string> = {
  Země: "País",
  Město: "Ciudad",
  Jméno: "Nombre",
  Zvíře: "Animal",
  Věc: "Cosa",
  Rostlina: "Planta",
  "Film / Seriál": "Película / Serie",
  "Herec / Herečka": "Actor / Actriz",
  "Zpěvák / Zpěvačka / Kapela": "Cantante / Grupo",
  Sport: "Deporte",
  Značka: "Marca",
  "Auto / Moto": "Coche / Moto",
  "Řeka / Hora": "Río / Montaña",
  Povolání: "Profesión",
  Barva: "Color",
};

const CATEGORY_LABELS_DE: Record<string, string> = {
  Země: "Land",
  Město: "Stadt",
  Jméno: "Name",
  Zvíře: "Tier",
  Věc: "Gegenstand",
  Rostlina: "Pflanze",
  "Film / Seriál": "Film / Serie",
  "Herec / Herečka": "Schauspieler / Schauspielerin",
  "Zpěvák / Zpěvačka / Kapela": "Sänger / Sängerin / Band",
  Sport: "Sportart",
  Značka: "Marke",
  "Auto / Moto": "Auto / Motorrad",
  "Řeka / Hora": "Fluss / Berg",
  Povolání: "Beruf",
  Barva: "Farbe",
};

const CATEGORY_LABELS_FR: Record<string, string> = {
  Země: "Pays",
  Město: "Ville",
  Jméno: "Prénom",
  Zvíře: "Animal",
  Věc: "Objet",
  Rostlina: "Plante",
  "Film / Seriál": "Film / Série",
  "Herec / Herečka": "Acteur / Actrice",
  "Zpěvák / Zpěvačka / Kapela": "Chanteur / Chanteuse / Groupe",
  Sport: "Sport",
  Značka: "Marque",
  "Auto / Moto": "Voiture / Moto",
  "Řeka / Hora": "Fleuve / Montagne",
  Povolání: "Métier",
  Barva: "Couleur",
};

const CATEGORY_LABELS_PT_BR: Record<string, string> = {
  Země: "País",
  Město: "Cidade",
  Jméno: "Nome",
  Zvíře: "Animal",
  Věc: "Objeto",
  Rostlina: "Planta",
  "Film / Seriál": "Filme / Série",
  "Herec / Herečka": "Ator / Atriz",
  "Zpěvák / Zpěvačka / Kapela": "Cantor / Cantora / Banda",
  Sport: "Esporte",
  Značka: "Marca",
  "Auto / Moto": "Carro / Moto",
  "Řeka / Hora": "Rio / Montanha",
  Povolání: "Profissão",
  Barva: "Cor",
};

const CATEGORY_LABELS_ID: Record<string, string> = {
  Země: "Negara",
  Město: "Kota",
  Jméno: "Nama",
  Zvíře: "Hewan",
  Věc: "Benda",
  Rostlina: "Tumbuhan",
  "Film / Seriál": "Film / Serial",
  "Herec / Herečka": "Aktor / Aktris",
  "Zpěvák / Zpěvačka / Kapela": "Penyanyi / Band",
  Sport: "Olahraga",
  Značka: "Merek",
  "Auto / Moto": "Mobil / Motor",
  "Řeka / Hora": "Sungai / Gunung",
  Povolání: "Pekerjaan",
  Barva: "Warna",
};

const CATEGORY_LABELS_TR: Record<string, string> = {
  Země: "Ülke",
  Město: "Şehir",
  Jméno: "İsim",
  Zvíře: "Hayvan",
  Věc: "Eşya",
  Rostlina: "Bitki",
  "Film / Seriál": "Film / Dizi",
  "Herec / Herečka": "Aktör / Aktris",
  "Zpěvák / Zpěvačka / Kapela": "Şarkıcı / Grup",
  Sport: "Spor",
  Značka: "Marka",
  "Auto / Moto": "Araba / Motosiklet",
  "Řeka / Hora": "Nehir / Dağ",
  Povolání: "Meslek",
  Barva: "Renk",
};

const CATEGORY_LABELS_PL: Record<string, string> = {
  Země: "Państwo",
  Město: "Miasto",
  Jméno: "Imię",
  Zvíře: "Zwierzę",
  Věc: "Rzecz",
  Rostlina: "Roślina",
  "Film / Seriál": "Film / Serial",
  "Herec / Herečka": "Aktor / Aktorka",
  "Zpěvák / Zpěvačka / Kapela":
    "Piosenkarz / Piosenkarka / Zespół",
  Sport: "Sport",
  Značka: "Marka",
  "Auto / Moto": "Samochód / Motocykl",
  "Řeka / Hora": "Rzeka / Góra",
  Povolání: "Zawód",
  Barva: "Kolor",
};

const CATEGORY_LABELS_IT: Record<string, string> = {
  Země: "Paese",
  Město: "Città",
  Jméno: "Nome",
  Zvíře: "Animale",
  Věc: "Oggetto",
  Rostlina: "Pianta",
  "Film / Seriál": "Film / Serie TV",
  "Herec / Herečka": "Attore / Attrice",
  "Zpěvák / Zpěvačka / Kapela": "Cantante / Gruppo",
  Sport: "Sport",
  Značka: "Marca",
  "Auto / Moto": "Auto / Moto",
  "Řeka / Hora": "Fiume / Montagna",
  Povolání: "Professione",
  Barva: "Colore",
};

type AnswerNormalization =
  | "plain"
  | "czech"
  | "polish"
  | "turkish"
  | "strip_diacritics"
  | "strip_diacritics_except_enye";

type GameLanguageConfig = {
  letters: readonly string[];
  locale: string;
  flag: string;
  hasDiacritics: boolean;
  answerNormalization: AnswerNormalization;
  categoryLabels?: Record<string, string>;
};

const GAME_LANGUAGE_CONFIG: Record<GameLanguage, GameLanguageConfig> = {
  cs: {
    letters: CZECH_LETTERS,
    locale: "cs-CZ",
    flag: "🇨🇿",
    hasDiacritics: true,
    answerNormalization: "czech",
  },
  en: {
    letters: ENGLISH_LETTERS,
    locale: "en-GB",
    flag: "🇬🇧",
    hasDiacritics: false,
    answerNormalization: "plain",
    categoryLabels: CATEGORY_LABELS_EN,
  },
  es: {
    letters: SPANISH_LETTERS,
    locale: "es-ES",
    flag: "🇪🇸",
    hasDiacritics: true,
    answerNormalization: "strip_diacritics_except_enye",
    categoryLabels: CATEGORY_LABELS_ES,
  },
  de: {
    letters: GERMAN_LETTERS,
    locale: "de-DE",
    flag: "🇩🇪",
    hasDiacritics: true,
    answerNormalization: "strip_diacritics",
    categoryLabels: CATEGORY_LABELS_DE,
  },
  fr: {
    letters: ENGLISH_LETTERS,
    locale: "fr-FR",
    flag: "🇫🇷",
    hasDiacritics: true,
    answerNormalization: "strip_diacritics",
    categoryLabels: CATEGORY_LABELS_FR,
  },
  "pt-BR": {
    letters: ENGLISH_LETTERS,
    locale: "pt-BR",
    flag: "🇧🇷",
    hasDiacritics: true,
    answerNormalization: "strip_diacritics",
    categoryLabels: CATEGORY_LABELS_PT_BR,
  },
  id: {
    letters: ENGLISH_LETTERS,
    locale: "id-ID",
    flag: "🇮🇩",
    hasDiacritics: false,
    answerNormalization: "plain",
    categoryLabels: CATEGORY_LABELS_ID,
  },
  tr: {
    letters: TURKISH_LETTERS,
    locale: "tr-TR",
    flag: "🇹🇷",
    hasDiacritics: true,
    answerNormalization: "turkish",
    categoryLabels: CATEGORY_LABELS_TR,
  },
  pl: {
    letters: POLISH_LETTERS,
    locale: "pl-PL",
    flag: "🇵🇱",
    hasDiacritics: true,
    answerNormalization: "polish",
    categoryLabels: CATEGORY_LABELS_PL,
  },
  it: {
    letters: ITALIAN_LETTERS,
    locale: "it-IT",
    flag: "🇮🇹",
    hasDiacritics: true,
    answerNormalization: "strip_diacritics",
    categoryLabels: CATEGORY_LABELS_IT,
  },
};

function getLettersForLanguage(language: GameLanguage) {
  return GAME_LANGUAGE_CONFIG[language].letters;
}

type RoomTier = "free" | "premium" | "super_premium";
type Category = string;

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

function alignStringRecord(
  current: Record<string, string>,
  categories: string[]
): Record<string, string> {
  return Object.fromEntries(
    categories.map((category) => [category, current[category] ?? ""])
  );
}

function alignScoreRecord(
  current: Record<string, -10 | -5 | 0 | 5 | 10>,
  categories: string[]
): Record<string, -10 | -5 | 0 | 5 | 10> {
  return Object.fromEntries(
    categories.map((category) => [category, current[category] ?? 0])
  ) as Record<string, -10 | -5 | 0 | 5 | 10>;
}

function emptyAnswers(categories: string[] = DEFAULT_ACTIVE_CATEGORIES): Record<Category, string> {
  return Object.fromEntries(categories.map((category) => [category, ""])) as Record<Category, string>;
}

function emptyScores(categories: string[] = DEFAULT_ACTIVE_CATEGORIES): Record<Category, -10 | -5 | 0 | 5 | 10> {
  return Object.fromEntries(categories.map((category) => [category, 0])) as Record<Category, -10 | -5 | 0 | 5 | 10>;
}

export default function RoomPage() {
  useStableViewportUnit();

  const { code } = useParams<{ code: string }>();

  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomInitialLoadComplete, setRoomInitialLoadComplete] = useState(false);
  const roomIdRef = useRef<string | null>(null);
  const isOrganizerRef = useRef(false);
  const [roomStatus, setRoomStatus] = useState<RoomStatus>("lobby");
  const [letter, setLetter] = useState<string | null>(null);
  const [activeCategories, setActiveCategories] = useState<string[]>(DEFAULT_ACTIVE_CATEGORIES);
  const [maxPlayers, setMaxPlayers] = useState(3);
  const [roomTier, setRoomTier] = useState<RoomTier>("free");
  const [premiumLockedOfferCategory, setPremiumLockedOfferCategory] = useState<string | null>(null);
  const [billingProducts, setBillingProducts] = useState<BillingProduct[]>([]);
  const [billingReady, setBillingReady] = useState(false);
  const [ownedCategoryProductIds, setOwnedCategoryProductIds] = useState<string[]>([]);
  const [ownedTier, setOwnedTier] = useState<RoomTier>("free");
  const [categoryPurchaseBusy, setCategoryPurchaseBusy] = useState<string | null>(null);
  const [roomLanguage, setRoomLanguage] = useState<GameLanguage>("cs");
  const [roundTimeLimitSeconds, setRoundTimeLimitSeconds] = useState<RoundTimeLimitSeconds>(null);
  const [roundCountLimit, setRoundCountLimit] = useState<RoundCountLimit>(null);
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>("cs");
  const [roomCustomCategories, setRoomCustomCategories] = useState(["", "", "", "", ""]);
  const t = (key: UiTextKey) => getUiText(uiLanguage, key);

  function uiMessage(
    messages: Record<UiLanguage, string> &
      Partial<Record<GameLanguage, string>>
  ) {
    return messages[uiLanguage];
  }
  const rulesText = getUiRules(uiLanguage);
  const superPremiumGameSettingsEnabled = roomTier === "super_premium";
  const [customCategorySlotCount, setCustomCategorySlotCount] = useState(0);
  const [localCreatorToken, setLocalCreatorToken] = useState<string | null>(null);
  const [roomCreatorToken, setRoomCreatorToken] = useState<string | null>(null);

  const [players, setPlayers] = useState<Player[]>([]);
  const [waitingPlayers, setWaitingPlayers] = useState<Player[]>([]);
  const [nameInput, setNameInput] = useState("");
  const [myPlayer, setMyPlayer] = useState<MyPlayer | null>(null);
  const [msg, setMsg] = useState("");
  const [showRules, setShowRules] = useState(false);
  const [showRoundHistory, setShowRoundHistory] = useState(false);
  const [showFreeLimitUpsell, setShowFreeLimitUpsell] = useState(false);
  const [showRewardedAdPlaceholder, setShowRewardedAdPlaceholder] = useState(false);
  const [nativeFreeBannerShown, setNativeFreeBannerShown] = useState(false);
  const [freeRoundsRemaining, setFreeRoundsRemaining] = useState(FREE_ROUND_BLOCK_SIZE);
  const [roomFreeRoundsUnlocked, setRoomFreeRoundsUnlocked] =
    useState(FREE_ROUND_BLOCK_SIZE);
  const [roomFreeRoundsStarted, setRoomFreeRoundsStarted] = useState(0);

  const [round, setRound] = useState<RoundLite | null>(null);
  const [serverTimeOffsetMs, setServerTimeOffsetMs] = useState(0);
  const [timerNowMs, setTimerNowMs] = useState(0);
  const [answers, setAnswers] = useState<Record<Category, string>>(emptyAnswers());
  const [allAnswers, setAllAnswers] = useState<AnswerRow[]>([]);

  const [scores, setScores] = useState<Record<Category, -10 | -5 | 0 | 5 | 10>>(emptyScores());
  const [allScores, setAllScores] = useState<ScoreRow[]>([]);
  const [allRoomScores, setAllRoomScores] = useState<ScoreRow[]>([]);
  const [myScoreSubmitted, setMyScoreSubmitted] = useState(false);
  const [selectedScoringCategory, setSelectedScoringCategory] = useState<string | null>(null);

  const [rollingLetter, setRollingLetter] = useState("A");
  const rollIntervalRef = useRef<number | null>(null);
  const autoStopRoundIdRef = useRef<string | null>(null);
  const answerInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const answerScrollBoxRef = useRef<HTMLDivElement | null>(null);
  const [keyboardInsetPx, setKeyboardInsetPx] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const wasOfflineRef = useRef(false);
  const keyboardInsetPxRef = useRef(0);

  function scrollAnswerIntoView(element: HTMLElement | null, block: "nearest" | "center" = "nearest") {
    const container = answerScrollBoxRef.current;
    if (!element || !container) return;

    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const currentTop = container.scrollTop;
    const elementTop = elementRect.top - containerRect.top + currentTop;
    const elementBottom = elementTop + elementRect.height;
    const padding = 12;
    const visibleHeight = Math.max(160, container.clientHeight - keyboardInsetPxRef.current - 24);

    if (block === "center") {
      container.scrollTo({
        top: Math.max(0, elementTop - visibleHeight / 2 + elementRect.height / 2),
        behavior: "smooth",
      });
      return;
    }

    if (elementTop < currentTop) {
      container.scrollTo({ top: Math.max(0, elementTop - padding), behavior: "smooth" });
    } else if (elementBottom > currentTop + visibleHeight) {
      container.scrollTo({
        top: elementBottom - visibleHeight + padding,
        behavior: "smooth",
      });
    }
  }

  useEffect(() => {
    function updateKeyboardInset() {
      const visualViewport = window.visualViewport;
      const nextInset = visualViewport
        ? Math.max(0, window.innerHeight - visualViewport.height - visualViewport.offsetTop)
        : 0;

      keyboardInsetPxRef.current = nextInset;
      setKeyboardInsetPx(Math.round(nextInset));
    }

    updateKeyboardInset();

    window.visualViewport?.addEventListener("resize", updateKeyboardInset);
    window.visualViewport?.addEventListener("scroll", updateKeyboardInset);
    window.addEventListener("resize", updateKeyboardInset);

    return () => {
      window.visualViewport?.removeEventListener("resize", updateKeyboardInset);
      window.visualViewport?.removeEventListener("scroll", updateKeyboardInset);
      window.removeEventListener("resize", updateKeyboardInset);
    };
  }, []);

  useEffect(() => {
    function updateConnectionState() {
      const online = window.navigator.onLine;

      setIsOnline(online);

      if (!online) {
        wasOfflineRef.current = true;
        setIsReconnecting(false);
      }
    }

    updateConnectionState();

    window.addEventListener("online", updateConnectionState);
    window.addEventListener("offline", updateConnectionState);

    return () => {
      window.removeEventListener("online", updateConnectionState);
      window.removeEventListener("offline", updateConnectionState);
    };
  }, []);

  useEffect(() => {
    if (roomStatus !== "playing") return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.dataset.zmScrollLockPlaying = "true";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      delete document.body.dataset.zmScrollLockPlaying;
    };
  }, [roomStatus]);

  useEffect(() => {
    const urlUiLanguage = new URLSearchParams(window.location.search).get("ui");
    const savedUiLanguage = window.localStorage.getItem("zm_uiLanguage");

    if (
      urlUiLanguage === "cs" ||
      urlUiLanguage === "en" ||
      urlUiLanguage === "es" ||
      urlUiLanguage === "de" ||
      urlUiLanguage === "fr" ||
      urlUiLanguage === "pt-BR" ||
      urlUiLanguage === "id" ||
      urlUiLanguage === "tr" ||
      urlUiLanguage === "pl" ||
      urlUiLanguage === "it"
    ) {
      setUiLanguage(urlUiLanguage);
      window.localStorage.setItem("zm_uiLanguage", urlUiLanguage);
      return;
    }

    if (
      savedUiLanguage === "cs" ||
      savedUiLanguage === "en" ||
      savedUiLanguage === "es" ||
      savedUiLanguage === "de" ||
      savedUiLanguage === "fr" ||
      savedUiLanguage === "pt-BR" ||
      savedUiLanguage === "id" ||
      savedUiLanguage === "tr" ||
      savedUiLanguage === "pl" ||
      savedUiLanguage === "it"
    ) {
      setUiLanguage(savedUiLanguage);
      return;
    }

    const deviceLanguage = window.navigator.language.toLowerCase();

    setUiLanguage(
      deviceLanguage.startsWith("cs") || deviceLanguage.startsWith("sk")
        ? "cs"
        : deviceLanguage.startsWith("es")
          ? "es"
          : deviceLanguage.startsWith("de")
            ? "de"
            : deviceLanguage.startsWith("fr")
              ? "fr"
              : deviceLanguage.startsWith("pt")
                ? "pt-BR"
                : deviceLanguage.startsWith("id")
                  ? "id"
                  : deviceLanguage.startsWith("tr")
                    ? "tr"
                    : deviceLanguage.startsWith("pl")
                      ? "pl"
                      : deviceLanguage.startsWith("it")
                        ? "it"
                        : "en"
    );
  }, []);

  useEffect(() => {
    if (!isPlayBillingAvailable()) return;

    let active = true;
    let listenerHandle: { remove: () => Promise<void> } | undefined;

    async function loadRoomBilling() {
      try {
        const connection = await PlayBilling.connect();
        if (!active || !connection.ready) return;

        setBillingReady(true);

        const [productsResult, purchasesResult] = await Promise.all([
          PlayBilling.getProducts(),
          PlayBilling.getPurchases(),
        ]);

        if (!active) return;

        setBillingProducts(productsResult.products ?? []);

        const ownedCategoryIds: string[] = [];
        const ownedProducts = new Set<string>();
        const purchaseTokensToAcknowledge: string[] = [];
        for (const purchase of purchasesResult.purchases ?? []) {
          if (purchase.purchaseState !== 1 || !purchase.purchaseToken) continue;

          const verified = await Promise.all(
            purchase.productIds.map((productId) =>
              verifyPlayPurchase(productId, purchase.purchaseToken)
            )
          );
          if (verified.some((valid) => !valid)) continue;

          purchase.productIds.forEach((productId) => ownedProducts.add(productId));
          ownedCategoryIds.push(
            ...purchase.productIds.filter((productId) =>
              CATEGORY_PRODUCT_IDS.has(productId)
            )
          );
          if (!purchase.acknowledged) {
            purchaseTokensToAcknowledge.push(purchase.purchaseToken);
          }
        }

        setOwnedCategoryProductIds([...new Set(ownedCategoryIds)]);
        if (ownedProducts.has("super_premium")) {
          setOwnedTier("super_premium");
        } else if (ownedProducts.has("premium")) {
          setOwnedTier("premium");
        }
        for (const purchaseToken of purchaseTokensToAcknowledge) {
          await acknowledgePlayPurchase(purchaseToken);
        }
      } catch (error) {
        console.error("Google Play room billing failed:", error);
      }
    }

    void loadRoomBilling();

    void PlayBilling.addListener("purchaseUpdated", async (event) => {
      if (!active) return;

      if (event.status !== "purchased") {
        setCategoryPurchaseBusy(null);
        return;
      }

      if (!event.purchaseToken) {
        setCategoryPurchaseBusy(null);
        return;
      }

      try {
        const verified = await Promise.all(
          event.productIds.map((productId) =>
            verifyPlayPurchase(productId, event.purchaseToken!)
          )
        );
        if (verified.some((valid) => !valid)) {
          setCategoryPurchaseBusy(null);
          setMsg(uiMessage({ cs: "❌ Nákup se nepodařilo ověřit.", en: "❌ The purchase could not be verified.", es: "❌ No se pudo verificar la compra.", de: "❌ Der Kauf konnte nicht überprüft werden.", fr: "❌ L’achat n’a pas pu être vérifié.", "pt-BR": "❌ Não foi possível verificar a compra.", id: "❌ Pembelian tidak dapat diverifikasi.", tr: "❌ Satın alma doğrulanamadı.", pl: "❌ Nie udało się zweryfikować zakupu.", it: "❌ Non è stato possibile verificare l’acquisto." }));
          return;
        }
      } catch (error) {
        console.error("Google Play purchase verification failed:", error);
        setCategoryPurchaseBusy(null);
        setMsg(uiMessage({ cs: "❌ Nákup se nepodařilo ověřit.", en: "❌ The purchase could not be verified.", es: "❌ No se pudo verificar la compra.", de: "❌ Der Kauf konnte nicht überprüft werden.", fr: "❌ L’achat n’a pas pu être vérifié.", "pt-BR": "❌ Não foi possível verificar a compra.", id: "❌ Pembelian tidak dapat diverifikasi.", tr: "❌ Satın alma doğrulanamadı.", pl: "❌ Nie udało się zweryfikować zakupu.", it: "❌ Non è stato possibile verificare l’acquisto." }));
        return;
      }

      if (event.productIds.includes("premium")) {
        void (async () => {
          const currentRoomId = roomIdRef.current;

          if (!currentRoomId) {
            setCategoryPurchaseBusy(null);
            return;
          }

          if (!isOrganizerRef.current) {
            setOwnedTier("premium");
            setCategoryPurchaseBusy(null);
            setMsg("");
            if (!event.acknowledged) {
              await acknowledgePlayPurchase(event.purchaseToken!);
            }
            return;
          }

          const { error } = await supabase
            .from("rooms")
            .update({
              creator_tier: "premium",
              max_players: 5,
              active_categories: PREMIUM_CATEGORIES,
              custom_category: null,
              ads_enabled: true,
            })
            .eq("id", currentRoomId);

          setCategoryPurchaseBusy(null);

          if (error) {
            console.error("Premium room update failed:", error);
            setMsg(
              uiMessage({ cs: "❌ Premium se nepodařilo aktivovat.", en: "❌ Premium could not be activated.", es: "❌ No se pudo activar Premium." , de: "❌ Premium konnte nicht aktiviert werden.", fr: "❌ Impossible d’activer Premium.", "pt-BR": "❌ Não foi possível ativar o Premium.", id: "❌ Premium tidak dapat diaktifkan.", tr: "❌ Premium etkinleştirilemedi.", pl: "❌ Nie udało się aktywować Premium.", it: "❌ Impossibile attivare Premium."})
            );
            return;
          }

          setOwnedTier("premium");
          setRoomTier("premium");
          setMaxPlayers(5);
          setActiveCategories(PREMIUM_CATEGORIES);
          setRoomCustomCategories(["", "", "", "", ""]);
          setShowFreeLimitUpsell(false);
          setPremiumLockedOfferCategory(null);
          setMsg("");
          if (!event.acknowledged) {
            await acknowledgePlayPurchase(event.purchaseToken!);
          }
        })();

        return;
      }

      if (event.productIds.includes("super_premium")) {
        void (async () => {
          const currentRoomId = roomIdRef.current;

          if (!currentRoomId) {
            setCategoryPurchaseBusy(null);
            return;
          }

          if (!isOrganizerRef.current) {
            setOwnedTier("super_premium");
            setCategoryPurchaseBusy(null);
            setMsg("");
            if (!event.acknowledged) {
              await acknowledgePlayPurchase(event.purchaseToken!);
            }
            return;
          }

          const { error } = await supabase
            .from("rooms")
            .update({
              creator_tier: "super_premium",
              max_players: 999,
              ads_enabled: true,
            })
            .eq("id", currentRoomId);

          setCategoryPurchaseBusy(null);

          if (error) {
            console.error("Super Premium room update failed:", error);
            setMsg(
              uiMessage({ cs: "❌ Super Premium se nepodařilo aktivovat.", en: "❌ Super Premium could not be activated.", es: "❌ No se pudo activar Super Premium." , de: "❌ Super Premium konnte nicht aktiviert werden.", fr: "❌ Impossible d’activer Super Premium.", "pt-BR": "❌ Não foi possível ativar o Super Premium.", id: "❌ Super Premium tidak dapat diaktifkan.", tr: "❌ Super Premium etkinleştirilemedi.", pl: "❌ Nie udało się aktywować Super Premium.", it: "❌ Impossibile attivare Super Premium."})
            );
            return;
          }

          setOwnedTier("super_premium");
          setRoomTier("super_premium");
          setMaxPlayers(999);
          setPremiumLockedOfferCategory(null);
          setMsg("");
          if (!event.acknowledged) {
            await acknowledgePlayPurchase(event.purchaseToken!);
          }
        })();

        return;
      }

      const purchasedCategoryIds = event.productIds.filter(
        (productId) => CATEGORY_PRODUCT_IDS.has(productId)
      );

      if (purchasedCategoryIds.length === 0) return;

      setOwnedCategoryProductIds((current) => [
        ...new Set([...current, ...purchasedCategoryIds]),
      ]);
      setCategoryPurchaseBusy(null);
      setPremiumLockedOfferCategory(null);
      setMsg(
        uiMessage({ cs: "Kategorie byla odemčena.", en: "The category has been unlocked.", es: "La categoría ha sido desbloqueada." , de: "Die Kategorie wurde freigeschaltet.", fr: "La catégorie a été déverrouillée.", "pt-BR": "A categoria foi desbloqueada.", id: "Kategori telah dibuka.", tr: "Kategorinin kilidi açıldı.", pl: "Kategoria została odblokowana.", it: "La categoria è stata sbloccata."})
      );
      if (!event.acknowledged) {
        await acknowledgePlayPurchase(event.purchaseToken);
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

  function categoryPlayPrice(category: string) {
    const productId = CATEGORY_PRODUCT_ID[category];

    return billingProducts.find(
      (product) => product.productId === productId
    )?.formattedPrice;
  }

  const superPremiumUpgradePrice =
    billingProducts
      .find((product) => product.productId === "super_premium")
      ?.offers?.find((offer) => offer.offerId === "premium-upgrade")
      ?.formattedPrice;

  function categoryLabel(category: string) {
    return (
      GAME_LANGUAGE_CONFIG[roomLanguage].categoryLabels?.[category] ??
      category
    );
  }

function normalizeForCompare(value: string) {
  const config = GAME_LANGUAGE_CONFIG[roomLanguage];
  const upperValue = value.trim().toLocaleUpperCase(config.locale);

  if (config.answerNormalization === "polish") {
    return upperValue
      .replaceAll("Ł", "L")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  if (config.answerNormalization === "turkish") {
    return upperValue
      .replaceAll("Ç", "C")
      .replaceAll("Ğ", "G")
      .replaceAll("Ö", "O")
      .replaceAll("Ş", "S")
      .replaceAll("Ü", "U");
  }

  if (config.answerNormalization === "strip_diacritics") {
    return upperValue
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  if (
    config.answerNormalization ===
    "strip_diacritics_except_enye"
  ) {
    return upperValue
      .replaceAll("Ñ", "__ENYE__")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replaceAll("__ENYE__", "Ñ");
  }

  return upperValue;
}

function answerStartsWithLetter(answer: string | undefined, selectedLetter: string | null) {
  if (!selectedLetter) return false;

  const normalizedAnswer = normalizeForCompare(answer ?? "");
  const normalizedLetter = normalizeForCompare(selectedLetter);

  if (roomLanguage === "cs") {
    if (normalizedLetter === "CH") {
      return normalizedAnswer.startsWith("CH");
    }

    const baseLetters: Record<string, string> = {
      Č: "C",
      Ř: "R",
      Š: "S",
      Ž: "Z",
    };

    const allowedBaseLetter = baseLetters[normalizedLetter];

    if (allowedBaseLetter) {
      const firstLetter = normalizedAnswer.charAt(0);
      return firstLetter === normalizedLetter || firstLetter === allowedBaseLetter;
    }
  }

  return normalizedAnswer.startsWith(normalizedLetter);
}

  const allAnswersFilled = activeCategories.every((c) => (answers[c] ?? "").trim().length > 0);

  const allAnswersAtLeastTwoChars = activeCategories.every((c) => (answers[c] ?? "").trim().length >= 2);

  const allAnswersStartWithLetter =
    Boolean(letter) &&
    activeCategories.every((c) => answerStartsWithLetter(answers[c], letter));

  const canStop = allAnswersFilled && allAnswersAtLeastTwoChars && allAnswersStartWithLetter;

  function myKey(rid: string) {
    return `zm_myPlayer_${rid}`;
  }

  async function pickLetter(rid: string): Promise<string | null> {
    const { data, error } = await (supabase as any).rpc(
      "draw_room_letter",
      {
        p_room_id: rid,
      }
    );

    if (error || typeof data !== "string" || !data.trim()) {
      console.error("Letter drawing failed:", error);
      setMsg(
        uiMessage({
          cs: "❌ Písmeno se nepodařilo vylosovat.",
          en: "❌ The letter could not be drawn.",
          es: "❌ No se pudo sortear la letra.",
          de: "❌ Der Buchstabe konnte nicht ausgelost werden.",
          fr: "❌ Impossible de tirer la lettre.",
          "pt-BR": "❌ Não foi possível sortear a letra.",
          id: "❌ Huruf tidak dapat diundi.",
          tr: "❌ Harf çekilemedi.",
          pl: "❌ Nie udało się wylosować litery.",
          it: "❌ Non è stato possibile estrarre la lettera.",
        })
      );
      return null;
    }

    return data.trim();
  }

  function getRoomUrl() {
    const publicBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== "undefined" ? window.location.origin : "");

    return `${publicBaseUrl}/room/${code.toUpperCase()}`;
  }

  async function copyInviteLink() {
    const url = getRoomUrl();

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      setMsg(
        uiMessage({ cs: "❌ Odkaz se nepodařilo zkopírovat.", en: "❌ The link could not be copied.", es: "❌ No se pudo copiar el enlace." , de: "❌ Der Link konnte nicht kopiert werden.", fr: "❌ Impossible de copier le lien.", "pt-BR": "❌ Não foi possível copiar o link.", id: "❌ Tautan tidak dapat disalin.", tr: "❌ Bağlantı kopyalanamadı.", pl: "❌ Nie udało się skopiować linku.", it: "❌ Impossibile copiare il link."})
      );
    }
  }

  async function shareInviteLink() {
    const url = getRoomUrl();

    try {
      const shareSupport = await Share.canShare();

      if (shareSupport.value) {
        await Share.share({
          title: "Země Město",
          text: uiMessage({ cs: `Připoj se do místnosti ${code.toUpperCase()}`, en: `Join room ${code.toUpperCase()}`, es: `Únete a la sala ${code.toUpperCase()}` , de: `Dem Raum ${code.toUpperCase()} beitreten`, fr: `Rejoindre la salle ${code.toUpperCase()}`, "pt-BR": `Entrar na sala ${code.toUpperCase()}`, id: `Gabung ke ruang ${code.toUpperCase()}`, tr: `Odaya katıl: ${code.toUpperCase()}`, pl: `Dołącz do pokoju ${code.toUpperCase()}`, it: `Entra nella stanza ${code.toUpperCase()}`}),
          url,
        });
        setMsg(
          uiMessage({ cs: "✅ Sdílení otevřeno.", en: "✅ Sharing opened.", es: "✅ Se abrió la opción de compartir." , de: "✅ Teilen geöffnet.", fr: "✅ Partage ouvert.", "pt-BR": "✅ Compartilhamento aberto.", id: "✅ Menu berbagi dibuka.", tr: "✅ Paylaşım menüsü açıldı.", pl: "✅ Otworzono udostępnianie.", it: "✅ Condivisione aperta."})
        );
      } else {
        await navigator.clipboard.writeText(url);
        setMsg(
          uiMessage({ cs: "✅ Sdílení není dostupné, odkaz byl zkopírován.", en: "✅ Sharing is unavailable, so the link was copied.", es: "✅ La opción de compartir no está disponible; el enlace fue copiado." , de: "✅ Teilen ist nicht verfügbar, daher wurde der Link kopiert.", fr: "✅ Le partage n’est pas disponible, le lien a donc été copié.", "pt-BR": "✅ O compartilhamento não está disponível, então o link foi copiado.", id: "✅ Fitur berbagi tidak tersedia, jadi tautan telah disalin.", tr: "✅ Paylaşım özelliği kullanılamadığı için bağlantı kopyalandı.", pl: "✅ Udostępnianie jest niedostępne, więc link został skopiowany.", it: "✅ La condivisione non è disponibile, quindi il link è stato copiato."})
        );
      }
    } catch {
      setMsg("");
    }
  }

  function saveMyPlayer(rid: string, p: MyPlayer) {
    setMyPlayer(p);
    try {
      window.localStorage.setItem(myKey(rid), JSON.stringify(p));
    } catch {}
  }

  function loadMyPlayer(rid: string) {
    try {
      const raw = window.localStorage.getItem(myKey(rid));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as MyPlayer;
      if (!parsed?.id || !parsed?.name) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function clearMyPlayer(rid: string) {
    setMyPlayer(null);
    try {
      window.localStorage.removeItem(myKey(rid));
    } catch {}
  }

  function stopRolling() {
    if (rollIntervalRef.current) {
      window.clearInterval(rollIntervalRef.current);
      rollIntervalRef.current = null;
    }
  }

  function startRollingVisual() {
    stopRolling();
    let idx = 0;
    setRollingLetter("A");
    rollIntervalRef.current = window.setInterval(() => {
      const letters = getLettersForLanguage(roomLanguage);
      idx = (idx + 1) % letters.length;
      setRollingLetter(letters[idx]);
    }, TICK_MS);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    setLocalCreatorToken(localStorage.getItem(`zm_roomCreatorToken_${code}`));
  }, [code]);

  useEffect(() => {
    let cancelled = false;

    async function updateBanner() {
      if (!isNativeAdMobAvailable()) {
        setNativeFreeBannerShown(false);
        return;
      }

      if (!cancelled) setNativeFreeBannerShown(true);
      await showFreeBannerAdForNativeApp();
    }

    void updateBanner();

    return () => {
      cancelled = true;
    };
  }, [roomTier]);

  useEffect(() => {
    if (roomTier !== "free") return;

    setFreeRoundsRemaining(getFreeQuotaState().remainingRounds);
  }, [roomTier]);

  useEffect(() => {
    setAnswers((current) => alignStringRecord(current, activeCategories));
    setScores((current) => alignScoreRecord(current, activeCategories));
  }, [activeCategories]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;

    async function syncServerTime() {
      const startedAt = Date.now();
      const { data, error } = await (supabase as any).rpc("get_server_now");
      const finishedAt = Date.now();

      if (cancelled || error || !data) return;

      const serverNowMs = new Date(String(data)).getTime();
      const localMiddleMs = startedAt + (finishedAt - startedAt) / 2;

      if (Number.isFinite(serverNowMs)) {
        setServerTimeOffsetMs(serverNowMs - localMiddleMs);
      }
    }

    void syncServerTime();

    const interval = window.setInterval(() => {
      void syncServerTime();
    }, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (roomStatus !== "playing" || !round?.deadline_at) return;
      !superPremiumGameSettingsEnabled ||

    setTimerNowMs(Date.now());

    const interval = window.setInterval(() => {
      setTimerNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [roomStatus, round?.deadline_at]);

  const roundDeadlineMs = round?.deadline_at ? new Date(round.deadline_at).getTime() : null;
  const roundTimerRemainingSeconds =
    roundDeadlineMs !== null && timerNowMs > 0
      ? Math.max(0, Math.ceil((roundDeadlineMs - (timerNowMs + serverTimeOffsetMs)) / 1000))
      : null;
  const roundTimerProgressPercent =
    superPremiumGameSettingsEnabled && roundTimeLimitSeconds !== null && roundTimerRemainingSeconds !== null
      ? Math.max(0, Math.min(100, (roundTimerRemainingSeconds / roundTimeLimitSeconds) * 100))
      : null;

  useEffect(() => {
    if (
      roomStatus !== "playing" ||
      !round?.id ||
      !round.deadline_at ||
      !myPlayer ||
      myPlayer.status === "waiting" ||
      roundTimerRemainingSeconds !== 0 ||
      autoStopRoundIdRef.current === round.id
    ) {
      return;
    }

    autoStopRoundIdRef.current = round.id;
    void stopRound("__TIMEOUT__");
  }, [roomStatus, superPremiumGameSettingsEnabled, round?.id, round?.deadline_at, roundTimerRemainingSeconds, myPlayer?.id, myPlayer?.status]);

  async function loadRoomByCode() {
    const { data, error } = await supabase
      .from("rooms")
      .select("id,status,letter,active_categories,max_players,creator_tier,ads_enabled,creator_token,language,round_time_limit_seconds,round_count_limit,free_rounds_unlocked,free_rounds_started")
      .eq("code", code)
      .single();

    if (error || !data) {
      console.error("Room loading failed:", error);
      setRoomId(null);
      setMsg(
        uiMessage({ cs: "❌ Místnost nebyla nalezena.", en: "❌ Room not found.", es: "❌ Sala no encontrada." , de: "❌ Raum nicht gefunden.", fr: "❌ Salle introuvable.", "pt-BR": "❌ Sala não encontrada.", id: "❌ Ruang tidak ditemukan.", tr: "❌ Oda bulunamadı.", pl: "❌ Nie znaleziono pokoju.", it: "❌ Stanza non trovata."})
      );
      return null;
    }

    const roomCategories =
      Array.isArray((data as any).active_categories) && (data as any).active_categories.length > 0
        ? ((data as any).active_categories as string[])
        : DEFAULT_ACTIVE_CATEGORIES;

    const customCategories = roomCategories
      .filter((category) => !ALL_PREDEFINED_CATEGORIES.includes(category))
      .slice(0, 5);

    setRoomId(data.id);
    setRoomStatus(data.status as RoomStatus);
    setLetter((data.letter ?? null) as string | null);
    setActiveCategories(roomCategories);
    setMaxPlayers(Number((data as any).max_players ?? 3));
    setRoomTier(((data as any).creator_tier ?? "free") as RoomTier);
    setRoomCreatorToken(((data as any).creator_token ?? null) as string | null);
    setRoomLanguage(((data as any).language ?? "cs") as GameLanguage);
    setRoundTimeLimitSeconds(parseRoundTimeLimit((data as any).round_time_limit_seconds));
    setRoundCountLimit(parseRoundCountLimit((data as any).round_count_limit));
    setRoomFreeRoundsUnlocked(
      Number((data as any).free_rounds_unlocked ?? FREE_ROUND_BLOCK_SIZE)
    );
    setRoomFreeRoundsStarted(
      Number((data as any).free_rounds_started ?? 0)
    );
    setRoomCustomCategories([
      ...customCategories,
      ...Array(Math.max(0, 5 - customCategories.length)).fill(""),
    ].slice(0, 5));

    const saved = loadMyPlayer(data.id);
    if (saved) setMyPlayer(saved);

    return data.id as string;
  }

  async function refreshRoomState(rid: string) {
    const { data, error } = await supabase
      .from("rooms")
      .select("status,letter,active_categories,max_players,creator_tier,ads_enabled,creator_token,language,round_time_limit_seconds,round_count_limit,free_rounds_unlocked,free_rounds_started")
      .eq("id", rid)
      .single();

    if (error || !data) return;

    const roomCategories =
      Array.isArray((data as any).active_categories) && (data as any).active_categories.length > 0
        ? uniqueNonEmpty((data as any).active_categories as unknown[])
        : DEFAULT_ACTIVE_CATEGORIES;

    setRoomStatus(data.status as RoomStatus);
    setLetter((data.letter ?? null) as string | null);
    setActiveCategories(roomCategories);
    setMaxPlayers(Number((data as any).max_players ?? 3));
    setRoomTier(((data as any).creator_tier ?? "free") as RoomTier);
    setRoomCreatorToken(((data as any).creator_token ?? null) as string | null);
    setRoomLanguage(((data as any).language ?? "cs") as GameLanguage);
    setRoundTimeLimitSeconds(parseRoundTimeLimit((data as any).round_time_limit_seconds));
    setRoundCountLimit(parseRoundCountLimit((data as any).round_count_limit));
    setRoomFreeRoundsUnlocked(
      Number((data as any).free_rounds_unlocked ?? FREE_ROUND_BLOCK_SIZE)
    );
    setRoomFreeRoundsStarted(
      Number((data as any).free_rounds_started ?? 0)
    );

    setAnswers((current) => alignStringRecord(current, roomCategories));
    setScores((current) => alignScoreRecord(current, roomCategories));
  }

  async function loadPlayers(rid: string) {
    const { data, error } = await supabase
      .from("players")
      .select("id,name,status")
      .eq("room_id", rid)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Players loading failed:", error);
      setMsg(
        uiMessage({ cs: "❌ Hráče se nepodařilo načíst.", en: "❌ The players could not be loaded.", es: "❌ No se pudieron cargar los jugadores." , de: "❌ Die Spieler konnten nicht geladen werden.", fr: "❌ Impossible de charger les joueurs.", "pt-BR": "❌ Não foi possível carregar os jogadores.", id: "❌ Data pemain tidak dapat dimuat.", tr: "❌ Oyuncu verileri yüklenemedi.", pl: "❌ Nie udało się wczytać graczy.", it: "❌ Impossibile caricare i giocatori."})
      );
      return;
    }

    const normalizedPlayers: Player[] = (data ?? []).map((player: any) => ({
      id: player.id,
      name: player.name,
      status: player.status === "waiting" ? "waiting" : "active",
    }));

    setPlayers(normalizedPlayers.filter((player) => player.status !== "waiting"));
    setWaitingPlayers(normalizedPlayers.filter((player) => player.status === "waiting"));

    if (myPlayer) {
      const freshPlayer = normalizedPlayers.find((player) => player.id === myPlayer.id);
      if (freshPlayer) {
        saveMyPlayer(rid, freshPlayer);
      }
    }
  }

  async function loadCurrentRound(rid: string) {
    const { data, error } = await supabase
      .from("rounds")
      .select("id,round_no,letter,status,deadline_at")
      .eq("room_id", rid)
      .order("round_no", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Round loading failed:", error);
      setMsg(
        uiMessage({ cs: "❌ Kolo se nepodařilo načíst.", en: "❌ The round could not be loaded.", es: "❌ No se pudo cargar la ronda." , de: "❌ Die Runde konnte nicht geladen werden.", fr: "❌ Impossible de charger la manche.", "pt-BR": "❌ Não foi possível carregar a rodada.", id: "❌ Ronde tidak dapat dimuat.", tr: "❌ Turlar yüklenemedi.", pl: "❌ Nie udało się wczytać rundy.", it: "❌ Impossibile caricare il turno."})
      );
      return;
    }

    const r = data?.[0] as RoundLite | undefined;
    setRound(r ?? null);
  }

  async function loadAllAnswers(rid: string, roundNo: number) {
    const { data, error } = await supabase
      .from("answers")
      .select("player_id,category,value")
      .eq("room_id", rid)
      .eq("round", roundNo);

    if (error) {
      console.error("Answers loading failed:", error);
      setMsg(
        uiMessage({ cs: "❌ Odpovědi se nepodařilo načíst.", en: "❌ The answers could not be loaded.", es: "❌ No se pudieron cargar las respuestas." , de: "❌ Die Antworten konnten nicht geladen werden.", fr: "❌ Impossible de charger les réponses.", "pt-BR": "❌ Não foi possível carregar as respostas.", id: "❌ Jawaban tidak dapat dimuat.", tr: "❌ Yanıtlar yüklenemedi.", pl: "❌ Nie udało się wczytać odpowiedzi.", it: "❌ Impossibile caricare le risposte."})
      );
      return;
    }

    setAllAnswers((data ?? []) as AnswerRow[]);
  }

  async function loadAllScores(rid: string, roundNo: number) {
    const { data, error } = await supabase
      .from("scores")
      .select("player_id,category,points")
      .eq("room_id", rid)
      .eq("round", roundNo);

    if (error) {
      console.error("Scores loading failed:", error);
      setMsg(
        uiMessage({ cs: "❌ Body se nepodařilo načíst.", en: "❌ The scores could not be loaded.", es: "❌ No se pudieron cargar los puntos." , de: "❌ Die Punkte konnten nicht geladen werden.", fr: "❌ Impossible de charger les scores.", "pt-BR": "❌ Não foi possível carregar as pontuações.", id: "❌ Poin tidak dapat dimuat.", tr: "❌ Puanlar yüklenemedi.", pl: "❌ Nie udało się wczytać punktów.", it: "❌ Impossibile caricare i punteggi."})
      );
      return;
    }

    const rows = (data ?? []) as ScoreRow[];
    setAllScores(rows);

    if (!myPlayer) return;

    const mine = rows.filter((s) => s.player_id === myPlayer.id);
    setMyScoreSubmitted(mine.length >= activeCategories.length);

    // Důležité:
    // Dokud hráč bodování neodeslal, nepřepisujeme mu rozpracované hodnoty.
    if (mine.length === 0) return;

    const next = emptyScores();

    for (const row of mine) {
      if (activeCategories.includes(row.category as Category)) {
        next[row.category as Category] = row.points as -10 | -5 | 0 | 5 | 10;
      }
    }

    setScores(next);
  }

  async function loadRoomScores(rid: string) {
    const { data, error } = await supabase
      .from("scores")
      .select("player_id,round,category,points")
      .eq("room_id", rid)
      .order("round", { ascending: true });

    if (error) {
      console.error("Total scores loading failed:", error);
      setMsg(
        uiMessage({ cs: "❌ Celkové výsledky se nepodařilo načíst.", en: "❌ The overall scores could not be loaded.", es: "❌ No se pudieron cargar los resultados generales." , de: "❌ Die Gesamtpunktzahlen konnten nicht geladen werden.", fr: "❌ Impossible de charger les scores totaux.", "pt-BR": "❌ Não foi possível carregar as pontuações totais.", id: "❌ Total poin tidak dapat dimuat.", tr: "❌ Toplam puanlar yüklenemedi.", pl: "❌ Nie udało się wczytać wyników łącznych.", it: "❌ Impossibile caricare i punteggi totali."})
      );
      return;
    }

    setAllRoomScores((data ?? []) as ScoreRow[]);
  }

  useEffect(() => {
    let cancelled = false;
    setRoomInitialLoadComplete(false);

    (async () => {
      if (!window.navigator.onLine) {
        if (!cancelled) setRoomInitialLoadComplete(true);
        return;
      }

      const rid = await loadRoomByCode();
      if (cancelled) return;
      setRoomInitialLoadComplete(true);
      if (!rid) return;
      await loadPlayers(rid);
      await loadCurrentRound(rid);
      await loadRoomScores(rid);
    })();

  return () => {
      cancelled = true;
      stopRolling();
    };
  }, [code]);

  useEffect(() => {
    if (!roomId || !isOnline) return;

    const poll = window.setInterval(async () => {
      const { data } = await supabase
        .from("rooms")
        .select("status,letter,free_rounds_unlocked,free_rounds_started")
        .eq("id", roomId)
        .single();

      if (data) {
        setRoomStatus(data.status as RoomStatus);
        setLetter((data.letter ?? null) as string | null);
        setRoomFreeRoundsUnlocked(
          Number((data as any).free_rounds_unlocked ?? FREE_ROUND_BLOCK_SIZE)
        );
        setRoomFreeRoundsStarted(
          Number((data as any).free_rounds_started ?? 0)
        );
      }

      await loadPlayers(roomId);
      await loadCurrentRound(roomId);

      // Celkové skóre načti dřív, než allScores může přepnout UI do Free limitu.
      await loadRoomScores(roomId);

      if (round?.round_no) {
        await loadAllAnswers(roomId, round.round_no);
        await loadAllScores(roomId, round.round_no);
      }
    }, 1000);

    return () => window.clearInterval(poll);
  }, [roomId, round?.round_no, myPlayer?.id, isOnline]);

  useEffect(() => {
    if (!isOnline || !wasOfflineRef.current) return;

    wasOfflineRef.current = false;
    let cancelled = false;

    setIsReconnecting(true);

    void (async () => {
      try {
        let rid = roomId;

        if (!rid) {
          rid = await loadRoomByCode();
        }

        if (!rid) return;

        await refreshRoomState(rid);

        await Promise.all([
          loadPlayers(rid),
          loadCurrentRound(rid),
          loadRoomScores(rid),
        ]);

        if (round?.round_no) {
          await Promise.all([
            loadAllAnswers(rid, round.round_no),
            loadAllScores(rid, round.round_no),
          ]);
        }
      } finally {
        if (!cancelled) {
          setIsReconnecting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOnline, roomId, round?.round_no]);

  useEffect(() => {
    if (roomStatus === "drawing") {
      startRollingVisual();
      return;
    }

    stopRolling();
  }, [roomStatus]);

  // Jakmile je v novém kole vylosované finální písmeno, sjednoť hlášku všem hráčům
  useEffect(() => {
    if (roomStatus === "playing" && letter) {
      setMsg(t("letterDrawn"));
    }
  }, [roomStatus, letter, round?.id, uiLanguage]);

  // Při losování sjednoť hlášku všem hráčům podle typu akce
  useEffect(() => {
    if (roomStatus !== "drawing") return;

    if (round?.status === "skipped") {
      setMsg(
        t("drawingAgain")
      );
      return;
    }

    if (round?.status === "done") {
      setMsg(
        t("drawingNextRound")
      );
      return;
    }

    setMsg(
      t("drawingLetter")
    );
  }, [roomStatus, round?.status, round?.id, uiLanguage]);

  // Při novém kole vyčisti lokální odpovědi a bodování u všech hráčů
  useEffect(() => {
    if (!round?.id) return;

    setAnswers(emptyAnswers(activeCategories));
    setScores(emptyScores(activeCategories));
    setAllAnswers([]);
    setAllScores([]);
    setMyScoreSubmitted(false);
  }, [round?.id]);

  // Při vstupu do bodování nového kola začni vždy s nulovým bodováním
  useEffect(() => {
    if (roomStatus !== "scoring" || !round?.id) return;

    setScores(emptyScores(activeCategories));
    setMyScoreSubmitted(false);
  }, [roomStatus, round?.id]);

  async function resetRoomData(rid: string) {
    await Promise.all([
      supabase.from("scores").delete().eq("room_id", rid),
      supabase.from("answers").delete().eq("room_id", rid),
      supabase.from("rounds").delete().eq("room_id", rid),
      supabase
        .from("rooms")
        .update({ status: "lobby", letter: null })
        .eq("id", rid),
    ]);

    setRoomStatus("lobby");
    setLetter(null);
    setRound(null);
    setAnswers(emptyAnswers(activeCategories));
    setScores(emptyScores(activeCategories));
    setAllAnswers([]);
    setAllScores([]);
    setAllRoomScores([]);
    setMyScoreSubmitted(false);
  }

  async function joinRoom() {
    if (!roomId) return;

    const currentQuota = getFreeQuotaState();
    setFreeRoundsRemaining(currentQuota.remainingRounds);

    if (
      roomTier === "free" &&
      ownedTier === "free" &&
      currentQuota.remainingRounds <= 0
    ) {
      setMsg(t("freeLimitReachedMessage"));
      return;
    }

    const trimmed = nameInput.trim();
    if (!trimmed) {
      setMsg(
        uiMessage({ cs: "❗ Napiš jméno.", en: "❗ Enter your name.", es: "❗ Escribe tu nombre." , de: "❗ Gib deinen Namen ein.", fr: "❗ Saisis ton nom.", "pt-BR": "❗ Digite seu nome.", id: "❗ Masukkan nama kamu.", tr: "❗ Adını gir.", pl: "❗ Wpisz swoje imię.", it: "❗ Inserisci il tuo nome."})
      );
      return;
    }

    const { count: existingPlayersCount } = await supabase
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("room_id", roomId);

    if ((existingPlayersCount ?? 0) === 0) {
      await resetRoomData(roomId);
    }

    if ((existingPlayersCount ?? 0) >= maxPlayers) {
      setMsg(roomFullMessage(uiLanguage, maxPlayers));
      return;
    }

    const playerStatus: PlayerStatus = roomStatus === "lobby" ? "active" : "waiting";

    const { data, error } = await supabase
      .from("players")
      .insert({ room_id: roomId, name: trimmed, status: playerStatus })
      .select("id,name,status")
      .single();

    if (error || !data) {
      const isDuplicateName =
        error?.code === "23505" ||
        error?.message?.includes("duplicate key") ||
        error?.message?.includes("players_room_id_name_key");

      if (isDuplicateName) {
        const existing = await supabase
          .from("players")
          .select("id,name,status")
          .eq("room_id", roomId)
          .eq("name", trimmed)
          .maybeSingle();

        if (existing.data) {
          const existingPlayer: Player = {
            id: existing.data.id,
            name: existing.data.name,
            status: existing.data.status === "waiting" ? "waiting" : "active",
          };

          saveMyPlayer(roomId, existingPlayer);

          setNameInput("");
          setMsg(
            existingPlayer.status === "waiting"
              ? uiMessage({ cs: `⏳ ${trimmed} čeká na připojení po aktuálním kole.`, en: `⏳ ${trimmed} will join after the current round.`, es: `⏳ ${trimmed} se unirá después de la ronda actual.` , de: `⏳ ${trimmed} tritt nach der aktuellen Runde bei.`, fr: `⏳ ${trimmed} rejoindra la partie après la manche en cours.`, "pt-BR": `⏳ ${trimmed} entrará depois da rodada atual.`, id: `⏳ ${trimmed} akan bergabung setelah ronde saat ini.`, tr: `⏳ ${trimmed} mevcut turdan sonra katılacak.`, pl: `⏳ ${trimmed} dołączy po zakończeniu bieżącej rundy.`, it: `⏳ ${trimmed} si unirà dopo il turno in corso.`})
              : ""
          );
          await loadPlayers(roomId);
          return;
        }

        setMsg(
          uiMessage({ cs: "❌ Tohle jméno už v místnosti existuje. Zadej jiné.", en: "❌ This name already exists in the room. Choose another one.", es: "❌ Este nombre ya existe en la sala. Elige otro." , de: "❌ Dieser Name existiert bereits im Raum. Wähle einen anderen.", fr: "❌ Ce nom existe déjà dans la salle. Choisis-en un autre.", "pt-BR": "❌ Este nome já existe na sala. Escolha outro.", id: "❌ Nama ini sudah digunakan di dalam ruang. Pilih nama lain.", tr: "❌ Bu ad odada zaten kullanılıyor. Başka bir ad seç.", pl: "❌ To imię już istnieje w pokoju. Wybierz inne.", it: "❌ Questo nome esiste già nella stanza. Scegline un altro."})
        );
        return;
      }

      console.error("Player joining failed:", error);
      setMsg(
        uiMessage({ cs: "❌ Připojení do místnosti se nepodařilo.", en: "❌ Could not join the room.", es: "❌ No se pudo entrar en la sala." , de: "❌ Der Beitritt zum Raum ist fehlgeschlagen.", fr: "❌ Impossible de rejoindre la salle.", "pt-BR": "❌ Não foi possível entrar na sala.", id: "❌ Tidak dapat bergabung ke ruang.", tr: "❌ Odaya katılınamadı.", pl: "❌ Nie udało się dołączyć do pokoju.", it: "❌ Impossibile entrare nella stanza."})
      );
      return;
    }

    const newPlayer: Player = {
      id: data.id,
      name: data.name,
      status: data.status === "waiting" ? "waiting" : "active",
    };

    saveMyPlayer(roomId, newPlayer);
    setNameInput("");
    setMsg(
      newPlayer.status === "waiting"
        ? uiMessage({ cs: `⏳ ${trimmed} čeká na připojení po aktuálním kole.`, en: `⏳ ${trimmed} will join after the current round.`, es: `⏳ ${trimmed} se unirá después de la ronda actual.` , de: `⏳ ${trimmed} tritt nach der aktuellen Runde bei.`, fr: `⏳ ${trimmed} rejoindra la partie après la manche en cours.`, "pt-BR": `⏳ ${trimmed} entrará depois da rodada atual.`, id: `⏳ ${trimmed} akan bergabung setelah ronde saat ini.`, tr: `⏳ ${trimmed} mevcut turdan sonra katılacak.`, pl: `⏳ ${trimmed} dołączy po zakończeniu bieżącej rundy.`, it: `⏳ ${trimmed} si unirà dopo il turno in corso.`})
        : ""
    );
    await loadPlayers(roomId);
  }

  async function switchLocalPlayer() {
    if (!roomId || !myPlayer) return;

    const canSwitchPlayer =
      roomStatus === "lobby" ||
      roomStatus === "finished" ||
      myPlayer.status === "waiting" ||
      (roomStatus === "scoring" && everyoneScored);

    if (!canSwitchPlayer) {
      const message =
        t("changePlayerAfterScoring");

      setMsg(`❗ ${message}`);

      if (typeof window !== "undefined") {
        window.alert(message);
      }

      return;
    }

    const { error } = await supabase
      .from("players")
      .delete()
      .eq("id", myPlayer.id);

    if (error) {
      console.error("Changing player failed:", error);
      setMsg(t("changingPlayerErrorPrefix"));
      return;
    }

    if (typeof window !== "undefined") {
      localStorage.removeItem(`zm_myPlayer_${roomId}`);
    }

    setMyPlayer(null);
    setNameInput("");
    setAnswers(emptyAnswers(activeCategories));
    setScores(emptyScores(activeCategories));
    setMyScoreSubmitted(false);
    setMsg(
      t("previousPlayerRemoved")
    );
    await loadPlayers(roomId);
  }

  async function signOut() {
    if (!roomId || !myPlayer) return;

    const rid = roomId;

    const { error } = await supabase.from("players").delete().eq("id", myPlayer.id);

    if (error) {
      console.error("Player disconnect failed:", error);
      setMsg(
        uiMessage({ cs: "❌ Odpojení se nepodařilo.", en: "❌ Could not leave the room.", es: "❌ No se pudo salir de la sala." , de: "❌ Der Raum konnte nicht verlassen werden.", fr: "❌ Impossible de quitter la salle.", "pt-BR": "❌ Não foi possível sair da sala.", id: "❌ Tidak dapat keluar dari ruang.", tr: "❌ Odadan çıkılamadı.", pl: "❌ Nie udało się opuścić pokoju.", it: "❌ Impossibile uscire dalla stanza."})
      );
      return;
    }

    clearMyPlayer(rid);

    const { count: remainingPlayersCount } = await supabase
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("room_id", rid);

    if ((remainingPlayersCount ?? 0) === 0) {
      await resetRoomData(rid);
      setPlayers([]);
      setMsg("");
      return;
    }

    await loadPlayers(rid);
    setMsg("");
  }

  async function createRound(rid: string, ltr: string) {
    const { data: last } = await supabase
      .from("rounds")
      .select("round_no")
      .eq("room_id", rid)
      .order("round_no", { ascending: false })
      .limit(1);

    const nextNo = ((last?.[0]?.round_no ?? 0) as number) + 1;

    const { data, error } = await supabase
      .from("rounds")
      .insert({ room_id: rid, round_no: nextNo, letter: ltr, status: "playing" })
      .select("id,round_no,letter,status,deadline_at")
      .single();

    if (error || !data) {
      console.error("Round creation failed:", error);
      setMsg(
        uiMessage({ cs: "❌ Nové kolo se nepodařilo vytvořit.", en: "❌ The new round could not be created.", es: "❌ No se pudo crear la nueva ronda." , de: "❌ Die neue Runde konnte nicht erstellt werden.", fr: "❌ Impossible de créer la nouvelle manche.", "pt-BR": "❌ Não foi possível criar a nova rodada.", id: "❌ Ronde baru tidak dapat dibuat.", tr: "❌ Yeni tur oluşturulamadı.", pl: "❌ Nie udało się utworzyć nowej rundy.", it: "❌ Impossibile creare il nuovo turno."})
      );
      return null;
    }

    const nextRound = data as RoundLite;
    setRound(nextRound);
    return nextRound;
  }

  const isOrganizer = Boolean(
    myPlayer && localCreatorToken && roomCreatorToken && localCreatorToken === roomCreatorToken
  );

  useEffect(() => {
    roomIdRef.current = roomId;
    isOrganizerRef.current = isOrganizer;
  }, [roomId, isOrganizer]);

  const ownedExtendedCategories = SUPER_PREMIUM_EXTRA_CATEGORIES.filter(
    (category) =>
      ownedCategoryProductIds.includes(CATEGORY_PRODUCT_ID[category])
  );

  const premiumCategorySelectionUnlocked =
    roomTier === "premium" && ownedExtendedCategories.length > 0;

  const canEditRoomCategories =
    isOrganizer &&
    (roomTier === "super_premium" || premiumCategorySelectionUnlocked);

  function canToggleRoomCategory(category: string) {
    if (!canEditRoomCategories) return false;
    if (roomTier === "super_premium") return true;
    if (PREMIUM_CATEGORIES.includes(category)) return true;

    return ownedCategoryProductIds.includes(CATEGORY_PRODUCT_ID[category]);
  }

  async function updateRoomCategories(predefinedCategories: string[], customCategories: string[]) {
    if (!isOrganizer || !roomId || roomStatus !== "lobby") return;

    if (roomTier === "premium" && !premiumCategorySelectionUnlocked) {
      setMsg(
        uiMessage({ cs: "Premium má základní kategorie pevně dané. Výběr se odemkne po koupi alespoň jedné rozšířené kategorie.", en: "Premium has fixed basic categories. Category selection unlocks after purchasing at least one extended category.", es: "Premium tiene categorías básicas fijas. La selección se desbloquea al comprar al menos una categoría ampliada." , de: "Premium hat feste Grundkategorien. Die Kategorieauswahl wird nach dem Kauf mindestens einer Zusatzkategorie freigeschaltet.", fr: "Premium propose des catégories de base fixes. La sélection des catégories se déverrouille après l’achat d’au moins une catégorie supplémentaire.", "pt-BR": "O Premium tem categorias básicas fixas. A seleção de categorias é liberada após a compra de pelo menos uma categoria adicional.", id: "Premium memiliki kategori dasar tetap. Pemilihan kategori akan terbuka setelah membeli setidaknya satu kategori tambahan.", tr: "Premium'da temel kategoriler sabittir. En az bir ek kategori satın alındığında kategori seçimi açılır.", pl: "Premium ma stałe kategorie podstawowe. Wybór kategorii zostanie odblokowany po zakupie co najmniej jednej kategorii rozszerzonej.", it: "Premium ha categorie base fisse. La selezione delle categorie si sblocca dopo l’acquisto di almeno una categoria estesa."})
      );
      return;
    }

    if (roomTier === "premium") {
      const unownedExtendedCategories = predefinedCategories.filter(
        (category) =>
          SUPER_PREMIUM_EXTRA_CATEGORIES.includes(category) &&
          !ownedCategoryProductIds.includes(CATEGORY_PRODUCT_ID[category])
      );

      if (unownedExtendedCategories.length > 0) {
        setMsg(
          uiMessage({ cs: "Tato rozšířená kategorie nebyla zakoupena.", en: "This extended category has not been purchased.", es: "Esta categoría ampliada no ha sido comprada." , de: "Diese Zusatzkategorie wurde nicht gekauft.", fr: "Cette catégorie supplémentaire n’a pas été achetée.", "pt-BR": "Esta categoria adicional não foi comprada.", id: "Kategori tambahan ini belum dibeli.", tr: "Bu ek kategori henüz satın alınmadı.", pl: "Ta kategoria rozszerzona nie została zakupiona.", it: "Questa categoria estesa non è stata acquistata."})
        );
        return;
      }
    }

    const cleanedCustomCategories =
      roomTier === "super_premium"
        ? uniqueNonEmpty(customCategories).slice(0, 5)
        : [];
    const finalCategories = uniqueNonEmpty([...predefinedCategories, ...cleanedCustomCategories]);

    if (finalCategories.length === 0) {
      setMsg(
        uiMessage({ cs: "❗ Vyber alespoň jednu kategorii.", en: "❗ Select at least one category.", es: "❗ Selecciona al menos una categoría." , de: "❗ Wähle mindestens eine Kategorie aus.", fr: "❗ Sélectionne au moins une catégorie.", "pt-BR": "❗ Selecione pelo menos uma categoria.", id: "❗ Pilih setidaknya satu kategori.", tr: "❗ En az bir kategori seç.", pl: "❗ Wybierz co najmniej jedną kategorię.", it: "❗ Seleziona almeno una categoria."})
      );
      return;
    }

    setActiveCategories(finalCategories);
    setRoomCustomCategories([
      ...cleanedCustomCategories,
      ...Array(Math.max(0, 5 - cleanedCustomCategories.length)).fill(""),
    ].slice(0, 5));

    const { error } = await supabase
      .from("rooms")
      .update({
        active_categories: finalCategories,
        custom_category: cleanedCustomCategories.join(" | ") || null,
      })
      .eq("id", roomId);

    if (error) {
      console.error("Category settings saving failed:", error);
      setMsg(
        uiMessage({ cs: "❌ Kategorie se nepodařilo uložit.", en: "❌ The categories could not be saved.", es: "❌ No se pudieron guardar las categorías." , de: "❌ Die Kategorien konnten nicht gespeichert werden.", fr: "❌ Impossible d’enregistrer les catégories.", "pt-BR": "❌ Não foi possível salvar as categorias.", id: "❌ Kategori tidak dapat disimpan.", tr: "❌ Kategoriler kaydedilemedi.", pl: "❌ Nie udało się zapisać kategorii.", it: "❌ Impossibile salvare le categorie."})
      );
    }
  }

  function showPremiumLockedCategoryOffer(category: string) {
    setPremiumLockedOfferCategory(category);
    setMsg("");
  }

  async function startCategoryPurchase(category: string) {
    const productId = CATEGORY_PRODUCT_ID[category];

    if (
      !productId ||
      !isPlayBillingAvailable() ||
      !billingReady ||
      !billingProducts.some((product) => product.productId === productId)
    ) {
      setMsg(
        uiMessage({ cs: "Nákup kategorie zatím není dostupný.", en: "The category purchase is not available yet.", es: "La compra de la categoría todavía no está disponible." , de: "Der Kauf der Kategorie ist noch nicht verfügbar.", fr: "L’achat de cette catégorie n’est pas encore disponible.", "pt-BR": "A compra desta categoria ainda não está disponível.", id: "Pembelian kategori ini belum tersedia.", tr: "Bu kategoriyi satın alma henüz kullanılamıyor.", pl: "Zakup kategorii nie jest jeszcze dostępny.", it: "L’acquisto della categoria non è ancora disponibile."})
      );
      return;
    }

    setCategoryPurchaseBusy(productId);

    try {
      const result = await PlayBilling.purchase({ productId });

      if (result.responseCode !== 0) {
        setCategoryPurchaseBusy(null);
        console.error("Google Play Billing error:", result.debugMessage);
        setMsg(
          uiMessage({ cs: "Nákupní okno se nepodařilo otevřít.", en: "The purchase window could not be opened.", es: "No se pudo abrir la ventana de compra." , de: "Das Kauffenster konnte nicht geöffnet werden.", fr: "Impossible d’ouvrir la fenêtre d’achat.", "pt-BR": "Não foi possível abrir a janela de compra.", id: "Jendela pembelian tidak dapat dibuka.", tr: "Satın alma penceresi açılamadı.", pl: "Nie udało się otworzyć okna zakupu.", it: "Impossibile aprire la finestra di acquisto."})
        );
      }
    } catch (error) {
      console.error("Category purchase failed:", error);
      setCategoryPurchaseBusy(null);
      setMsg(
        uiMessage({ cs: "Nákup se nepodařilo spustit.", en: "The purchase could not be started.", es: "No se pudo iniciar la compra." , de: "Der Kauf konnte nicht gestartet werden.", fr: "Impossible de démarrer l’achat.", "pt-BR": "Não foi possível iniciar a compra.", id: "Pembelian tidak dapat dimulai.", tr: "Satın alma başlatılamadı.", pl: "Nie udało się rozpocząć zakupu.", it: "Impossibile avviare l’acquisto."})
      );
    }
  }

  async function startPremiumPurchase() {
    const premiumProduct = billingProducts.find(
      (product) => product.productId === "premium"
    );

    if (
      !isPlayBillingAvailable() ||
      !billingReady ||
      !premiumProduct
    ) {
      setMsg(
        uiMessage({ cs: "Nákup Premium zatím není dostupný.", en: "The Premium purchase is not available yet.", es: "La compra de Premium todavía no está disponible." , de: "Der Premium-Kauf ist noch nicht verfügbar.", fr: "L’achat de Premium n’est pas encore disponible.", "pt-BR": "A compra do Premium ainda não está disponível.", id: "Pembelian Premium belum tersedia.", tr: "Premium satın alma henüz kullanılamıyor.", pl: "Zakup Premium nie jest jeszcze dostępny.", it: "L’acquisto di Premium non è ancora disponibile."})
      );
      return;
    }

    setCategoryPurchaseBusy("premium");

    try {
      const result = await PlayBilling.purchase({
        productId: "premium",
      });

      if (result.responseCode !== 0) {
        setCategoryPurchaseBusy(null);
        console.error("Google Play Billing error:", result.debugMessage);
        setMsg(
          uiMessage({ cs: "Nákupní okno se nepodařilo otevřít.", en: "The purchase window could not be opened.", es: "No se pudo abrir la ventana de compra." , de: "Das Kauffenster konnte nicht geöffnet werden.", fr: "Impossible d’ouvrir la fenêtre d’achat.", "pt-BR": "Não foi possível abrir a janela de compra.", id: "Jendela pembelian tidak dapat dibuka.", tr: "Satın alma penceresi açılamadı.", pl: "Nie udało się otworzyć okna zakupu.", it: "Impossibile aprire la finestra di acquisto."})
        );
      }
    } catch (error) {
      console.error("Premium purchase failed:", error);
      setCategoryPurchaseBusy(null);
      setMsg(
        uiMessage({ cs: "Nákup se nepodařilo spustit.", en: "The purchase could not be started.", es: "No se pudo iniciar la compra." , de: "Der Kauf konnte nicht gestartet werden.", fr: "Impossible de démarrer l’achat.", "pt-BR": "Não foi possível iniciar a compra.", id: "Pembelian tidak dapat dimulai.", tr: "Satın alma başlatılamadı.", pl: "Nie udało się rozpocząć zakupu.", it: "Impossibile avviare l’acquisto."})
      );
    }
  }

  async function startSuperPremiumPurchase() {
    const superPremiumProduct = billingProducts.find(
      (product) => product.productId === "super_premium"
    );
    const useUpgradeOffer = (isOrganizer ? roomTier : ownedTier) === "premium";
    const upgradeOfferAvailable = superPremiumProduct?.offers?.some(
      (offer) => offer.offerId === "premium-upgrade"
    );

    if (
      !isPlayBillingAvailable() ||
      !billingReady ||
      !superPremiumProduct ||
      (useUpgradeOffer && !upgradeOfferAvailable)
    ) {
      setMsg(
        uiMessage({ cs: "Nákup Super Premium zatím není dostupný.", en: "The Super Premium purchase is not available yet.", es: "La compra de Super Premium todavía no está disponible.", de: "Der Super-Premium-Kauf ist noch nicht verfügbar.", fr: "L’achat de Super Premium n’est pas encore disponible.", "pt-BR": "A compra do Super Premium ainda não está disponível.", id: "Pembelian Super Premium belum tersedia.", tr: "Super Premium satın alma henüz kullanılamıyor.", pl: "Zakup Super Premium nie jest jeszcze dostępny.", it: "L’acquisto di Super Premium non è ancora disponibile." })
      );
      return;
    }

    setCategoryPurchaseBusy("super_premium");

    try {
      const result = await PlayBilling.purchase({
        productId: "super_premium",
        ...(useUpgradeOffer ? { offerId: "premium-upgrade" } : {}),
      });

      if (result.responseCode !== 0) {
        setCategoryPurchaseBusy(null);
        console.error("Google Play Billing error:", result.debugMessage);
        setMsg(
          uiMessage({ cs: "Nákupní okno se nepodařilo otevřít.", en: "The purchase window could not be opened.", es: "No se pudo abrir la ventana de compra." , de: "Das Kauffenster konnte nicht geöffnet werden.", fr: "Impossible d’ouvrir la fenêtre d’achat.", "pt-BR": "Não foi possível abrir a janela de compra.", id: "Jendela pembelian tidak dapat dibuka.", tr: "Satın alma penceresi açılamadı.", pl: "Nie udało się otworzyć okna zakupu.", it: "Impossibile aprire la finestra di acquisto."})
        );
      }
    } catch (error) {
      console.error("Super Premium purchase failed:", error);
      setCategoryPurchaseBusy(null);
      setMsg(
        uiMessage({ cs: "Nákup se nepodařilo spustit.", en: "The purchase could not be started.", es: "No se pudo iniciar la compra." , de: "Der Kauf konnte nicht gestartet werden.", fr: "Impossible de démarrer l’achat.", "pt-BR": "Não foi possível iniciar a compra.", id: "Pembelian tidak dapat dimulai.", tr: "Satın alma başlatılamadı.", pl: "Nie udało się rozpocząć zakupu.", it: "Impossibile avviare l’acquisto."})
      );
    }
  }

  function toggleRoomCategory(category: string) {
    const selectedPredefined = activeCategories.filter((item) =>
      ALL_PREDEFINED_CATEGORIES.includes(item)
    );

    const nextPredefined = selectedPredefined.includes(category)
      ? selectedPredefined.filter((item) => item !== category)
      : [...selectedPredefined, category];

    void updateRoomCategories(nextPredefined, roomCustomCategories);
  }

  function addRoomCustomCategory() {
    setCustomCategorySlotCount((current) =>
      Math.min(5, Math.max(current, filledCustomCategoryCount) + 1)
    );
  }

  function removeRoomCustomCategory(index: number) {
    const visibleValues = roomCustomCategories.slice(0, visibleCustomCategoryCount);
    visibleValues.splice(index, 1);

    const next = [
      ...visibleValues,
      ...Array(5).fill(""),
    ].slice(0, 5);

    const nextVisibleCount = Math.max(0, visibleCustomCategoryCount - 1);

    setRoomCustomCategories(next);
    setCustomCategorySlotCount(nextVisibleCount);

    const selectedPredefined = activeCategories.filter((item) =>
      ALL_PREDEFINED_CATEGORIES.includes(item)
    );

    void updateRoomCategories(selectedPredefined, next);
  }

  function updateRoomCustomCategory(index: number, value: string) {
    const next = [...roomCustomCategories];
    next[index] = value;
    setRoomCustomCategories(next);

    const selectedPredefined = activeCategories.filter((item) =>
      ALL_PREDEFINED_CATEGORIES.includes(item)
    );

    void updateRoomCategories(selectedPredefined, next);
  }

  async function updateRoomGameSettings(
    nextRoundTimeLimitSeconds: RoundTimeLimitSeconds,
    nextRoundCountLimit: RoundCountLimit
  ) {
    if (!isOrganizer || !roomId || roomStatus !== "lobby" || !superPremiumGameSettingsEnabled) return;

    setRoundTimeLimitSeconds(nextRoundTimeLimitSeconds);
    setRoundCountLimit(nextRoundCountLimit);

    const { error } = await supabase
      .from("rooms")
      .update({
        round_time_limit_seconds: nextRoundTimeLimitSeconds,
        round_count_limit: nextRoundCountLimit,
      })
      .eq("id", roomId)
      .eq("status", "lobby");

    if (error) {
      console.error("Game settings saving failed:", error);
      setMsg(t("gameSettingsSaveErrorPrefix"));
    }
  }

  async function saveRoomCategoryOrder(nextCategories: string[]) {
    if (!isOrganizer || !roomId || roomStatus !== "lobby") return;

    const finalCategories = uniqueNonEmpty(nextCategories);

    if (finalCategories.length === 0) {
      setMsg(
        uiMessage({ cs: "❗ Vyber alespoň jednu kategorii.", en: "❗ Select at least one category.", es: "❗ Selecciona al menos una categoría." , de: "❗ Wähle mindestens eine Kategorie aus.", fr: "❗ Sélectionne au moins une catégorie.", "pt-BR": "❗ Selecione pelo menos uma categoria.", id: "❗ Pilih setidaknya satu kategori.", tr: "❗ En az bir kategori seç.", pl: "❗ Wybierz co najmniej jedną kategorię.", it: "❗ Seleziona almeno una categoria."})
      );
      return;
    }

    const customCategories = finalCategories
      .filter((category) => !ALL_PREDEFINED_CATEGORIES.includes(category))
      .slice(0, 5);

    setActiveCategories(finalCategories);
    setRoomCustomCategories([
      ...customCategories,
      ...Array(Math.max(0, 5 - customCategories.length)).fill(""),
    ].slice(0, 5));

    const { error } = await supabase
      .from("rooms")
      .update({
        active_categories: finalCategories,
        custom_category: customCategories.join(" | ") || null,
      })
      .eq("id", roomId);

    if (error) {
      console.error("Category order saving failed:", error);
      setMsg(
        uiMessage({ cs: "❌ Pořadí kategorií se nepodařilo uložit.", en: "❌ The category order could not be saved.", es: "❌ No se pudo guardar el orden de las categorías." , de: "❌ Die Reihenfolge der Kategorien konnte nicht gespeichert werden.", fr: "❌ Impossible d’enregistrer l’ordre des catégories.", "pt-BR": "❌ Não foi possível salvar a ordem das categorias.", id: "❌ Urutan kategori tidak dapat disimpan.", tr: "❌ Kategori sırası kaydedilemedi.", pl: "❌ Nie udało się zapisać kolejności kategorii.", it: "❌ Impossibile salvare l’ordine delle categorie."})
      );
    }
  }

  function moveRoomCategory(category: string, direction: -1 | 1) {
    const currentIndex = activeCategories.indexOf(category);
    if (currentIndex < 0) return;

    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= activeCategories.length) return;

    const nextCategories = [...activeCategories];
    const moved = nextCategories[currentIndex];

    nextCategories[currentIndex] = nextCategories[nextIndex];
    nextCategories[nextIndex] = moved;

    void saveRoomCategoryOrder(nextCategories);
  }

  async function beginFreeRoomRound(
    rid: string,
    expectedStatus: "lobby" | "scoring"
  ): Promise<"started" | "limit" | "already_started" | "error"> {
    const { data, error } = await (supabase as any).rpc(
      "begin_free_round",
      {
        p_room_id: rid,
        p_expected_status: expectedStatus,
      }
    );

    if (error) {
      console.error("Free round start failed:", error);
      return "error";
    }

    const startedRounds = Number(data ?? 0);

    if (startedRounds > 0) {
      setRoomFreeRoundsStarted(startedRounds);
      return "started";
    }

    const { data: roomData, error: roomError } = await supabase
      .from("rooms")
      .select("status,free_rounds_unlocked,free_rounds_started")
      .eq("id", rid)
      .single();

    if (roomError || !roomData) {
      console.error("Free room limit check failed:", roomError);
      return "error";
    }

    const unlocked = Number(
      (roomData as any).free_rounds_unlocked ?? FREE_ROUND_BLOCK_SIZE
    );
    const started = Number(
      (roomData as any).free_rounds_started ?? 0
    );

    setRoomFreeRoundsUnlocked(unlocked);
    setRoomFreeRoundsStarted(started);
    setRoomStatus((roomData as any).status as RoomStatus);

    if (started >= unlocked) {
      return "limit";
    }

    return "already_started";
  }

  async function startGame() {
    if (roomId) {
      await refreshRoomState(roomId);
    }

    if (!roomId || !myPlayer) {
      setMsg(t("joinNameFirst"));
      return;
    }

    const rid = roomId;

    if (roomTier === "free") {
      const result = await beginFreeRoomRound(rid, "lobby");

      if (result === "limit") {
        setShowFreeLimitUpsell(true);
        setMsg(t("freeLimitReachedMessage"));
        return;
      }

      if (result !== "started") {
        setMsg(
          uiMessage({ cs: "ℹ️ Losování už spustil jiný hráč.", en: "ℹ️ Another player has already started drawing the letter.", es: "ℹ️ Otro jugador ya ha iniciado el sorteo de la letra." , de: "ℹ️ Ein anderer Spieler hat bereits mit dem Auslosen des Buchstabens begonnen.", fr: "ℹ️ Un autre joueur a déjà commencé à tirer la lettre.", "pt-BR": "ℹ️ Outro jogador já começou a sortear a letra.", id: "ℹ️ Pemain lain sudah mulai mengundi huruf.", tr: "ℹ️ Başka bir oyuncu harf çekmeye başladı.", pl: "ℹ️ Inny gracz rozpoczął już losowanie litery.", it: "ℹ️ Un altro giocatore ha già iniziato l’estrazione della lettera."})
        );
        return;
      }
    } else {
      const { data: locked, error: lockError } = await supabase
        .from("rooms")
        .update({ status: "drawing", letter: null })
        .eq("id", rid)
        .eq("status", "lobby")
        .select("id")
        .maybeSingle();

      if (lockError || !locked) {
        setMsg(
          uiMessage({ cs: "ℹ️ Losování už spustil jiný hráč.", en: "ℹ️ Another player has already started drawing the letter.", es: "ℹ️ Otro jugador ya ha iniciado el sorteo de la letra." , de: "ℹ️ Ein anderer Spieler hat bereits mit dem Auslosen des Buchstabens begonnen.", fr: "ℹ️ Un autre joueur a déjà commencé à tirer la lettre.", "pt-BR": "ℹ️ Outro jogador já começou a sortear a letra.", id: "ℹ️ Pemain lain sudah mulai mengundi huruf.", tr: "ℹ️ Başka bir oyuncu harf çekmeye başladı.", pl: "ℹ️ Inny gracz rozpoczął już losowanie litery.", it: "ℹ️ Un altro giocatore ha già iniziato l’estrazione della lettera."})
        );
        return;
      }
    }

    setMsg(t("drawingLetter"));
    setRoomStatus("drawing");
    setLetter(null);

    window.setTimeout(async () => {
      const finalLetter = await pickLetter(rid);
      if (!finalLetter) return;

      const newRound = await createRound(rid, finalLetter);
      if (!newRound) return;

      await supabase
        .from("rooms")
        .update({ status: "playing", letter: finalLetter })
        .eq("id", rid)
        .eq("status", "drawing");

      setAnswers(emptyAnswers(activeCategories));
      setScores(emptyScores(activeCategories));
      setAllAnswers([]);
      setAllScores([]);
      setMyScoreSubmitted(false);
      setMsg(t("letterDrawn"));
    }, ROLL_MS);
  }

  async function redrawLetter() {
    if (!roomId || !round?.id || !myPlayer) {
      setMsg(t("joinNameFirst"));
      return;
    }

    const rid = roomId;
    const currentRoundId = round.id;

    setMsg(t("drawingAgain"));
    setRoomStatus("drawing");
    setLetter(null);
    setAnswers(emptyAnswers(activeCategories));
    setScores(emptyScores(activeCategories));
    setAllAnswers([]);
    setAllScores([]);
    setMyScoreSubmitted(false);

    const { data: locked, error: lockError } = await supabase
      .from("rooms")
      .update({ status: "drawing", letter: null })
      .eq("id", rid)
      .eq("status", "playing")
      .select("id")
      .maybeSingle();

    if (lockError || !locked) {
      setMsg(
        uiMessage({ cs: "ℹ️ Losování už spustil jiný hráč.", en: "ℹ️ Another player has already started drawing the letter.", es: "ℹ️ Otro jugador ya ha iniciado el sorteo de la letra." , de: "ℹ️ Ein anderer Spieler hat bereits mit dem Auslosen des Buchstabens begonnen.", fr: "ℹ️ Un autre joueur a déjà commencé à tirer la lettre.", "pt-BR": "ℹ️ Outro jogador já começou a sortear a letra.", id: "ℹ️ Pemain lain sudah mulai mengundi huruf.", tr: "ℹ️ Başka bir oyuncu harf çekmeye başladı.", pl: "ℹ️ Inny gracz rozpoczął już losowanie litery.", it: "ℹ️ Un altro giocatore ha già iniziato l’estrazione della lettera."})
      );
      return;
    }

    await supabase.from("rounds").update({ status: "skipped" }).eq("id", currentRoundId);

    window.setTimeout(async () => {
      const finalLetter = await pickLetter(rid);
      if (!finalLetter) return;

      const newRound = await createRound(rid, finalLetter);
      if (!newRound) return;

      await supabase
        .from("rooms")
        .update({ status: "playing", letter: finalLetter })
        .eq("id", rid)
        .eq("status", "drawing");

      setMsg(t("letterDrawn"));
    }, ROLL_MS);
  }

  async function saveAnswer(category: Category, value: string) {
    if (!roomId || !myPlayer || !round?.round_no) return;

    setAnswers((prev) => ({ ...prev, [category]: value }));

    await supabase.from("answers").upsert(
      {
        room_id: roomId,
        player_id: myPlayer.id,
        round: round.round_no,
        category,
        value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "room_id,player_id,round,category" }
    );
  }

  async function stopRound(stopByValue?: string) {
    if (!roomId || !round?.id || !round?.round_no || !myPlayer) return;

    const effectiveStopBy = stopByValue ?? myPlayer.name;
    const stoppedByTimeout = effectiveStopBy === "__TIMEOUT__";

    const { data: locked, error: lockError } = await supabase
      .from("rooms")
      .update({ status: "scoring" })
      .eq("id", roomId)
      .eq("status", "playing")
      .select("id")
      .maybeSingle();

    if (lockError || !locked) {
      setMsg(
        uiMessage({ cs: "ℹ️ STOP už stiskl jiný hráč.", en: "ℹ️ Another player has already pressed STOP.", es: "ℹ️ Otro jugador ya ha pulsado STOP." , de: "ℹ️ Ein anderer Spieler hat bereits STOP gedrückt.", fr: "ℹ️ Un autre joueur a déjà appuyé sur STOP.", "pt-BR": "ℹ️ Outro jogador já apertou STOP.", id: "ℹ️ Pemain lain sudah menekan STOP.", tr: "ℹ️ Başka bir oyuncu STOP'a bastı.", pl: "ℹ️ Inny gracz nacisnął już STOP.", it: "ℹ️ Un altro giocatore ha già premuto STOP."})
      );
      return;
    }

    await supabase.from("answers").upsert(
      {
        room_id: roomId,
        player_id: myPlayer.id,
        round: round.round_no,
        category: "__STOP_BY__",
        value: effectiveStopBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "room_id,player_id,round,category" }
    );

    await supabase.from("rounds").update({ status: "scoring" }).eq("id", round.id);

    setRoomStatus("scoring");
    setScores(emptyScores(activeCategories));
    setMyScoreSubmitted(false);

    setMsg(
      stoppedByTimeout
        ? uiMessage({ cs: "Čas vypršel.", en: "Time is up.", es: "Se acabó el tiempo." , de: "Die Zeit ist abgelaufen.", fr: "Le temps est écoulé.", "pt-BR": "O tempo acabou.", id: "Waktu habis.", tr: "Süre doldu.", pl: "Czas minął.", it: "Tempo scaduto."})
        : stopPressedMessage(uiLanguage, myPlayer.name)
    );
  }

  async function submitScores() {
    if (!roomId || !myPlayer || !round?.round_no) return;

    const rows = activeCategories.map((category) => ({
      room_id: roomId,
      player_id: myPlayer.id,
      round: round.round_no,
      category,
      points: scores[category],
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("scores")
      .upsert(rows, { onConflict: "room_id,player_id,round,category" });

    if (error) {
      console.error("Scores saving failed:", error);
      setMsg(t("savingScoresErrorPrefix"));
      return;
    }

    setMyScoreSubmitted(true);
    setMsg("");

    // Nejdřív synchronizuj celkové skóre. Free limit se může zobrazit až potom.
    await loadRoomScores(roomId);
    await loadAllScores(roomId, round.round_no);
  }

  const scoredPlayerIds = new Set(
    players
      .filter((p) => activeCategories.every((c) => allScores.some((s) => s.player_id === p.id && s.category === c)))
      .map((p) => p.id)
  );

  const everyoneScored = players.length > 0 && scoredPlayerIds.size === players.length;

  useEffect(() => {
    if (
      roomTier !== "free" ||
      roomStatus !== "playing" ||
      !roomId ||
      roomFreeRoundsStarted <= 0 ||
      !myPlayer ||
      myPlayer.status === "waiting"
    ) {
      return;
    }

    const nextQuota = consumeFreeRound(
      `${roomId}:free-round:${roomFreeRoundsStarted}`
    );
    setFreeRoundsRemaining(nextQuota.remainingRounds);
  }, [
    roomTier,
    roomStatus,
    roomId,
    roomFreeRoundsStarted,
    myPlayer?.id,
    myPlayer?.status,
  ]);

  const currentRoundNo = round?.round_no ?? 0;
  const isFinalScoringRound =
    superPremiumGameSettingsEnabled &&
    roomStatus === "scoring" &&
    everyoneScored &&
    roundCountLimit !== null &&
    currentRoundNo >= roundCountLimit;

  const freeLimitReached =
    roomTier === "free" &&
    everyoneScored &&
    roomFreeRoundsStarted >= roomFreeRoundsUnlocked;

  const shouldShowFreeLimitUpsell = freeLimitReached || showFreeLimitUpsell;

  const stoppedByName =
    allAnswers.find((a) => a.category === "__STOP_BY__")?.value ?? "";
  const stoppedByTime = stoppedByName === "__TIMEOUT__";

  function playerRoundPoints(playerId: string, roundNo: number) {
    return allRoomScores
      .filter((s) => s.player_id === playerId && s.round === roundNo)
      .reduce((sum, s) => sum + Number(s.points ?? 0), 0);
  }

  function playerTotalPoints(playerId: string) {
    return allRoomScores
      .filter((s) => s.player_id === playerId)
      .reduce((sum, s) => sum + Number(s.points ?? 0), 0);
  }

  const finalStandings = players
    .map((player) => ({
      ...player,
      totalPoints: playerTotalPoints(player.id),
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints || a.name.localeCompare(b.name, "cs-CZ"));

  const scoredRoundNumbers = Array.from(
    new Set(
      allRoomScores
        .map((s) => s.round)
        .filter((roundNo): roundNo is number => typeof roundNo === "number")
    )
  ).sort((a, b) => a - b);

  async function startFreeRewardedAd() {
    if (showRewardedAdPlaceholder) return;

    setShowRewardedAdPlaceholder(true);
    setMsg("");

    const nativeRewardShown = await showFreeRewardedAdForNativeApp();

    if (!nativeRewardShown) {
      setShowRewardedAdPlaceholder(false);
      setMsg(t("freeLimitReachedMessage"));
      return;
    }

    await unlockFreeRoundsByRewardedAd();
  }

  async function unlockFreeRoundsByRewardedAd() {
    if (!roomId) {
      setShowRewardedAdPlaceholder(false);
      return;
    }

    const { data, error } = await (supabase as any).rpc(
      "unlock_free_rounds",
      { p_room_id: roomId }
    );

    if (error) {
      console.error("Free room unlock failed:", error);
      setShowRewardedAdPlaceholder(false);
      setMsg(t("freeLimitReachedMessage"));
      return;
    }

    const nextRoomLimit = Number(
      data ?? roomFreeRoundsUnlocked + FREE_ROUND_BLOCK_SIZE
    );

    setRoomFreeRoundsUnlocked(nextRoomLimit);

    const nextQuota = unlockFreeRoundBlock();
    setFreeRoundsRemaining(nextQuota.remainingRounds);

    // Po návratu z nativní rewarded reklamy znovu potvrď poslední uložené body.
    await loadRoomScores(roomId);

    setShowFreeLimitUpsell(false);
    setShowRewardedAdPlaceholder(false);
    setMsg(t("freeRewardUnlocked"));
  }

  async function finishGame() {
    if (!roomId || !round?.id || !everyoneScored || !myPlayer) {
      setMsg(t("joinNameFirst"));
      return;
    }

    await supabase.from("rounds").update({ status: "done" }).eq("id", round.id);

    const { error } = await supabase
      .from("rooms")
      .update({ status: "finished" })
      .eq("id", roomId);

    if (error) {
      console.error("Finishing game failed:", error);
      setMsg(t("finishGameErrorPrefix"));
      return;
    }

    setRoomStatus("finished");
    setMsg(t("gameFinishedMessage"));
    await loadRoomScores(roomId);
  }

  async function nextRound() {
    if (!roomId || !round?.id || !everyoneScored || !myPlayer) {
      setMsg(t("joinNameFirst"));
      return;
    }

    const rid = roomId;
    const currentRoundId = round.id;

    if (roomTier === "free") {
      const result = await beginFreeRoomRound(rid, "scoring");

      if (result === "limit") {
        setShowFreeLimitUpsell(true);
        setMsg(t("freeLimitReachedMessage"));
        return;
      }

      if (result !== "started") {
        setMsg(
          uiMessage({ cs: "ℹ️ Další kolo už spustil jiný hráč.", en: "ℹ️ Another player has already started the next round.", es: "ℹ️ Otro jugador ya ha iniciado la siguiente ronda.", de: "ℹ️ Ein anderer Spieler hat bereits die nächste Runde gestartet.", fr: "ℹ️ Un autre joueur a déjà démarré la manche suivante.", "pt-BR": "ℹ️ Outro jogador já iniciou a próxima rodada.", id: "ℹ️ Pemain lain sudah memulai ronde berikutnya.", tr: "ℹ️ Başka bir oyuncu sonraki turu başlattı.", pl: "ℹ️ Inny gracz rozpoczął już następną rundę.", it: "ℹ️ Un altro giocatore ha già avviato il turno successivo."})
        );
        return;
      }
    } else {
      const { data: locked, error: lockError } = await supabase
        .from("rooms")
        .update({ status: "drawing", letter: null })
        .eq("id", rid)
        .eq("status", "scoring")
        .select("id")
        .maybeSingle();

      if (lockError || !locked) {
        setMsg(
          uiMessage({ cs: "ℹ️ Další kolo už spustil jiný hráč.", en: "ℹ️ Another player has already started the next round.", es: "ℹ️ Otro jugador ya ha iniciado la siguiente ronda.", de: "ℹ️ Ein anderer Spieler hat bereits die nächste Runde gestartet.", fr: "ℹ️ Un autre joueur a déjà démarré la manche suivante.", "pt-BR": "ℹ️ Outro jogador já iniciou a próxima rodada.", id: "ℹ️ Pemain lain sudah memulai ronde berikutnya.", tr: "ℹ️ Başka bir oyuncu sonraki turu başlattı.", pl: "ℹ️ Inny gracz rozpoczął już następną rundę.", it: "ℹ️ Un altro giocatore ha già avviato il turno successivo."})
        );
        return;
      }
    }

    if (waitingPlayers.length > 0) {
      await supabase
        .from("players")
        .update({ status: "active" })
        .eq("room_id", roomId)
        .eq("status", "waiting");

      await loadPlayers(roomId);
    }

    setMsg(t("drawingNextRound"));
    setRoomStatus("drawing");
    setLetter(null);
    setAnswers(emptyAnswers(activeCategories));
    setScores(emptyScores(activeCategories));
    setAllAnswers([]);
    setAllScores([]);
    setMyScoreSubmitted(false);

    await supabase.from("rounds").update({ status: "done" }).eq("id", currentRoundId);

    window.setTimeout(async () => {
      const finalLetter = await pickLetter(rid);
      if (!finalLetter) return;

      const newRound = await createRound(rid, finalLetter);
      if (!newRound) return;

      await supabase
        .from("rooms")
        .update({ status: "playing", letter: finalLetter })
        .eq("id", rid)
        .eq("status", "drawing");

      setMsg(t("letterDrawn"));
    }, ROLL_MS);
  }

  function answerFor(playerId: string, category: Category) {
    return allAnswers.find((a) => a.player_id === playerId && a.category === category)?.value ?? "";
  }

  const gameLanguageName = gameLanguageNameText(uiLanguage, roomLanguage);

  const gameLanguageInstruction = gameLanguageInstructionText(uiLanguage, roomLanguage);

  const gameLanguageConfig = GAME_LANGUAGE_CONFIG[roomLanguage];
  const gameLanguageFlag = gameLanguageConfig.flag;
  const gameLanguageHasDiacritics =
    gameLanguageConfig.hasDiacritics;

  const roomIsFull = !myPlayer && players.length + waitingPlayers.length >= maxPlayers;
  const freeJoinBlocked =
    roomTier === "free" && ownedTier === "free" && freeRoundsRemaining <= 0;
  const activeMyPlayer = Boolean(myPlayer && myPlayer.status !== "waiting");

  const filledCustomCategoryCount = roomCustomCategories.filter((value) => value.trim().length > 0).length;
  const visibleCustomCategoryCount = Math.min(
    5,
    Math.max(customCategorySlotCount, filledCustomCategoryCount)
  );

  const isGameScreen = Boolean(
    myPlayer && (roomStatus === "drawing" || roomStatus === "playing")
  );
  const isScoringScreen = Boolean(myPlayer && roomStatus === "scoring");
  const isActiveGamePhase = isGameScreen || isScoringScreen;
  const showAdBanner = !nativeFreeBannerShown;

  const statusMessage =
    (roomStatus === "scoring" || roomStatus === "finished") && stoppedByTime
      ? uiMessage({ cs: "Čas vypršel.", en: "Time is up.", es: "Se acabó el tiempo." , de: "Die Zeit ist abgelaufen.", fr: "Le temps est écoulé.", "pt-BR": "O tempo acabou.", id: "Waktu habis.", tr: "Süre doldu.", pl: "Czas minął.", it: "Tempo scaduto."})
      : (roomStatus === "scoring" || roomStatus === "finished") && stoppedByName
        ? stopPressedMessage(uiLanguage, stoppedByName)
        : roomStatus === "playing" && letter
          ? t("letterDrawn")
          : msg;

  const visibleStatusMessage =
    isActiveGamePhase ? "" : myPlayer ? statusMessage : msg;

  const isRoomEntry = Boolean(roomId && !myPlayer);
  const isStyledLobby = Boolean(roomId && myPlayer && roomStatus === "lobby");
  const usePhotoRoomChrome = isRoomEntry || isStyledLobby || isActiveGamePhase;
  const newRoomLabel = uiMessage({
    cs: "Nová místnost",
    en: "New room",
    es: "Nueva sala",
    de: "Neuer Raum",
    fr: "Nouvelle salle",
    "pt-BR": "Nova sala",
    id: "Ruang baru",
    tr: "Yeni oda",
    pl: "Nowy pokój",
    it: "Nuova stanza",
  });
  const roomEntryMosaic = (
    <div className={roomStyles.photoMosaic} aria-hidden="true">
      {[
        "mountains", "castle", "eiffel", "colosseum", "woman", "elephant",
        "dog", "plant", "camera", "headphones", "backpack", "sunflower",
      ].map((photo) => (
        <span key={photo} className={`${roomStyles.photo} ${roomStyles[photo]}`} />
      ))}
    </div>
  );

  if (!roomInitialLoadComplete) {
    return (
      <main
        className={roomStyles.entryPage}
        aria-busy="true"
        style={{
          padding: 24,
          paddingTop: "calc(72px + env(safe-area-inset-top))",
          fontFamily: "system-ui",
        }}
      >
        {roomEntryMosaic}
      </main>
    );
  }

  return (
    <main
        className={usePhotoRoomChrome ? roomStyles.entryPage : undefined}
        onClickCapture={(event) => {
          if (isOnline) return;

          const target = event.target;
          if (!(target instanceof HTMLElement)) return;

          const control = target.closest(
            "button, a, select, input, textarea"
          );

          if (!control) return;

          const answerInput =
            control instanceof HTMLTextAreaElement ||
            (control instanceof HTMLInputElement &&
              (control.type === "text" || control.type === "search"));

          if (answerInput) return;

          event.preventDefault();
          event.stopPropagation();
        }}
        onSubmitCapture={(event) => {
          if (!isOnline) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        style={{
          padding: 24,
          paddingTop: "calc(72px + env(safe-area-inset-top))",
          fontFamily: "system-ui",
        }}
      >
      {usePhotoRoomChrome && roomEntryMosaic}
      {(!isOnline || isReconnecting) && (
        <section
          role="status"
          aria-live="polite"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 100,
            marginBottom: 12,
            padding: "11px 14px",
            border: "1px solid #c58b00",
            borderRadius: 10,
            background: isReconnecting ? "#e8f1ff" : "#fff4cc",
            color: "#172033",
            textAlign: "center",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {isReconnecting
            ? uiMessage({ cs: "Obnovuji spojení a synchronizuji hru…", en: "Restoring the connection and syncing the game…", es: "Restableciendo la conexión y sincronizando la partida…" , de: "Verbindung wird wiederhergestellt und das Spiel synchronisiert…", fr: "Rétablissement de la connexion et synchronisation de la partie…", "pt-BR": "Restabelecendo a conexão e sincronizando o jogo…", id: "Memulihkan koneksi dan menyinkronkan permainan…", tr: "Bağlantı yeniden kuruluyor ve oyun eşitleniyor…", pl: "Przywracanie połączenia i synchronizacja gry…", it: "Ripristino della connessione e sincronizzazione della partita…"})
            : uiMessage({ cs: "Jsi offline. Rozepsané odpovědi zůstávají uložené v tomto telefonu.", en: "You are offline. Your written answers remain saved on this phone.", es: "Sin conexión. Las respuestas escritas permanecen guardadas en este teléfono." , de: "Du bist offline. Deine eingetragenen Antworten bleiben auf diesem Gerät gespeichert.", fr: "Tu es hors ligne. Tes réponses saisies restent enregistrées sur cet appareil.", "pt-BR": "Você está offline. As respostas digitadas continuam salvas neste aparelho.", id: "Kamu sedang offline. Jawaban yang sudah ditulis tetap tersimpan di perangkat ini.", tr: "Çevrimdışısın. Yazdığın yanıtlar bu cihazda kayıtlı kalır.", pl: "Jesteś offline. Wpisane odpowiedzi pozostają zapisane na tym telefonie.", it: "Sei offline. Le risposte già inserite restano salvate su questo telefono."})}
        </section>
      )}

      {showAdBanner && (
        <section
          data-free-ad-banner
          aria-label="Reklamní banner"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            minHeight: 52,
            marginBottom: 12,
            padding: "6px 10px",
            border: "1px dashed #999",
            borderRadius: 8,
            background: "#f8fafc",
            color: "#555",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          Reklamní banner
        </section>
      )}

      {!isActiveGamePhase && (
      isRoomEntry ? (
      <header className={roomStyles.entryHeader}>
        <div className={roomStyles.entryTitleRow}>
          <h1 className={roomStyles.entryTitle}>
            {t("room")} {code.toUpperCase()}
          </h1>
          <span className={roomStyles.entryTier}>
            {roomTier === "super_premium" ? "Super Premium" : roomTier === "premium" ? "Premium" : "Free"}
          </span>
        </div>

        <p className={roomStyles.entryStatus}>{t("notSignedIn")}</p>

        <div className={roomStyles.entryActions}>
          <a className={`${roomStyles.entryAction} ${roomStyles.entryActionHome}`} href="/">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h11"/></svg>
            <span>{t("backHome")}</span>
          </a>
          <button className={roomStyles.entryAction} type="button" onClick={shareInviteLink}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"/></svg>
            <span>{t("shareRoomCode")}</span>
          </button>
          <button className={roomStyles.entryAction} type="button" onClick={copyInviteLink}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2"/></svg>
            <span>{t("copyRoomLink")}</span>
          </button>
          <button className={roomStyles.entryAction} type="button" onClick={() => setShowRules((value) => !value)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.6 2.1c-1 .6-1.4 1.1-1.4 2.2M12 17h.01"/></svg>
            <span>{t("rules")}</span>
            <svg className={`${roomStyles.entryActionChevron} ${showRules ? roomStyles.entryActionChevronOpen : ""}`} viewBox="0 0 24 24" aria-hidden="true"><path d="m5 9 7 7 7-7"/></svg>
          </button>
        </div>
      </header>
      ) : isStyledLobby ? (
      <header className={roomStyles.lobbyHeader}>
        <h1 className={roomStyles.lobbyRoomTitle}>
          {t("room")}: {code.toUpperCase()}
        </h1>
        {isOrganizer && (roomTier === "premium" || roomTier === "super_premium") && (
          <p className={roomStyles.lobbyBossRoom}>{t("bossRoom")}</p>
        )}
        <p className={roomStyles.lobbySignedIn}>
          {t("signedIn")}: <b>{myPlayer?.name}</b>
        </p>

        <div className={roomStyles.lobbyActions}>
          <a className={`${roomStyles.lobbyAction} ${roomStyles.lobbyActionPurple}`} href="/">
            <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="11" cy="10" r="5"/><path d="M2 27c0-6 3-9 9-9s9 3 9 9M24 13v12M18 19h12"/></svg>
            <span>{newRoomLabel}</span>
          </a>

          <button className={roomStyles.lobbyAction} type="button" onClick={signOut}>
            <span>{t("changePlayerOnDevice")}</span>
          </button>

          <button
            className={`${roomStyles.lobbyAction} ${roomStyles.lobbyActionLike}`}
            type="button"
            onClick={() => window.alert(t("ratingUnavailable"))}
          >
            <span className={roomStyles.lobbyLikeCopy}>{t("likeApp")} ❤️</span>
          </button>
        </div>
      </header>
      ) : (
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: 0 }}>
            {t("room")}: {code.toUpperCase()}
          </h1>
          {isOrganizer && (roomTier === "premium" || roomTier === "super_premium") && (
            <p style={{ fontWeight: 700, margin: "4px 0" }}>
              {t("bossRoom")}
            </p>
          )}
          <p style={{ marginBottom: 4 }}>
            {myPlayer ? (
              <>
                {t("signedIn")}: <b>{myPlayer.name}</b>
              </>
            ) : (
              <>{t("notSignedIn")}</>
            )}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <a
              data-room-home-link
              href="/"
              style={{
                display: "inline-block",
                padding: "2px 8px",
                border: "1px solid #888",
                borderRadius: 3,
                color: "inherit",
                textDecoration: "none",
                background: "#f5f5f5",
                marginRight: 4,
              }}
            >
              {isOrganizer ? newRoomLabel : t("backHome")}
            </a>
          <button
            type="button"
            onClick={() =>
              window.alert(
                t("ratingUnavailable")
              )
            }
            style={{
              padding: "2px 8px",
              border: "1px solid #b38b00",
              borderRadius: 3,
              background: "#fff5bf",
              fontWeight: 700,
              whiteSpace: "pre-line",
              lineHeight: 1.1,
              cursor: "pointer",
            }}
          >
            {t("likeApp")} ♥️
          </button>
          <button onClick={() => setShowRules((v) => !v)}>
            {t("rules")}
          </button>
          <button onClick={copyInviteLink}>
            {t("copyLink")}
          </button>
          <button onClick={shareInviteLink}>
            {t("share")}
          </button>
          {myPlayer && (
            <button onClick={signOut}>
              {t("disconnect")}
            </button>
          )}
        </div>
      </header>
      )
      )}

      {!isActiveGamePhase && (
      isRoomEntry ? (
      <section className={roomStyles.entryLanguage} data-game-language-banner>
        <span className={roomStyles.entryLanguageLabel}>{t("gameLanguage")}</span>
        <div className={roomStyles.entryLanguageCurrent}>
          <span>{gameLanguageFlag}</span>
          <span>{gameLanguageName}</span>
        </div>
        <p className={roomStyles.entryLanguageInstruction}>{gameLanguageInstruction}</p>
        {roomStatus === "lobby" && gameLanguageHasDiacritics && (
          <p className={roomStyles.entryLanguageNote}>{t("diacriticsOptional")}</p>
        )}
      </section>
      ) : isStyledLobby ? (
      <section className={roomStyles.lobbyLanguage} data-game-language-banner>
        <div className={roomStyles.lobbyLanguageCurrent}>
          {t("gameLanguage")}: {gameLanguageName} {gameLanguageFlag}
        </div>
        {uiLanguage !== roomLanguage && (
          <p className={roomStyles.lobbyLanguageInstruction}>{gameLanguageInstruction}</p>
        )}
        {gameLanguageHasDiacritics && (
          <p className={roomStyles.lobbyLanguageNote}>{t("diacriticsOptional")}</p>
        )}
      </section>
      ) : (
      <section
        data-game-language-banner
        style={{
          marginTop: 12,
          marginBottom: 16,
          padding: "10px 12px",
          border: "2px solid #2563eb",
          borderRadius: 8,
          background: "#eff6ff",
        }}
      >
        <div style={{ fontWeight: 800 }}>
          {t("gameLanguage")}:{" "}
          {gameLanguageName} {gameLanguageFlag}
        </div>

        {uiLanguage !== roomLanguage && (
          <div style={{ marginTop: 3 }}>
            {gameLanguageInstruction}
          </div>
        )}

          {roomStatus === "lobby" && gameLanguageHasDiacritics && (
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
              {t("diacriticsOptional")}
            </div>
          )}
      </section>
      )
      )}

      {showRules && !isStyledLobby && !isActiveGamePhase && (
        <section
          className={usePhotoRoomChrome ? roomStyles.entryRules : undefined}
          style={usePhotoRoomChrome ? undefined : { border: "1px solid #ddd", borderRadius: 8, padding: 12, marginTop: 16 }}
        >
          <h2 style={{ marginTop: 0 }}>
            {t("rules")}
          </h2>

          <>
            <p>{rulesText.join}</p>
            <p>{rulesText.play}</p>
            <h3>{rulesText.scoringTitle}</h3>
            <p>{rulesText.scoring}</p>
          </>
        </section>
      )}

      {visibleStatusMessage && <p>{visibleStatusMessage}</p>}

      {roomId && !myPlayer && (
        <section className={roomStyles.entryJoin}>
          <h2 className={roomStyles.entryJoinTitle}>
            {t("joinGame")}
          </h2>
          <p className={roomStyles.entryJoinHelp}>{t("joinNameHelp")}</p>

          {freeJoinBlocked ? (
            <section
              style={{
                padding: 14,
                border: "2px solid #f59e0b",
                borderRadius: 10,
                background: "#fff7ed",
              }}
            >
              <h3 style={{ marginTop: 0 }}>{t("freeLimitTitle")}</h3>
              <p>{t("freeLimitText")}</p>

              <button
                type="button"
                disabled={categoryPurchaseBusy !== null || showRewardedAdPlaceholder}
                onClick={() => void startPremiumPurchase()}
                style={{
                  padding: 14,
                  width: "100%",
                  fontWeight: 700,
                }}
              >
                {t("freeUpgradeButton")}
              </button>

              <button
                type="button"
                disabled={categoryPurchaseBusy !== null || showRewardedAdPlaceholder}
                onClick={() => void startSuperPremiumPurchase()}
                style={{
                  marginTop: 10,
                  padding: 14,
                  width: "100%",
                  fontWeight: 700,
                }}
              >
                {uiMessage({ cs: "Získat Super Premium", en: "Get Super Premium", es: "Obtener Super Premium", de: "Super Premium holen", fr: "Obtenir Super Premium", "pt-BR": "Obter Super Premium", id: "Dapatkan Super Premium", tr: "Super Premium al", pl: "Zdobądź Super Premium", it: "Ottieni Super Premium" })}
              </button>

              <button
                type="button"
                disabled={showRewardedAdPlaceholder || categoryPurchaseBusy !== null}
                onClick={() => void startFreeRewardedAd()}
                style={{
                  marginTop: 10,
                  padding: 14,
                  width: "100%",
                  fontWeight: 700,
                }}
              >
                {t("freeRewardButton")}
              </button>
            </section>
          ) : roomIsFull ? (
            <p>
              {roomFullMessage(uiLanguage, maxPlayers)}
            </p>
          ) : (
            <>
              <input
                className={roomStyles.entryNameInput}
                placeholder={t("yourName")}
                value={nameInput}
                enterKeyHint="go"
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || e.nativeEvent.isComposing) return;

                  e.preventDefault();
                  void joinRoom();
                }}
              />
              <button className={roomStyles.entryJoinButton} onClick={joinRoom}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
                {t("join")}
              </button>
              <p className={roomStyles.entryCapacity}>
                {(maxPlayers >= 999
                  ? t("roomCapacityUnlimited")
                  : t("roomCapacity")
                ).replace("{count}", String(maxPlayers))}
              </p>
            </>
          )}
        </section>
      )}

      {isRoomEntry && (
        <>
          <button
            type="button"
            className={roomStyles.entryLike}
            style={{
              height: 52,
              minHeight: 52,
              justifyContent: "flex-start",
              paddingTop: 5,
              paddingBottom: 5,
              borderColor: "#ffd0dc",
              background: "linear-gradient(#f7afc4,#e58daa 55%,#cc6f92)",
              boxShadow:
                "inset 0 3px 5px #ffe8ef,inset 0 -5px 7px #a85171,0 0 0 2px #9d536d,0 5px 7px #00152d",
            }}
            onClick={() => window.alert(t("ratingUnavailable"))}
          >
            <span className={roomStyles.entryLikeCopy}>{t("likeApp")} ❤️</span>
          </button>
          <p className={roomStyles.entryPrivacy}>
            <a href="/privacy">{t("privacyPolicy")}</a>
          </p>
        </>
      )}

      {roomStatus === "lobby" && myPlayer && (
        <>
            {superPremiumGameSettingsEnabled && (
            <section
              style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
              }}
            >
              <h3 style={{ marginTop: 0 }}>{t("gameSettings")}</h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: 12,
                }}
              >
                <label>
                  <span style={{ display: "block", marginBottom: 6, fontWeight: 700 }}>
                    {t("timeLimit")}
                  </span>

                  {isOrganizer ? (
                    <select
                      value={roundTimeLimitSeconds ?? ""}
                      onChange={(e) => {
                        void updateRoomGameSettings(
                          parseRoundTimeLimit(e.target.value),
                          roundCountLimit
                        );
                      }}
                      style={{ width: "100%", padding: 10 }}
                    >
                      <option value="">{t("noTimeLimit")}</option>
                      {ROUND_TIME_LIMIT_OPTIONS.map((seconds) => (
                        <option key={seconds} value={seconds}>
                          {seconds} s
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div style={{ padding: "10px 0" }}>
                      {roundTimeLimitSeconds ? `${roundTimeLimitSeconds} s` : t("noTimeLimit")}
                    </div>
                  )}
                </label>

                <label>
                  <span style={{ display: "block", marginBottom: 6, fontWeight: 700 }}>
                    {t("roundCount")}
                  </span>

                  {isOrganizer ? (
                    <select
                      value={roundCountLimit ?? ""}
                      onChange={(e) => {
                        void updateRoomGameSettings(
                          roundTimeLimitSeconds,
                          parseRoundCountLimit(e.target.value)
                        );
                      }}
                      style={{ width: "100%", padding: 10 }}
                    >
                      <option value="">{t("unlimitedRounds")}</option>
                      {ROUND_COUNT_LIMIT_OPTIONS.map((count) => (
                        <option key={count} value={count}>
                          {count} {t("roundsCountSuffix")}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div style={{ padding: "10px 0" }}>
                      {roundCountLimit ? `${roundCountLimit} ${t("roundsCountSuffix")}` : t("unlimitedRounds")}
                    </div>
                  )}
                </label>
              </div>
            </section>
            )}

          {isOrganizer && myPlayer && (
            <button
              data-main-start-button
              className={roomStyles.lobbyStartButton}
              onClick={startGame}
            >
              {t("startGame")}
            </button>
          )}

          <p className={roomStyles.lobbyLetters}>
            <strong>{t("availableLetters")}:</strong>{" "}
            <span>{getLettersForLanguage(roomLanguage).join(", ")}</span>
          </p>

          <section className={roomStyles.lobbyPlayers}>
            <h3>
              {t("players")} ({players.length})
            </h3>
            <ul>
              {players.map((p) => (
                <li key={p.id}>{p.name}</li>
              ))}
            </ul>
          </section>

          {waitingPlayers.length > 0 && (
            <>
              <h3>
                {t("waitingPlayers")}{" "}
                ({waitingPlayers.length})
              </h3>
              <ul>
                {waitingPlayers.map((p) => (
                  <li key={p.id}>
                    ⏳ {p.name} –{" "}
                    {t("waitingPlayerNextRound")}
                  </li>
                ))}
              </ul>
            </>
          )}

          {(roomTier === "premium" || roomTier === "super_premium") && myPlayer && (
            <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginTop: 16 }}>
              <h3 style={{ marginTop: 0 }}>
                {t("roomCategories")}
              </h3>

              <p style={{ opacity: 0.75 }}>
                {categoryHelpText(uiLanguage, isOrganizer, roomTier)}
              </p>

              <h4>
                {t("basicCategories")}
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {PREMIUM_CATEGORIES.map((category) => (
                  <label key={category} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {canToggleRoomCategory(category) ? (
                    <input
                      type="checkbox"
                      checked={activeCategories.includes(category)}
                      style={{
                        accentColor: "#2563eb",
                        cursor: "pointer",
                      }}
                      onChange={() => toggleRoomCategory(category)}
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        border: activeCategories.includes(category)
                          ? "1px solid #2563eb"
                          : "1px solid #767676",
                        background: activeCategories.includes(category) ? "#2563eb" : "#fff",
                        color: "#fff",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 700,
                        lineHeight: 1,
                        flex: "0 0 14px",
                        pointerEvents: "none",
                        userSelect: "none",
                      }}
                    >
                      {activeCategories.includes(category) ? "✓" : ""}
                    </span>
                  )}
                    {categoryLabel(category)}
                  </label>
                ))}
              </div>

              {(roomTier === "premium" || roomTier === "super_premium") && (
                <>
              <h4 style={{ marginTop: 16 }}>
                {t("extendedCategories")}
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {SUPER_PREMIUM_EXTRA_CATEGORIES.map((category) => (
                  <label key={category} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {canToggleRoomCategory(category) ? (
                    <input
                      type="checkbox"
                      checked={activeCategories.includes(category)}
                      style={{
                        accentColor: "#2563eb",
                        cursor: "pointer",
                      }}
                      onChange={() => toggleRoomCategory(category)}
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        border: activeCategories.includes(category)
                          ? "1px solid #2563eb"
                          : "1px solid #767676",
                        background: activeCategories.includes(category) ? "#2563eb" : "#fff",
                        color: "#fff",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 700,
                        lineHeight: 1,
                        flex: "0 0 14px",
                        pointerEvents: "none",
                        userSelect: "none",
                      }}
                    >
                      {activeCategories.includes(category) ? "✓" : ""}
                    </span>
                  )}

                    {roomTier === "premium" &&
                    isOrganizer &&
                    !ownedCategoryProductIds.includes(
                      CATEGORY_PRODUCT_ID[category]
                    ) ? (
                      <button
                        type="button"
                        onClick={() => showPremiumLockedCategoryOffer(category)}
                        style={{
                          border: "none",
                          background: "transparent",
                          padding: 0,
                          textAlign: "left",
                          color: "#111827",
                          textDecoration: "underline",
                          cursor: "pointer",
                          font: "inherit",
                        }}
                      >
                        🔒 {categoryLabel(category)}
                        {categoryPlayPrice(category)
                          ? ` – ${categoryPlayPrice(category)}`
                          : ""}
                      </button>
                    ) : (
                      categoryLabel(category)
                    )}
                  </label>
                ))}
              </div>

                {roomTier === "premium" &&
                isOrganizer &&
                premiumLockedOfferCategory && (
                  <section
                    style={{
                      marginTop: 10,
                      padding: 10,
                      border: "1px solid #f59e0b",
                      borderRadius: 8,
                      background: "#fffbeb",
                    }}
                  >
                    <button
                      type="button"
                      disabled={categoryPurchaseBusy !== null}
                      onClick={() =>
                        void startCategoryPurchase(premiumLockedOfferCategory)
                      }
                      style={{
                        border: "none",
                        background: "transparent",
                        padding: 0,
                        marginTop: 0,
                        color: "#2563eb",
                        textDecoration: "underline",
                        cursor: "pointer",
                        font: "inherit",
                        fontWeight: 700,
                        textAlign: "left",
                      }}
                    >
                      {categoryLabel(premiumLockedOfferCategory)}
                      {categoryPlayPrice(premiumLockedOfferCategory)
                        ? ` – ${categoryPlayPrice(premiumLockedOfferCategory)}`
                        : ""}
                    </button>

                    <p>
                      {t("premiumLockedCategoryOfferIntro")}
                    </p>

                    <p style={{ marginBottom: 0 }}>
                      {t("superPremiumUpsellBefore")}{" "}
                      <button
                        type="button"
                        disabled={categoryPurchaseBusy !== null}
                        onClick={() => void startSuperPremiumPurchase()}
                        style={{
                          border: "none",
                          background: "transparent",
                          padding: 0,
                          color: "#2563eb",
                          textDecoration: "underline",
                          cursor: "pointer",
                          font: "inherit",
                          fontWeight: 700,
                        }}
                      >
                        {t("superPremiumLinkText")}
                      </button>
                      {superPremiumUpgradePrice
                        ? uiMessage({ cs: ` za ${superPremiumUpgradePrice}`, en: ` for ${superPremiumUpgradePrice}`, es: ` por ${superPremiumUpgradePrice}` , de: ` für ${superPremiumUpgradePrice}`, fr: ` pour ${superPremiumUpgradePrice}`, "pt-BR": ` por ${superPremiumUpgradePrice}`, id: ` seharga ${superPremiumUpgradePrice}`, tr: `: ${superPremiumUpgradePrice}`, pl: ` za ${superPremiumUpgradePrice}`, it: ` per ${superPremiumUpgradePrice}`})
                        : ""}{" "}
                      {t("superPremiumUpsellAfter")}
                    </p>
                  </section>
                )}

                </>
              )}

              {roomTier === "super_premium" && (
                <>
              <h4 style={{ marginTop: 16 }}>
                {t("customCategories")}
              </h4>

              {roomCustomCategories.slice(0, visibleCustomCategoryCount).map((value, index) => (
                <div key={index} style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <input
                    placeholder={
                      `${t("customCategoryPrefix")} ${index + 1}`
                    }
                    value={value}
                    disabled={!isOrganizer}
                    onChange={(e) => updateRoomCustomCategory(index, e.target.value)}
                    style={{ padding: 12, width: "100%" }}
                  />

                  {isOrganizer && (
                    <button
                      type="button"
                      onClick={() => removeRoomCustomCategory(index)}
                      aria-label={
                        t("removeCustomCategory")
                      }
                      style={{ padding: "0 12px" }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}

              {isOrganizer && visibleCustomCategoryCount < 5 && (
                <button
                  type="button"
                  onClick={addRoomCustomCategory}
                  style={{ marginTop: 8, padding: 10, width: "100%" }}
                >
                  {t("addCustomCategory")}
                </button>
              )}

              {isOrganizer && visibleCustomCategoryCount >= 5 && (
                <p style={{ opacity: 0.75, marginBottom: 0 }}>
                  {t("maxCustomCategories")}
                </p>
              )}

                </>
              )}

              <h4 style={{ marginTop: 16 }}>
                {t("categoryOrder")}
              </h4>

              <ol style={{ paddingLeft: 20 }}>
                {activeCategories.map((category, index) => (
                  <li
                    key={category}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 8,
                    }}
                  >
                    <span>
                      {index + 1}. {categoryLabel(category)}
                    </span>

                    {canEditRoomCategories && (
                      <span style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => moveRoomCategory(category, -1)}
                          disabled={index === 0}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveRoomCategory(category, 1)}
                          disabled={index === activeCategories.length - 1}
                        >
                          ↓
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}

        </>
      )}

      {(roomStatus === "drawing" || roomStatus === "playing") && myPlayer && (
        <section className={roomStyles.gameScreen}>
          <section className={roomStyles.gameHeader}>
            <div className={roomStyles.gameHeaderTop}>
              <h2 className={roomStyles.gameTitle}>{t("playing")}</h2>
              <div className={roomStyles.gameLetter} aria-live="polite">
                {roomStatus === "drawing" ? rollingLetter || "…" : letter}
              </div>
            </div>

            {roomStatus === "drawing" && (
              <p className={roomStyles.gameDrawingText}>{t("drawingLetter")}</p>
            )}

            <div className={roomStyles.gameControls}>
              <div className={roomStyles.gameLeftControls}>
                <div className={roomStyles.gameLanguageCompact}>
                  {gameLanguageName} {gameLanguageFlag}
                </div>
                <button
                  type="button"
                  className={roomStyles.gameDisconnectButton}
                  onClick={() => {
                    if (window.confirm(`${t("disconnect")}?`)) {
                      void signOut();
                    }
                  }}
                >
                  {t("disconnect")}
                </button>
              </div>

              {roomStatus === "playing" && letter && activeMyPlayer && (
                <button
                  type="button"
                  className={roomStyles.gameRedrawButton}
                  onClick={redrawLetter}
                >
                  ↻ {t("drawAgain")}
                </button>
              )}
            </div>

            {roomStatus === "playing" && letter && roundTimerRemainingSeconds !== null && (
              <div className={roomStyles.gameTimer}>
                {Math.floor(roundTimerRemainingSeconds / 60)}:{String(roundTimerRemainingSeconds % 60).padStart(2, "0")}
              </div>
            )}
            {roomStatus === "playing" && letter && roundTimerProgressPercent !== null && (
              <div className={roomStyles.gameTimerTrack}>
                <div
                  className={roomStyles.gameTimerProgress}
                  style={{ width: `${roundTimerProgressPercent}%` }}
                />
              </div>
            )}
          </section>

          {roomStatus === "playing" && letter && activeMyPlayer && round && (
            <div
              ref={answerScrollBoxRef}
              className={roomStyles.gameAnswers}
              style={{
                paddingBottom: `calc(${Math.max(96, keyboardInsetPx + 96)}px + env(safe-area-inset-bottom))`,
              }}
            >
              {activeCategories.map((category, index) => (
                <label key={category} className={roomStyles.gameAnswerLabel}>
                  <div className={roomStyles.gameAnswerName}>
                    {categoryLabel(category)}
                  </div>
                  <input
                    ref={(element) => {
                      answerInputRefs.current[category] = element;
                    }}
                    className={roomStyles.gameAnswerInput}
                    enterKeyHint={index === activeCategories.length - 1 ? "done" : "next"}
                    value={answers[category] ?? ""}
                    onChange={(e) => saveAnswer(category, e.target.value)}
                    onFocus={(e) => {
                      const input = e.currentTarget;
                      requestAnimationFrame(() => {
                        scrollAnswerIntoView(input, "nearest");
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;

                      e.preventDefault();
                      const nextCategory = activeCategories[index + 1];

                      if (nextCategory) {
                        const nextInput = answerInputRefs.current[nextCategory];
                        if (nextInput) {
                          nextInput.focus({ preventScroll: true });
                          window.setTimeout(() => {
                            scrollAnswerIntoView(nextInput, "center");
                          }, 80);
                        }
                      } else if (canStop) {
                        e.currentTarget.blur();
                        void stopRound();
                      } else {
                        e.currentTarget.blur();
                        window.setTimeout(() => {
                          scrollAnswerIntoView(
                            document.getElementById("stop-round-button"),
                            "center"
                          );
                        }, 300);
                      }
                    }}
                  />
                </label>
              ))}

              <button
                id="stop-round-button"
                onClick={() => void stopRound()}
                disabled={!canStop}
                className={`${roomStyles.gameStopButton} ${
                  canStop ? roomStyles.gameStopActive : roomStyles.gameStopDisabled
                }`}
              >
                STOP
              </button>

              {allAnswersFilled && !allAnswersAtLeastTwoChars && (
                <p className={roomStyles.gameValidation}>{t("minTwoChars")}</p>
              )}

              {allAnswersFilled && allAnswersAtLeastTwoChars && !allAnswersStartWithLetter && (
                <p className={roomStyles.gameValidation}>{t("mustStartWithLetter")}</p>
              )}
            </div>
          )}

          {roomStatus === "playing" && letter && myPlayer.status === "waiting" && (
            <p className={roomStyles.gameInfo}>{t("waitingToJoin")}</p>
          )}
        </section>
      )}

        {roomStatus === "finished" && myPlayer && (
          <section style={{ border: "2px solid #16a34a", borderRadius: 8, padding: 12, marginTop: 16, background: "#f0fdf4" }}>
            <h2 style={{ marginTop: 0 }}>{t("finalResults")}</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 320 }}>
                <thead>
                  <tr>
                    <th style={{ border: "1px solid #ccc", padding: 8, textAlign: "left" }}>{t("position")}</th>
                    <th style={{ border: "1px solid #ccc", padding: 8, textAlign: "left" }}>{t("player")}</th>
                    <th style={{ border: "1px solid #ccc", padding: 8, textAlign: "right" }}>{t("totalPoints")}</th>
                  </tr>
                </thead>
                <tbody>
                  {finalStandings.map((player, index) => (
                    <tr key={player.id}>
                      <td style={{ border: "1px solid #ccc", padding: 8 }}>{index + 1}.</td>
                      <td style={{ border: "1px solid #ccc", padding: 8 }}>{player.name}</td>
                      <td style={{ border: "1px solid #ccc", padding: 8, textAlign: "right" }}><b>{player.totalPoints}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

      {roomStatus === "scoring" && myPlayer && (
        <section className={roomStyles.scoringScreen}>
          <section className={roomStyles.scoringHeader}>
            <div className={roomStyles.scoringHeaderTop}>
              <h2>{t("scoring")}</h2>
              <div className={roomStyles.scoringLetter} aria-label={`${t("round")} ${letter || ""}`}>
                {letter || "–"}
              </div>
            </div>
            <p className={roomStyles.scoringSignedIn}>
              <strong>{t("signedIn")}:</strong> {myPlayer.name}
            </p>
            <p className={roomStyles.scoringStoppedBy}>
              {stoppedByTime
                ? `⏱️ ${statusMessage}`
                : stoppedByName
                  ? `🛑 ${stopPressedMessage(uiLanguage, stoppedByName).replace(/^✅\s*/, "")}`
                  : ""}
            </p>
          </section>

          <section className={roomStyles.scoringStatus}>
            <p className={roomStyles.scoringSubmittedCount}>
              <strong>{t("submitted")}:</strong>{" "}
              {scoredPlayerIds.size}/{players.length}
            </p>
            <ul className={roomStyles.scoringPlayerStatus}>
              {players.map((p) => (
                <li key={p.id}>
                  {scoredPlayerIds.has(p.id) ? "✅" : "⏳"} {p.name}
                  {scoredPlayerIds.has(p.id)
                    ? t("statusSubmitted")
                    : t("statusWaiting")}
                </li>
              ))}
            </ul>
          </section>

          <section className={roomStyles.scoringAnswers}>
            <h3>{t("playersAnswers")}</h3>
            <div
              id="scoring-table-scroll"
              className={roomStyles.scoringTableScroll}
            >
            <table className={roomStyles.scoringTable}>
              <thead>
                <tr>
                  <th
                    data-sticky-player="true"
                    className={`${roomStyles.scoringTableCell} ${roomStyles.scoringTableHead} ${roomStyles.scoringStickyPlayer}`}
                  >
                    {t("player")}
                  </th>
                  {activeCategories.map((c, index) => (
                    <th
                      id={`score-column-${index}`}
                      key={c}
                      className={`${roomStyles.scoringTableCell} ${roomStyles.scoringTableHead} ${
                        selectedScoringCategory === c ? roomStyles.scoringSelectedColumn : ""
                      }`}
                    >
                      {categoryLabel(c)}
                    </th>
                  ))}
                  <th className={`${roomStyles.scoringTableCell} ${roomStyles.scoringTableHead}`}>
                    <span className={roomStyles.scoringTotalPointsText}>{t("totalPoints")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id}>
                    <td
                      className={`${roomStyles.scoringTableCell} ${roomStyles.scoringStickyPlayer}`}
                    >
                      {p.name}
                    </td>
                    {activeCategories.map((c) => (
                      <td
                        key={c}
                        className={`${roomStyles.scoringTableCell} ${
                          selectedScoringCategory === c ? roomStyles.scoringSelectedColumn : ""
                        }`}
                      >
                        {answerFor(p.id, c)}
                      </td>
                    ))}
                    <td className={roomStyles.scoringTableCell}>
                      <b>{playerTotalPoints(p.id)}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </section>

          <div className={roomStyles.scoringHistory}>
            <button
              className={roomStyles.scoringHistoryButton}
              onClick={() => setShowRoundHistory((v) => !v)}
            >
              {showRoundHistory ? t("hideRoundHistory") : t("showRoundHistory")}
            </button>

            {showRoundHistory && (
              <div className={roomStyles.scoringHistoryContent}>
                {scoredRoundNumbers.length === 0 ? (
                  <p>
                    {t("noRoundScores")}
                  </p>
                ) : (
                  <table
                    style={{
                      borderCollapse: "collapse",
                      width: "max-content",
                      textAlign: "center",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <thead>
                      <tr>
                        <th style={{ border: "1px solid #ccc", padding: 8 }}>
                          {t("round")}
                        </th>
                        {players.map((p) => (
                          <th key={p.id} style={{ border: "1px solid #ccc", padding: 8 }}>
                            {p.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {scoredRoundNumbers.map((roundNo) => (
                        <tr key={roundNo}>
                          <td style={{ border: "1px solid #ccc", padding: 8 }}>
                            {roundNo}.
                          </td>
                          {players.map((p) => (
                            <td key={p.id} style={{ border: "1px solid #ccc", padding: 8 }}>
                              {playerRoundPoints(p.id, roundNo)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          {activeMyPlayer ? (
            <section className={roomStyles.scoringMine}>
              <h3>{t("myScoring")}</h3>

              {activeCategories.map((category, index) => (
                <label key={category} className={roomStyles.scoringCategoryRow}>
                  <span
                    className={roomStyles.scoringCategoryName}
                    onClick={() => {
                      setSelectedScoringCategory(category);

                      requestAnimationFrame(() => {
                        const scrollBox = document.getElementById("scoring-table-scroll");
                        const column = document.getElementById(`score-column-${index}`);
                        const stickyPlayerColumn =
                          scrollBox?.querySelector('[data-sticky-player="true"]') as
                            | HTMLElement
                            | null;

                        if (!scrollBox || !column) return;

                        const stickyWidth = stickyPlayerColumn?.offsetWidth ?? 0;
                        const visibleWidth = scrollBox.clientWidth - stickyWidth;
                        const centredPosition =
                          column.offsetLeft -
                          stickyWidth -
                          Math.max(0, (visibleWidth - column.offsetWidth) / 2);

                        scrollBox.scrollTo({
                          left: Math.max(0, centredPosition),
                          behavior: "smooth",
                        });
                      });
                    }}
                  >
                    {categoryLabel(category)}
                  </span>
                  <select
                    value={scores[category] ?? 0}
                    disabled={myScoreSubmitted}
                    onFocus={() => {
                      setSelectedScoringCategory(category);

                      requestAnimationFrame(() => {
                        const scrollBox = document.getElementById("scoring-table-scroll");
                        const column = document.getElementById(`score-column-${index}`);
                        const stickyPlayerColumn =
                          scrollBox?.querySelector('[data-sticky-player="true"]') as
                            | HTMLElement
                            | null;

                        if (!scrollBox || !column) return;

                        const stickyWidth = stickyPlayerColumn?.offsetWidth ?? 0;
                        const visibleWidth = scrollBox.clientWidth - stickyWidth;
                        const centredPosition =
                          column.offsetLeft -
                          stickyWidth -
                          Math.max(0, (visibleWidth - column.offsetWidth) / 2);

                        scrollBox.scrollTo({
                          left: Math.max(0, centredPosition),
                          behavior: "smooth",
                        });
                      });
                    }}
                    onChange={(e) =>
                      setScores((prev) => ({
                        ...prev,
                        [category]: Number(e.target.value) as -10 | -5 | 0 | 5 | 10,
                      }))
                    }
                    className={roomStyles.scoringPointsSelect}
                  >
                    <option value={0}>
                      {t("zeroPoints")}
                    </option>
                    <option value={5}>
                      {t("fivePoints")}
                    </option>
                    <option value={10}>
                      {t("tenPoints")}
                    </option>
                    <option value={-5}>
                      {t("minusFivePoints")}
                    </option>
                    <option value={-10}>
                      {t("minusTenPoints")}
                    </option>
                  </select>
                </label>
              ))}

              {!myScoreSubmitted ? (
                <button
                  onClick={submitScores}
                  className={roomStyles.scoringSubmitButton}
                >
                  {t("submitScoring")}
                </button>
              ) : (
                <p className={roomStyles.scoringSubmittedMessage}>
                  {t("scoringSubmitted")}
                </p>
              )}
            </section>
          ) : myPlayer?.status === "waiting" ? (
            <p className={roomStyles.scoringMineInfo}>{t("waitingToJoin")}</p>
          ) : (
            <p className={roomStyles.scoringMineInfo}>{t("enterNameScoring")}</p>
          )}

          {!everyoneScored && (
            <p className={roomStyles.scoringWaiting}>{t("waitingForAllPlayers")}</p>
          )}

            {everyoneScored && (
              shouldShowFreeLimitUpsell ? (
                <section
                  className={`${roomStyles.scoringNextArea} ${roomStyles.scoringFreeLimitPanel}`}
                >
                  <h3 style={{ marginTop: 0 }}>{t("freeLimitTitle")}</h3>
                  <p>
                    {uiMessage({
                      cs: "Ve Free verzi máš 3 kola. Pro pokračování zvol Premium, Super Premium, nebo si dobrovolně pusť reklamu a odemkni další 3 kola.",
                      en: "The Free version includes 3 rounds. To continue, choose Premium, Super Premium, or watch an ad to unlock 3 more rounds.",
                      es: "La versión Free incluye 3 rondas. Para continuar, elige Premium, Super Premium o mira un anuncio para desbloquear 3 rondas más.",
                      de: "Die Free-Version enthält 3 Runden. Um weiterzuspielen, wähle Premium, Super Premium oder sieh dir eine Werbung an, um 3 weitere Runden freizuschalten.",
                      fr: "La version Free comprend 3 manches. Pour continuer, choisis Premium, Super Premium ou regarde une publicité pour débloquer 3 manches supplémentaires.",
                      "pt-BR": "A versão Free inclui 3 rodadas. Para continuar, escolha Premium, Super Premium ou assista a um anúncio para liberar mais 3 rodadas.",
                      id: "Versi Free mencakup 3 ronde. Untuk melanjutkan, pilih Premium, Super Premium, atau tonton iklan untuk membuka 3 ronde lagi.",
                      tr: "Free sürüm 3 tur içerir. Devam etmek için Premium, Super Premium seç veya 3 tur daha açmak için reklam izle.",
                      pl: "Wersja Free obejmuje 3 rundy. Aby kontynuować, wybierz Premium, Super Premium albo obejrzyj reklamę i odblokuj 3 kolejne rundy.",
                      it: "La versione Free include 3 turni. Per continuare, scegli Premium, Super Premium oppure guarda un annuncio per sbloccare altri 3 turni.",
                    })}
                  </p>

                  <button
                    type="button"
                    disabled={!isOrganizer || categoryPurchaseBusy !== null}
                    onClick={() => void startPremiumPurchase()}
                    style={{ padding: 14, width: "100%", fontWeight: 700 }}
                  >
                    {t("freeUpgradeButton")}
                  </button>
                  <p style={{ margin: "6px 2px 0", fontSize: 13, lineHeight: 1.35 }}>
                    {uiMessage({
                      cs: "Premium: max. 5 hráčů a základní kategorie Země, Město, Jméno, Zvíře, Věc a Rostlina.",
                      en: "Premium: up to 5 players and the basic categories Country, City, Name, Animal, Thing and Plant.",
                      es: "Premium: hasta 5 jugadores y las categorías básicas País, Ciudad, Nombre, Animal, Cosa y Planta.",
                      de: "Premium: bis zu 5 Spieler und die Grundkategorien Land, Stadt, Name, Tier, Gegenstand und Pflanze.",
                      fr: "Premium : jusqu’à 5 joueurs et les catégories de base Pays, Ville, Prénom, Animal, Objet et Plante.",
                      "pt-BR": "Premium: até 5 jogadores e as categorias básicas País, Cidade, Nome, Animal, Objeto e Planta.",
                      id: "Premium: hingga 5 pemain dan kategori dasar Negara, Kota, Nama, Hewan, Benda, dan Tumbuhan.",
                      tr: "Premium: en fazla 5 oyuncu ve temel kategoriler Ülke, Şehir, İsim, Hayvan, Eşya ve Bitki.",
                      pl: "Premium: maks. 5 graczy oraz podstawowe kategorie Państwo, Miasto, Imię, Zwierzę, Rzecz i Roślina.",
                      it: "Premium: fino a 5 giocatori e le categorie base Paese, Città, Nome, Animale, Oggetto e Pianta.",
                    })}
                  </p>

                  <button
                    type="button"
                    disabled={!isOrganizer || categoryPurchaseBusy !== null}
                    onClick={() => void startSuperPremiumPurchase()}
                    style={{ marginTop: 12, padding: 14, width: "100%", fontWeight: 700 }}
                  >
                    {uiMessage({ cs: "Získat Super Premium", en: "Get Super Premium", es: "Obtener Super Premium", de: "Super Premium holen", fr: "Obtenir Super Premium", "pt-BR": "Obter Super Premium", id: "Dapatkan Super Premium", tr: "Super Premium al", pl: "Zdobądź Super Premium", it: "Ottieni Super Premium" })}
                  </button>
                  <p style={{ margin: "6px 2px 0", fontSize: 13, lineHeight: 1.35 }}>
                    {uiMessage({
                      cs: "Super Premium: neomezený počet hráčů, všechny základní i rozšířené kategorie, až 5 vlastních kategorií, volba počtu a pořadí kategorií, časový limit a nastavení počtu kol.",
                      en: "Super Premium: unlimited players, all basic and extended categories, up to 5 custom categories, category count and order selection, a time limit and round count settings.",
                      es: "Super Premium: jugadores ilimitados, todas las categorías básicas y ampliadas, hasta 5 categorías propias, elección del número y orden de categorías, límite de tiempo y configuración del número de rondas.",
                      de: "Super Premium: unbegrenzt viele Spieler, alle Grund- und Zusatzkategorien, bis zu 5 eigene Kategorien, Auswahl von Anzahl und Reihenfolge der Kategorien, Zeitlimit und Einstellung der Rundenzahl.",
                      fr: "Super Premium : nombre de joueurs illimité, toutes les catégories de base et supplémentaires, jusqu’à 5 catégories personnalisées, choix du nombre et de l’ordre des catégories, limite de temps et réglage du nombre de manches.",
                      "pt-BR": "Super Premium: jogadores ilimitados, todas as categorias básicas e adicionais, até 5 categorias personalizadas, escolha da quantidade e da ordem das categorias, limite de tempo e configuração do número de rodadas.",
                      id: "Super Premium: pemain tanpa batas, semua kategori dasar dan tambahan, hingga 5 kategori khusus, pilihan jumlah dan urutan kategori, batas waktu, serta pengaturan jumlah ronde.",
                      tr: "Super Premium: sınırsız oyuncu, tüm temel ve ek kategoriler, 5’e kadar özel kategori, kategori sayısı ve sırası seçimi, süre sınırı ve tur sayısı ayarı.",
                      pl: "Super Premium: nieograniczona liczba graczy, wszystkie kategorie podstawowe i rozszerzone, do 5 własnych kategorii, wybór liczby i kolejności kategorii, limit czasu oraz ustawienie liczby rund.",
                      it: "Super Premium: giocatori illimitati, tutte le categorie base ed estese, fino a 5 categorie personalizzate, scelta del numero e dell’ordine delle categorie, limite di tempo e impostazione del numero di turni.",
                    })}
                  </p>

                  <button
                    type="button"
                    onClick={startFreeRewardedAd}
                    style={{ marginTop: 12, padding: 14, width: "100%", fontWeight: 700 }}
                  >
                    {t("freeRewardButton")}
                  </button>

                    {showRewardedAdPlaceholder && (
                      <section
                        style={{
                          marginTop: 10,
                          padding: 12,
                          border: "1px dashed #999",
                          borderRadius: 8,
                          background: "#fff",
                        }}
                      >
                        <p style={{ marginTop: 0, marginBottom: 6, fontWeight: 700 }}>
                          {uiMessage({ cs: "Rewarded reklama běží…", en: "Rewarded ad is playing…", es: "El anuncio recompensado se está reproduciendo…" , de: "Werbung mit Belohnung wird abgespielt…", fr: "Lecture de la publicité récompensée…", "pt-BR": "Reproduzindo anúncio com recompensa…", id: "Iklan berhadiah sedang diputar…", tr: "Ödüllü reklam oynatılıyor…", pl: "Trwa reklama z nagrodą…", it: "Riproduzione dell’annuncio con premio…"})}
                        </p>
                        <p style={{ margin: 0 }}>
                          {uiMessage({ cs: "Po doběhnutí reklamy se automaticky odemknou další 3 kola.", en: "After the ad finishes, 3 more rounds will unlock automatically.", es: "Cuando termine el anuncio, se desbloquearán automáticamente 3 rondas más." , de: "Nach Ende der Werbung werden automatisch 3 weitere Runden freigeschaltet.", fr: "À la fin de la publicité, 3 manches supplémentaires seront automatiquement débloquées.", "pt-BR": "Quando o anúncio terminar, mais 3 rodadas serão liberadas automaticamente.", id: "Setelah iklan selesai, 3 ronde tambahan akan terbuka secara otomatis.", tr: "Reklam tamamlandığında 3 ek turun kilidi otomatik olarak açılacak.", pl: "Po zakończeniu reklamy automatycznie odblokują się 3 kolejne rundy.", it: "Al termine dell’annuncio, verranno sbloccati automaticamente altri 3 turni."})}
                        </p>
                      </section>
                    )}

                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = "/";
                    }}
                    style={{
                      marginTop: 10,
                      padding: 12,
                      width: "100%",
                      background: "transparent",
                    }}
                  >
                    {t("backHome")}
                  </button>
                </section>
              ) : isFinalScoringRound ? (
                <button onClick={finishGame} className={roomStyles.scoringNextButton}>
                  {t("finishGame")}
                </button>
              ) : (
                <button onClick={nextRound} className={roomStyles.scoringNextButton}>
                  {t("newRound")}
                </button>
              )
            )}
        </section>
      )}
    </main>
  );
}
