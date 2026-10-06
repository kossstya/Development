/* =========================================================
   Аналітична сторінка: картки, таблиця, графіки, тенденції
   Залежності: data.js (YEARS, INDICATORS, THREATS, SOURCES), Chart.js
   ========================================================= */

const COLORS = {
  safe: "#16955a",
  safeFill: "rgba(22, 149, 90, .14)",
  danger: "#d23f3f",
  dangerFill: "rgba(210, 63, 63, .14)",
  warn: "#e0a020",
  navy: "#183a66",
  navyFill: "rgba(24, 58, 102, .12)",
  accent: "#d9822b",
  grid: "rgba(16, 40, 73, .08)",
  text: "#5d6b82"
};

const LEVELS = {
  high: { label: "Високий", cls: "badge-high", color: COLORS.danger },
  mid: { label: "Середній", cls: "badge-mid", color: COLORS.warn },
  low: { label: "Помірний", cls: "badge-low", color: "#3b74c4" }
};

/* ---------- Допоміжні функції ---------- */

// Форматування числа в українському стилі: кома як десятковий роздільник, «−» для мінуса
function fmt(value, digits = 1, signed = false) {
  if (value === null || value === undefined || Number.isNaN(value)) return "н/д";
  const abs = Math.abs(value).toFixed(digits).replace(".", ",");
  if (value < 0) return "−" + abs;
  if (signed && value > 0) return "+" + abs;
  return abs;
}

function isSafe(ind, value) {
  if (value === null || value === undefined) return null;
  return ind.type === "min" ? value >= ind.threshold : value <= ind.threshold;
}

function thresholdLabel(ind) {
  return (ind.type === "min" ? "≥ " : "≤ ") + fmt(ind.threshold, Number.isInteger(ind.threshold) ? 0 : 1);
}

function lastAvailableIndex(ind) {
  for (let i = ind.values.length - 1; i >= 0; i--) {
    if (ind.values[i] !== null) return i;
  }
  return -1;
}

// Частка показників у безпечній зоні за рік (н/д не враховуються)
function integralForYear(yearIndex) {
  let safe = 0;
  let total = 0;
  INDICATORS.forEach((ind) => {
    const s = isSafe(ind, ind.values[yearIndex]);
    if (s === null) return;
    total++;
    if (s) safe++;
  });
  return { safe, total, share: total ? (safe / total) * 100 : 0 };
}

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

/* ---------- 1. Картки ключових показників ---------- */

function renderSummary() {
  const box = document.getElementById("summary");
  if (!box) return;
  const lastIdx = YEARS.length - 1;
  const res = integralForYear(lastIdx);
  const first = integralForYear(0);
  box.innerHTML = `
    <div class="summary-item safe"><div class="num">${res.safe}</div><div class="lbl">показників у безпечній зоні (${YEARS[lastIdx]} р.)</div></div>
    <div class="summary-item danger"><div class="num">${res.total - res.safe}</div><div class="lbl">показників з порушенням порогу (${YEARS[lastIdx]} р.)</div></div>
    <div class="summary-item neutral"><div class="num">${fmt(res.share)} %</div><div class="lbl">інтегральна оцінка (у ${YEARS[0]} р. — ${fmt(first.share)} %)</div></div>`;
}

function renderKPIs() {
  const grid = document.getElementById("kpi-grid");
  if (!grid) return;
  INDICATORS.forEach((ind) => {
    const idx = lastAvailableIndex(ind);
    const value = ind.values[idx];
    const safe = isSafe(ind, value);
    const yearNote = idx === YEARS.length - 1 ? `${YEARS[idx]} р.` : `${YEARS[idx]} р. (за ${YEARS[YEARS.length - 1]} — н/д)`;
    const card = el("article", "kpi " + (safe ? "safe" : "danger"));
    card.innerHTML = `
      <div class="kpi-title">${ind.name}</div>
      <div class="kpi-value">${fmt(value)}<small>${ind.unit}</small></div>
      <div class="kpi-foot">
        <span>Поріг ${thresholdLabel(ind)} · ${yearNote}</span>
        <span class="badge ${safe ? "badge-safe" : "badge-danger"}">${safe ? "Безпечно" : "Загроза"}</span>
      </div>`;
    card.title = ind.thresholdSource;
    grid.appendChild(card);
  });
}

/* ---------- 2. Таблиця показників ---------- */

