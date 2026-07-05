"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import {
  categoryHelpText,
  gameLanguageInstructionText,
  gameLanguageNameText,
  getUiRules,
  getUiText,
  roomFullMessage,
  stopPressedMessage,
  type UiTextKey,
} from "./uiText";

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

type RoomLanguage = "cs" | "en" | "es";

function getLettersForLanguage(language: RoomLanguage) {
  if (language === "cs") return CZECH_LETTERS;
  if (language === "es") return SPANISH_LETTERS;
  return ENGLISH_LETTERS;
}
const ROLL_MS = 5000;
const TICK_MS = 35;
const FREE_ROUND_BLOCK_SIZE = 3;
const FREE_INITIAL_UNLOCKED_ROUNDS = 3;
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
  const { code } = useParams<{ code: string }>();

  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomStatus, setRoomStatus] = useState<RoomStatus>("lobby");
  const [letter, setLetter] = useState<string | null>(null);
  const [activeCategories, setActiveCategories] = useState<string[]>(DEFAULT_ACTIVE_CATEGORIES);
  const [maxPlayers, setMaxPlayers] = useState(3);
  const [roomTier, setRoomTier] = useState<RoomTier>("free");
  const [premiumCategoryUnlockTest, setPremiumCategoryUnlockTest] = useState(false);
  const [premiumLockedOfferCategory, setPremiumLockedOfferCategory] = useState<string | null>(null);
  const [roomLanguage, setRoomLanguage] = useState<RoomLanguage>("cs");
  const [roundTimeLimitSeconds, setRoundTimeLimitSeconds] = useState<RoundTimeLimitSeconds>(null);
  const [roundCountLimit, setRoundCountLimit] = useState<RoundCountLimit>(null);
  const [uiLanguage, setUiLanguage] = useState<RoomLanguage>("cs");
  const [roomCustomCategories, setRoomCustomCategories] = useState(["", "", "", "", ""]);
  const t = (key: UiTextKey) => getUiText(uiLanguage, key);
  const rulesText = getUiRules(uiLanguage);
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
  const [freeUnlockedRounds, setFreeUnlockedRounds] = useState(FREE_INITIAL_UNLOCKED_ROUNDS);

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
  const answerInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    const urlUiLanguage = new URLSearchParams(window.location.search).get("ui");
    const savedUiLanguage = window.localStorage.getItem("zm_uiLanguage");

    if (urlUiLanguage === "cs" || urlUiLanguage === "en" || urlUiLanguage === "es") {
      setUiLanguage(urlUiLanguage);
      window.localStorage.setItem("zm_uiLanguage", urlUiLanguage);
      return;
    }

    if (savedUiLanguage === "cs" || savedUiLanguage === "en" || savedUiLanguage === "es") {
      setUiLanguage(savedUiLanguage);
      return;
    }

    const deviceLanguage = window.navigator.language.toLowerCase();

    setUiLanguage(
      deviceLanguage.startsWith("cs") || deviceLanguage.startsWith("sk")
        ? "cs"
        : deviceLanguage.startsWith("es")
          ? "es"
          : "en"
    );
  }, []);

  function categoryLabel(category: string) {
    if (roomLanguage === "en") {
      return CATEGORY_LABELS_EN[category] ?? category;
    }

    if (roomLanguage === "es") {
      return CATEGORY_LABELS_ES[category] ?? category;
    }

    return category;
  }

  function normalizeAnswerStart(value: string) {
    return value
      .trim()
      .charAt(0)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
  }

