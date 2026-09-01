from pathlib import Path

page_path = Path('app/src/app/room/[code]/page.tsx')
css_path = Path('app/src/app/room/[code]/page.module.css')

page = page_path.read_text()
css = css_path.read_text()

old_scroll = '''.scoringMine{\n  order:5;\n  max-height:46dvh;\n  overflow-y:auto;\n  overscroll-behavior:contain;'''
new_scroll = '''.scoringMine{\n  order:5;\n  max-height:46dvh;\n  overflow-y:auto;'''
assert old_scroll in css
css = css.replace(old_scroll, new_scroll, 1)

old_free = '''                  style={{\n                    padding: 16,\n                    border: "2px solid #f59e0b",\n                    borderRadius: 12,\n                    background: "#fff7ed",\n                  }}'''
new_free = '''                  style={{\n                    padding: 16,\n                    border: "2px solid #f59e0b",\n                    borderRadius: 12,\n                    background: "#fff7ed",\n                    color: "#111",\n                    textShadow: "none",\n                  }}'''
assert old_free in page
page = page.replace(old_free, new_free, 1)

page_path.write_text(page)
css_path.write_text(css)