function renderTable() {
  const table = document.getElementById("indicators-table");
  if (!table) return;

  const thead = `<thead><tr>
      <th class="ind" scope="col">Показник</th>
      <th scope="col">Од.</th>
      ${YEARS.map((y) => `<th scope="col">${y}</th>`).join("")}
      <th class="thr" scope="col">Поріг</th>
    </tr></thead>`;

  const rows = INDICATORS.map((ind) => {
    const cells = ind.values.map((v) => {
      const s = isSafe(ind, v);
      const cls = s === null ? "cell-na" : s ? "cell-safe" : "cell-danger";
      const title = s === null ? "Дані відсутні" : s ? "Безпечна зона" : "Поріг порушено";
      return `<td class="${cls}" title="${title}">${fmt(v)}</td>`;
    }).join("");
    return `<tr>
        <td class="ind">${ind.name}</td>
        <td>${ind.unit}</td>
        ${cells}
        <td class="thr" title="${ind.thresholdSource}">${thresholdLabel(ind)}</td>
      </tr>`;
  }).join("");

  const totals = YEARS.map((_, i) => {
    const r = integralForYear(i);
    return `<td>${r.safe} / ${r.total}<br><span class="text-muted">${fmt(r.share)} %</span></td>`;
  }).join("");

  table.innerHTML = `${thead}<tbody>${rows}</tbody>
    <tfoot><tr><td class="ind">Показників у безпечній зоні</td><td>—</td>${totals}<td>—</td></tr></tfoot>`;
}

/* ---------- 3. Графіки ---------- */

const charts = {};

function chartAvailable() {
  if (typeof Chart !== "undefined") return true;
  document.querySelectorAll(".chart-box").forEach((box) => {
    box.innerHTML = '<div class="chart-fallback">Не вдалося завантажити бібліотеку Chart.js.<br>Перевірте підключення до Інтернету та оновіть сторінку.</div>';
  });
  return false;
}

function setChartDefaults() {
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.color = COLORS.text;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.boxWidth = 10;
  Chart.defaults.plugins.tooltip.backgroundColor = "#0a1a33";
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.maintainAspectRatio = false;
}

// 3.1 Динаміка обраного показника з лінією порогу
function buildDynamicsChart(indId) {
  const ind = INDICATORS.find((i) => i.id === indId) || INDICATORS[0];
  const pointColors = ind.values.map((v) => (isSafe(ind, v) ? COLORS.safe : COLORS.danger));
  const data = {
    labels: YEARS,
    datasets: [
      {
        label: `${ind.short}, ${ind.unit}`,
        data: ind.values,
        borderColor: COLORS.navy,
        backgroundColor: COLORS.navyFill,
        fill: true,
        tension: 0.3,
        borderWidth: 3,
        pointRadius: 7,
        pointHoverRadius: 9,
        pointBackgroundColor: pointColors,
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        spanGaps: false
      },
      {
        label: `Поріг (${thresholdLabel(ind)} ${ind.unit})`,
        data: YEARS.map(() => ind.threshold),
        borderColor: COLORS.accent,
        borderDash: [8, 6],
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false
      }
    ]
  };

  const options = {
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { position: "bottom", labels: { usePointStyle: false, boxHeight: 3, boxWidth: 22 } },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            if (ctx.datasetIndex === 1) return ` Поріг: ${thresholdLabel(ind)} ${ind.unit}`;
            const s = isSafe(ind, ctx.raw);
            const status = s === null ? "" : s ? " — безпечно" : " — поріг порушено";
            return ` ${ind.short}: ${fmt(ctx.raw)} ${ind.unit}${status}`;
          }
        }
      }
    },
    scales: {
      y: {
        grid: { color: COLORS.grid },
        ticks: { callback: (v) => fmt(v, Number.isInteger(v) ? 0 : 1) },
        title: { display: true, text: ind.unit }
      },
      x: { grid: { display: false } }
    }
  };

  if (charts.dynamics) {
    charts.dynamics.data = data;
    charts.dynamics.options = options;
    charts.dynamics.update();
  } else {
    charts.dynamics = new Chart(document.getElementById("dynamicsChart"), { type: "line", data, options });
  }
  updateDynamicsNote(ind);
}

function updateDynamicsNote(ind) {
  const note = document.getElementById("dynamics-note");
  if (!note) return;
  const lastIdx = lastAvailableIndex(ind);
  const safeYears = ind.values.filter((v) => isSafe(ind, v) === true).length;
  const available = ind.values.filter((v) => v !== null).length;
  const s = isSafe(ind, ind.values[lastIdx]);
  note.innerHTML = `<strong>${ind.name}.</strong> Поріг ${thresholdLabel(ind)} ${ind.unit} (${ind.thresholdSource}).
    У безпечній зоні — ${safeYears} з ${available} років. Останнє значення (${YEARS[lastIdx]} р.):
    <strong class="${s ? "safe-text" : "danger-text"}">${fmt(ind.values[lastIdx])} ${ind.unit}</strong>.
    ${ind.note ? " " + ind.note : ""}`;
}

