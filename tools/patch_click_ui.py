#!/usr/bin/env python3
"""Refonte UI : clic sur icônes, sans noms/numéros visibles."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "index.html"
t = p.read_text(encoding="utf-8")

# Supprimer catalogue caché
start = t.find('    <section hidden aria-hidden="true"')
if start >= 0:
    end = t.find("    </section>\n\n  </main>", start)
    if end >= 0:
        t = t[:start] + t[end + len("    </section>\n\n") :]

OLD_CATALOG_JS = """    function importNumFor(type, id) {
      const n = PNG_KEY_TO_IMPORT.get(`${type}-${id}.png`);
      return n != null ? String(n).padStart(2, "0") : "—";
    }

    function catalogCard(type, id, label) {
      const num = importNumFor(type, id);
      const ic = iconMarkup(type, id, 48, label);
      return `<motion class="catalog-card">
        ${ic}
        <span class="catalog-label">${escapeHtml(label)}</span>
        <span class="catalog-tags">
          <span class="tag mono">${escapeHtml(id)}</span>
          <span class="tag mono">#${num}</span>
        </span>
      </div>`;
    }

    function renderItemCatalog() {
      const passEl = document.getElementById("catalogPassives");
      const skillEl = document.getElementById("catalogSkills");
      const evoEl = document.getElementById("catalogEvos");
      const mythEl = document.getElementById("catalogMythics");
      if (!passEl || !skillEl || !evoEl || !mythEl) return;

      passEl.innerHTML = PASSIVES.map((p) => catalogCard("passive", p.id, p.label)).join("");
      skillEl.innerHTML = SKILLS.map((s) => catalogCard("skill", s.id, s.label)).join("");
      evoEl.innerHTML = EVO_RECIPES.map(([, , eid, elab]) => catalogCard("evo", eid, elab)).join("");
      mythEl.innerHTML = MYTHIC_RECIPES.map(([, , mid, mlab]) =>
        catalogCard("mythic", mid, mlab)
      ).join("");
    }

    function renderStaticRecipeCatalog() {
      const evoRefEl = document.getElementById("evoRecipesRef");
      const mythRefEl = document.getElementById("mythicRecipesRef");
      if (!evoRefEl || !mythRefEl) return;

      evoRefEl.innerHTML = EVO_RECIPES.map(([sid, pid, eid, elab]) => {
        const sl = skillLabel(sid);
        const pl = passiveLabel(pid);
        const is = iconMarkup("skill", sid, 32, sl);
        const ip = iconMarkup("passive", pid, 32, pl);
        const ie = iconMarkup("evo", eid, 32, elab);
        return `<div class="ref-row row-icon">${is}<span class="slot-arrow">+</span>${ip}<span class="slot-arrow">→</span>${ie}<span class="tag">${escapeHtml(elab)}</span><span class="tag mono">${escapeHtml(eid)}</span></div>`;
      }).join("");

      mythRefEl.innerHTML = MYTHIC_RECIPES.map(([eidA, eidB, mid, mlab]) => {
        const la = evoLabelById(eidA);
        const lb = evoLabelById(eidB);
        const ia = iconMarkup("evo", eidA, 32, la);
        const ib = iconMarkup("evo", eidB, 32, lb);
        const im = iconMarkup("mythic", mid, 32, mlab);
        return `<div class="ref-row row-icon fusion myth">${ia}<span class="slot-arrow">+</span>${ib}<span class="slot-arrow">→</span>${im}<span class="tag">${escapeHtml(mlab)}</span><span class="tag mono">${escapeHtml(mid)}</span></motion>`;
      }).join("");
    }

"""

# Fix catalogCard if div not motion in file
OLD_CATALOG_JS = OLD_CATALOG_JS.replace('`<motion class="catalog-card">', '`<div class="catalog-card">').replace(
    "      </motion>`;", "      </motion>`;"
)

# Use regex-free find for actual file content
marker = "    function importNumFor(type, id)"
end_marker = "    const modeEl = document.getElementById(\"mode\");"
i0 = t.find(marker)
i1 = t.find(end_marker)
if i0 >= 0 and i1 > i0:
    t = t[:i0] + """    const pickerSkillsEl = document.getElementById("pickerSkills");
    const pickerPassivesEl = document.getElementById("pickerPassives");

""" + t[i1:]
else:
    print("WARN: catalog JS block not found", i0, i1)

# Insert focus state after passiveHintTimer
needle = "    let passiveHintTimer = 0;\n"
insert = """    let passiveHintTimer = 0;
    let focusSlot = 0;
    /** @type {"skill"|"passive"} */
    let focusField = "skill";

