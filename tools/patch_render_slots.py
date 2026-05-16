#!/usr/bin/env python3
"""Replace renderSlots() with two-column build layout."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"

NEW_FN = r'''    function renderSlots() {
      if (!slotSkillsEl || !slotPassivesEl) return;
      ensureSlots();
      const n = slotCount();
      slotSkillsEl.innerHTML = "";
      slotPassivesEl.innerHTML = "";

      for (let i = 0; i < n; i++) {
        const { skill, passive } = slots[i];
        const evo = evoPreviewForSkill(skill);
        const active = i === focusSlot;

        const skillCell = document.createElement("div");
        skillCell.className =
          "build-cell" +
          (active ? " is-active" : "") +
          (active && focusField === "skill" ? " is-focus" : "");
        const skLab = skillLabel(skill);
        const skillBtn = document.createElement("button");
        skillBtn.type = "button";
        skillBtn.className = "icon-box" + (skill ? "" : " empty");
        skillBtn.innerHTML = iconMarkup("skill", skill, 48, skLab);
        skillBtn.setAttribute("aria-label", skill ? skLab : `Sort emplacement ${i + 1}`);
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
        skillCell.appendChild(skillBtn);
        if (evo) {
          const evoWrap = document.createElement("div");
          evoWrap.className = "build-cell-evo";
          evoWrap.innerHTML = iconMarkup("evo", evo.id, 44, evo.label);
          skillCell.appendChild(evoWrap);
        }
        slotSkillsEl.appendChild(skillCell);

        const passCell = document.createElement("div");
        passCell.className =
          "build-cell" +
          (active ? " is-active" : "") +
          (active && focusField === "passive" ? " is-focus" : "");
        const paLab = passive ? passiveLabel(passive) : "";
        const passBtn = document.createElement("button");
        passBtn.type = "button";
        passBtn.className = "icon-box" + (passive ? "" : " empty");
        passBtn.innerHTML = iconMarkup("passive", passive, 48, paLab);
        passBtn.setAttribute("aria-label", passive ? paLab : `Passif emplacement ${i + 1}`);
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
        passCell.appendChild(passBtn);
        slotPassivesEl.appendChild(passCell);
      }
    }

'''

def main() -> None:
    text = INDEX.read_text(encoding="utf-8")
    start = text.index("    function renderSlots() {")
    end = text.index("    function renderEvos() {")
    updated = text[:start] + NEW_FN + text[end:]
    INDEX.write_text(updated, encoding="utf-8", newline="\n")
    print("patched renderSlots:", INDEX)


if __name__ == "__main__":
    main()
