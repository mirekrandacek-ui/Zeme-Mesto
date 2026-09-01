from pathlib import Path

page_path = Path('app/src/app/room/[code]/page.tsx')
css_path = Path('app/src/app/room/[code]/page.module.css')
page = page_path.read_text()
css = css_path.read_text()

old_round = '''                          <td style={{ border: "1px solid #ccc", padding: 8 }}>
                            {roundNo}
                          </td>'''
new_round = '''                          <td style={{ border: "1px solid #ccc", padding: 8 }}>
                            {roundNo}.
                          </td>'''
assert old_round in page
page = page.replace(old_round, new_round, 1)

old_mine = '''.scoringMine{
  order:4;'''
new_mine = '''.scoringMine{
  order:5;'''
assert old_mine in css
css = css.replace(old_mine, new_mine, 1)

old_next = '''.scoringNextButton{
  min-height:50px;'''
new_next = '''.scoringNextButton{
  order:4;
  min-height:50px;'''
assert old_next in css
css = css.replace(old_next, new_next, 1)

old_history = '''.scoringHistoryContent{
  margin-top:7px;
  overflow-x:auto;'''
new_history = '''.scoringHistoryContent{
  margin-top:7px;
  max-width:100%;
  overflow-x:auto;
  overscroll-behavior-x:contain;
  -webkit-overflow-scrolling:touch;'''
assert old_history in css
css = css.replace(old_history, new_history, 1)

page_path.write_text(page)
css_path.write_text(css)
