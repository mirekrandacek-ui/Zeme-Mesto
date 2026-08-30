from pathlib import Path

page_path = Path('app/src/app/room/[code]/page.tsx')
css_path = Path('app/src/app/room/[code]/page.module.css')

page = page_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, got {count}')
    return text.replace(old, new, 1)


page = replace_once(
    page,
    '''  const isRoomEntry = Boolean(roomId && !myPlayer);\n  const roomEntryMosaic = (\n''',
    '''  const isRoomEntry = Boolean(roomId && !myPlayer);\n  const isStyledLobby = Boolean(roomId && myPlayer && roomStatus === "lobby");\n  const usePhotoRoomChrome = isRoomEntry || isStyledLobby;\n  const newRoomLabel = uiMessage({\n    cs: "Nová místnost",\n    en: "New room",\n    es: "Nueva sala",\n    de: "Neuer Raum",\n    fr: "Nouvelle salle",\n    "pt-BR": "Nova sala",\n    id: "Ruang baru",\n    tr: "Yeni oda",\n    pl: "Nowy pokój",\n    it: "Nuova stanza",\n  });\n  const roomEntryMosaic = (\n''',
    'styled lobby state',
)

page = replace_once(
    page,
    'className={isRoomEntry ? roomStyles.entryPage : undefined}',
    'className={usePhotoRoomChrome ? roomStyles.entryPage : undefined}',
    'styled lobby page class',
)

page = replace_once(
    page,
    '{isRoomEntry && roomEntryMosaic}',
    '{usePhotoRoomChrome && roomEntryMosaic}',
    'styled lobby mosaic',
)

header_marker = '''      </header>\n      ) : (\n      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>\n'''
header_insert = '''      </header>\n      ) : isStyledLobby ? (\n      <header className={roomStyles.lobbyHeader}>\n        <h1 className={roomStyles.lobbyRoomTitle}>\n          {t("room")}: {code.toUpperCase()}\n        </h1>\n        {isOrganizer && (roomTier === "premium" || roomTier === "super_premium") && (\n          <p className={roomStyles.lobbyBossRoom}>{t("bossRoom")}</p>\n        )}\n        <p className={roomStyles.lobbySignedIn}>\n          {t("signedIn")}: <b>{myPlayer?.name}</b>\n        </p>\n\n        <div className={roomStyles.lobbyActions}>\n          <button\n            className={`${roomStyles.lobbyAction} ${roomStyles.lobbyActionShare}`}\n            type="button"\n            onClick={shareInviteLink}\n          >\n            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"/></svg>\n            <span>{t("shareRoomCode")}</span>\n          </button>\n\n          <button\n            className={roomStyles.lobbyAction}\n            type="button"\n            onClick={() => setShowRules((value) => !value)}\n          >\n            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.6 2.1c-1 .6-1.4 1.1-1.4 2.2M12 17h.01"/></svg>\n            <span>{t("rules")}</span>\n          </button>\n\n          <button className={roomStyles.lobbyAction} type="button" onClick={copyInviteLink}>\n            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2"/></svg>\n            <span>{t("copyRoomLink")}</span>\n          </button>\n\n          <a className={roomStyles.lobbyAction} href="/">\n            <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="11" cy="10" r="5"/><path d="M2 27c0-6 3-9 9-9s9 3 9 9M24 13v12M18 19h12"/></svg>\n            <span>{isOrganizer ? newRoomLabel : t("backHome")}</span>\n          </a>\n\n          <button\n            className={`${roomStyles.lobbyAction} ${roomStyles.lobbyActionLike}`}\n            type="button"\n            onClick={() => window.alert(t("ratingUnavailable"))}\n          >\n            <span className={roomStyles.lobbyLikeCopy}>{t("likeApp")} ❤️</span>\n          </button>\n\n          <button className={roomStyles.lobbyAction} type="button" onClick={signOut}>\n            <span>{t("disconnect")}</span>\n          </button>\n        </div>\n      </header>\n      ) : (\n      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>\n'''
page = replace_once(page, header_marker, header_insert, 'styled lobby header')

page = replace_once(
    page,
    '{isOrganizer ? t("newGame") : t("backHome")}',
    '{isOrganizer ? newRoomLabel : t("backHome")}',
    'new room label',
)

page = replace_once(
    page,
    '''          {myPlayer && (\n            <button onClick={switchLocalPlayer}>\n              {t("changePlayerOnDevice")}\n            </button>\n          )}\n''',
    '',
    'remove duplicate change-player button',
)

