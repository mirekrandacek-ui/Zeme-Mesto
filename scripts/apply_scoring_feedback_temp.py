from pathlib import Path

page_path = Path('app/src/app/room/[code]/page.tsx')
css_path = Path('app/src/app/room/[code]/page.module.css')
page = page_path.read_text()
css = css_path.read_text()

old_total = '''                  <th className={`${roomStyles.scoringTableCell} ${roomStyles.scoringTableHead}`}>
                    {t("totalPoints")}
                  </th>'''
new_total = '''                  <th className={`${roomStyles.scoringTableCell} ${roomStyles.scoringTableHead}`}>
                    <span className={roomStyles.scoringTotalPointsText}>{t("totalPoints")}</span>
                  </th>'''
assert old_total in page
page = page.replace(old_total, new_total, 1)

old_name = '''                  <span className={roomStyles.scoringCategoryName}>
                    {categoryLabel(category)}
                  </span>'''
new_name = '''                  <span
                    className={roomStyles.scoringCategoryName}
                    onClick={() => {
                      setSelectedScoringCategory(category);

                      requestAnimationFrame(() => {
                        const scrollBox = document.getElementById("scoring-table-scroll");
                        const column = document.getElementById(`score-column-${index}`);
                        const stickyPlayerColumn =
                          scrollBox?.querySelector('[data-sticky-player="true"]') as
                            | HTMLElement
                            | null;

                        if (!scrollBox || !column) return;

                        const stickyWidth = stickyPlayerColumn?.offsetWidth ?? 0;
                        const visibleWidth = scrollBox.clientWidth - stickyWidth;
                        const centredPosition =
                          column.offsetLeft -
                          stickyWidth -
                          Math.max(0, (visibleWidth - column.offsetWidth) / 2);

                        scrollBox.scrollTo({
                          left: Math.max(0, centredPosition),
                          behavior: "smooth",
                        });
                      });
                    }}
                  >
                    {categoryLabel(category)}
                  </span>'''
assert old_name in page
page = page.replace(old_name, new_name, 1)

css_add = '''

.scoringTotalPointsText{
  display:inline-block;
  max-width:4.8em;
  white-space:normal;
  line-height:1.05;
}
'''
assert '.scoringTotalPointsText{' not in css
css = css.rstrip() + css_add

page_path.write_text(page)
css_path.write_text(css)