function normalizeForCompare(value: string) {
  const upperValue = value.trim().toLocaleUpperCase(
    roomLanguage === "es" ? "es-ES" : "cs-CZ"
  );

  if (roomLanguage !== "es") return upperValue;

  return upperValue
    .replaceAll("Ñ", "__ENYE__")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("__ENYE__", "Ñ");
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

  async function pickLetter(rid: string) {
    const letters = getLettersForLanguage(roomLanguage);
    const { data } = await supabase
      .from("rounds")
      .select("letter")
      .eq("room_id", rid)
      .order("round_no", { ascending: true });

    let usedInCurrentCycle = new Set<string>();

    for (const row of data ?? []) {
      const usedLetter = String((row as { letter: string }).letter ?? "").toUpperCase();

      if (usedInCurrentCycle.size >= letters.length) {
        usedInCurrentCycle = new Set<string>();
      }

      if (letters.includes(usedLetter)) {
        usedInCurrentCycle.add(usedLetter);
      }
    }

    const availableLetters =
      usedInCurrentCycle.size >= letters.length
        ? letters
        : letters.filter((ltr) => !usedInCurrentCycle.has(ltr));

    return availableLetters[Math.floor(Math.random() * availableLetters.length)];
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
      setMsg("✅ odkaz zkopírován");
    } catch {
      setMsg("❌ odkaz se nepodařilo zkopírovat");
    }
  }

  async function shareInviteLink() {
    const url = getRoomUrl();

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Země Město",
          text: `Připoj se do místnosti ${code.toUpperCase()}`,
          url,
        });
        setMsg("✅ sdílení otevřeno");
      } else {
        await navigator.clipboard.writeText(url);
        setMsg("✅ sdílení není dostupné, odkaz zkopírován");
      }
    } catch {
      setMsg("ℹ️ sdílení zrušeno");
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
    if (!roomId || roomTier !== "free") return;

    const saved = window.localStorage.getItem(`zm_freeUnlockedRounds_${roomId}`);
    const parsed = Number(saved);

    setFreeUnlockedRounds(
      Number.isFinite(parsed) && parsed >= FREE_INITIAL_UNLOCKED_ROUNDS
        ? parsed
        : FREE_INITIAL_UNLOCKED_ROUNDS
    );
  }, [roomId, roomTier]);

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
    roundTimeLimitSeconds !== null && roundTimerRemainingSeconds !== null
      ? Math.max(0, Math.min(100, (roundTimerRemainingSeconds / roundTimeLimitSeconds) * 100))
      : null;

  async function loadRoomByCode() {
    const { data, error } = await supabase
      .from("rooms")
      .select("id,status,letter,active_categories,max_players,creator_tier,ads_enabled,creator_token,language,round_time_limit_seconds,round_count_limit")
      .eq("code", code)
      .single();

    if (error || !data) {
      setRoomId(null);
      setMsg(`❌ místnost nenalezena: ${error?.message ?? ""}`);
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
    setRoomLanguage(((data as any).language ?? "cs") as RoomLanguage);
    setRoundTimeLimitSeconds(parseRoundTimeLimit((data as any).round_time_limit_seconds));
    setRoundCountLimit(parseRoundCountLimit((data as any).round_count_limit));
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
      .select("status,letter,active_categories,max_players,creator_tier,ads_enabled,creator_token,language,round_time_limit_seconds,round_count_limit")
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
    setRoomLanguage(((data as any).language ?? "cs") as RoomLanguage);
    setRoundTimeLimitSeconds(parseRoundTimeLimit((data as any).round_time_limit_seconds));
    setRoundCountLimit(parseRoundCountLimit((data as any).round_count_limit));

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
      setMsg(`❌ hráči: ${error.message}`);
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
      setMsg(`❌ kolo: ${error.message}`);
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
      setMsg(`❌ odpovědi: ${error.message}`);
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
      setMsg(`❌ body: ${error.message}`);
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
      setMsg(`❌ celkové body: ${error.message}`);
      return;
    }

    setAllRoomScores((data ?? []) as ScoreRow[]);
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const rid = await loadRoomByCode();
      if (cancelled || !rid) return;
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
    if (!roomId) return;

    const poll = window.setInterval(async () => {
      const { data } = await supabase
        .from("rooms")
        .select("status,letter")
        .eq("id", roomId)
        .single();

      if (data) {
        setRoomStatus(data.status as RoomStatus);
        setLetter((data.letter ?? null) as string | null);
      }

      await loadPlayers(roomId);
      await loadCurrentRound(roomId);

      if (round?.round_no) {
        await loadAllAnswers(roomId, round.round_no);
        await loadAllScores(roomId, round.round_no);
    await loadRoomScores(roomId);
      }

      await loadRoomScores(roomId);
    }, 1000);

    return () => window.clearInterval(poll);
  }, [roomId, round?.round_no, myPlayer?.id]);

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
    await supabase.from("scores").delete().eq("room_id", rid);
    await supabase.from("answers").delete().eq("room_id", rid);
    await supabase.from("rounds").delete().eq("room_id", rid);

    await supabase
      .from("rooms")
      .update({ status: "lobby", letter: null })
      .eq("id", rid);

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

    const trimmed = nameInput.trim();
    if (!trimmed) {
      setMsg("❗ napiš jméno");
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
              ? `⏳ ${trimmed} čeká na připojení po aktuálním kole`
              : ""
          );
          await loadPlayers(roomId);
          return;
        }

        setMsg("❌ Tohle jméno už v místnosti existuje. Zadej jiné.");
        return;
      }

      setMsg(`❌ připojení: ${error?.message ?? "neznámá chyba"}`);
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
        ? `⏳ ${trimmed} čeká na připojení po aktuálním kole`
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
      setMsg(
        `${t("changingPlayerErrorPrefix")}: ${error.message}`
      );
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
      setMsg(`❌ odpojení: ${error.message}`);
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
      setMsg(t("disconnectedRoomCleared"));
      return;
    }

    await loadPlayers(rid);
    setMsg(t("disconnected"));
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
      setMsg(`❌ vytvoření kola: ${error?.message ?? "neznámá chyba"}`);
      return null;
    }

    const nextRound = data as RoundLite;
    setRound(nextRound);
    return nextRound;
  }

  const isOrganizer = Boolean(
    myPlayer && localCreatorToken && roomCreatorToken && localCreatorToken === roomCreatorToken
  );

  const premiumCategoriesUnlockedForTest =
    roomTier === "premium" && premiumCategoryUnlockTest;

  const canEditRoomCategories =
    isOrganizer && (roomTier === "super_premium" || premiumCategoriesUnlockedForTest);

  async function updateRoomCategories(predefinedCategories: string[], customCategories: string[]) {
    if (!isOrganizer || !roomId || roomStatus !== "lobby") return;

    if (roomTier === "premium" && !premiumCategoriesUnlockedForTest) {
      setMsg("Premium má kategorie pevně dané. Po dokoupení alespoň jedné rozšířené kategorie se odemkne volba počtu kategorií a jejich pořadí.");
      return;
    }

    const cleanedCustomCategories = uniqueNonEmpty(customCategories).slice(0, 5);
    const finalCategories = uniqueNonEmpty([...predefinedCategories, ...cleanedCustomCategories]);

    if (finalCategories.length === 0) {
      setMsg("❗ Vyber alespoň jednu kategorii.");
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
      setMsg(`❌ kategorie: ${error.message}`);
    }
  }

  function showPremiumLockedCategoryOffer(category: string) {
    setPremiumLockedOfferCategory(category);
    setMsg("");
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
    if (!isOrganizer || !roomId || roomStatus !== "lobby") return;

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
      setMsg(`${t("gameSettingsSaveErrorPrefix")}: ${error.message}`);
    }
  }

  async function saveRoomCategoryOrder(nextCategories: string[]) {
    if (!isOrganizer || !roomId || roomStatus !== "lobby") return;

    const finalCategories = uniqueNonEmpty(nextCategories);

    if (finalCategories.length === 0) {
      setMsg("❗ Vyber alespoň jednu kategorii.");
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
      setMsg(`❌ pořadí kategorií: ${error.message}`);
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

  async function startGame() {
    if (roomId) {
      await refreshRoomState(roomId);
    }

    if (!roomId || !myPlayer) {
      setMsg(t("joinNameFirst"));
      return;
    }

    const rid = roomId;

    setMsg("… losujeme");
    setRoomStatus("drawing");
    setLetter(null);

    const { data: locked, error: lockError } = await supabase
      .from("rooms")
      .update({ status: "drawing", letter: null })
      .eq("id", rid)
      .eq("status", "lobby")
      .select("id")
      .maybeSingle();

    if (lockError || !locked) {
      setMsg("ℹ️ Losování už spustil jiný hráč.");
      return;
    }

    window.setTimeout(async () => {
      const finalLetter = await pickLetter(rid);
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

    setMsg("… losujeme znovu");
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
      setMsg("ℹ️ Losování už spustil jiný hráč.");
      return;
    }

    await supabase.from("rounds").update({ status: "skipped" }).eq("id", currentRoundId);

    window.setTimeout(async () => {
      const finalLetter = await pickLetter(rid);
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

  async function stopRound() {
    if (!roomId || !round?.id || !round?.round_no || !myPlayer) return;

    const { data: locked, error: lockError } = await supabase
      .from("rooms")
      .update({ status: "scoring" })
      .eq("id", roomId)
      .eq("status", "playing")
      .select("id")
      .maybeSingle();

    if (lockError || !locked) {
      setMsg("ℹ️ STOP už stiskl jiný hráč.");
      return;
    }

    await supabase.from("answers").upsert(
      {
        room_id: roomId,
        player_id: myPlayer.id,
        round: round.round_no,
        category: "__STOP_BY__",
        value: myPlayer.name,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "room_id,player_id,round,category" }
    );

    await supabase.from("rounds").update({ status: "scoring" }).eq("id", round.id);

    setRoomStatus("scoring");
    setScores(emptyScores(activeCategories));
    setMyScoreSubmitted(false);

    setMsg(
      stopPressedMessage(uiLanguage, myPlayer.name)
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
      setMsg(
        `${t("savingScoresErrorPrefix")}: ${error.message}`
      );
      return;
    }

    setMyScoreSubmitted(true);
    setMsg("");
    await loadAllScores(roomId, round.round_no);
    await loadRoomScores(roomId);
  }

  const scoredPlayerIds = new Set(
    players
      .filter((p) => activeCategories.every((c) => allScores.some((s) => s.player_id === p.id && s.category === c)))
      .map((p) => p.id)
  );

  const everyoneScored = players.length > 0 && scoredPlayerIds.size === players.length;
  const currentRoundNo = round?.round_no ?? 0;
  const isFinalScoringRound =
    roomStatus === "scoring" &&
    everyoneScored &&
    roundCountLimit !== null &&
    currentRoundNo >= roundCountLimit;

  const freeLimitReached =
    roomTier === "free" &&
    everyoneScored &&
    currentRoundNo >= freeUnlockedRounds;

  const shouldShowFreeLimitUpsell = freeLimitReached || showFreeLimitUpsell;

  const stoppedByName =
    allAnswers.find((a) => a.category === "__STOP_BY__")?.value ?? "";

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

  function unlockFreeRoundsByRewardedAd() {
    if (!roomId || !round?.round_no) return;

    const nextLimit = Math.max(freeUnlockedRounds, round.round_no) + FREE_ROUND_BLOCK_SIZE;

    setFreeUnlockedRounds(nextLimit);
    setShowFreeLimitUpsell(false);
    window.localStorage.setItem(`zm_freeUnlockedRounds_${roomId}`, String(nextLimit));
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
      setMsg(`${t("finishGameErrorPrefix")}: ${error.message}`);
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

    if (roomTier === "free" && round.round_no >= freeUnlockedRounds) {
      setShowFreeLimitUpsell(true);
      setMsg(t("freeLimitReachedMessage"));
      return;
    }

    if (waitingPlayers.length > 0) {
      await supabase
        .from("players")
        .update({ status: "active" })
        .eq("room_id", roomId)
        .eq("status", "waiting");

      await loadPlayers(roomId);
    }

    const rid = roomId;
    const currentRoundId = round.id;

    setMsg("… losujeme další kolo");
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
      .eq("status", "scoring")
      .select("id")
      .maybeSingle();

    if (lockError || !locked) {
      setMsg("ℹ️ Další kolo už spustil jiný hráč.");
      return;
    }

    await supabase.from("rounds").update({ status: "done" }).eq("id", currentRoundId);

    window.setTimeout(async () => {
      const finalLetter = await pickLetter(rid);
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

  const gameLanguageFlag =
    roomLanguage === "en" ? "🇬🇧" : roomLanguage === "es" ? "🇪🇸" : "🇨🇿";

  const diacriticGameLanguages = new Set<string>([
    "cs",
    "es",
    "de",
    "fr",
    "pl",
    "it",
    "pt-BR",
    "nl",
    "tr",
  ]);
  const gameLanguageHasDiacritics = diacriticGameLanguages.has(roomLanguage);

  const roomIsFull = !myPlayer && players.length + waitingPlayers.length >= maxPlayers;
  const activeMyPlayer = Boolean(myPlayer && myPlayer.status !== "waiting");

  const filledCustomCategoryCount = roomCustomCategories.filter((value) => value.trim().length > 0).length;
  const visibleCustomCategoryCount = Math.min(
    5,
    Math.max(customCategorySlotCount, filledCustomCategoryCount)
  );

  const statusMessage =
    (roomStatus === "scoring" || roomStatus === "finished") && stoppedByName
      ? stopPressedMessage(uiLanguage, stoppedByName)
      : roomStatus === "playing" && letter
        ? t("letterDrawn")
        : msg;

  const visibleStatusMessage = myPlayer ? statusMessage : msg;

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
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
              cursor: "pointer",
            }}
          >
            {t("likeApp")}
          </button>

{isOrganizer && (
            <a
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
              {t("newGame")}
            </a>
          )}
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
            <button onClick={switchLocalPlayer}>
              {t("changePlayerOnDevice")}
            </button>
          )}
          {myPlayer && (
            <button onClick={signOut}>
              {t("disconnect")}
            </button>
          )}
        </div>
      </header>

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

        <div style={{ marginTop: 3 }}>
          {gameLanguageInstruction}
        </div>

          {roomStatus === "lobby" && gameLanguageHasDiacritics && (
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
              {t("diacriticsOptional")}
            </div>
          )}
      </section>

      {showRules && (
        <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginTop: 16 }}>
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
        <section style={{ border: "1px solid #ddd", padding: 12, margin: "16px 0" }}>
          <h2 style={{ marginTop: 0 }}>
            {t("joinGame")}
          </h2>

          {roomIsFull ? (
            <p>
              {roomFullMessage(uiLanguage, maxPlayers)}
            </p>
          ) : (
            <>
              <input
                placeholder={t("yourName")}
                value={nameInput}
                enterKeyHint="go"
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || e.nativeEvent.isComposing) return;

                  e.preventDefault();
                  void joinRoom();
                }}
                style={{ padding: 12, width: "100%", maxWidth: 320 }}
              />
              <button onClick={joinRoom} style={{ display: "block", marginTop: 10, padding: 12 }}>
                {t("join")}
              </button>
            </>
          )}
        </section>
      )}

      {roomStatus === "lobby" && myPlayer && (
        <>
          <h2>Lobby</h2>

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

          {isOrganizer && myPlayer && (
            <button
              data-main-start-button
              onClick={startGame}
              style={{ marginBottom: 16, padding: 16, fontWeight: 700 }}
            >
              {t("startGame")}
            </button>
          )}

          <p style={{ opacity: 0.75 }}>
            {t("availableLetters")}:{" "}
            {getLettersForLanguage(roomLanguage).join(", ")}
          </p>

          <h3>
            {t("players")} ({players.length})
          </h3>
          <ul>
            {players.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </ul>

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

              {isOrganizer && roomTier === "premium" && (
                <div style={{ marginTop: 10, marginBottom: 12 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setPremiumCategoryUnlockTest(true);
                      setMsg(
                        t("testPremiumUnlockedMessage")
                      );
                    }}
                    style={{ padding: 10, width: "100%" }}
                  >
                    {t("testPremiumUnlockButton")}
                  </button>

                  {premiumCategoriesUnlockedForTest && (
                    <p style={{ opacity: 0.75, marginBottom: 0 }}>
                      {t("testActiveCategoryOrder")}
                    </p>
                  )}
                </div>
              )}

              <h4>
                {t("basicCategories")}
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {PREMIUM_CATEGORIES.map((category) => (
                  <label key={category} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {canEditRoomCategories ? (
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
                    {canEditRoomCategories ? (
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

                    {roomTier === "premium" ? (
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
                        🔒 {categoryLabel(category)} –{" "}
                        {t("extendedCategoryPrice")}
                      </button>
                    ) : (
                      categoryLabel(category)
                    )}
                  </label>
                ))}
              </div>

                {roomTier === "premium" && premiumLockedOfferCategory && (
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
                      onClick={() => window.alert(t("premiumComingSoon"))}
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
                      {categoryLabel(premiumLockedOfferCategory)}{" "}–{" "}{t("extendedCategoryPrice")}
                    </button>

                    <p>
                      {t("premiumLockedCategoryOfferIntro")}
                    </p>

                    <p style={{ marginBottom: 0 }}>
                      {t("superPremiumUpsellBefore")}{" "}
                      <button
                        type="button"
                        onClick={() => window.alert(t("premiumComingSoon"))}
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
                      </button>{" "}
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
        <>
            {roomStatus === "playing" && letter ? (
              <section
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 20,
                  background: "#fff",
                  padding: "8px 0 10px",
                  borderBottom: "1px solid #ddd",
                }}
              >
                <h2 style={{ margin: "0 0 8px" }}>{t("playing")}</h2>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 56, fontWeight: "bold", lineHeight: 1 }}>
                    {letter}
                  </div>
                  {activeMyPlayer && (
                    <button onClick={redrawLetter} style={{ padding: 12 }}>
                      {t("drawAgain")}
                    </button>
                  )}
                  {roundTimerRemainingSeconds !== null && (
                    <div style={{ marginLeft: "auto", fontSize: 24, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                      {Math.floor(roundTimerRemainingSeconds / 60)}:{String(roundTimerRemainingSeconds % 60).padStart(2, "0")}
                    </div>
                  )}
                </div>
                {roundTimerProgressPercent !== null && (
                  <div style={{ height: 6, marginTop: 8, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
                    <div style={{ width: `${roundTimerProgressPercent}%`, height: "100%", background: "#16a34a" }} />
                  </div>
                )}
              </section>
            ) : (
              <div style={{ fontSize: 72, fontWeight: "bold" }}>{letter ?? rollingLetter}</div>
            )}

          {roomStatus === "playing" && letter && activeMyPlayer && round && (
            <>
              {activeCategories.map((category, index) => (
                <label key={category} style={{ display: "block", marginTop: 10 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>
                    {categoryLabel(category)}
                  </div>
                  <input
                    ref={(element) => {
                      answerInputRefs.current[category] = element;
                    }}
                    enterKeyHint={
                      index === activeCategories.length - 1 ? "done" : "next"
                    }
                    value={answers[category] ?? ""}
                    onChange={(e) => saveAnswer(category, e.target.value)}
                    onFocus={(e) => {
                      const input = e.currentTarget;
                      requestAnimationFrame(() => {
                        input.scrollIntoView({
                          behavior: "smooth",
                          block: "nearest",
                        });
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
                            nextInput.scrollIntoView({
                              behavior: "smooth",
                              block: "center",
                            });
                          }, 80);
                        }
                      } else if (canStop) {
                        e.currentTarget.blur();
                        void stopRound();
                      } else {
                        e.currentTarget.blur();

                        window.setTimeout(() => {
                          document
                            .getElementById("stop-round-button")
                            ?.scrollIntoView({
                              behavior: "smooth",
                              block: "center",
                            });
                        }, 300);
                      }
                    }}
                    style={{
                      display: "block",
                      marginTop: 10,
                      padding: 12,
                      width: "100%",
                    }}
                  />
                </label>
              ))}

              <button
                id="stop-round-button"
                onClick={stopRound}
                disabled={!canStop}
                style={{
                  marginTop: 16,
                  marginBottom: "calc(24px + env(safe-area-inset-bottom))",
                  padding: 16,
                  width: "100%",
                  scrollMarginBottom: "calc(96px + env(safe-area-inset-bottom))",
                }}
              >
                STOP
              </button>

              {!allAnswersFilled && (
                <p>
                  {t("stopAfterFields")}
                </p>
              )}

              {allAnswersFilled && !allAnswersAtLeastTwoChars && (
                <p>
                  {t("minTwoChars")}
                </p>
              )}

              {allAnswersFilled && allAnswersAtLeastTwoChars && !allAnswersStartWithLetter && (
                <p>
                  {t("mustStartWithLetter")}
                </p>
              )}
            </>
          )}

          {roomStatus === "playing" && letter && myPlayer?.status === "waiting" && (
            <p>
              {t("waitingToJoin")}
            </p>
          )}

          {roomStatus === "playing" && letter && !myPlayer && (
            <p>
              {t("enterNameAnswers")}
            </p>
          )}
        </>
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
        <>
          <h2>{t("scoring")}</h2>

          <p>
            {t("submitted")}:{" "}
            {scoredPlayerIds.size}/{players.length}
          </p>

          <ul style={{ paddingLeft: 20 }}>
            {players.map((p) => (
              <li key={p.id}>
                {scoredPlayerIds.has(p.id) ? "✅" : "⏳"} {p.name}
                {scoredPlayerIds.has(p.id)
                  ? t("statusSubmitted")
                  : t("statusWaiting")}
              </li>
            ))}
          </ul>

          <section
            style={{
              position: "sticky",
              top: 0,
              zIndex: 20,
              background: "#fff",
              paddingTop: 4,
              paddingBottom: 8,
              boxShadow: "0 4px 8px rgba(0, 0, 0, 0.12)",
              pointerEvents: "none",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>
              {t("playersAnswers")}
            </h3>
            <div
              id="scoring-table-scroll"
              style={{
                overflowX: "auto",
                overflowY: "auto",
                maxHeight: "42dvh",
                overscrollBehavior: "contain",
                pointerEvents: "auto",
                touchAction: "pan-x pan-y",
                scrollPaddingLeft: "104px",
              }}
            >
            <table
              style={{
                borderCollapse: "separate",
                borderSpacing: 0,
                width: "max-content",
                textAlign: "center",
                whiteSpace: "nowrap",
              }}
            >
              <thead>
                <tr>
                  <th
                    data-sticky-player="true"
                    style={{
                      position: "sticky",
                      top: 0,
                      left: 0,
                      zIndex: 5,
                      border: "1px solid #ccc",
                      padding: 8,
                      minWidth: 96,
                      width: 96,
                      background: "#fff",
                      boxShadow: "3px 0 5px rgba(0, 0, 0, 0.12)",
                    }}
                  >
                    {t("player")}
                  </th>
                  {activeCategories.map((c, index) => (
                    <th
                      id={`score-column-${index}`}
                      key={c}
                      style={{
                        position: "sticky",
                        top: 0,
                        zIndex: 3,
                        border: "1px solid #ccc",
                        padding: 8,
                        whiteSpace: "nowrap",
                        background: selectedScoringCategory === c ? "#fff3bf" : "#fff",
                        transition: "background 0.25s ease",
                        scrollMarginLeft: "104px",
                        scrollMarginRight: "40vw",
                      }}
                    >
                      {categoryLabel(c)}
                    </th>
                  ))}
                  <th style={{ border: "1px solid #ccc", padding: 8 }}>
                    {t("totalPoints")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id}>
                    <td
                      style={{
                        position: "sticky",
                        left: 0,
                        zIndex: 2,
                        border: "1px solid #ccc",
                        padding: 8,
                        background: "#fff",
                        whiteSpace: "nowrap",
                        boxShadow: "3px 0 5px rgba(0, 0, 0, 0.12)",
                      }}
                    >
                      {p.name}
                    </td>
                    {activeCategories.map((c) => (
                      <td
                        key={c}
                        style={{
                          border: "1px solid #ccc",
                          padding: 8,
                          whiteSpace: "nowrap",
                          background: selectedScoringCategory === c ? "#fff3bf" : "#fff",
                          transition: "background 0.25s ease",
                        }}
                      >
                        {answerFor(p.id, c)}
                      </td>
                    ))}
                    <td style={{ border: "1px solid #ccc", padding: 8 }}>
                      <b>{playerTotalPoints(p.id)}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </section>

          <div style={{ marginTop: 16 }}>
            <button onClick={() => setShowRoundHistory((v) => !v)} style={{ padding: 12 }}>
              {showRoundHistory ? t("hideRoundHistory") : t("showRoundHistory")}
            </button>

            {showRoundHistory && (
              <div style={{ overflowX: "auto", marginTop: 12 }}>
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
                            {roundNo}
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
            <section
              style={{
                maxHeight: "46dvh",
                overflowY: "auto",
                overscrollBehavior: "auto",
                WebkitOverflowScrolling: "touch",
                marginTop: 16,
                padding: 12,
                border: "1px solid #ccc",
                borderRadius: 8,
                background: "#fff",
              }}
            >
              <h3 style={{ marginTop: 0 }}>
                {t("myScoring")}
              </h3>

              {activeCategories.map((category, index) => (
                <label key={category} style={{ display: "block", marginTop: 12 }}>
                  <span
                    style={{
                      display: "inline-block",
                      color: "#0969da",
                      fontWeight: 700,
                      textDecoration: "underline",
                      textUnderlineOffset: 3,
                      cursor: "pointer",
                      marginBottom: 4,
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
                    style={{ display: "block", padding: 10, marginTop: 4, width: "100%" }}
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
                  style={{
                    position: "sticky",
                    bottom: 0,
                    marginTop: 16,
                    padding: 16,
                    width: "100%",
                    background: "#fff",
                  }}
                >
                  {t("submitScoring")}
                </button>
              ) : (
                <p style={{ marginTop: 16 }}>
                  {t("scoringSubmitted")}
                </p>
              )}
            </section>
          ) : myPlayer?.status === "waiting" ? (
            <p>
              {t("waitingToJoin")}
            </p>
          ) : (
            <p>
              {t("enterNameScoring")}
            </p>
          )}

          {!everyoneScored && (
            <p>
              {t("waitingForAllPlayers")}
            </p>
          )}

            {everyoneScored && (
              shouldShowFreeLimitUpsell ? (
                <section
                  style={{
                    marginTop: 16,
                    padding: 16,
                    border: "2px solid #f59e0b",
                    borderRadius: 12,
                    background: "#fff7ed",
                  }}
                >
                  <h3 style={{ marginTop: 0 }}>{t("freeLimitTitle")}</h3>
                  <p>{t("freeLimitText")}</p>

                  <button
                    type="button"
                    onClick={() => window.alert(t("premiumComingSoon"))}
                    style={{ padding: 14, width: "100%", fontWeight: 700 }}
                  >
                    {t("freeUpgradeButton")}
                  </button>

                  <button
                    type="button"
                    onClick={unlockFreeRoundsByRewardedAd}
                    style={{ marginTop: 10, padding: 14, width: "100%", fontWeight: 700 }}
                  >
                    {t("freeRewardButton")}
                  </button>

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
                <button onClick={finishGame} style={{ marginTop: 16, padding: 16, fontWeight: 700 }}>
                  {t("finishGame")}
                </button>
              ) : (
                <button onClick={nextRound} style={{ marginTop: 16, padding: 16 }}>
                  {t("newRound")}
                </button>
              )
            )}
        </>
      )}
    </main>
  );
}