language_marker = '''      </section>\n      ) : (\n      <section\n        data-game-language-banner\n        style={{\n          marginTop: 12,\n'''
language_insert = '''      </section>\n      ) : isStyledLobby ? (\n      <section className={roomStyles.lobbyLanguage} data-game-language-banner>\n        <div className={roomStyles.lobbyLanguageCurrent}>\n          {t("gameLanguage")}: {gameLanguageName} {gameLanguageFlag}\n        </div>\n        {uiLanguage !== roomLanguage && (\n          <p className={roomStyles.lobbyLanguageInstruction}>{gameLanguageInstruction}</p>\n        )}\n        {gameLanguageHasDiacritics && (\n          <p className={roomStyles.lobbyLanguageNote}>{t("diacriticsOptional")}</p>\n        )}\n      </section>\n      ) : (\n      <section\n        data-game-language-banner\n        style={{\n          marginTop: 12,\n'''
page = replace_once(page, language_marker, language_insert, 'styled lobby language')

page = replace_once(
    page,
    'className={isRoomEntry ? roomStyles.entryRules : undefined}',
    'className={usePhotoRoomChrome ? roomStyles.entryRules : undefined}',
    'styled lobby rules class',
)
page = replace_once(
    page,
    'style={isRoomEntry ? undefined : { border: "1px solid #ddd", borderRadius: 8, padding: 12, marginTop: 16 }}',
    'style={usePhotoRoomChrome ? undefined : { border: "1px solid #ddd", borderRadius: 8, padding: 12, marginTop: 16 }}',
    'styled lobby rules style',
)

page = replace_once(
    page,
    '''          <h2>Lobby</h2>\n\n''',
    '',
    'remove Lobby heading',
)

page = replace_once(
    page,
    '''            <button\n              data-main-start-button\n              onClick={startGame}\n              style={{ marginBottom: 16, padding: 16, fontWeight: 700 }}\n            >\n''',
    '''            <button\n              data-main-start-button\n              className={roomStyles.lobbyStartButton}\n              onClick={startGame}\n            >\n''',
    'green start button',
)

page = replace_once(
    page,
    '''          <p style={{ opacity: 0.75 }}>\n            {t("availableLetters")}:{" "}\n            {getLettersForLanguage(roomLanguage).join(", ")}\n          </p>\n\n''',
    '''          <p className={roomStyles.lobbyLetters}>\n            <strong>{t("availableLetters")}:</strong>{" "}\n            <span>{getLettersForLanguage(roomLanguage).join(", ")}</span>\n          </p>\n\n''',
    'styled letter selection',
)

page = replace_once(
    page,
    '''          <h3>\n            {t("players")} ({players.length})\n          </h3>\n          <ul>\n            {players.map((p) => (\n              <li key={p.id}>{p.name}</li>\n            ))}\n          </ul>\n\n''',
    '''          <section className={roomStyles.lobbyPlayers}>\n            <h3>\n              {t("players")} ({players.length})\n            </h3>\n            <ul>\n              {players.map((p) => (\n                <li key={p.id}>{p.name}</li>\n              ))}\n            </ul>\n          </section>\n\n''',
    'styled players list',
)

