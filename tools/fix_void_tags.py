from pathlib import Path

d = "di" + "v"
p = Path(__file__).resolve().parents[1] / "index.html"
t = p.read_text(encoding="utf-8")
t = t.replace("<motion class=\"grid\"", f"<{d} class=\"grid\"")
t = t.replace('aria-live="polite"></motion>', f'aria-live="polite"></{d}>', 1)
t = t.replace('class="list" />', f'class="list"></{d}>')
t = t.replace('class="ref-grid" />', f'class="ref-grid"></{d}>')
p.write_text(t, encoding="utf-8")
print("fixed void tags")
