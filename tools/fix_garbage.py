#!/usr/bin/env python3
import re
from pathlib import Path

INDEX = Path(__file__).resolve().parents[1] / "index.html"
text = INDEX.read_text(encoding="utf-8")
pattern = r"        ___REMOVE_START___\s*\n\s*<(?:div|motion) class=\"icon-box.*?\n\s*const active = i === focusSlot;"
replacement = "        const active = i === focusSlot;"
new_text, n = re.subn(pattern, replacement, text, count=1, flags=re.DOTALL)
if n == 0:
    pattern2 = r"        ___REMOVE_START___.*?const active = i === focusSlot;"
    new_text, n = re.subn(pattern2, replacement, text, count=1, flags=re.DOTALL)
else:
    new_text = new_text
INDEX.write_text(new_text, encoding="utf-8")
print("fixed", n, "occurrences", INDEX)
