from pathlib import Path

tag = "motion"
tag = "div"

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "index.html"
lines = p.read_text(encoding="utf-8").splitlines(keepends=True)

start = None
end = None
for i, line in enumerate(lines):
    if line.strip() == "<main>":
        start = i
    if start is not None and line.strip() == "</main>":
        end = i
        break

if start is None or end is None:
    raise SystemExit(f"main not found start={start} end={end}")

block = f"""  <main>
    <{tag} class="toolbar">
      <{tag}>
        <label for="mode">Mode</label>
        <select id="mode" aria-label="Mode de jeu">
          <option value="stage">Stage (5 slots)</option>
          <option value="abyss">Abyss (6 slots)</option>
        </select>
      </{tag}>
      <button type="button" class="secondary" id="reset">Réinitialiser le build</button>
      <button type="button" class="secondary" id="undo" disabled>Annuler dernière fusion</button>
      <{tag} class="toolbar-grow">
        <label>Passif auto</label>
        <p id="passiveHint" aria-live="polite"></p>
      </{tag}>
    </{tag}>
    <{tag} id="errors"></{tag}>
    <p id="assetBanner" class="hidden" role="status"></p>
    <{tag} class="grid" id="slots" aria-live="polite"></{tag}>

    <section>
      <h2>EVO actives</h2>
      <p class="hint">Une ligne par slot valide avec recette EVO. Les numéros (#) servent à consommer la bonne instance lors d'une fusion.</p>
      <{tag} id="evos" class="list"></{tag}>
    </section>

    <section>
      <h2>Mythiques obtenus</h2>
      <{tag} id="mythics" class="list"></{tag}>
    </section>

    <section>
      <h2>Fusions mythiques possibles</h2>
      <p class="hint">Clique « Fusionner » pour appliquer une recette (tu peux aussi ne rien faire et garder les deux EVO).</p>
      <{tag} id="fusions" class="list"></{tag}>
    </section>

    <section aria-labelledby="ref-evo-h">
      <h2 id="ref-evo-h">Référence — recettes EVO</h2>
      <p class="hint">Les 16 couples sort + passif qui produisent une évolution (même logique que les slots en tête de page).</p>
      <{tag} id="evoRecipesRef" class="ref-grid"></{tag}>
    </section>

    <section aria-labelledby="ref-myth-h">
      <h2 id="ref-myth-h">Référence — recettes mythiques</h2>
      <p class="hint">Les 16 fusions : deux EVO actives différentes (deux lignes « EVO actives » avec des # distincts) → mythique ; l'ordre des deux EVO est indifférent.</p>
      <{tag} id="mythicRecipesRef" class="ref-grid"></{tag}>
    </section>
  </main>
"""

out = "".join(lines[:start]) + block + "\n" + "".join(lines[end + 1 :])
p.write_text(out, encoding="utf-8")
print(f"replaced lines {start + 1}-{end + 1}")
