from pathlib import Path

path = Path('app/src/app/room/[code]/page.module.css')
text = path.read_text(encoding='utf-8')
old_header = '''.gameHeaderTop{\n  display:grid;\n  grid-template-columns:minmax(0,1fr) 112px;\n  align-items:center;\n  gap:8px;\n  min-height:68px;\n  padding-right:8px;\n}\n'''
new_header = '''.gameHeaderTop{\n  display:flex;\n  align-items:center;\n  justify-content:center;\n  min-height:68px;\n}\n'''
old_title = '''.gameTitle{\n  margin:0;\n  font-size:clamp(19px,5vw,24px);\n  line-height:1.05;\n  font-weight:800;\n}\n'''
new_title = '''.gameTitle{\n  display:none;\n}\n'''
old_letter = '''.gameLetter{\n  width:112px;\n  min-width:0;\n  text-align:center;\n  font-size:clamp(52px,15.5vw,72px);\n  font-weight:900;\n  line-height:.82;\n  letter-spacing:-.08em;\n  white-space:nowrap;\n  transform:translateX(-8px);\n  color:#fff;\n  text-shadow:0 3px 4px #00152d,0 0 8px #53d7ff;\n}\n'''
new_letter = '''.gameLetter{\n  width:100%;\n  min-width:0;\n  text-align:center;\n  font-size:clamp(52px,15.5vw,72px);\n  font-weight:900;\n  line-height:.82;\n  letter-spacing:-.08em;\n  white-space:nowrap;\n  color:#fff;\n  text-shadow:0 3px 4px #00152d,0 0 8px #53d7ff;\n}\n'''
for old, new in ((old_header,new_header),(old_title,new_title),(old_letter,new_letter)):
    if old not in text:
        raise SystemExit('Expected CSS block not found')
    text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