"""
if needle in t and "let focusSlot" not in t:
    t = t.replace(needle, insert, 1)

# Replace renderSlots through renderFusions - use markers
rs_start = t.find("    function renderSlots() {")
rf_end = t.find("    function syncUndo() {")
if rs_start >= 0 and rf_end > rs_start:
    new_block = r'''    function skillUsedElsewhere(slotIndex, skillId) {
      return slots.some((sl, j) => j !== slotIndex && sl.skill === skillId);
    }

    function firstOpenSlot() {
      const n = slotCount();
      for (let i = 0; i < n; i++) {
        if (!slots[i].skill) return i;
      }
      return focusSlot;
    }

    function pickButton(type, id, label, disabled) {
      const ic = iconMarkup(type, id, 48, label);
      const dis = disabled ? " disabled" : "";
      return `<button type="button" class="icon-pick${disabled ? " is-used" : ""}" data-pick-type="${type}" data-pick-id="${escapeHtml(id)}"${dis} aria-label="${escapeHtml(label)}">${ic}</button>`;
    }

    function renderPickers() {
      if (!pickerSkillsEl || !pickerPassivesEl) return;
      const n = slotCount();
      pickerSkillsEl.innerHTML = SKILLS.map((s) => {
        let disabled = false;
        if (modeEl.value === "stage") {
          disabled = slots.some((sl, j) => j !== focusSlot && sl.skill === s.id);
        }
        return pickButton("skill", s.id, s.label, disabled);
      }).join("");
      pickerPassivesEl.innerHTML = PASSIVES.map((p) => {
        const disabled = slots.some((sl, j) => j !== focusSlot && sl.passive === p.id);
        return pickButton("passive", p.id, p.label, disabled);
      }).join("");
    }

    function bindPickerClicks() {
      if (!pickerSkillsEl || !pickerPassivesEl) return;
      pickerSkillsEl.onclick = (ev) => {
        const btn = ev.target.closest("[data-pick-type='skill']");
        if (!btn || btn.disabled) return;
        applySkill(btn.dataset.pickId);
      };
      pickerPassivesEl.onclick = (ev) => {
        const btn = ev.target.closest("[data-pick-type='passive']");
        if (!btn || btn.disabled) return;
        applyPassive(btn.dataset.pickId);
      };
    }

    function applySkill(skillId) {
      const i = focusField === "skill" ? focusSlot : firstOpenSlot();
      if (modeEl.value === "stage" && skillUsedElsewhere(i, skillId)) {
        showPassiveHint("Ce sort est déjà utilisé (mode Stage).");
        return;
      }
      slots[i].skill = skillId;
      const need = SKILL_TO_PASSIVE.get(skillId);
      if (need) {
        if (passiveUsedElsewhere(i, need)) {
          slots[i].passive = "";
          showPassiveHint("Passif partenaire déjà pris sur un autre emplacement.");
        } else {
          slots[i].passive = need;
        }
      }
      focusSlot = i;
      focusField = "passive";
      clearPassiveHint();
      resetFusionState();
      renderSlots();
      onUpdate();
    }

    function applyPassive(passiveId) {
      const i = focusSlot;
      if (passiveUsedElsewhere(i, passiveId)) {
        showPassiveHint("Ce passif est déjà utilisé.");
        return;
      }
      slots[i].passive = passiveId;
      focusField = "skill";
      const next = firstOpenSlot();
      if (next !== i && !slots[next].skill) focusSlot = next;
      clearPassiveHint();
      resetFusionState();
      renderSlots();
      onUpdate();
    }

    function clearSlotPart(i, part) {
      if (part === "skill") {
        slots[i].skill = "";
        slots[i].passive = "";
      } else {
        slots[i].passive = "";
      }
      resetFusionState();
      renderSlots();
      onUpdate();
    }

    function renderSlots() {
      ensureSlots();
      const n = slotCount();
      slotsEl.innerHTML = "";
      for (let i = 0; i < n; i++) {
        const box = document.createElement("div");
        box.className = "slot" + (i === focusSlot ? " is-active" : "");
        const { skill, passive } = slots[i];
        const evo = skill && passive ? EVO_MAP.get(`${skill}|${passive}`) : null;
        const skillLab = skillLabel(skill);
        const passLab = passive ? passiveLabel(passive) : "";

        const skillBtn = document.createElement("button");
        skillBtn.type = "button";
        skillBtn.className = "icon-box" + (skill ? "" : " empty") + (i === focusSlot && focusField === "skill" ? " is-focus" : "");
        skillBtn.innerHTML = iconMarkup("skill", skill, 44, skillLab);
        skillBtn.setAttribute("aria-label", skill ? `Sort : ${skillLab}` : "Choisir un sort");
        skillBtn.addEventListener("click", () => {
          focusSlot = i;
          focusField = "skill";
          renderSlots();
          renderPickers();
        });
        skillBtn.addEventListener("dblclick", (e) => {
          e.preventDefault();
          if (skill) clearSlotPart(i, "skill");
        });

        const passBtn = document.createElement("button");
        passBtn.type = "button";
        passBtn.className = "icon-box" + (passive ? "" : " empty") + (i === focusSlot && focusField === "passive" ? " is-focus" : "");
        passBtn.innerHTML = iconMarkup("passive", passive, 44, passLab);
        passBtn.setAttribute("aria-label", passive ? `Passif : ${passLab}` : "Choisir un passif");
        passBtn.addEventListener("click", () => {
          focusSlot = i;
          focusField = "passive";
          renderSlots();
          renderPickers();
        });
        passBtn.addEventListener("dblclick", (e) => {
          e.preventDefault();
          if (passive) clearSlotPart(i, "passive");
        });

        const evoBox = document.createElement("motion");
        evoBox.className = "icon-box" + (evo ? "" : " empty");
        evoBox.style.pointerEvents = "none";
        evoBox.innerHTML = evo ? iconMarkup("evo", evo.id, 44, evo.label) : iconMarkup("", "", 44, "");
        if (evo) evoBox.setAttribute("aria-label", `EVO : ${evo.label}`);

        const row = document.createElement("motion");
        row.className = "slot-icons";
        row.appendChild(skillBtn);
        const plus = document.createElement("span");
        plus.className = "slot-arrow";
        plus.textContent = "+";
        row.appendChild(plus);
        row.appendChild(passBtn);
        const arr = document.createElement("span");
        arr.className = "slot-arrow";
        arr.textContent = "→";
        row.appendChild(arr);
        row.appendChild(evoBox);
        box.appendChild(row);
        slotsEl.appendChild(box);
      }
    }

    function renderEvos() {
      const act = activeEvos();
      if (!act.length) {
        evosEl.innerHTML = "";
        return;
      }
      evosEl.innerHTML = act
        .map((e) => iconMarkup("evo", e.evoId, 44, e.label))
        .join("");
    }

    function renderMythics() {
      if (!mythics.length) {
        mythicsEl.innerHTML = "";
        return;
      }
      mythicsEl.innerHTML = mythics
        .map((m) => iconMarkup("mythic", m.mythicId, 44, m.label))
        .join("");
    }

    function renderFusions() {
      const opts = possibleFusions();
      fusionsEl.innerHTML = "";
      if (!opts.length) {
        return;
      }
      for (const o of opts) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "fusion myth row-icon fusion-pick";
        const il = iconMarkup("evo", o.left.evoId, 40, o.left.label);
        const ir = iconMarkup("evo", o.right.evoId, 40, o.right.label);
        const im = iconMarkup("mythic", o.mythicId, 40, o.mythicLabel);
        row.innerHTML = `${il}<span class="slot-arrow">+</span>${ir}<span class="slot-arrow">→</span>${im}`;
        row.setAttribute("aria-label", `Fusionner en ${o.mythicLabel}`);
        row.addEventListener("click", () => {
          consumedEvo.add(o.left.instanceId);
          consumedEvo.add(o.right.instanceId);
          const entry = {
            mythicId: o.mythicId,
            label: o.mythicLabel,
            leftId: o.left.instanceId,
            rightId: o.right.instanceId,
          };
          mythics.push(entry);
          mythicStack.push(entry);
          onUpdate();
        });
        fusionsEl.appendChild(row);
      }
    }

'''
    new_block = new_block.replace("motion", "motion")  # placeholder
    new_block = new_block.replace('document.createElement("motion")', 'document.createElement("div")')
    t = t[:rs_start] + new_block + t[rf_end:]

# onUpdate: add renderPickers
t = t.replace(
    "      renderFusions();\n      syncUndo();",
    "      renderFusions();\n      renderPickers();\n      syncUndo();",
)

# init
t = t.replace(
    "      renderStaticRecipeCatalog();\n      renderItemCatalog();\n      renderSlots();",
    "      bindPickerClicks();\n      renderSlots();",
)

# mode change
t = t.replace(
    "      renderSlots();\n      onUpdate();\n    });\n\n    document.getElementById(\"reset\")",
    "      focusSlot = 0;\n      focusField = \"skill\";\n      renderSlots();\n      onUpdate();\n    });\n\n    document.getElementById(\"reset\")",
)

t = t.replace(
    "      clearPassiveHint();\n      renderSlots();\n      onUpdate();\n    });\n\n    undoEl.addEventListener",
    "      focusSlot = 0;\n      focusField = \"skill\";\n      clearPassiveHint();\n      renderSlots();\n      onUpdate();\n    });\n\n    undoEl.addEventListener",
)

# Remove title on icon wrap for cleaner UI (optional - keep aria)
t = t.replace(' title="${t}"', "")

p.write_text(t, encoding="utf-8")
print("patched", p)
