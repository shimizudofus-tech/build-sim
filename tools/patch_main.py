from pathlib import Path

t = "di" + "v"
p = Path(__file__).resolve().parents[1] / "index.html"
text = p.read_text(encoding="utf-8")

old = (
    '      <p class="hint">Clique \u00ab Fusionner \u00bb pour appliquer une recette '
    "(tu peux aussi ne rien faire et garder les deux EVO).</p>\n"
    f'      <{t} id="fusions" class="list"></{t}>\n'
    "    </section>"
)

new = (
    f"    </{t}>\n"
    f'    <{t} id="errors"></{t}>\n'
    '    <p id="assetBanner" class="hidden" role="status"></p>\n'
    f'    <{t} class="grid" id="slots" aria-live="polite"></{t}>\n'
    "\n"
    "    <section>\n"
    "      <h2>EVO actives</h2>\n"
    "      <p class=\"hint\">Une ligne par slot valide avec recette EVO. Les num\u00e9ros (#) servent \u00e0 consommer la bonne instance lors d'une fusion.</p>\n"
    f'      <{t} id="evos" class="list"></{t}>\n'
    "    </section>\n"
    "\n"
    "    <section>\n"
    "      <h2>Mythiques obtenus</h2>\n"
    f'      <{t} id="mythics" class="list"></{t}>\n'
    "    </section>\n"
    "\n"
    "    <section>\n"
    "      <h2>Fusions mythiques possibles</h2>\n"
    '      <p class="hint">Clique \u00ab Fusionner \u00bb pour appliquer une recette '
    "(tu peux aussi ne rien faire et garder les deux EVO).</p>\n"
    f'      <{t} id="fusions" class="list"></{t}>\n'
    "    </section>"
)

if old not in text:
    raise SystemExit("block not found")

p.write_text(text.replace(old, new, 1), encoding="utf-8")
print("patched OK")
