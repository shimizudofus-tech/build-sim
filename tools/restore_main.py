from pathlib import Path

v = "di" + "v"
p = Path(__file__).resolve().parents[1] / "index.html"
text = p.read_text(encoding="utf-8")

marker = '    <motion id="errors"></motion>\n  <footer>'
if marker not in text:
    marker2 = "errors"
    idx = text.find("errors")
    raise SystemExit(f"marker not found; idx={idx} snippet={text[idx-30:idx+80]!r}")

insert = f"""    <{v} id="errors"></{v}>
    <p id="assetBanner" class="hidden" role="status"></p>
    <{v} class="grid" id="slots" aria-live="polite"></{v}>

    <section>
      <h2>EVO actives</h2>
      <p class="hint">Une ligne par slot valide avec recette EVO. Les num\u00e9ros (#) servent \u00e0 consommer la bonne instance lors d'une fusion.</p>
      <{v} id="evos" class="list"></{v}>
    </section>

    <section>
      <h2>Mythiques obtenus</h2>
      <{v} id="mythics" class="list"></{v}>
    </section>

    <section>
      <h2>Fusions mythiques possibles</h2>
      <p class="hint">Clique \u00ab Fusionner \u00bb pour appliquer une recette (tu peux aussi ne rien faire et garder les deux EVO).</p>
      <{v} id="fusions" class="list"></{v}>
    </section>

    <section aria-labelledby="ref-evo-h">
      <h2 id="ref-evo-h">R\u00e9f\u00e9rence \u2014 recettes EVO</h2>
      <p class="hint">Les 16 couples sort + passif qui produisent une \u00e9volution (m\u00eame logique que les slots en t\u00eate de page).</p>
      <{v} id="evoRecipesRef" class="ref-grid"></{v}>
    </section>

    <section aria-labelledby="ref-myth-h">
      <h2 id="ref-myth-h">R\u00e9f\u00e9rence \u2014 recettes mythiques</h2>
      <p class="hint">Les 16 fusions : deux EVO actives diff\u00e9rentes (deux lignes \u00ab EVO actives \u00bb avec des # distincts) \u2192 mythique ; l\u2019ordre des deux EVO est indiff\u00e9rent.</p>
      <{v} id="mythicRecipesRef" class="ref-grid"></{v}>
    </section>
  </main>
  <footer>"""

text = text.replace(marker, insert, 1)
p.write_text(text, encoding="utf-8")
print("restored main OK")