function initDynamicsSwitch() {
  const sw = document.getElementById("dynamics-switch");
  const select = document.getElementById("dynamics-select");
  if (!sw || !select) return;

  INDICATORS.forEach((ind, i) => {
    const btn = el("button", i === 0 ? "active" : "", ind.short);
    btn.type = "button";
    btn.dataset.id = ind.id;
    btn.setAttribute("aria-pressed", i === 0 ? "true" : "false");
    sw.appendChild(btn);

    const opt = el("option", "", ind.name);
    opt.value = ind.id;
    select.appendChild(opt);
  });

  const choose = (id) => {
    sw.querySelectorAll("button").forEach((b) => {
      const on = b.dataset.id === id;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", String(on));
    });
    select.value = id;
    buildDynamicsChart(id);
  };

  sw.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (btn) choose(btn.dataset.id);
  });
  select.addEventListener("change", () => choose(select.value));
}

// 3.2 Інтегральна оцінка: частка показників у безпечній зоні
function buildIntegralChart() {
  const results = YEARS.map((_, i) => integralForYear(i));
  const shares = results.map((r) => Math.round(r.share * 10) / 10);
  const colorFor = (v) => (v >= 60 ? COLORS.safe : v >= 40 ? COLORS.warn : COLORS.danger);

  charts.integral = new Chart(document.getElementById("integralChart"), {
    type: "bar",
    data: {
      labels: YEARS,
      datasets: [{
        label: "Частка показників у безпечній зоні, %",
        data: shares,
        backgroundColor: shares.map(colorFor),
        borderRadius: 8,
        maxBarThickness: 64
      }]
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const r = results[ctx.dataIndex];
              return ` ${fmt(ctx.raw)} % (${r.safe} з ${r.total} показників)`;
            }
          }
        }
      },
      scales: {
        y: {
          min: 0,
          max: 100,
          grid: { color: COLORS.grid },
          ticks: { stepSize: 20, callback: (v) => v + " %" }
        },
        x: { grid: { display: false } }
      }
    },
    plugins: [{
      // підписи значень над стовпцями
      id: "barLabels",
      afterDatasetsDraw(chart) {
        const { ctx } = chart;
        ctx.save();
        ctx.font = "700 12px " + Chart.defaults.font.family;
        ctx.fillStyle = "#1b2433";
        ctx.textAlign = "center";
        chart.getDatasetMeta(0).data.forEach((bar, i) => {
          ctx.fillText(fmt(shares[i]) + " %", bar.x, bar.y - 6);
        });
        ctx.restore();
      }
    }]
  });
}