css_append = r'''

/* Lobby: reuse the approved homepage / room-entry visual language. */
.lobbyHeader,
.lobbyLanguage,
.lobbyStartButton,
.lobbyLetters,
.lobbyPlayers{
  box-sizing:border-box;
  width:min(82vw,calc(var(--zm-stable-vh,1lvh) * 34.45),360px);
  margin-left:auto;
  margin-right:auto;
}

.lobbyHeader{
  margin-bottom:10px;
  padding:13px;
  border:2px solid #43c8ff;
  border-radius:28px;
  background:linear-gradient(145deg,rgba(8,115,175,.97),rgba(0,48,91,.985) 38%,rgba(0,28,59,.99));
  box-shadow:inset 0 0 0 2px #087cbf,inset 0 9px 16px #4cd1ff66,inset 0 -10px 18px #001f43,0 0 0 3px #00284ccc,0 0 16px #04aaff,0 12px 18px #000819cc;
  text-shadow:0 2px 3px #00152d;
}

.lobbyRoomTitle{
  margin:0 0 3px;
  font-size:clamp(19px,5vw,25px);
  line-height:1.1;
  font-weight:800;
}

.lobbyBossRoom{
  margin:3px 0;
  color:#d8f4ff;
  font-size:11px;
  line-height:1.25;
  font-weight:700;
}

.lobbySignedIn{
  margin:0 0 10px;
  font-size:14px;
  line-height:1.2;
}

.lobbyActions{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:7px;
}

.lobbyAction{
  box-sizing:border-box;
  display:flex;
  align-items:center;
  width:100%;
  min-height:54px;
  padding:7px 9px;
  border:2px solid #61d7ff;
  border-radius:14px;
  color:#fff;
  background:linear-gradient(#1686ca,#00508b 58%,#003360);
  box-shadow:inset 0 2px 5px #56c9ff,inset 0 -5px 8px #002746,0 3px 7px #00162c;
  font:inherit;
  font-size:clamp(11px,3vw,14px);
  font-weight:750;
  line-height:1.12;
  text-align:left;
  text-decoration:none;
  text-shadow:0 2px 2px #001b38;
  cursor:pointer;
}

.lobbyAction span{
  min-width:0;
}

.lobbyAction svg{
  flex:0 0 auto;
  width:22px;
  height:22px;
  margin-right:8px;
  fill:none;
  stroke:#fff;
  stroke-width:2.3;
  stroke-linecap:round;
  stroke-linejoin:round;
}

.lobbyActionShare{
  border-color:#b8a9ff;
  background:linear-gradient(#7163c5,#51469d 58%,#38317c);
}

.lobbyActionLike{
  justify-content:flex-start;
  border-color:#ffd0dc;
  background:linear-gradient(#f7afc4,#e58daa 55%,#cc6f92);
  box-shadow:inset 0 3px 5px #ffe8ef,inset 0 -5px 7px #a85171,0 0 0 2px #9d536d,0 3px 7px #00152d;
  text-shadow:0 2px 2px #7d3b56;
}

.lobbyLikeCopy{
  white-space:pre-line;
  line-height:1.05;
}

.lobbyLanguage{
  margin-bottom:10px;
  padding:10px 14px 11px;
  border:2px solid #55d5ff;
  border-radius:18px;
  background:linear-gradient(#1686ca,#00508b 58%,#003360);
  box-shadow:inset 0 2px 5px #56c9ff,inset 0 -6px 10px #002746,0 0 10px #00aaff,0 5px 9px #00162c;
  text-shadow:0 2px 2px #001b38;
}

.lobbyLanguageCurrent{
  font-size:clamp(16px,4.5vw,19px);
  line-height:1.15;
  font-weight:800;
}

.lobbyLanguageInstruction,
.lobbyLanguageNote{
  margin:5px 0 0;
  color:#dff5ff;
  font-size:11px;
  line-height:1.25;
}

.lobbyLanguageNote{
  color:#c5ebfb;
}

.lobbyStartButton{
  display:flex;
  align-items:center;
  justify-content:center;
  min-height:54px;
  margin-top:0;
  margin-bottom:10px;
  padding:10px 8px 11px;
  border:2px solid #dcffa4;
  border-radius:18px;
  color:#fff;
  background:linear-gradient(#84e43d,#4ebe12 48%,#189000 77%,#35ae0a);
  box-shadow:inset 0 4px 6px #ffffffbf,inset 0 -6px 8px #147700,0 0 10px #77f335,0 5px 4px #001d25;
  font:inherit;
  font-size:clamp(19px,5.3vw,25px);
  font-weight:800;
  text-shadow:0 2px 2px #145c0d;
  cursor:pointer;
}

.lobbyLetters{
  margin-top:0;
  margin-bottom:10px;
  padding:10px 12px;
  border:2px solid #f59e0b;
  border-radius:14px;
  color:#172033;
  background:#fff7ed;
  box-shadow:0 4px 8px #00152d99;
  text-shadow:none;
  font-size:13px;
  line-height:1.35;
}

.lobbyPlayers{
  margin-top:0;
  margin-bottom:12px;
  padding:10px 12px 12px;
  border:2px solid #55d5ff;
  border-radius:18px;
  background:linear-gradient(#1686ca,#00508b 58%,#003360);
  box-shadow:inset 0 2px 5px #56c9ff,inset 0 -6px 10px #002746,0 0 10px #00aaff,0 5px 9px #00162c;
  text-shadow:0 2px 2px #001b38;
}

.lobbyPlayers h3{
  margin:0 0 8px;
  font-size:18px;
}

.lobbyPlayers ul{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(120px,1fr));
  gap:6px;
  margin:0;
  padding:0;
  list-style:none;
}

.lobbyPlayers li{
  min-width:0;
  padding:6px 9px;
  border:1px solid #69d8ff;
  border-radius:9px;
  background:rgba(0,38,76,.62);
  font-size:14px;
  line-height:1.2;
  overflow-wrap:anywhere;
}

.lobbyPlayers li::before{
  content:"•";
  margin-right:7px;
}

@media(max-width:380px){
  .lobbyActions{gap:6px}
  .lobbyAction{padding:6px 7px;font-size:11px}
  .lobbyAction svg{width:20px;height:20px;margin-right:6px}
}
'''

if '.lobbyHeader{' in css:
    raise SystemExit('Lobby CSS already present')
css = css.rstrip() + css_append + '\n'

page_path.write_text(page, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')
