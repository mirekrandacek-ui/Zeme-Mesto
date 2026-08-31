from pathlib import Path

page = Path('app/src/app/room/[code]/page.tsx')
css = Path('app/src/app/room/[code]/page.module.css')

page_text = page.read_text()
css_text = css.read_text()

old_actions = '''        <div className={roomStyles.lobbyActions}>
          <button
            className={`${roomStyles.lobbyAction} ${roomStyles.lobbyActionShare}`}
            type="button"
            onClick={shareInviteLink}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"/></svg>
            <span>{t("shareRoomCode")}</span>
          </button>

          <button
            className={roomStyles.lobbyAction}
            type="button"
            onClick={() => setShowRules((value) => !value)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.6 2.1c-1 .6-1.4 1.1-1.4 2.2M12 17h.01"/></svg>
            <span>{t("rules")}</span>
          </button>

          <button className={roomStyles.lobbyAction} type="button" onClick={copyInviteLink}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2"/></svg>
            <span>{t("copyRoomLink")}</span>
          </button>

          <a className={roomStyles.lobbyAction} href="/">
            <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="11" cy="10" r="5"/><path d="M2 27c0-6 3-9 9-9s9 3 9 9M24 13v12M18 19h12"/></svg>
            <span>{isOrganizer ? newRoomLabel : t("backHome")}</span>
          </a>

          <button
            className={`${roomStyles.lobbyAction} ${roomStyles.lobbyActionLike}`}
            type="button"
            onClick={() => window.alert(t("ratingUnavailable"))}
          >
            <span className={roomStyles.lobbyLikeCopy}>{t("likeApp")} ❤️</span>
          </button>

          <button className={roomStyles.lobbyAction} type="button" onClick={signOut}>
            <span>{t("disconnect")}</span>
          </button>
        </div>'''

new_actions = '''        <div className={roomStyles.lobbyActions}>
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
        </div>'''

if old_actions not in page_text:
    raise SystemExit('Lobby actions block not found')
page_text = page_text.replace(old_actions, new_actions, 1)

old_rules = '      {showRules && (\n'
new_rules = '      {showRules && !isStyledLobby && (\n'
if old_rules not in page_text:
    raise SystemExit('Rules condition not found')
page_text = page_text.replace(old_rules, new_rules, 1)

old_grid = '''.lobbyActions{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:7px;
}'''
new_grid = '''.lobbyActions{
  display:grid;
  grid-template-columns:1fr;
  gap:7px;
}'''
if old_grid not in css_text:
    raise SystemExit('Lobby grid CSS not found')
css_text = css_text.replace(old_grid, new_grid, 1)

old_action_css = '''  min-height:54px;
  padding:7px 9px;'''
new_action_css = '''  min-height:54px;
  padding:9px 13px;'''
if old_action_css not in css_text:
    raise SystemExit('Lobby action size CSS not found')
css_text = css_text.replace(old_action_css, new_action_css, 1)

old_font = '  font-size:clamp(11px,3vw,14px);'
new_font = '  font-size:clamp(14px,4vw,18px);'
if old_font not in css_text:
    raise SystemExit('Lobby action font CSS not found')
css_text = css_text.replace(old_font, new_font, 1)

old_purple = '.lobbyActionShare{'
new_purple = '.lobbyActionPurple{'
if old_purple not in css_text:
    raise SystemExit('Lobby purple CSS not found')
css_text = css_text.replace(old_purple, new_purple, 1)

page.write_text(page_text)
css.write_text(css_text)
