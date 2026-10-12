/* =========================================================
   Платформа «Демографічне навантаження» (індикатор 2.6)
   Формула та порогові значення — наказ Мінекономрозвитку
   № 1277 від 29.10.2013 (додатки 1–3).
   Автор: Канавець Костянтин Олегович, 2026
   ========================================================= */

"use strict";

// Характеристичні значення індикатора 2.6, % (додаток 2 до наказу № 1277)
const X = {
  Lkrit: 35, Lnebezp: 36, Lnezdv: 38, Lzdv: 40, Lopt: 45,
  Ropt: 50, Rzdv: 51, Rnezdv: 52, Rnebezp: 53, Rkrit: 55
};
const WEIGHT = 0.1265; // ваговий коефіцієнт (додаток 3)

// Шкала рівнів: ліва частина — [a; b), права — (a; b]
const LEVELS = [
  { label: "< 35",       min: -Infinity, minInc: false, max: X.Lkrit,   maxInc: false, level: "Абсолютна небезпека", cls: "lvl-abs",   side: "L" },
  { label: "[35; 36)",   min: X.Lkrit,   minInc: true,  max: X.Lnebezp, maxInc: false, level: "Критичний",           cls: "lvl-crit",  side: "L" },
  { label: "[36; 38)",   min: X.Lnebezp, minInc: true,  max: X.Lnezdv,  maxInc: false, level: "Небезпечний",         cls: "lvl-dang",  side: "L" },
  { label: "[38; 40)",   min: X.Lnezdv,  minInc: true,  max: X.Lzdv,    maxInc: false, level: "Незадовільний",       cls: "lvl-unsat", side: "L" },
  { label: "[40; 45)",   min: X.Lzdv,    minInc: true,  max: X.Lopt,    maxInc: false, level: "Задовільний",         cls: "lvl-sat",   side: "L" },
  { label: "[45; 50]",   min: X.Lopt,    minInc: true,  max: X.Ropt,    maxInc: true,  level: "Оптимальний",         cls: "lvl-opt",   side: "O" },
  { label: "(50; 51]",   min: X.Ropt,    minInc: false, max: X.Rzdv,    maxInc: true,  level: "Задовільний",         cls: "lvl-sat",   side: "R" },
  { label: "(51; 52]",   min: X.Rzdv,    minInc: false, max: X.Rnezdv,  maxInc: true,  level: "Незадовільний",       cls: "lvl-unsat", side: "R" },
  { label: "(52; 53]",   min: X.Rnezdv,  minInc: false, max: X.Rnebezp, maxInc: true,  level: "Небезпечний",         cls: "lvl-dang",  side: "R" },
  { label: "(53; 55]",   min: X.Rnebezp, minInc: false, max: X.Rkrit,   maxInc: true,  level: "Критичний",           cls: "lvl-crit",  side: "R" },
  { label: "> 55",       min: X.Rkrit,   minInc: false, max: Infinity,  maxInc: false, level: "Абсолютна небезпека", cls: "lvl-abs",   side: "R" }
];

const ZONE_COLORS = {
  "lvl-opt": "rgba(22,149,90,.16)", "lvl-sat": "rgba(106,158,31,.13)", "lvl-unsat": "rgba(201,138,12,.13)",
  "lvl-dang": "rgba(216,102,28,.13)", "lvl-crit": "rgba(210,63,63,.13)", "lvl-abs": "rgba(142,27,44,.13)"
};

// Приклад: Держстат, «Розподіл постійного населення України за статтю та віком» на 1 січня, осіб
// (без тимчасово окупованих АР Крим, м. Севастополя та частини Донецької і Луганської областей)
const EXAMPLE = {
  country: "Україна",
  rows: [
    { year: 2017, children: 6886960, elderly: 9545919,  working: 25982026 },
    { year: 2018, children: 6895699, elderly: 9679745,  working: 25641322 },
    { year: 2019, children: 6862759, elderly: 9827110,  working: 25293695 },
    { year: 2020, children: 6786514, elderly: 9978194,  working: 24968071 },
    { year: 2021, children: 6678195, elderly: 10121624, working: 24618898 }
  ]
};

const MIN_YEAR = 1950;
const MAX_YEAR = new Date().getFullYear();
const MAX_PERIOD = 15;
const FIELDS = [
  { key: "children", name: "Діти 0–15 років" },
  { key: "elderly",  name: "Особи 60+ років" },
  { key: "working",  name: "Працездатні 16–59 років" }
];

