from pathlib import Path

page_path = Path('app/src/app/room/[code]/page.tsx')
text_path = Path('app/src/app/room/[code]/uiText.ts')

page = page_path.read_text()
text = text_path.read_text()

old_back = '''                  <button
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
                  </button>'''
new_back = '''                  <a
                    className={`${roomStyles.entryAction} ${roomStyles.entryActionHome}`}
                    href="/"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h11"/></svg>
                    <span>{t("backHome")}</span>
                  </a>'''
assert old_back in page
page = page.replace(old_back, new_back, 1)

old_super = 'cs: "Získat Super Premium"'
new_super = 'cs: "Koupit Super Premium"'
assert old_super in page
page = page.replace(old_super, new_super, 1)

old_premium = 'freeUpgradeButton: "Získat Premium"'
new_premium = 'freeUpgradeButton: "Koupit Premium"'
assert old_premium in text
text = text.replace(old_premium, new_premium, 1)

page_path.write_text(page)
text_path.write_text(text)
