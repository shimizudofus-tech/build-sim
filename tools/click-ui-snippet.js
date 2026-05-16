    function skillUsedElsewhere(slotIndex, skillId) {
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
      return `<button type="button" class="icon-pick${disabled ? " is-used" : ""}" data-pick-type="${type}" data-pick-id="${id}"${dis} aria-label="${escapeHtml(label)}">${ic}</button>`;
    }

    function renderPickers() {
      if (!pickerSkillsEl || !pickerPassivesEl) return;
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
          showPassiveHint("Passif partenaire déjà pris ailleurs.");
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
        const skLab = skillLabel(skill);
        const paLab = passive ? passiveLabel(passive) : "";

        const skillBtn = document.createElement("button");
        skillBtn.type = "button";
        skillBtn.className =
          "icon-box" +
          (skill ? "" : " empty") +
          (i === focusSlot && focusField === "skill" ? " is-focus" : "");
        skillBtn.innerHTML = iconMarkup("skill", skill, 44, skLab);
        skillBtn.setAttribute("aria-label", skill ? skLab : "Sort");
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
        passBtn.className =
          "icon-box" +
          (passive ? "" : " empty") +
          (i === focusSlot && focusField === "passive" ? " is-focus" : "");
        passBtn.innerHTML = iconMarkup("passive", passive, 44, paLab);
        passBtn.setAttribute("aria-label", passive ? paLab : "Passif");
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

        const evoBox = document.createElement("div");
        evoBox.className = "icon-box" + (evo ? "" : " empty");
        evoBox.style.pointerEvents = "none";
        evoBox.innerHTML = evo
          ? iconMarkup("evo", evo.id, 44, evo.label)
          : iconMarkup("", "", 44, "");
        if (evo) evoBox.setAttribute("aria-label", evo.label);

        const row = document.createElement("div");
        row.className = "slot-icons";
        row.appendChild(skillBtn);
        const plus = document.createElement("span");
        plus.className = "slot-arrow";
        plus.textContent = "+";
        row.appendChild(plus);
        row.appendChild(passBtn);
        const arr = document.createElement("span");
        arr.className = "slot-arrow";
        arr.textContent = "\u2192";
        row.appendChild(arr);
        row.appendChild(evoBox);
        box.appendChild(row);
        slotsEl.appendChild(box);
      }
    }

    function renderEvos() {
      const act = activeEvos();
      evosEl.innerHTML = act.length
        ? act.map((e) => iconMarkup("evo", e.evoId, 44, e.label)).join("")
        : "";
    }

    function renderMythics() {
      mythicsEl.innerHTML = mythics.length
        ? mythics.map((m) => iconMarkup("mythic", m.mythicId, 44, m.label)).join("")
        : "";
    }

    function renderFusions() {
      const opts = possibleFusions();
      fusionsEl.innerHTML = "";
      for (const o of opts) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "fusion myth row-icon fusion-pick";
        const il = iconMarkup("evo", o.left.evoId, 40, o.left.label);
        const ir = iconMarkup("evo", o.right.evoId, 40, o.right.label);
        const im = iconMarkup("mythic", o.mythicId, 40, o.mythicLabel);
        row.innerHTML = `${il}<span class="slot-arrow">+</span>${ir}<span class="slot-arrow">\u2192</span>${im}`;
        row.setAttribute("aria-label", o.mythicLabel);
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
