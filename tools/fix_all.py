from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
index = ROOT / "index.html"
tail = Path(__file__).resolve().parent / "_main_tail.html"

v = "di" + "v"

def fix_tags(s: str) -> str:
    return s.replace("</motion>", f"</{v}>").replace("<motion ", f"<{v} ")


text = index.read_text(encoding="utf-8")
snippet = fix_tags(tail.read_text(encoding="utf-8"))

bad = f'<motion id="errors"></motion>\n  <footer>'
bad2 = f'<{v} id="errors"></{v}>\n  <footer>'
if bad in text:
    text = text.replace(bad, snippet, 1)
elif bad2 in text:
    text = text.replace(bad2, snippet, 1)
else:
    raise SystemExit("errors/footer marker not found")

index.write_text(text, encoding="utf-8")
print("index.html restored")
