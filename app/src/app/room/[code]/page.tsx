"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type RoomStatus = "lobby" | "playing" | "scoring" | "finished";
type Player = { id: string; name: string };
type MyPlayer = { id: string; name: string };
type RoundLite = { id: string; round_no: number; letter: string; status: string };
type AnswerRow = { player_id: string; category: string; value: string };
type ScoreRow = { player_id: string; category: string; points: number };

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

const emptyScores = (): Record<Category, -10 | 0 | 5 | 10> => ({
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

  const [round, setRound] = useState<RoundLite | null>(null);
  const [answers, setAnswers] = useState<Record<Category, string>>(emptyAnswers());
  const [allAnswers, setAllAnswers] = useState<AnswerRow[]>([]);

  const [scores, setScores] = useState<Record<Category, -10 | 0 | 5 | 10>>(emptyScores());
  const [allScores, setAllScores] = useState<ScoreRow[]>([]);
  const [myScoreSubmitted, setMyScoreSubmitted] = useState(false);

  const [rollingLetter, setRollingLetter] = useState("A");
  const rollIntervalRef = useRef<number | null>(null);

  const allAnswersFilled = CATEGORIES.every((c) => answers[c].trim().length > 0);

  function myKey(rid: string) {
    return `zm_myPlayer_${rid}`;
  }

  function pickLetter() {
    return LETTERS[Math.floor(Math.random() * LETTERS.length)];
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
        next[row.category as Category] = row.points as -10 | 0 | 5 | 10;
      }
    }

    setScores(next);
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const rid = await loadRoomByCode();
      if (cancelled || !rid) return;
      await loadPlayers(rid);
      await loadCurrentRound(rid);
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
      }
    }, 1000);

    return () => window.clearInterval(poll);
  }, [roomId, round?.round_no, myPlayer?.id]);

  useEffect(() => {
    if (roomStatus === "playing" && letter === null) {
      startRollingVisual();
      return;
    }

    stopRolling();
  }, [roomStatus, letter]);

  async function joinRoom() {
    if (!roomId) return;

    const trimmed = nameInput.trim();
    if (!trimmed) {
      setMsg("❗ napiš jméno");
      return;
    }

    const { data, error } = await supabase
      .from("players")
      .insert({ room_id: roomId, name: trimmed })
      .select("id,name")
      .single();

    if (error || !data) {
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

    await supabase.from("players").delete().eq("id", myPlayer.id);
    clearMyPlayer(roomId);
    await loadPlayers(roomId);
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
    if (!roomId) return;

    setMsg("… losujeme");
    setRoomStatus("playing");
    setLetter(null);

    const { error: startError } = await supabase
      .from("rooms")
      .update({ status: "playing", letter: null })
      .eq("id", roomId);

    if (startError) {
      setMsg(`❌ start: ${startError.message}`);
      setRoomStatus("lobby");
      return;
    }

    const finalLetter = pickLetter();

    window.setTimeout(async () => {
      const newRound = await createRound(roomId, finalLetter);
      if (!newRound) return;

      await supabase.from("rooms").update({ letter: finalLetter }).eq("id", roomId);

      setAnswers(emptyAnswers());
      setScores(emptyScores());
      setAllAnswers([]);
      setAllScores([]);
      setMyScoreSubmitted(false);
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
    if (!roomId || !round?.id) return;

    await supabase.from("rounds").update({ status: "scoring" }).eq("id", round.id);
    await supabase.from("rooms").update({ status: "scoring" }).eq("id", roomId);

    setMsg("✅ STOP – jdeme bodovat");
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
    setMsg("✅ bodování odesláno");
    await loadAllScores(roomId, round.round_no);
  }

  const scoredPlayerIds = new Set(
    players
      .filter((p) => CATEGORIES.every((c) => allScores.some((s) => s.player_id === p.id && s.category === c)))
      .map((p) => p.id)
  );

  const everyoneScored = players.length > 0 && scoredPlayerIds.size === players.length;

  async function nextRound() {
    if (!roomId || !round?.id || !everyoneScored) return;

    await supabase.from("rounds").update({ status: "done" }).eq("id", round.id);
    await startGame();
  }

  function answerFor(playerId: string, category: Category) {
    return allAnswers.find((a) => a.player_id === playerId && a.category === category)?.value ?? "";
  }

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
          <p style={{ marginTop: 0, opacity: 0.75 }}>Kód: {code.toUpperCase()}</p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button onClick={copyInviteLink}>Kopírovat odkaz</button>
          <button onClick={shareInviteLink}>Sdílet</button>
          {myPlayer && <button onClick={signOut}>Odpojit</button>}
        </div>
      </header>

      {msg && <p>{msg}</p>}

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

          <button onClick={startGame}>START</button>
        </>
      )}

      {roomStatus === "playing" && (
        <>
          <h2>Hrajeme</h2>

          <div style={{ fontSize: 72, fontWeight: "bold" }}>{letter ?? rollingLetter}</div>

          {letter && myPlayer && round && (
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
                disabled={!allAnswersFilled}
                style={{ marginTop: 16, padding: 16 }}
              >
                STOP
              </button>

              {!allAnswersFilled && <p>STOP půjde zmáčknout až po vyplnění všech polí.</p>}
            </>
          )}

          {letter && !myPlayer && <p>Přihlaš se jménem nahoře, abys mohl psát odpovědi.</p>}
        </>
      )}

      {roomStatus === "scoring" && (
        <>
          <h2>Bodování</h2>
          <p>Odesláno: {scoredPlayerIds.size}/{players.length}</p>

          <h3>Odpovědi hráčů</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", minWidth: 700 }}>
              <thead>
                <tr>
                  <th style={{ border: "1px solid #ccc", padding: 8 }}>Hráč</th>
                  {CATEGORIES.map((c) => (
                    <th key={c} style={{ border: "1px solid #ccc", padding: 8 }}>{c}</th>
                  ))}
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
                  </tr>
                ))}
              </tbody>
            </table>
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
                        [category]: Number(e.target.value) as -10 | 0 | 5 | 10,
                      }))
                    }
                    style={{ display: "block", padding: 10, marginTop: 4, width: "100%" }}
                  >
                    <option value={0}>0 bodů</option>
                    <option value={5}>5 bodů</option>
                    <option value={10}>10 bodů</option>
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
