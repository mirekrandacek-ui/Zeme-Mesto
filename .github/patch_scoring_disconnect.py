from pathlib import Path

path = Path("app/src/app/room/[code]/page.tsx")
text = path.read_text()

old_signout = '''  async function signOut() {
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
'''

new_signout = '''  async function signOut(): Promise<boolean> {
    if (!roomId || !myPlayer) return false;

    const rid = roomId;

    const { error } = await supabase.from("players").delete().eq("id", myPlayer.id);

    if (error) {
      console.error("Player disconnect failed:", error);
      setMsg(
        uiMessage({ cs: "❌ Odpojení se nepodařilo.", en: "❌ Could not leave the room.", es: "❌ No se pudo salir de la sala." , de: "❌ Der Raum konnte nicht verlassen werden.", fr: "❌ Impossible de quitter la salle.", "pt-BR": "❌ Não foi possível sair da sala.", id: "❌ Tidak dapat keluar dari ruang.", tr: "❌ Odadan çıkılamadı.", pl: "❌ Nie udało się opuścić pokoju.", it: "❌ Impossibile uscire dalla stanza."})
      );
      return false;
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
      return true;
    }

    await loadPlayers(rid);
    setMsg("");
    return true;
  }

  async function signOutToHome() {
    const disconnected = await signOut();
    if (disconnected && typeof window !== "undefined") {
      window.location.href = "/";
    }
  }
'''

if old_signout not in text:
    raise SystemExit("signOut block not found")
text = text.replace(old_signout, new_signout, 1)

old_scoring = '''            <p className={roomStyles.scoringStoppedBy}>
              {stoppedByTime
                ? `⏱️ ${statusMessage}`
                : stoppedByName
                  ? `🛑 ${stopPressedMessage(uiLanguage, stoppedByName).replace(/^✅\\s*/, "")}`
                  : ""}
            </p>
          </section>
'''

new_scoring = '''            <p className={roomStyles.scoringStoppedBy}>
              {stoppedByTime
                ? `⏱️ ${statusMessage}`
                : stoppedByName
                  ? `🛑 ${stopPressedMessage(uiLanguage, stoppedByName).replace(/^✅\\s*/, "")}`
                  : ""}
            </p>
            <button
              type="button"
              className={roomStyles.gameDisconnectButton}
              onClick={() => {
                if (window.confirm(`${t("disconnect")}?`)) {
                  void signOutToHome();
                }
              }}
            >
              {t("disconnect")}
            </button>
          </section>
'''

if old_scoring not in text:
    raise SystemExit("scoring header anchor not found")
text = text.replace(old_scoring, new_scoring, 1)

path.write_text(text)