// 3.3 Комбінований графік: державний борг + сальдо бюджету
function buildDebtBudgetChart() {
  const debt = INDICATORS.find((i) => i.id === "debt");
  const budget = INDICATORS.find((i) => i.id === "budget");

  charts.debtBudget = new Chart(document.getElementById("debtBudgetChart"), {
    data: {
      labels: YEARS,
      datasets: [
        {
          type: "bar",
          label: "Державний борг, % ВВП",
          data: debt.values,
          backgroundColor: debt.values.map((v) => (isSafe(debt, v) ? "rgba(22, 149, 90, .75)" : "rgba(24, 58, 102, .78)")),
          borderRadius: 8,
          maxBarThickness: 56,
          yAxisID: "yDebt",
          order: 3
        },
        {
          type: "line",
          label: "Поріг боргу (60 % ВВП)",
          data: YEARS.map(() => debt.threshold),
          borderColor: COLORS.navy,
          backgroundColor: COLORS.navy,
          borderDash: [6, 5],
          borderWidth: 1.5,
          pointRadius: 0,
          yAxisID: "yDebt",
          order: 2
        },
        {
          type: "line",
          label: "Сальдо бюджету, % ВВП",
          data: budget.values,
          borderColor: COLORS.accent,
          backgroundColor: COLORS.accent,
          borderWidth: 3,
          tension: 0.3,
          pointRadius: 6,
          pointBackgroundColor: budget.values.map((v) => (isSafe(budget, v) ? COLORS.safe : COLORS.danger)),
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          yAxisID: "yBudget",
          order: 1
        },
        {
          type: "line",
          label: "Поріг дефіциту (−3 % ВВП)",
          data: YEARS.map(() => budget.threshold),
          borderColor: COLORS.danger,
          backgroundColor: COLORS.danger,
          borderDash: [3, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          yAxisID: "yBudget",
          order: 0
        }
      ]
    },
    options: {
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "bottom", reverse: true, labels: { usePointStyle: false, boxWidth: 18, boxHeight: 8 } },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${fmt(ctx.raw)}` } }
      },
      scales: {
        yDebt: {
          position: "left",
          min: 0,
          max: 120,
          grid: { color: COLORS.grid },
          title: { display: true, text: "Борг, % ВВП" }
        },
        yBudget: {
          position: "right",
          min: -8,
          max: 8,
          grid: { drawOnChartArea: false },
          ticks: { callback: (v) => fmt(v, 0) },
          title: { display: true, text: "Сальдо бюджету, % ВВП" }
        },
        x: { grid: { display: false } }
      }
    }
  });
}

/* ---------- 4. Тенденції: 2025 vs 2020 ---------- */

function renderTrends() {
  const safeList = document.getElementById("trends-safe");
  const dangerList = document.getElementById("trends-danger");
  if (!safeList || !dangerList) return;

  INDICATORS.forEach((ind) => {
    const first = ind.values[0];
    const lastIdx = lastAvailableIndex(ind);
    const last = ind.values[lastIdx];
    const delta = last - first;
    const improved = ind.type === "min" ? delta > 0 : delta < 0;
    const safeNow = isSafe(ind, last);
    const safeThen = isSafe(ind, first);
    const gap = Math.abs(last - ind.threshold);

    let verdict;
    if (safeNow && !safeThen) verdict = "Показник повернувся в безпечну зону.";
    else if (safeNow) verdict = "Показник утримується в безпечній зоні.";
    else if (improved) verdict = `Позитивна динаміка, але поріг не досягнуто (відставання ${fmt(gap)} п.п.).`;
    else verdict = `Погіршення; поріг порушено на ${fmt(gap)} п.п.`;

    const yearLabel = lastIdx === YEARS.length - 1 ? YEARS[lastIdx] : `${YEARS[lastIdx]}*`;
    const item = el("li", "trend-item");
    item.innerHTML = `
      <div class="t-head">
        <span class="t-name">${ind.short}</span>
        <span class="t-delta ${improved || safeNow ? "safe-text" : "danger-text"}">${fmt(delta, 1, true)} п.п.</span>
      </div>
      <div class="t-body">${YEARS[0]}: ${fmt(first)} → ${yearLabel}: ${fmt(last)} ${ind.unit} (поріг ${thresholdLabel(ind)}). ${verdict}</div>`;
    (safeNow ? safeList : dangerList).appendChild(item);
  });

  const foot = document.getElementById("trends-foot");
  if (foot) foot.textContent = "* Для енергозалежності порівняно 2024 р. з 2020 р., оскільки дані за 2025 р. ще не опубліковані.";
}

/* ---------- 5. Загрози ---------- */

function renderThreats() {
  const grid = document.getElementById("threat-grid");
  if (!grid) return;
  THREATS.forEach((t, i) => {
    const lvl = LEVELS[t.level];
    const card = el("article", "card threat");
    card.innerHTML = `
      <div class="threat-top">
        <span class="threat-num">${i + 1}</span>
        <span class="badge ${lvl.cls}">Рівень загрози: ${lvl.label}</span>
      </div>
      <h3 class="mt-0">${t.title}</h3>
      <p>${t.text}</p>
      <span class="ind-tag">${t.indicator}</span>
      <div class="meter" role="img" aria-label="Інтенсивність загрози ${t.score} зі 100"><span style="width:${t.score}%;background:${lvl.color}"></span></div>`;
    grid.appendChild(card);
  });
}

/* ---------- 6. Джерела ---------- */

function renderSources() {
  const list = document.getElementById("sources");
  if (!list) return;
  SOURCES.forEach((s) => {
    const li = el("li");
    li.innerHTML = `<div>${s.title}<br><a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.url}</a></div>`;
    list.appendChild(li);
  });
}

/* ---------- Запуск ---------- */

document.addEventListener("DOMContentLoaded", () => {
  renderSummary();
  renderKPIs();
  renderTable();
  renderTrends();
  renderThreats();
  renderSources();
  initDynamicsSwitch();

  if (chartAvailable()) {
    setChartDefaults();
    buildDynamicsChart(INDICATORS[0].id);
    buildIntegralChart();
    buildDebtBudgetChart();
  }
});