const state = { country: "", years: [], unit: "persons", results: null };
let chart = null;

const $ = (id) => document.getElementById(id);

/* ---------- Допоміжні ---------- */

function fmt(value, digits = 2) {
  return value.toLocaleString("uk-UA", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtPop(value) {
  return state.unit === "persons" ? fmt(value, 0) : fmt(value, 3);
}

function signed(value, digits = 2) {
  if (Math.abs(value) < 0.005) return "0,00";
  return (value > 0 ? "+" : "−") + fmt(Math.abs(value), digits);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function yearWord(n) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "рік";
  if ([2, 3, 4].includes(m10) && ![12, 13, 14].includes(m100)) return "роки";
  return "років";
}

function errorWord(n) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "помилку";
  if ([2, 3, 4].includes(m10) && ![12, 13, 14].includes(m100)) return "помилки";
  return "помилок";
}

function unitLabel() {
  return state.unit === "persons" ? "осіб" : "тис. осіб";
}

function setFieldError(input, text, kind = "error") {
  const holder = input.parentElement.querySelector(".field-error");
  input.classList.toggle("is-invalid", kind === "error" && !!text);
  input.classList.toggle("is-warning", kind === "warn" && !!text);
  input.setAttribute("aria-invalid", kind === "error" && text ? "true" : "false");
  if (holder) {
    holder.textContent = text || "";
    holder.classList.toggle("warn", kind === "warn");
  }
}

function showMessage(html, type = "error") {
  const box = $("message");
  box.className = `message ${type}`;
  box.innerHTML = html;
}

function clearMessage() {
  $("message").className = "message";
  $("message").innerHTML = "";
}

/* ---------- Рівень безпеки ---------- */

function inInterval(v, t) {
  const lower = t.min === -Infinity ? true : (t.minInc ? v >= t.min : v > t.min);
  const upper = t.max === Infinity ? true : (t.maxInc ? v <= t.max : v < t.max);
  return lower && upper;
}

function level(value) {
  return LEVELS.find((t) => inInterval(value, t));
}

// Відхилення від оптимального діапазону [45; 50], в. п.
function deviation(value) {
  if (value < X.Lopt) return value - X.Lopt;
  if (value > X.Ropt) return value - X.Ropt;
  return 0;
}

/* ---------- Крок 1: період → таблиця ---------- */

function parseYear(input) {
  const raw = input.value.trim();
  if (raw === "") return { ok: false, msg: "Вкажіть рік." };
  if (!/^\d{4}$/.test(raw)) return { ok: false, msg: "Рік — рівно 4 цифри, наприклад 2017." };
  const y = Number(raw);
  if (y < MIN_YEAR || y > MAX_YEAR) return { ok: false, msg: `Допустимо ${MIN_YEAR}–${MAX_YEAR}.` };
  return { ok: true, value: y };
}

function validatePeriod() {
  const countryInput = $("country");
  const country = countryInput.value.trim().replace(/\s+/g, " ");
  let ok = true;

  if (country.length < 2 || !/[A-Za-zА-Яа-яІіЇїЄєҐґ]{2,}/.test(country) || /[<>{}]/.test(country)) {
    setFieldError(countryInput, "Назва країни — щонайменше 2 літери, без спецсимволів.");
    ok = false;
  } else setFieldError(countryInput, "");

  const from = parseYear($("yearFrom"));
  const to = parseYear($("yearTo"));
  setFieldError($("yearFrom"), from.ok ? "" : from.msg);
  setFieldError($("yearTo"), to.ok ? "" : to.msg);
  if (!from.ok || !to.ok) return null;

  if (to.value < from.value) {
    setFieldError($("yearTo"), "Кінцевий рік не може бути раніше за початковий.");
    return null;
  }
  if (to.value - from.value + 1 > MAX_PERIOD) {
    setFieldError($("yearTo"), `Період — не більше ${MAX_PERIOD} років.`);
    return null;
  }
  if (!ok) return null;
  return { country, from: from.value, to: to.value };
}

function buildTable(keepValues = true) {
  const period = validatePeriod();
  if (!period) return false;

  // Зберігаємо вже введені значення, якщо рік лишився в новому періоді
  const old = {};
  if (keepValues) {
    document.querySelectorAll("#inputBody tr").forEach((tr) => {
      old[tr.dataset.year] = {};
      tr.querySelectorAll("input").forEach((inp) => { old[tr.dataset.year][inp.dataset.key] = inp.value; });
    });
  }

  state.country = period.country;
  state.unit = $("unit").value;
  state.years = [];
  for (let y = period.from; y <= period.to; y++) state.years.push(y);

  $("inputBody").innerHTML = state.years.map((y) => `
    <tr data-year="${y}">
      <td>${y}</td>
      ${FIELDS.map((f) => `
        <td>
          <input type="text" inputmode="decimal" autocomplete="off" data-key="${f.key}"
                 aria-label="${f.name}, ${y}" value="${escapeHtml(old[y]?.[f.key] ?? "")}">
          <span class="field-error"></span>
        </td>`).join("")}
    </tr>`).join("");

  updateUnitLabels();
  clearMessage();
  $("dataCard").classList.remove("hidden");
  return true;
}

function updateUnitLabels() {
  document.querySelectorAll(".unit-label").forEach((s) => { s.textContent = unitLabel(); });
}

/* ---------- Крок 2: перевірка введених даних ---------- */

function parsePopulation(raw, unit) {
  const value = raw.replace(/[\s  ]/g, "");
  if (value === "") return { ok: false, msg: "Поле порожнє." };
  if (/^-/.test(value)) return { ok: false, msg: "Від'ємні значення неприпустимі." };
  if (/%/.test(value)) return { ok: false, msg: "Знак % не вводиться." };
  if (unit === "persons") {
    if (/[.,]/.test(value)) return { ok: false, msg: "Кількість осіб — ціле число." };
    if (!/^\d+$/.test(value)) return { ok: false, msg: "Допустимі лише цифри." };
  } else if (!/^\d+([.,]\d{1,3})?$/.test(value)) {
    return { ok: false, msg: "Число з не більше ніж 3 знаками після коми." };
  }
  const num = Number(value.replace(",", "."));
  const limit = unit === "persons" ? 2e9 : 2e6; // ~ населення найбільших країн світу
  if (!Number.isFinite(num)) return { ok: false, msg: "Некоректне число." };
  if (num > limit) return { ok: false, msg: "Значення неправдоподібно велике." };
  return { ok: true, value: num };
}

function validate() {
  const errors = [];
  const warnings = [];
  const rows = [];

  document.querySelectorAll("#inputBody tr").forEach((tr) => {
    const year = Number(tr.dataset.year);
    const row = { year };
    let rowOk = true;

    tr.querySelectorAll("input").forEach((inp) => {
      const field = FIELDS.find((f) => f.key === inp.dataset.key);
      const p = parsePopulation(inp.value, state.unit);
      if (!p.ok) {
        setFieldError(inp, p.msg);
        errors.push(`${year} р., «${field.name}»: ${p.msg}`);
        rowOk = false;
        return;
      }
      setFieldError(inp, "");
      row[field.key] = p.value;
    });

    if (row.working === 0) {
      const inp = tr.querySelector('[data-key="working"]');
      setFieldError(inp, "Не може дорівнювати 0 (ділення на нуль).");
      errors.push(`${year} р.: чисельність працездатного населення дорівнює 0 — розрахунок неможливий.`);
      rowOk = false;
    }

    if (rowOk) {
      const nonWorking = row.children + row.elderly;
      if (nonWorking === 0) {
        warnings.push(`${year} р.: непрацездатного населення 0 осіб — перевірте дані.`);
        setFieldError(tr.querySelector('[data-key="children"]'), "Перевірте значення.", "warn");
      } else if (nonWorking > 3 * row.working) {
        warnings.push(`${year} р.: непрацездатних більш ніж утричі більше за працездатних — значення неправдоподібне.`);
        setFieldError(tr.querySelector('[data-key="working"]'), "Неправдоподібно мале значення?", "warn");
      } else if (row.working < Math.max(row.children, row.elderly)) {
        warnings.push(`${year} р.: працездатних менше, ніж однієї з непрацездатних груп — перевірте, чи не переплутано стовпці.`);
      }
      rows.push(row);
    }
  });

  // Різкі стрибки чисельності між сусідніми роками (> 30 %) — ймовірна помилка в одиницях
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1], cur = rows[i];
    if (prev.year !== cur.year - 1) continue;
    FIELDS.forEach((f) => {
      if (prev[f.key] > 0 && Math.abs(cur[f.key] / prev[f.key] - 1) > 0.3) {
        warnings.push(`${cur.year} р., «${f.name}»: зміна понад 30 % порівняно з ${prev.year} р. — перевірте одиниці виміру.`);
      }
    });
  }

  return { ok: errors.length === 0, errors, warnings, rows };
}

