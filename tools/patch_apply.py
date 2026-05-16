#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
html_path = ROOT / "index.html"
snippet_path = Path(__file__).resolve().parent / "click-ui-snippet.js"
out_log = ROOT / "patch-done.txt"

html = html_path.read_text(encoding="utf-8")
snippet = snippet_path.read_text(encoding="utf-8")

s = html.find('<section hidden aria-hidden="true"')
if s >= 0:
    e = html.find("</section>", s)
    if e >= 0:
        html = html[:s] + html[e + len("</section>") :].lstrip("\n")

start = html.find("    function catalogCard_REMOVED")
end = html.find('    const modeEl = document.getElementById("mode");')
if start >= 0 and end > start:
    insert = """    const pickerSkillsEl = document.getElementById("pickerSkills");
    const pickerPassivesEl = document.getElementById("pickerPassives");

"""
    html = html[:start] + insert + html[end:]

a = html.find("    function renderSlots() {")
b = html.find("    function syncUndo() {")
if a < 0 or b <= a:
    out_log.write_text(f"FAIL renderSlots a={a} b={b}", encoding="utf-8")
    raise SystemExit(1)

html = html[:a] + snippet + html[b:]

html = html.replace(
    "      renderFusions();\n      syncUndo();",
    "      renderFusions();\n      renderPickers();\n      syncUndo();",
)
html = html.replace(
    "      renderStaticRecipeCatalog();\n      renderItemCatalog();\n      renderSlots();",
    "      bindPickerClicks();\n      renderSlots();",
)
html = html.replace(
    '      clearPassiveHint();\n      renderSlots();\n      onUpdate();\n    });\n\n    undoEl.addEventListener',
    '      focusSlot = 0;\n      focusField = "skill";\n      clearPassiveHint();\n      renderSlots();\n      onUpdate();\n    });\n\n    undoEl.addEventListener',
)
if "focusSlot = 0" not in html.split("modeEl.addEventListener")[1].split("document.getElementById(\"reset\")")[0]:
    html = html.replace(
        "      ensureSlots();\n      renderSlots();\n      onUpdate();\n    });\n\n    document.getElementById(\"reset\")",
        '      focusSlot = 0;\n      focusField = "skill";\n      ensureSlots();\n      renderSlots();\n      onUpdate();\n    });\n\n    document.getElementById("reset")',
    )

html_path.write_text(html, encoding="utf-8")
out_log.write_text("ok", encoding="utf-8")
print("ok")
