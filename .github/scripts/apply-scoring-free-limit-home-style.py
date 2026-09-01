from pathlib import Path

page_path = Path('app/src/app/room/[code]/page.tsx')
css_path = Path('app/src/app/room/[code]/page.module.css')

page = page_path.read_text()
css = css_path.read_text()

old_panel = '''                <section
                  className={roomStyles.scoringNextArea}
                  style={{
                    padding: 16,
                    border: "2px solid #f59e0b",
                    borderRadius: 12,
                    background: "#fff7ed",
                    color: "#111",
                    textShadow: "none",
                  }}
                >'''
new_panel = '''                <section
                  className={`${roomStyles.scoringNextArea} ${roomStyles.scoringFreeLimitPanel}`}
                >'''

if old_panel not in page:
    raise SystemExit('Free limit panel block not found')
page = page.replace(old_panel, new_panel, 1)

anchor = '''.scoringNextArea,
.scoringNextButton{
  order:6;
  margin-top:0;
  margin-bottom:6px;
}

'''
styles = '''.scoringNextArea,
.scoringNextButton{
  order:6;
  margin-top:0;
  margin-bottom:6px;
}

.scoringFreeLimitPanel{
  padding:8px;
  border:1.5px solid #ffd75d;
  border-radius:10px;
  color:#fff;
  background:#513100cf;
  font-size:16px;
  line-height:1.3;
  text-shadow:0 2px 3px #00152d;
}

.scoringFreeLimitPanel h3,
.scoringFreeLimitPanel p{
  margin-top:0;
  margin-bottom:7px;
}

.scoringFreeLimitPanel>button:not(:last-child){
  width:100%;
  border:1px solid #b8ff8c;
  border-radius:9px;
  color:#fff;
  background:linear-gradient(#67ca35,#21880d);
  font:inherit;
  font-size:16px;
  font-weight:800;
  text-shadow:0 2px 2px #145c0d;
}

.scoringFreeLimitPanel>button:not(:last-child):disabled{
  filter:grayscale(.7);
  opacity:.65;
}

.scoringFreeLimitPanel section{
  color:#111;
  text-shadow:none;
}

'''
if anchor not in css:
    raise SystemExit('CSS anchor not found')
css = css.replace(anchor, styles, 1)

page_path.write_text(page)
css_path.write_text(css)