/* ---------- Розрахунок ---------- */

function calc(rows) {
  const items = rows.map((r) => {
    const nonWorking = r.children + r.elderly;
    const dn = nonWorking / r.working * 100;
    return { ...r, nonWorking, dn, lvl: level(dn), dev: deviation(dn) };
  });
  const avg = items.reduce((s, r) => s + r.dn, 0) / items.length;
  return { items, avg, avgLevel: level(avg), avgDev: deviation(avg) };
}

/* ---------- Виведення результатів ---------- */

function badge(lvl) {
  return `<span class="badge ${lvl.cls}">${lvl.level}</span>`;
}

function renderResults(res) {
  const { items, avg, avgLevel, avgDev } = res;
  const first = items[0], last = items[items.length - 1];

  $("resultMeta").textContent = `${state.country}; ${first.year}${items.length > 1 ? "–" + last.year : ""} рр.; `
    + `кількість років: ${items.length}; одиниці введення: ${unitLabel()}.`;

  const avgCls = avgLevel.cls === "lvl-opt" || avgLevel.cls === "lvl-sat" ? "safe" : "danger";
  $("summary").innerHTML = `
    <div class="summary-item ${avgCls}"><div class="num">${fmt(avg)} %</div><div class="lbl">Середнє ДН за період</div></div>
    <div class="summary-item ${avgCls}"><div class="num small">${badge(avgLevel)}</div><div class="lbl">Рівень економічної безпеки</div></div>
    <div class="summary-item neutral"><div class="num">${signed(avgDev)}</div><div class="lbl">Відхилення від оптимуму 45–50 %, в. п.</div></div>
    <div class="summary-item neutral"><div class="num">${items.length > 1 ? signed(last.dn - first.dn) : "—"}</div><div class="lbl">Зміна за період, в. п.</div></div>`;

  $("resultBody").innerHTML = items.map((r) => `
    <tr>
      <td><b>${r.year}</b></td>
      <td>${fmtPop(r.children)}</td>
      <td>${fmtPop(r.elderly)}</td>
      <td>${fmtPop(r.nonWorking)}</td>
      <td>${fmtPop(r.working)}</td>
      <td class="dn">${fmt(r.dn)}</td>
      <td>${signed(r.dev)}</td>
      <td>${badge(r.lvl)}</td>
    </tr>`).join("");

  $("resultFoot").innerHTML = `
    <tr>
      <td>Середнє</td>
      <td>—</td><td>—</td><td>—</td><td>—</td>
      <td class="dn">${fmt(avg)}</td>
      <td>${signed(avgDev)}</td>
      <td>${badge(avgLevel)}</td>
    </tr>`;

  renderChart(res);
  $("conclusion").innerHTML = conclusion(res);

  $("results").classList.remove("hidden");
  $("results").scrollIntoView({ behavior: "smooth", block: "start" });
}

