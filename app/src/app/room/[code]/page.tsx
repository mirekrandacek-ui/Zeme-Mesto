"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type RoomStatus = "lobby" | "drawing" | "playing" | "scoring" | "finished";
type Player = { id: string; name: string };
type MyPlayer = { id: string; name: string };
type RoundLite = { id: string; round_no: number; letter: string; status: string };
type AnswerRow = { player_id: string; category: string; value: string };
type ScoreRow = { player_id: string; round?: number; category: string; points: number };

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const ROLL_MS = 5000;
const TICK_MS = 35;

const CATEGORIES = ["Země", "Město", "Jméno", "Zvíře", "Věc", "Rostlina"] as const;
type Category = (typeof CATEGORIES)[number];

const emptyAnswers = (): Record<Category, string> => ({
  Země: "",
  Město: "",
  Jméno: "",
  Zvíře: "",
  Věc: "",
  Rostlina: "",
});

const emptyScores = (): Record<Category, -10 | -5 | 0 | 5 | 10> => ({
  Země: 0,
  Město: 0,
  Jméno: 0,
  Zvíře: 0,
  Věc: 0,
  Rostlina: 0,
});

export default function RoomPage() {
  const { code } = useParams<{ code: string }>();

  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomStatus, setRoomStatus] = useState<RoomStatus>("lobby");
  const [letter, setLetter] = useState<string | null>(null);

  const [players, setPlayers] = useState<Player[]>([]);
  const [nameInput, setNameInput] = useState("");
  const [myPlayer, setMyPlayer] = useState<MyPlayer | null>(null);
  const [msg, setMsg] = useState("");
  const [showRules, setShowRules] = useState(false);
  const [showRoundHistory, setShowRoundHistory] = useState(false);

  const [round, setRound] = useState<RoundLite | null>(null);
  const [answers, setAnswers] = useState<Record<Category, string>>(emptyAnswers());
  const [allAnswers, setAllAnswers] = useState<AnswerRow[]>([]);

  const [scores, setScores] = useState<Record<Category, -10 | -5 | 0 | 5 | 10>>(emptyScores());
  const [allScores, setAllScores] = useState<ScoreRow[]>([]);
  const [allRoomScores, setAllRoomScores] = useState<ScoreRow[]>([]);
  const [myScoreSubmitted, setMyScoreSubmitted] = useState(false);

  const [rollingLetter, setRollingLetter] = useState("A");
  const rollIntervalRef = useRef<number | null>(null);

  function normalizeAnswerStart(value: string) {
    return value
      .trim()
      .charAt(0)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
  }

  const allAnswersFilled = CATEGORIES.every((c) => answers[c].trim().length > 0);

  const allAnswersAtLeastTwoChars = CATEGORIES.every((c) => answers[c].trim().length >= 2);

  const allAnswersStartWithLetter =
    Boolean(letter) &&
    CATEGORIES.every((c) => normalizeAnswerStart(answers[c]) === letter);

  const canStop = allAnswersFilled && allAnswersAtLeastTwoChars && allAnswersStartWithLetter;

  function myKey(rid: string) {
    return `zm_myPlayer_${rid}`;
  }

  async function pickLetter(rid: string) {
    const { data } = await supabase
      .from("rounds")
      .select("letter")
      .eq("room_id", rid)
      .order("round_no", { ascending: true });

    let usedInCurrentCycle = new Set<string>();

    for (const row of data ?? []) {
      const usedLetter = String((row as { letter: string }).letter ?? "").toUpperCase();

      if (usedInCurrentCycle.size >= LETTERS.length) {
        usedInCurrentCycle = new Set<string>();
      }

      if (LETTERS.includes(usedLetter)) {
        usedInCurrentCycle.add(usedLetter);
      }
    }

    const availableLetters =
      usedInCurrentCycle.size >= LETTERS.length
        ? LETTERS
        : LETTERS.filter((ltr) => !usedInCurrentCycle.has(ltr));

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
          title: "Země • Město",
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
      idx = (idx + 1) % LETTERS.length;
      setRollingLetter(LETTERS[idx]);
    }, TICK_MS);
  }

  async function loadRoomByCode() {
    const { data, error } = await supabase
      .from("rooms")
      .select("id,status,letter")
      .eq("code", code)
      .single();

    if (error || !data) {
      setRoomId(null);
      setMsg(`❌ místnost nenalezena: ${error?.message ?? ""}`);
      return null;
    }

    setRoomId(data.id);
    setRoomStatus(data.status as RoomStatus);
    setLetter((data.letter ?? null) as string | null);

    const saved = loadMyPlayer(data.id);
    if (saved) setMyPlayer(saved);

    return data.id as string;
  }

  async function loadPlayers(rid: string) {
    const { data, error } = await supabase
      .from("players")
      .select("id,name")
      .eq("room_id", rid)
      .order("created_at");

    if (error) {
      setMsg(`❌ hráči: ${error.message}`);
      return;
    }

    setPlayers((data ?? []) as Player[]);
  }

  async function loadCurrentRound(rid: string) {
    const { data, error } = await supabase
      .from("rounds")
      .select("id,round_no,letter,status")
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
    setMyScoreSubmitted(mine.length >= CATEGORIES.length);

    // Důležité:
    // Dokud hráč bodování neodeslal, nepřepisujeme mu rozpracované hodnoty.
    if (mine.length === 0) return;

    const next = emptyScores();

    for (const row of mine) {
      if (CATEGORIES.includes(row.category as Category)) {
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
      setMsg("✅ vylosováno");
    }
  }, [roomStatus, letter, round?.id]);

  // Při losování sjednoť hlášku všem hráčům podle typu akce
  useEffect(() => {
    if (roomStatus !== "drawing") return;

    if (round?.status === "skipped") {
      setMsg("… losujeme znovu");
      return;
    }

    if (round?.status === "done") {
      setMsg("… losujeme další kolo");
      return;
    }

    setMsg("… losujeme");
  }, [roomStatus, round?.status, round?.id]);

  // Při novém kole vyčisti lokální odpovědi a bodování u všech hráčů
  useEffect(() => {
    if (!round?.id) return;

    setAnswers(emptyAnswers());
    setScores(emptyScores());
    setAllAnswers([]);
    setAllScores([]);
    setMyScoreSubmitted(false);
  }, [round?.id]);

  // Při vstupu do bodování nového kola začni vždy s nulovým bodováním
  useEffect(() => {
    if (roomStatus !== "scoring" || !round?.id) return;

    setScores(emptyScores());
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
    setAnswers(emptyAnswers());
    setScores(emptyScores());
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

    const { data, error } = await supabase
      .from("players")
      .insert({ room_id: roomId, name: trimmed })
      .select("id,name")
      .single();

    if (error || !data) {
      const isDuplicateName =
        error?.code === "23505" ||
        error?.message?.includes("duplicate key") ||
        error?.message?.includes("players_room_id_name_key");

      if (isDuplicateName) {
        const existing = await supabase
          .from("players")
          .select("id,name")
          .eq("room_id", roomId)
          .eq("name", trimmed)
          .maybeSingle();

        if (existing.data) {
          saveMyPlayer(roomId, {
            id: existing.data.id,
            name: existing.data.name,
          });

          setNameInput("");
          setMsg(`✅ ${trimmed} znovu připojen`);
          await loadPlayers(roomId);
          return;
        }

        setMsg("❌ Tohle jméno už v místnosti existuje. Zadej jiné.");
        return;
      }

      setMsg(`❌ připojení: ${error?.message ?? "neznámá chyba"}`);
      return;
    }

    saveMyPlayer(roomId, { id: data.id, name: data.name });
    setNameInput("");
    setMsg(`✅ ${trimmed} připojen`);
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
      setMsg("✅ odpojeno, místnost vyčištěna");
      return;
    }

    await loadPlayers(rid);
    setMsg("✅ odpojeno");
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
      .select("id,round_no,letter,status")
      .single();

    if (error || !data) {
      setMsg(`❌ vytvoření kola: ${error?.message ?? "neznámá chyba"}`);
      return null;
    }

    const nextRound = data as RoundLite;
    setRound(nextRound);
    return nextRound;
  }

  async function startGame() {
    if (!roomId || !myPlayer) {
      setMsg("❗ nejdřív se připoj jménem");
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

      setAnswers(emptyAnswers());
      setScores(emptyScores());
      setAllAnswers([]);
      setAllScores([]);
      setMyScoreSubmitted(false);
      setMsg("✅ vylosováno");
    }, ROLL_MS);
  }

  async function redrawLetter() {
    if (!roomId || !round?.id || !myPlayer) {
      setMsg("❗ nejdřív se připoj jménem");
      return;
    }

    const rid = roomId;
    const currentRoundId = round.id;

    setMsg("… losujeme znovu");
    setRoomStatus("drawing");
    setLetter(null);
    setAnswers(emptyAnswers());
    setScores(emptyScores());
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

      setMsg("✅ vylosováno");
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
    setScores(emptyScores());
    setMyScoreSubmitted(false);

    setMsg(`✅ STOP stiskl ${myPlayer.name}`);
  }

  async function submitScores() {
    if (!roomId || !myPlayer || !round?.round_no) return;

    const rows = CATEGORIES.map((category) => ({
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
      setMsg(`❌ uložení bodů: ${error.message}`);
      return;
    }

    setMyScoreSubmitted(true);
    setMsg("");
    await loadAllScores(roomId, round.round_no);
    await loadRoomScores(roomId);
  }

  const scoredPlayerIds = new Set(
    players
      .filter((p) => CATEGORIES.every((c) => allScores.some((s) => s.player_id === p.id && s.category === c)))
      .map((p) => p.id)
  );

  const everyoneScored = players.length > 0 && scoredPlayerIds.size === players.length;

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

  const scoredRoundNumbers = Array.from(
    new Set(
      allRoomScores
        .map((s) => s.round)
        .filter((roundNo): roundNo is number => typeof roundNo === "number")
    )
  ).sort((a, b) => a - b);

  async function nextRound() {
    if (!roomId || !round?.id || !everyoneScored || !myPlayer) {
      setMsg("❗ nejdřív se připoj jménem");
      return;
    }

    const rid = roomId;
    const currentRoundId = round.id;

    setMsg("… losujeme další kolo");
    setRoomStatus("drawing");
    setLetter(null);
    setAnswers(emptyAnswers());
    setScores(emptyScores());
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

      setMsg("✅ vylosováno");
    }, ROLL_MS);
  }

  function answerFor(playerId: string, category: Category) {
    return allAnswers.find((a) => a.player_id === playerId && a.category === category)?.value ?? "";
  }

  const statusMessage =
    (roomStatus === "scoring" || roomStatus === "finished") && stoppedByName
      ? `✅ STOP stiskl ${stoppedByName}`
      : roomStatus === "playing" && letter
        ? "✅ vylosováno"
        : msg;

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: 0 }}>Místnost: {code.toUpperCase()}</h1>
          <p style={{ marginBottom: 4 }}>
            {myPlayer ? (
              <>
                Přihlášen: <b>{myPlayer.name}</b>
              </>
            ) : (
              <>Nepřihlášen</>
            )}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button onClick={() => setShowRules((v) => !v)}>Pravidla</button>
          <button onClick={copyInviteLink}>Kopírovat odkaz</button>
          <button onClick={shareInviteLink}>Sdílet</button>
          {myPlayer && <button onClick={signOut}>Odpojit</button>}
        </div>
      </header>

      {showRules && (
        <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginTop: 16 }}>
          <h2 style={{ marginTop: 0 }}>Pravidla</h2>
          <p>
            Ten, kdo místnost vytvoří, pošle ostatním hráčům odkaz pomocí tlačítka Kopírovat odkaz
            nebo Sdílet. Ostatní hráči odkaz otevřou, zadají své jméno a připojí se do stejné místnosti.
          </p>

          <p>
            Hráči společně hrají na vylosované písmeno. Každý vyplní odpovědi do kategorií.
            Kdo má všechna pole vyplněná, stiskne STOP. Odpovědi musí začínat vylosovaným písmenem
            a pole musí obsahovat minimálně dvě písmena pro odeslání odpovědí.
          </p>

          <p>
            Losování písmen probíhá tak, že jakmile se každé písmeno z abecedy vylosuje alespoň jednou,
            losuje se znovu celá abeceda. Pokud vám písmeno nevyhovuje, lze losování opakovat
            a vyřazené písmeno bude pro toto kolo abecedy automaticky vyřazeno. Bude opět dostupné, jakmile se vyčerpá celá abeceda.
          </p>

          <h3>Bodování</h3>
          <ul>
            <li><b>10 bodů</b> – unikátní odpověď, kterou nikdo jiný nemá.</li>
            <li><b>5 bodů</b> – odpověď, kterou má i někdo jiný.</li>
            <li><b>0 bodů</b> – žádná odpověď.</li>
            <li><b>-5 bodů</b> a <b>-10 bodů</b> – penalizace za neúplnou, chybnou nebo ostatními hráči neuznanou odpověď.</li>
          </ul>
        </section>
      )}

      {statusMessage && <p>{statusMessage}</p>}

      {roomId && !myPlayer && (
        <section style={{ border: "1px solid #ddd", padding: 12, margin: "16px 0" }}>
          <h2 style={{ marginTop: 0 }}>Připojit se do hry</h2>
          <input
            placeholder="Tvoje jméno"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            style={{ padding: 12, width: "100%", maxWidth: 320 }}
          />
          <button onClick={joinRoom} style={{ display: "block", marginTop: 10, padding: 12 }}>
            Připojit se
          </button>
        </section>
      )}

      {roomStatus === "lobby" && (
        <>
          <h2>Lobby</h2>

          <h3>Hráči ({players.length})</h3>
          <ul>
            {players.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </ul>

          <p>Kategorie: {CATEGORIES.join(" / ")}</p>

          {myPlayer ? (
            <button onClick={startGame}>START</button>
          ) : (
            <p>Připoj se jménem, aby šlo spustit hru.</p>
          )}
        </>
      )}

      {(roomStatus === "drawing" || roomStatus === "playing") && (
        <>
          <h2>{roomStatus === "drawing" ? "Losujeme…" : "Hrajeme"}</h2>

          <div style={{ fontSize: 72, fontWeight: "bold" }}>{letter ?? rollingLetter}</div>

          {roomStatus === "playing" && letter && myPlayer && (
            <button onClick={redrawLetter} style={{ marginTop: 12, padding: 12 }}>
              Losovat znovu
            </button>
          )}

          {roomStatus === "playing" && letter && myPlayer && round && (
            <>
              {CATEGORIES.map((category) => (
                <input
                  key={category}
                  placeholder={category}
                  value={answers[category]}
                  onChange={(e) => saveAnswer(category, e.target.value)}
                  style={{ display: "block", marginTop: 10, padding: 12, width: "100%" }}
                />
              ))}

              <button
                onClick={stopRound}
                disabled={!canStop}
                style={{ marginTop: 16, padding: 16 }}
              >
                STOP
              </button>

              {!allAnswersFilled && (
                <p>STOP půjde zmáčknout až po vyplnění všech polí.</p>
              )}

              {allAnswersFilled && !allAnswersAtLeastTwoChars && (
                <p>Každé pole musí mít alespoň dvě písmena.</p>
              )}

              {allAnswersFilled && allAnswersAtLeastTwoChars && !allAnswersStartWithLetter && (
                <p>Každé pole musí začínat vylosovaným písmenem.</p>
              )}
            </>
          )}

          {roomStatus === "playing" && letter && !myPlayer && <p>Přihlaš se jménem nahoře, abys mohl psát odpovědi.</p>}
        </>
      )}

      {roomStatus === "scoring" && (
        <>
          <h2>Bodování</h2>

          <p>Odesláno: {scoredPlayerIds.size}/{players.length}</p>

          <ul style={{ paddingLeft: 20 }}>
            {players.map((p) => (
              <li key={p.id}>
                {scoredPlayerIds.has(p.id) ? "✅" : "⏳"} {p.name}
                {scoredPlayerIds.has(p.id) ? " – odeslal" : " – čekáme"}
              </li>
            ))}
          </ul>

          <h3>Odpovědi hráčů</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", minWidth: 700 }}>
              <thead>
                <tr>
                  <th style={{ border: "1px solid #ccc", padding: 8 }}>Hráč</th>
                  {CATEGORIES.map((c) => (
                    <th key={c} style={{ border: "1px solid #ccc", padding: 8 }}>{c}</th>
                  ))}
                  <th style={{ border: "1px solid #ccc", padding: 8 }}>Body celkem</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id}>
                    <td style={{ border: "1px solid #ccc", padding: 8 }}>{p.name}</td>
                    {CATEGORIES.map((c) => (
                      <td key={c} style={{ border: "1px solid #ccc", padding: 8 }}>
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

          <div style={{ marginTop: 16 }}>
            <button onClick={() => setShowRoundHistory((v) => !v)} style={{ padding: 12 }}>
              {showRoundHistory ? "Skrýt historii kol" : "Zobrazit historii kol"}
            </button>

            {showRoundHistory && (
              <div style={{ overflowX: "auto", marginTop: 12 }}>
                {scoredRoundNumbers.length === 0 ? (
                  <p>Zatím nejsou uložené body za žádné kolo.</p>
                ) : (
                  <table style={{ borderCollapse: "collapse", minWidth: 500 }}>
                    <thead>
                      <tr>
                        <th style={{ border: "1px solid #ccc", padding: 8 }}>Kolo</th>
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

          {myPlayer ? (
            <>
              <h3>Moje bodování</h3>

              {CATEGORIES.map((category) => (
                <label key={category} style={{ display: "block", marginTop: 12 }}>
                  {category}
                  <select
                    value={scores[category]}
                    disabled={myScoreSubmitted}
                    onChange={(e) =>
                      setScores((prev) => ({
                        ...prev,
                        [category]: Number(e.target.value) as -10 | -5 | 0 | 5 | 10,
                      }))
                    }
                    style={{ display: "block", padding: 10, marginTop: 4, width: "100%" }}
                  >
                    <option value={0}>0 bodů</option>
                    <option value={5}>5 bodů</option>
                    <option value={10}>10 bodů</option>
                    <option value={-5}>-5 bodů</option>
                    <option value={-10}>-10 bodů</option>
                  </select>
                </label>
              ))}

              {!myScoreSubmitted ? (
                <button onClick={submitScores} style={{ marginTop: 16, padding: 16 }}>
                  Odeslat bodování
                </button>
              ) : (
                <p style={{ marginTop: 16 }}>✅ Bodování odesláno. Úprava už není možná.</p>
              )}
            </>
          ) : (
            <p>Přihlaš se jménem nahoře, abys mohl odeslat bodování.</p>
          )}

          {!everyoneScored && <p>Čekáme na všechny hráče…</p>}

          {everyoneScored && (
            <button onClick={nextRound} style={{ marginTop: 16, padding: 16 }}>
              Nové kolo
            </button>
          )}
        </>
      )}
    </main>
  );
}
