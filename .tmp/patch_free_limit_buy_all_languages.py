from pathlib import Path

page = Path('app/src/app/room/[code]/page.tsx')
ui = Path('app/src/app/room/[code]/uiText.ts')

page_text = page.read_text(encoding='utf-8')
ui_text = ui.read_text(encoding='utf-8')

# Add spacing only to the Free-limit Back to homepage action, not the entry-screen action.
old_back = '''                  <a
                    className={`${roomStyles.entryAction} ${roomStyles.entryActionHome}`}
                    href="/"
                  >'''
new_back = '''                  <a
                    className={`${roomStyles.entryAction} ${roomStyles.entryActionHome}`}
                    href="/"
                    style={{ marginTop: 14 }}
                  >'''
if page_text.count(old_back) != 1:
    raise SystemExit(f'Expected exactly one Free-limit back-home block, found {page_text.count(old_back)}')
page_text = page_text.replace(old_back, new_back, 1)

# Use explicit purchase wording for every Super Premium button in every UI language.
old_super_variants = [
    '{uiMessage({ cs: "Získat Super Premium", en: "Get Super Premium", es: "Obtener Super Premium", de: "Super Premium holen", fr: "Obtenir Super Premium", "pt-BR": "Obter Super Premium", id: "Dapatkan Super Premium", tr: "Super Premium al", pl: "Zdobądź Super Premium", it: "Ottieni Super Premium" })}',
    '{uiMessage({ cs: "Koupit Super Premium", en: "Get Super Premium", es: "Obtener Super Premium", de: "Super Premium holen", fr: "Obtenir Super Premium", "pt-BR": "Obter Super Premium", id: "Dapatkan Super Premium", tr: "Super Premium al", pl: "Zdobądź Super Premium", it: "Ottieni Super Premium" })}',
]
new_super = '{uiMessage({ cs: "Koupit Super Premium", en: "Buy Super Premium", es: "Comprar Super Premium", de: "Super Premium kaufen", fr: "Acheter Super Premium", "pt-BR": "Comprar Super Premium", id: "Beli Super Premium", tr: "Super Premium satın al", pl: "Kup Super Premium", it: "Acquista Super Premium" })}'
replaced_super = 0
for old in old_super_variants:
    count = page_text.count(old)
    replaced_super += count
    page_text = page_text.replace(old, new_super)
if replaced_super < 2:
    raise SystemExit(f'Expected at least two Super Premium button variants, replaced {replaced_super}')

# Use purchase wording for Premium in all 10 UI languages.
replacements = {
    'freeUpgradeButton: "Koupit Premium"': 'freeUpgradeButton: "Koupit Premium"',
    'freeUpgradeButton: "Get Premium"': 'freeUpgradeButton: "Buy Premium"',
    'freeUpgradeButton: "Obtener Premium"': 'freeUpgradeButton: "Comprar Premium"',
    'freeUpgradeButton: "Premium holen"': 'freeUpgradeButton: "Premium kaufen"',
    'freeUpgradeButton: "Passer à Premium"': 'freeUpgradeButton: "Acheter Premium"',
    'freeUpgradeButton: "Obter Premium"': 'freeUpgradeButton: "Comprar Premium"',
    'freeUpgradeButton: "Dapatkan Premium"': 'freeUpgradeButton: "Beli Premium"',
    'freeUpgradeButton: "Premium\'a geç"': 'freeUpgradeButton: "Premium satın al"',
    'freeUpgradeButton: "Kup Premium"': 'freeUpgradeButton: "Kup Premium"',
    'freeUpgradeButton: "Passa a Premium"': 'freeUpgradeButton: "Acquista Premium"',
}
for old, new in replacements.items():
    if old not in ui_text:
        raise SystemExit(f'Missing expected UI string: {old}')
    ui_text = ui_text.replace(old, new, 1)

page.write_text(page_text, encoding='utf-8')
ui.write_text(ui_text, encoding='utf-8')