// Плагін Chart.js: кольорові смуги зон рівнів безпеки
const zonesPlugin = {
  id: "zones",
  beforeDatasetsDraw(c) {
    const { ctx, chartArea: a, scales: { y } } = c;
    if (!a) return;
    ctx.save();
    LEVELS.forEach((t) => {
      const lo = Math.max(t.min, y.min), hi = Math.min(t.max, y.max);
      if (hi <= lo) return;
      const top = y.getPixelForValue(hi), bottom = y.getPixelForValue(lo);
      ctx.fillStyle = ZONE_COLORS[t.cls];
      ctx.fillRect(a.left, top, a.right - a.left, bottom - top);
    });
    ctx.restore();
  }
};

function renderChart(res) {
  const box = document.querySelector("#results .chart-box");
  if (typeof Chart === "undefined") {
    box.innerHTML = '<div class="chart-fallback">Не вдалося завантажити бібліотеку Chart.js. Таблиця та висновок доступні вище і нижче.</div>';
    return;
  }
  const labels = res.items.map((r) => String(r.year));
  const values = res.items.map((r) => Number(r.dn.toFixed(2)));
  const lo = Math.min(...values), hi = Math.max(...values);
  const yMin = Math.floor(Math.min(30, lo - 3) / 5) * 5;
  const yMax = Math.ceil(Math.max(60, hi + 3) / 5) * 5;
  const line = (v) => labels.map(() => v);

  const datasets = [
    { label: "ДН, %", data: values, borderColor: "#102849", backgroundColor: "#102849", borderWidth: 3, pointRadius: 5, pointHoverRadius: 7, tension: .25 },
    { label: `Середнє (${fmt(res.avg)} %)`, data: line(Number(res.avg.toFixed(2))), borderColor: "#d9822b", borderDash: [8, 5], borderWidth: 2, pointRadius: 0 },
    { label: "Межі оптимуму (45 і 50 %)", data: line(X.Lopt), borderColor: "#16955a", borderDash: [4, 4], borderWidth: 1.5, pointRadius: 0 },
    { label: "", data: line(X.Ropt), borderColor: "#16955a", borderDash: [4, 4], borderWidth: 1.5, pointRadius: 0 },
    { label: "Критичні межі (35 і 55 %)", data: line(X.Lkrit), borderColor: "#d23f3f", borderDash: [4, 4], borderWidth: 1.5, pointRadius: 0 },
    { label: "", data: line(X.Rkrit), borderColor: "#d23f3f", borderDash: [4, 4], borderWidth: 1.5, pointRadius: 0 }
  ];

  if (chart) chart.destroy();
  chart = new Chart($("dnChart"), {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        y: { min: yMin, max: yMax, title: { display: true, text: "ДН, %" }, ticks: { callback: (v) => v + " %" } },
        x: { title: { display: true, text: "Рік (на 1 січня)" } }
      },
      plugins: {
        legend: { labels: { filter: (item) => item.text !== "", usePointStyle: true } },
        tooltip: {
          filter: (item) => item.datasetIndex === 0 || item.datasetIndex === 1,
          callbacks: {
            label: (ctx) => ctx.datasetIndex === 0
              ? `ДН: ${fmt(ctx.parsed.y)} % — ${level(ctx.parsed.y).level.toLowerCase()}`
              : `Середнє: ${fmt(ctx.parsed.y)} %`
          }
        }
      }
    },
    plugins: [zonesPlugin]
  });
}

