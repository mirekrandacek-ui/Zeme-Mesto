from pathlib import Path

path = Path('app/src/app/page.tsx')
text = path.read_text(encoding='utf-8')
old = '{status && <p className={styles.status} role="status">{status}</p>}'
new = '{status && status !== getRoomUiText(language, "freeLimitReachedMessage") && (\n          <p className={styles.status} role="status">{status}</p>\n        )}'
if old not in text:
    raise SystemExit('Expected homepage status render not found')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
