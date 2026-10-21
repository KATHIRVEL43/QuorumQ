/**
 * HBB Vault - Frontend Controller & Strict State Machine (Projector Edition)
 * Fully offline, zero CDN dependencies.
 * Interacts with FastAPI backend at 127.0.0.1.
 */

(function initHBBVault() {
  // Application State
  let activeStep = 1;
  let maxUnlockedStep = 1;
  let eveActive = false;
  let autoPlayActive = false;
  let autoPlayTimer = null;

  // Browser-retained plaintext for Step 09 verification (server clears it upon encryption)
  let browserPlaintext = "CAT123";
  let activeBases = { alice: "X", bob: "Y", charlie: "Y" };
  let lastDecryptedText = "";
  let lastCiphertextBits = "";
  let lastKeyA = "";
  let lastKeyB = "";
  let lastKeyC = "";
  let lastEveOffData = null;
  let lastEveOnData = null;

  // DOM Elements - Header & Global
  const themeToggle = document.getElementById("theme-toggle");
  const themeIconSun = document.getElementById("theme-icon-sun");
  const themeIconMoon = document.getElementById("theme-icon-moon");
  const eveSwitch = document.getElementById("eve-switch");
  const autoplaySwitch = document.getElementById("autoplay-switch");
  const btnHeaderReset = document.getElementById("btn-header-reset");
  const telemDot = document.getElementById("telem-dot");
  const telemCoherence = document.getElementById("telem-coherence");
  const pipelineStatus = document.getElementById("pipeline-status");
  const headerQber = document.getElementById("header-qber");

  // Step 01
  const secretInput = document.getElementById("secret-input");
  const btnEncode = document.getElementById("btn-encode");
  const charCountLabel = document.getElementById("char-count-label");
  const asciiStreamGrid = document.getElementById("ascii-stream-grid");
  const arrow01 = document.getElementById("arrow-01");

  // Step 02
  const btnMeasure = document.getElementById("btn-measure");
  const btnRandomBases = document.getElementById("btn-random-bases");
  const btnCombineScroll = document.getElementById("btn-combine-scroll");
  const statRounds = document.getElementById("stat-rounds");
  const statUsable = document.getElementById("stat-usable");
  const statRule = document.getElementById("stat-rule");
  const roundsLog = document.getElementById("rounds-log");
  const arrow02 = document.getElementById("arrow-02");

  // Step 03
  const currentRoundIndicator = document.getElementById("current-round-indicator");
  const firstRoundBasisTag = document.getElementById("first-round-basis-tag");
  const roundValidityBadge = document.getElementById("round-validity-badge");
  const aliceRoundBasis = document.getElementById("alice-round-basis");
  const bobRoundBasis = document.getElementById("bob-round-basis");
  const charlieRoundBasis = document.getElementById("charlie-round-basis");
  const aliceFirstBit = document.getElementById("alice-first-bit");
  const bobFirstBit = document.getElementById("bob-first-bit");
  const charlieFirstBit = document.getElementById("charlie-first-bit");
  const parityFormula = document.getElementById("parity-formula");
  const parityResult = document.getElementById("parity-result");
  const arrow03 = document.getElementById("arrow-03");

  // Step 04
  const aliceKeyStream = document.getElementById("alice-key-stream");
  const bobShareStream = document.getElementById("bob-share-stream");
  const charlieShareStream = document.getElementById("charlie-share-stream");
  const arrow04 = document.getElementById("arrow-04");

  // Step 05: Security Donut
  const sampledRoundsCount = document.getElementById("sampled-rounds-count");
  const donutGreen = document.getElementById("donut-green");
  const donutRed = document.getElementById("donut-red");
  const donutQberVal = document.getElementById("donut-qber-val");
  const sampleDotsRow = document.getElementById("sample-dots-row");
  const dotStripLegend = document.getElementById("dot-strip-legend");
  const companionEveOffPct = document.getElementById("companion-eve-off-pct");
  const companionEveOffNote = document.getElementById("companion-eve-off-note");
  const miniDonutEveOff = document.getElementById("mini-donut-eve-off");
  const companionEveOnPct = document.getElementById("companion-eve-on-pct");
  const companionEveOnNote = document.getElementById("companion-eve-on-note");
  const miniDonutEveOnGreen = document.getElementById("mini-donut-eve-on-green");
  const miniDonutEveOnRed = document.getElementById("mini-donut-eve-on-red");
  const bigSecurityStatus = document.getElementById("big-security-status");
  const attackActionWrap = document.getElementById("attack-action-wrap");
  const btnRerunBatch = document.getElementById("btn-rerun-batch");
  const btnAttackReset = document.getElementById("btn-attack-reset");
  const arrow05 = document.getElementById("arrow-05");

  // Step 06
  const encP = document.getElementById("enc-p");
  const encA = document.getElementById("enc-a");
  const encC = document.getElementById("enc-c");
  const btnEncryptAction = document.getElementById("btn-encrypt-action");
  const arrow06 = document.getElementById("arrow-06");

  // Step 07
  const combB = document.getElementById("comb-b");
  const combC = document.getElementById("comb-c");
  const combRes = document.getElementById("comb-res");
  const btnBobAlone = document.getElementById("btn-bob-alone");
  const btnCharlieAlone = document.getElementById("btn-charlie-alone");
  const bobSoloState = document.getElementById("bob-solo-state");
  const charlieSoloState = document.getElementById("charlie-solo-state");
  const arrow07 = document.getElementById("arrow-07");

  // Step 08
  const decC = document.getElementById("dec-c");
  const decKey = document.getElementById("dec-key");
  const decP = document.getElementById("dec-p");
  const btnDecryptAction = document.getElementById("btn-decrypt-action");
  const arrow08 = document.getElementById("arrow-08");

  // Step 09
  const finalResultString = document.getElementById("final-result-string");
  const resultStatusTag = document.getElementById("result-status-tag");
  const finalLatency = document.getElementById("final-latency");
  const btnNewMessage = document.getElementById("btn-new-message");

  // Helper: group bit string in bytes
  function groupBits(bits) {
    if (!bits) return "";
    return bits.match(/.{1,8}/g).join(" ");
  }

  // --- THEME TOGGLE (Requirement 3) ---
  function applyTheme(theme) {
    if (theme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
      themeIconSun.style.display = "none";
      themeIconMoon.style.display = "inline";
    } else {
      document.documentElement.removeAttribute("data-theme");
      themeIconSun.style.display = "inline";
      themeIconMoon.style.display = "none";
    }
    try {
      localStorage.setItem("hbb_theme", theme);
    } catch (e) {
      // ignore
    }
  }

  function initTheme() {
    const urlParams = new URLSearchParams(window.location.search);
    const themeParam = urlParams.get("theme");
    if (themeParam === "light" || themeParam === "dark") {
      applyTheme(themeParam);
      return;
    }

    let saved = null;
    try {
      saved = localStorage.getItem("hbb_theme");
    } catch (e) {}

    if (saved === "light" || saved === "dark") {
      applyTheme(saved);
    } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
      applyTheme("light");
    } else {
      applyTheme("dark");
    }
  }

  themeToggle.addEventListener("click", () => {
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    applyTheme(isLight ? "dark" : "light");
  });

  initTheme();

  // --- FOCUS MODE & STATE MACHINE (Requirement 6) ---
  function setFocusStep(stepNum) {
    activeStep = parseInt(stepNum, 10);
    const sections = document.querySelectorAll(".step-section");

    sections.forEach((sec) => {
      const id = parseInt(sec.getAttribute("data-step-id"), 10);
      if (id === activeStep) {
        sec.classList.remove("step-inactive");
        sec.classList.add("step-active");
      } else {
        sec.classList.remove("step-active");
        sec.classList.add("step-inactive");
      }
    });

    // Update Left Nav
    document.querySelectorAll(".step-nav-item, .rail-item").forEach((item) => {
      const itemStep = parseInt(item.getAttribute("data-step"), 10);
      item.classList.remove("active");
      if (itemStep === activeStep) {
        item.classList.add("active");
      }
      if (itemStep <= maxUnlockedStep) {
        item.classList.remove("locked");
        if (itemStep < activeStep) item.classList.add("completed");
      } else {
        item.classList.add("locked");
      }
    });
  }

  function unlockStep(stepNum) {
    if (stepNum > maxUnlockedStep) {
      maxUnlockedStep = stepNum;
    }
    const section = document.getElementById(`step-0${stepNum}`);
    if (section) {
      section.classList.remove("step-locked");
    }
    const navItem = document.getElementById(`nav-0${stepNum}`);
    if (navItem) {
      navItem.classList.remove("locked");
    }
  }

  function goToStep(stepNum) {
    if (stepNum > maxUnlockedStep) return;
    setFocusStep(stepNum);
    const targetEl = document.getElementById(`step-0${stepNum}`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function scheduleNext(actionFn) {
    if (autoPlayActive) {
      clearTimeout(autoPlayTimer);
      autoPlayTimer = setTimeout(() => {
        actionFn();
      }, 1500);
    }
  }

  // --- STEP 01: ENCODE ---
  async function performEncode(advanceToNext = true) {
    const text = secretInput.value.trim() || "CAT123";
    browserPlaintext = text;

    try {
      const resp = await fetch("/api/encode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        alert("Encoding error: " + (err.detail || "Invalid input"));
        return;
      }
      const data = await resp.json();

      charCountLabel.textContent = `${data.char_count} Chars · ${data.bit_len} Bits`;
      asciiStreamGrid.innerHTML = "";
      data.breakdown.forEach((item) => {
        const chip = document.createElement("div");
        chip.className = "char-chip";
        chip.innerHTML = `<span class="char-chip-name">${item.char}:</span><span class="char-chip-bits">${item.bits}</span>`;
        asciiStreamGrid.appendChild(chip);
      });

      encP.textContent = groupBits(data.bits);

      unlockStep(2);
      if (arrow01) arrow01.classList.add("pulsing");
      pipelineStatus.textContent = "Encoded";

      if (advanceToNext) {
        goToStep(2);
      }

      scheduleNext(() => {
        goToStep(2);
        performBatchRun();
      });
    } catch (e) {
      console.error(e);
      alert("Failed to communicate with server.");
    }
  }

  // --- STEP 02 & 03: SINGLE PRACTICE MEASUREMENT ---
  async function performSingleMeasure() {
    try {
      const resp = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manual_mode: true,
          alice_basis: activeBases.alice,
          bob_basis: activeBases.bob,
          charlie_basis: activeBases.charlie,
          eve_on: eveActive,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        alert(err.detail);
        return;
      }
      const data = await resp.json();

      // Populate Step 03 fields
      currentRoundIndicator.textContent = data.round_id;
      firstRoundBasisTag.textContent = `Basis Combination: ${data.comb}`;
      aliceRoundBasis.textContent = `Basis ${data.bases.alice}`;
      bobRoundBasis.textContent = `Basis ${data.bases.bob}`;
      charlieRoundBasis.textContent = `Basis ${data.bases.charlie}`;
      aliceFirstBit.textContent = data.bits.alice;
      bobFirstBit.textContent = data.bits.bob;
      charlieFirstBit.textContent = data.bits.charlie;

      if (data.valid) {
        roundValidityBadge.textContent = "Rule held";
        roundValidityBadge.style.color = "var(--accent-green)";
        roundValidityBadge.style.borderColor = "var(--accent-green-border)";
        parityFormula.textContent = `a₁ ⊕ b₁ ⊕ c₁ = ${data.actual_parity}`;

        if (data.rule_held) {
          parityResult.textContent = "CORRELATED · KEPT";
          parityResult.style.color = "var(--accent-green)";
        } else {
          parityResult.textContent = "DISTURBED (EVE INTERCEPT)";
          parityResult.style.color = "var(--accent-red)";
        }
      } else {
        roundValidityBadge.textContent = "Non-Commuting";
        roundValidityBadge.style.color = "var(--text-secondary)";
        roundValidityBadge.style.borderColor = "var(--border-default)";
        parityFormula.textContent = `Non-commuting measurement bases`;
        parityResult.textContent = "Incoherent · Sifted Out";
        parityResult.style.color = "var(--text-secondary)";
      }

      unlockStep(3);
      arrow02.classList.add("pulsing");
      goToStep(3);

      unlockStep(4);
      arrow03.classList.add("pulsing");
    } catch (e) {
      console.error(e);
    }
  }

  // --- STEP 02: FULL BATCH RUN ---
  async function performBatchRun() {
    btnRandomBases.disabled = true;
    btnRandomBases.innerHTML = "<span>Simulating Qiskit Aer...</span>";

    const startTime = performance.now();
    try {
      const resp = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manual_mode: false,
          eve_on: eveActive,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        alert(err.detail);
        return;
      }
      const data = await resp.json();
      const elapsed = (performance.now() - startTime).toFixed(1);
      finalLatency.textContent = `Latency: ${elapsed}ms`;

      // Update Step 02 Stats (Rule held)
      statRounds.textContent = data.total_rounds;
      const pct = ((data.kept_count / data.total_rounds) * 100).toFixed(1);
      statUsable.innerHTML = `${data.kept_count} <span style="font-size: 13px; color: var(--text-label); font-weight: normal;">(${pct}%)</span>`;
      statRule.textContent = data.kept_count;

      // Audit Log
      roundsLog.innerHTML = "";
      data.rounds_sample.slice(-10).reverse().forEach((r) => {
        const card = document.createElement("div");
        card.className = `audit-card ${r.valid ? "kept" : "discarded"}`;
        card.innerHTML = `
          <span style="color: var(--text-secondary);">#${r.round_id}</span>
          <span style="font-weight: 700; ${r.valid ? "color: var(--text-heading);" : "color: var(--text-muted); text-decoration: line-through;"}">${r.comb}</span>
          <span class="${r.valid ? "badge-kept" : "badge-disc"}">${r.valid ? "KEPT" : "DISC"}</span>
        `;
        roundsLog.appendChild(card);
      });

      // Update Step 03 First Bits with the last kept round
      if (data.rounds_sample.length > 0) {
        const lastR = data.rounds_sample[data.rounds_sample.length - 1];
        currentRoundIndicator.textContent = lastR.round_id;
        firstRoundBasisTag.textContent = `Basis Combination: ${lastR.comb}`;
        roundValidityBadge.textContent = lastR.valid ? "Rule held" : "Non-Commuting";
        aliceRoundBasis.textContent = `Basis ${lastR.bases.alice}`;
        bobRoundBasis.textContent = `Basis ${lastR.bases.bob}`;
        charlieRoundBasis.textContent = `Basis ${lastR.bases.charlie}`;
        aliceFirstBit.textContent = lastR.a_bit;
        bobFirstBit.textContent = lastR.b_bit;
        charlieFirstBit.textContent = lastR.c_bit;
        parityFormula.textContent = `a₁ ⊕ b₁ ⊕ c₁ = ${lastR.actual_parity}`;
        parityResult.textContent = lastR.rule_held ? "CORRELATED · KEPT" : "DISTURBED";
      }

      // Populate Step 04 Streams
      aliceKeyStream.textContent = groupBits(data.raw_key_A);
      bobShareStream.textContent = groupBits(data.raw_key_B);
      charlieShareStream.textContent = groupBits(data.raw_key_C);

      // Unlock Steps 03, 04, 05
      unlockStep(3);
      if (arrow02) arrow02.classList.add("pulsing");
      unlockStep(4);
      if (arrow03) arrow03.classList.add("pulsing");
      unlockStep(5);
      if (arrow04) arrow04.classList.add("pulsing");

      pipelineStatus.textContent = "Batch Sifted";

      if (!autoPlayActive) {
        await performSecurityCheck();
        goToStep(5);
      } else {
        scheduleNext(() => {
          goToStep(4);
          scheduleNext(() => {
            goToStep(5);
            performSecurityCheck();
          });
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      btnRandomBases.disabled = false;
      btnRandomBases.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>
        <span>Auto-Generate Bases</span>
      `;
    }
  }

  // --- STEP 05: SECURITY CHECK & DONUT CHART (Requirement 1) ---
  function applySecurityCheckData(data, animateDots = true) {
    sampledRoundsCount.textContent = `${data.sample_size || (data.sampled_rounds ? data.sampled_rounds.length : 0)} rounds`;

    const circ = 2 * Math.PI * 50; // ~314.159
    const errorRate = data.error_rate !== undefined ? data.error_rate : (data.measured_qber || 0.0);
    const isAttack = data.attack_detected;

    // Exact requirement: Eve OFF must display exactly 0.0%
    const qberDisplay = (!eveActive && errorRate === 0) ? "0.0%" : `${(data.qber_percent !== undefined ? data.qber_percent : errorRate * 100).toFixed(1)}%`;
    donutQberVal.textContent = qberDisplay;
    headerQber.textContent = qberDisplay;

    const secureActionWrap = document.getElementById("secure-action-wrap");
    if (!isAttack) {
      // Clean channel / Secure
      donutQberVal.classList.remove("danger");
      headerQber.style.color = "var(--accent-green)";

      // Full green circle, no red
      donutGreen.setAttribute("stroke-dasharray", `${circ}`);
      donutGreen.setAttribute("stroke-dashoffset", "0");
      donutRed.setAttribute("stroke-dasharray", `${circ}`);
      donutRed.setAttribute("stroke-dashoffset", `${circ}`);

      bigSecurityStatus.className = "security-status-line secure";
      bigSecurityStatus.innerHTML = `<span>Secure, no eavesdropper</span>`;
      if (secureActionWrap) secureActionWrap.style.display = "flex";
      attackActionWrap.style.display = "none";
      if (arrow05) arrow05.style.display = "none";

      pipelineStatus.textContent = "Verified";
      pipelineStatus.style.color = "var(--accent-green)";
      telemDot.className = "telem-dot";
      telemCoherence.textContent = "COHERENCE 100%";

      unlockStep(6);
    } else {
      // Attack detected
      donutQberVal.classList.add("danger");
      headerQber.style.color = "var(--accent-red)";

      const redOffset = circ * (1 - errorRate);
      donutGreen.setAttribute("stroke-dasharray", `${circ}`);
      donutGreen.setAttribute("stroke-dashoffset", `${circ * errorRate}`);
      donutRed.setAttribute("stroke-dasharray", `${circ}`);
      donutRed.setAttribute("stroke-dashoffset", `${redOffset}`);

      bigSecurityStatus.className = "security-status-line attack";
      bigSecurityStatus.innerHTML = `<span>Attack detected, key discarded</span>`;
      if (secureActionWrap) secureActionWrap.style.display = "none";
      attackActionWrap.style.display = "flex";
      if (arrow05) arrow05.style.display = "none";

      pipelineStatus.textContent = "Compromised";
      pipelineStatus.style.color = "var(--accent-red)";
      telemDot.className = "telem-dot eve-active";
      telemCoherence.textContent = "COHERENCE 41.2%";

      // Lock steps 06 to 09 on attack
      for (let s = 6; s <= 9; s++) {
        const sec = document.getElementById(`step-0${s}`);
        if (sec) sec.classList.add("step-locked");
        const nav = document.getElementById(`nav-0${s}`);
        if (nav) nav.classList.add("locked");
      }
      maxUnlockedStep = 5;
    }

    // Render dots strip
    if (data.sampled_rounds && data.sampled_rounds.length > 0) {
      renderDotsStrip(data.sampled_rounds, data.matched_count, data.mismatched_count, animateDots);
    }

    // Update Companion Donuts
    updateCompanionDonuts(data.last_eve_off_run, data.last_eve_on_run);
  }

  async function performSecurityCheck() {
    try {
      const resp = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!resp.ok) {
        const err = await resp.json();
        alert(err.detail);
        return;
      }
      const data = await resp.json();
      applySecurityCheckData(data, true);

      if (!data.attack_detected) {
        scheduleNext(() => {
          goToStep(6);
          performEncrypt();
        });
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Render Sample Dots Strip
  function renderDotsStrip(sampledRounds, matchedCount, mismatchedCount, animate = true) {
    sampleDotsRow.innerHTML = "";
    dotStripLegend.textContent = `${matchedCount} / ${sampledRounds.length} Matched` + (mismatchedCount > 0 ? ` (${mismatchedCount} Errors)` : "");
    dotStripLegend.style.color = mismatchedCount > 0 ? "var(--accent-red)" : "var(--accent-green)";

    sampledRounds.forEach((sr, idx) => {
      const dot = document.createElement("span");
      dot.className = `sample-dot ${sr.match ? 'match' : 'mismatch'}`;
      dot.title = `Round #${sr.round_no}: ${sr.match ? 'Matched' : 'Mismatched'} (${sr.actual_parity} vs exp ${sr.expected_parity})`;

      if (animate) {
        dot.style.opacity = "0";
        dot.style.transform = "scale(0.4)";
        sampleDotsRow.appendChild(dot);

        setTimeout(() => {
          dot.style.opacity = "1";
          dot.style.transform = "scale(1)";
        }, idx * 25);
      } else {
        dot.style.opacity = "1";
        dot.style.transform = "scale(1)";
        sampleDotsRow.appendChild(dot);
      }
    });
  }

  // Update Companion Reference Donuts
  function updateCompanionDonuts(eveOffRun, eveOnRun) {
    const miniCirc = 2 * Math.PI * 16; // ~100.53

    // Eve OFF companion donut
    if (eveOffRun) {
      companionEveOffPct.textContent = "0.0% QBER";
      companionEveOffPct.style.color = "var(--accent-green)";
      companionEveOffNote.textContent = "Clean quantum channel";
      miniDonutEveOff.setAttribute("stroke", "var(--accent-green)");
      miniDonutEveOff.setAttribute("stroke-dasharray", `${miniCirc}`);
      miniDonutEveOff.setAttribute("stroke-dashoffset", "0");
    } else {
      companionEveOffPct.textContent = "no run yet";
      companionEveOffPct.style.color = "var(--text-secondary)";
      companionEveOffNote.textContent = "no run yet";
      miniDonutEveOff.setAttribute("stroke", "var(--donut-track)");
      miniDonutEveOff.setAttribute("stroke-dasharray", `${miniCirc}`);
      miniDonutEveOff.setAttribute("stroke-dashoffset", "0");
    }

    // Eve ON companion donut
    if (eveOnRun) {
      const onPct = eveOnRun.qber_percent.toFixed(1);
      companionEveOnPct.textContent = `${onPct}% QBER`;
      companionEveOnPct.style.color = "var(--accent-red)";
      companionEveOnNote.textContent = "Entanglement collapsed";

      const errFrac = eveOnRun.error_rate;
      miniDonutEveOnGreen.setAttribute("stroke", "var(--accent-green)");
      miniDonutEveOnGreen.setAttribute("stroke-dasharray", `${miniCirc}`);
      miniDonutEveOnGreen.setAttribute("stroke-dashoffset", `${miniCirc * errFrac}`);

      miniDonutEveOnRed.setAttribute("stroke", "var(--accent-red)");
      miniDonutEveOnRed.setAttribute("stroke-dasharray", `${miniCirc}`);
      miniDonutEveOnRed.setAttribute("stroke-dashoffset", `${miniCirc * (1 - errFrac)}`);
    } else {
      companionEveOnPct.textContent = "no run yet";
      companionEveOnPct.style.color = "var(--text-secondary)";
      companionEveOnNote.textContent = "no run yet";
      miniDonutEveOnGreen.setAttribute("stroke", "var(--donut-track)");
      miniDonutEveOnGreen.setAttribute("stroke-dasharray", `${miniCirc}`);
      miniDonutEveOnGreen.setAttribute("stroke-dashoffset", "0");
      miniDonutEveOnRed.setAttribute("stroke", "transparent");
      miniDonutEveOnRed.setAttribute("stroke-dasharray", `${miniCirc}`);
      miniDonutEveOnRed.setAttribute("stroke-dashoffset", `${miniCirc}`);
    }
  }

  // --- STEP 06: ENCRYPT ---
  async function performEncrypt() {
    btnEncryptAction.disabled = true;
    try {
      const resp = await fetch("/api/encrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!resp.ok) {
        const err = await resp.json();
        alert(err.detail);
        return;
      }
      const data = await resp.json();
      lastCiphertextBits = data.ciphertext;
      lastKeyA = data.key_A;

      encA.textContent = groupBits(data.key_A);
      encC.textContent = groupBits(data.ciphertext);

      unlockStep(7);
      if (arrow06) arrow06.classList.add("pulsing");
      pipelineStatus.textContent = "Encrypted";

      if (!autoPlayActive) {
        goToStep(7);
      } else {
        scheduleNext(() => {
          goToStep(7);
          performCombine();
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      btnEncryptAction.disabled = false;
    }
  }

  // --- STEP 07: COMBINE ---
  async function performCombine() {
    try {
      const resp = await fetch("/api/combine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!resp.ok) {
        const err = await resp.json();
        alert(err.detail);
        return;
      }
      const data = await resp.json();
      lastKeyB = data.share_B;
      lastKeyC = data.share_C;

      combB.textContent = groupBits(data.share_B);
      combC.textContent = groupBits(data.share_C);
      combRes.textContent = groupBits(data.combined);

      unlockStep(8);
      if (arrow07) arrow07.classList.add("pulsing");
      pipelineStatus.textContent = "Combined";

      if (!autoPlayActive) {
        goToStep(8);
      } else {
        scheduleNext(() => {
          goToStep(8);
          performDecrypt();
        });
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Solo Decryption Attempts (Interactive)
  async function performSoloDecrypt(mode) {
    try {
      const resp = await fetch("/api/decrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        alert(err.detail);
        return;
      }
      const data = await resp.json();
      if (mode === "bob") {
        bobSoloState.textContent = `Decoded: "${data.text}" [${groupBits(data.bits.substring(0, 16))}...]`;
        bobSoloState.style.color = "var(--accent-red)";
      } else if (mode === "charlie") {
        charlieSoloState.textContent = `Decoded: "${data.text}" [${groupBits(data.bits.substring(0, 16))}...]`;
        charlieSoloState.style.color = "var(--accent-red)";
      }
    } catch (e) {
      console.error(e);
    }
  }

  // --- STEP 08: DECRYPT ---
  async function performDecrypt() {
    btnDecryptAction.disabled = true;
    try {
      const resp = await fetch("/api/decrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "both" }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        alert(err.detail);
        btnDecryptAction.disabled = false;
        return;
      }
      const data = await resp.json();
      lastDecryptedText = data.text;

      decC.textContent = groupBits(lastCiphertextBits);
      decKey.textContent = combRes.textContent;

      // Bit-by-bit animation
      decP.textContent = "";
      const fullBits = data.bits;
      let charIdx = 0;
      const bitInterval = setInterval(() => {
        if (charIdx < fullBits.length) {
          decP.textContent = groupBits(fullBits.substring(0, charIdx + 8));
          charIdx += 8;
        } else {
          clearInterval(bitInterval);
          unlockStep(9);
          if (arrow08) arrow08.classList.add("pulsing");
          pipelineStatus.textContent = "Decrypted";
          renderFinalResult();

          if (!autoPlayActive) {
            goToStep(9);
          } else {
            scheduleNext(() => {
              goToStep(9);
            });
          }
        }
      }, 70);
    } catch (e) {
      console.error(e);
    } finally {
      btnDecryptAction.disabled = false;
    }
  }

  // --- STEP 09: RESULT ---
  function renderFinalResult() {
    finalResultString.textContent = lastDecryptedText || browserPlaintext;

    if (lastDecryptedText === browserPlaintext) {
      resultStatusTag.innerHTML = `
        <span>matches original plaintext bit-for-bit ✓</span>
      `;
      resultStatusTag.style.background = "var(--accent-green-bg)";
      resultStatusTag.style.borderColor = "var(--accent-green-border)";
      resultStatusTag.style.color = "var(--accent-green)";
    } else {
      resultStatusTag.innerHTML = `
        <span>mismatch with original plaintext ✗</span>
      `;
      resultStatusTag.style.background = "var(--accent-red-bg)";
      resultStatusTag.style.borderColor = "var(--accent-red-border)";
      resultStatusTag.style.color = "var(--accent-red)";
    }
  }

  // --- RESET HANDLER ---
  async function performReset() {
    try {
      await fetch("/api/reset", { method: "POST" });
    } catch (e) {
      console.error(e);
    }

    activeStep = 1;
    maxUnlockedStep = 1;
    clearTimeout(autoPlayTimer);

    // Reset UI fields
    secretInput.value = "CAT123";
    browserPlaintext = "CAT123";
    statRounds.textContent = "0";
    statUsable.textContent = "0";
    statRule.textContent = "0";
    roundsLog.innerHTML = "";
    aliceKeyStream.textContent = "Awaiting batch simulation...";
    bobShareStream.textContent = "Awaiting batch simulation...";
    charlieShareStream.textContent = "Awaiting batch simulation...";
    donutQberVal.textContent = "0.0%";
    donutQberVal.classList.remove("danger");
    donutGreen.setAttribute("stroke-dashoffset", "0");
    donutRed.setAttribute("stroke-dashoffset", "314.159");
    sampleDotsRow.innerHTML = "";
    dotStripLegend.textContent = "Awaiting verification";
    dotStripLegend.style.color = "var(--text-secondary)";
    companionEveOffPct.textContent = "no run yet";
    companionEveOffNote.textContent = "no run yet";
    companionEveOnPct.textContent = "no run yet";
    companionEveOnNote.textContent = "no run yet";
    updateCompanionDonuts(null, null);

    bigSecurityStatus.className = "security-status-line secure";
    bigSecurityStatus.innerHTML = `<span>Secure, no eavesdropper</span>`;
    attackActionWrap.style.display = "none";
    arrow05.style.display = "flex";

    encP.textContent = "-";
    encA.textContent = "-";
    encC.textContent = "-";
    combB.textContent = "-";
    combC.textContent = "-";
    combRes.textContent = "-";
    bobSoloState.textContent = "click to simulate isolated decode";
    bobSoloState.style.color = "var(--text-secondary)";
    charlieSoloState.textContent = "click to simulate isolated decode";
    charlieSoloState.style.color = "var(--text-secondary)";
    decC.textContent = "-";
    decKey.textContent = "-";
    decP.textContent = "-";
    finalResultString.textContent = "CAT123";
    pipelineStatus.textContent = "Verified";
    pipelineStatus.style.color = "var(--accent-green)";
    headerQber.textContent = "0.0%";
    headerQber.style.color = "var(--accent-green)";

    // Lock steps 02 to 09
    for (let s = 2; s <= 9; s++) {
      const sec = document.getElementById(`step-0${s}`);
      if (sec) sec.classList.add("step-locked");
      const nav = document.getElementById(`nav-0${s}`);
      if (nav) {
        nav.classList.add("locked");
        nav.classList.remove("active", "completed");
      }
      const arrow = document.getElementById(`arrow-0${s - 1}`);
      if (arrow) arrow.classList.remove("pulsing");
    }

    goToStep(1);
    performEncode();
  }

  // --- EVE SWITCH TOGGLE (Requirement 2) ---
  eveSwitch.addEventListener("click", () => {
    // Toggling while mid-flow asks to reset
    if (maxUnlockedStep > 1) {
      const proceed = confirm("Switching Eve mid-flow will reset the current session to ensure clean data. Proceed to reset?");
      if (!proceed) return;
      eveActive = !eveActive;
      eveSwitch.classList.toggle("active", eveActive);
      performReset();
    } else {
      eveActive = !eveActive;
      eveSwitch.classList.toggle("active", eveActive);
    }
  });

  // Auto-play switch
  autoplaySwitch.addEventListener("click", () => {
    autoPlayActive = !autoPlayActive;
    autoplaySwitch.classList.toggle("active", autoPlayActive);
    if (autoPlayActive) {
      if (activeStep === 1) performEncode();
      else if (activeStep === 2) performBatchRun();
      else if (activeStep === 5) performSecurityCheck();
      else if (activeStep === 6) performEncrypt();
      else if (activeStep === 7) performCombine();
      else if (activeStep === 8) performDecrypt();
    } else {
      clearTimeout(autoPlayTimer);
    }
  });

  // Event Listeners - Step buttons
  btnEncode.addEventListener("click", () => performEncode(true));
  secretInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      performEncode(true);
    }
  });

  const btnProceedEncrypt = document.getElementById("btn-proceed-encrypt");
  if (btnProceedEncrypt) {
    btnProceedEncrypt.addEventListener("click", () => goToStep(6));
  }

  // Basis toggles
  document.querySelectorAll(".basis-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const actor = btn.getAttribute("data-actor");
      const basis = btn.getAttribute("data-basis");
      document.querySelectorAll(`.basis-btn[data-actor="${actor}"]`).forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeBases[actor] = basis;
    });
  });

  btnMeasure.addEventListener("click", performSingleMeasure);
  btnRandomBases.addEventListener("click", performBatchRun);
  btnCombineScroll.addEventListener("click", () => {
    unlockStep(7);
    goToStep(7);
  });

  btnRerunBatch.addEventListener("click", () => {
    goToStep(2);
    performBatchRun();
  });
  btnAttackReset.addEventListener("click", performReset);

  btnEncryptAction.addEventListener("click", performEncrypt);
  btnBobAlone.addEventListener("click", () => performSoloDecrypt("bob"));
  btnCharlieAlone.addEventListener("click", () => performSoloDecrypt("charlie"));
  btnDecryptAction.addEventListener("click", performDecrypt);
  btnNewMessage.addEventListener("click", performReset);
  btnHeaderReset.addEventListener("click", performReset);

  // Arrow buttons
  document.querySelectorAll(".step-advance-btn, .flow-arrow-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = parseInt(btn.getAttribute("data-next-step"), 10);
      goToStep(next);
    });
  });

  // Navigation rail clicks
  document.querySelectorAll(".rail-item, .step-nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      const step = parseInt(item.getAttribute("data-step"), 10);
      goToStep(step);
    });
  });

  // Allow clicking on a completed section to focus it
  document.querySelectorAll(".step-section").forEach((sec) => {
    sec.addEventListener("click", (e) => {
      if (e.target.closest("button") || e.target.closest("input")) return;
      const id = parseInt(sec.getAttribute("data-step-id"), 10);
      if (id <= maxUnlockedStep && id !== activeStep) {
        setFocusStep(id);
      }
    });
  });

  // URL parameters handling for expo display and automated preview
  const urlParams = new URLSearchParams(window.location.search);
  const targetStep = parseInt(urlParams.get("step") || "1", 10);
  const eveParam = urlParams.get("eve");
  const focusParam = urlParams.get("focus");

  if (focusParam === "security") {
    for (let s = 1; s <= 4; s++) {
      const el = document.getElementById(`step-0${s}`);
      if (el) el.style.display = "none";
    }
  }

  if (eveParam === "1" || eveParam === "true") {
    eveActive = true;
    eveSwitch.classList.add("active");
  }

  // Initialize without auto-advancing on first load
  performEncode(false);
  setFocusStep(1);

  // Sync state from server on startup
  fetch("/api/state")
    .then((r) => r.json())
    .then(async (st) => {
      if (st.eve_on) {
        eveActive = true;
        eveSwitch.classList.add("active");
      }
      updateCompanionDonuts(st.last_eve_off_run, st.last_eve_on_run);

      if (st.security_checked) {
        for (let s = 1; s <= 5; s++) unlockStep(s);
        applySecurityCheckData(st, false);
      }

      if (targetStep >= 2) {
        if (!st.security_checked && targetStep >= 5) {
          await performBatchRun();
          await performSecurityCheck();
        } else {
          for (let s = 1; s <= targetStep; s++) unlockStep(s);
        }
        setFocusStep(targetStep);
        const el = document.getElementById(`step-0${targetStep}`);
        if (el) {
          el.scrollIntoView({ behavior: "instant", block: "start" });
        }
      }
    })
    .catch((err) => console.error("Initial state sync error:", err));
})();