/* ---------- Аналітичний висновок ---------- */

function conclusion(res) {
  const { items, avg, avgLevel, avgDev } = res;
  const first = items[0], last = items[items.length - 1];
  const country = escapeHtml(state.country);
  const p = [];

  // 1. Динаміка
  if (items.length === 1) {
    p.push(`У ${first.year} р. демографічне навантаження непрацездатного населення на працездатне в країні «${country}» становило <b>${fmt(first.dn)} %</b>, тобто на кожні 100 осіб працездатного віку припадало ${fmt(first.dn, 1)} особи непрацездатного віку.`);
  } else {
    const d = last.dn - first.dn;
    const verb = Math.abs(d) < 0.05 ? "практично не змінилося" : d > 0 ? "зросло" : "знизилося";
    const ups = items.slice(1).filter((r, i) => r.dn > items[i].dn).length;
    const mono = ups === items.length - 1 ? " і зростало щороку" : ups === 0 ? " і знижувалося щороку" : "";
    p.push(`У ${first.year}–${last.year} рр. демографічне навантаження непрацездатного населення на працездатне в країні «${country}» ${verb}${Math.abs(d) < 0.05 ? "" : ` з <b>${fmt(first.dn)} %</b> до <b>${fmt(last.dn)} %</b> (${signed(d)} в. п.)`}${mono}. На кінець періоду на кожні 100 осіб працездатного віку припадало ${fmt(last.dn, 1)} особи непрацездатного віку.`);
  }

  // 2. Середнє та рівень
  let pos;
  if (avgDev === 0) pos = "перебуває в межах оптимального діапазону 45–50 %";
  else if (avgDev > 0) pos = `перевищує верхню межу оптимального діапазону (50 %) на ${fmt(avgDev)} в. п.`;
  else pos = `нижче за нижню межу оптимального діапазону (45 %) на ${fmt(-avgDev)} в. п.`;
  p.push(`Середнє значення індикатора за період — <b>${fmt(avg)} %</b>, що ${pos} і відповідає рівню економічної безпеки <b>«${avgLevel.level.toLowerCase()}»</b> за шкалою наказу № 1277.`);

  // 3. Структура навантаження та зміст відхилення
  const elderShare = last.elderly / last.nonWorking * 100;
  const main = elderShare >= 50
    ? `особи віком 60 років і старше (${fmt(elderShare, 1)} % непрацездатного населення у ${last.year} р.)`
    : `діти віком 0–15 років (${fmt(100 - elderShare, 1)} % непрацездатного населення у ${last.year} р.)`;
  if (avgLevel.side === "R") {
    p.push(`Індикатор перебуває в правій (дестимулюючій) частині шкали: надмірне навантаження означає, що меншій кількості працездатних доводиться утримувати більшу кількість дітей і літніх людей. Основний внесок формують ${main}. Це посилює тиск на Пенсійний фонд, державний бюджет і систему охорони здоров'я та звужує базу оподаткування.`);
  } else if (avgLevel.side === "L") {
    p.push(`Індикатор перебуває в лівій (стимулюючій) частині шкали: замале навантаження свідчить про низьку частку дітей і майбутній брак трудових ресурсів. Основний внесок формують ${main}.`);
  } else {
    p.push(`Співвідношення непрацездатного і працездатного населення збалансоване. Основний внесок формують ${main}.`);
  }

  // 4. Тенденція відносно оптимуму, найкращий і найгірший роки
  if (items.length > 1) {
    const dist = (r) => Math.abs(r.dev);
    const best = items.reduce((a, b) => (dist(b) < dist(a) ? b : a));
    const worst = items.reduce((a, b) => (dist(b) > dist(a) ? b : a));
    let trend;
    if (dist(last) < dist(first) - 0.05) trend = "<b>позитивна</b>: значення наближається до оптимального діапазону";
    else if (dist(last) > dist(first) + 0.05) trend = "<b>негативна</b>: значення віддаляється від оптимального діапазону";
    else trend = "<b>стабільна</b>: віддаленість від оптимального діапазону істотно не змінилася";
    p.push(`Тенденція ${trend}. Найближче до оптимуму — ${best.year} р. (${fmt(best.dn)} %, «${best.lvl.level.toLowerCase()}»), найдалі — ${worst.year} р. (${fmt(worst.dn)} %, «${worst.lvl.level.toLowerCase()}»).`);

    const counts = {};
    items.forEach((r) => { counts[r.lvl.level] = (counts[r.lvl.level] || 0) + 1; });
    const list = Object.entries(counts).map(([k, n]) => `«${k.toLowerCase()}» — ${n} ${yearWord(n)}`).join("; ");
    p.push(`Розподіл років за рівнями безпеки: ${list}.`);
  }

  // 5. Рекомендації
  let rec;
  if (avgLevel.side === "R") {
    rec = "Доцільні заходи: стимулювання народжуваності та підтримка сімей з дітьми, збільшення тривалості здорового життя й зайнятості осіб передпенсійного віку, повернення трудових мігрантів, реформування пенсійної системи (розвиток накопичувального рівня).";
  } else if (avgLevel.side === "L") {
    rec = "Доцільні заходи: підтримка народжуваності та сімей з дітьми, створення умов для залучення молоді, планування потреб ринку праці на довгострокову перспективу.";
  } else {
    rec = "Рекомендовано зберігати збалансовану демографічну політику та регулярно відстежувати індикатор, щоб вчасно виявити відхилення від оптимального діапазону.";
  }
  p.push(rec);
  p.push(`<span class="text-muted">У розрахунку інтегрального індексу демографічної безпеки індикатор 2.6 враховується з ваговим коефіцієнтом ${fmt(WEIGHT, 4)}.</span>`);

  return p.map((t) => `<p>${t}</p>`).join("");
}

/* ---------- Обробники кнопок ---------- */

function onCalculate() {
  // Перевіряємо й крок 1, щоб не рахувати за застарілим періодом
  const period = validatePeriod();
  if (!period) {
    showMessage("Виправте помилки в полях «Країна» та «Період» і сформуйте таблицю повторно.");
    return;
  }
  if (period.from !== state.years[0] || period.to !== state.years[state.years.length - 1] || $("unit").value !== state.unit) {
    showMessage('Період або одиниці змінено. Натисніть «Сформувати таблицю», щоб оновити рядки.', "info");
    return;
  }
  state.country = period.country;

  const v = validate();
  if (!v.ok) {
    $("results").classList.add("hidden");
    showMessage(`<b>Розрахунок неможливий — виправте ${v.errors.length} ${errorWord(v.errors.length)}:</b><ul>${v.errors.slice(0, 8).map((e) => `<li>${escapeHtml(e)}</li>`).join("")}${v.errors.length > 8 ? "<li>…</li>" : ""}</ul>`);
    return;
  }
  if (v.warnings.length) {
    showMessage(`<b>Розрахунок виконано, але є попередження:</b><ul>${v.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul>`, "warn");
  } else {
    showMessage("Дані коректні. Розрахунок виконано.", "info");
  }

  state.results = calc(v.rows);
  renderResults(state.results);
}

function fillExample() {
  $("country").value = EXAMPLE.country;
  $("yearFrom").value = EXAMPLE.rows[0].year;
  $("yearTo").value = EXAMPLE.rows[EXAMPLE.rows.length - 1].year;
  $("unit").value = "persons";
  if (!buildTable(false)) return;
  EXAMPLE.rows.forEach((r) => {
    const tr = document.querySelector(`#inputBody tr[data-year="${r.year}"]`);
    FIELDS.forEach((f) => { tr.querySelector(`[data-key="${f.key}"]`).value = fmt(r[f.key], 0); });
  });
  showMessage("Таблицю заповнено офіційними даними Держстату на 1 січня 2017–2021 рр. Натисніть «Розрахувати».", "info");
}

function clearAll() {
  $("country").value = "";
  $("yearFrom").value = "";
  $("yearTo").value = "";
  $("unit").value = "persons";
  ["country", "yearFrom", "yearTo"].forEach((id) => setFieldError($(id), ""));
  $("inputBody").innerHTML = "";
  $("dataCard").classList.add("hidden");
  $("results").classList.add("hidden");
  if (chart) { chart.destroy(); chart = null; }
  state.years = [];
  state.results = null;
  clearMessage();
  $("country").focus();
}

function downloadCSV() {
  if (!state.results) return;
  const { items, avg, avgLevel } = state.results;
  const u = unitLabel();
  const rows = [
    ["Платформа", "Демографічне навантаження непрацездатного населення на працездатне (індикатор 2.6)"],
    ["Країна", state.country],
    [],
    ["Рік", `Діти 0–15, ${u}`, `Особи 60+, ${u}`, `Непрацездатні, ${u}`, `Працездатні 16–59, ${u}`, "ДН, %", "Відхилення від оптимуму, в. п.", "Рівень безпеки"],
    ...items.map((r) => [r.year, fmtPop(r.children), fmtPop(r.elderly), fmtPop(r.nonWorking), fmtPop(r.working), fmt(r.dn), signed(r.dev), r.lvl.level]),
    ["Середнє", "", "", "", "", fmt(avg), signed(deviation(avg)), avgLevel.level],
    [],
    ["Порогові значення (наказ № 1277)", "оптимум 45–50 %; критичні межі 35 % і 55 %"]
  ];
  const csv = rows.map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(";")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `demographic-load-${items[0].year}-${items[items.length - 1].year}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function renderThresholds() {
  $("thresholds").innerHTML = LEVELS.map((t) => `
    <div class="threshold ${t.cls}"><div class="interval">${t.label} %</div><div class="level">${t.level}</div></div>`).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  $("maxYear").textContent = MAX_YEAR;
  renderThresholds();

  $("buildBtn").addEventListener("click", () => buildTable(true));
  $("exampleBtn").addEventListener("click", fillExample);
  $("clearBtn").addEventListener("click", clearAll);
  $("calcBtn").addEventListener("click", onCalculate);
  $("csvBtn").addEventListener("click", downloadCSV);
  $("printBtn").addEventListener("click", () => window.print());

  // Enter у полях кроку 1 — сформувати таблицю, у таблиці — розрахувати
  ["country", "yearFrom", "yearTo"].forEach((id) =>
    $(id).addEventListener("keydown", (e) => { if (e.key === "Enter") buildTable(true); }));
  $("inputBody").addEventListener("keydown", (e) => { if (e.key === "Enter") onCalculate(); });
  // Знімаємо підсвічування помилки, щойно користувач почав виправляти
  document.addEventListener("input", (e) => {
    if (e.target.matches("input.is-invalid, input.is-warning")) setFieldError(e.target, "");
  });
});
