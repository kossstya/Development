// Побудова аналітичної сторінки: KPI, таблиці, графіки (Chart.js)
const LVL_CLASS = {
  "Оптимальний": "opt", "Задовільний": "sat", "Незадовільний": "uns",
  "Небезпечний": "dang", "Критичний": "crit", "Абсолютна небезпека": "abs"
};
const LVL_SCORE = {
  "Абсолютна небезпека": 0, "Критичний": 1, "Небезпечний": 2,
  "Незадовільний": 3, "Задовільний": 4, "Оптимальний": 5
};
const COLORS = { a: "#1f4e9c", b: "#c8102e", opt: "rgba(26,143,76,.6)" };

const badge = (l) => `<span class="badge lvl-${LVL_CLASS[l]}">${l}</span>`;
const fmt = (v, d = 2) => Number(v).toLocaleString("uk-UA", { minimumFractionDigits: d, maximumFractionDigits: d });

// Опис показників: шкали порогів взято з файлу завдання
const INDICATORS = [
  {
    id: "cereal", title: "Урожайність зернових культур", unit: "ц/га", dec: 2,
    series: [{ key: "cereal", label: "Урожайність, ц/га" }],
    optimal: [45, 55],
    scale: [["(0; 15)", "abs"], ["[15; 20)", "crit"], ["[20; 25)", "dang"], ["[25; 35)", "uns"], ["[35; 45)", "sat"], ["[45; 55]", "opt"], ["(55; 75]", "sat"], ["(75; 95]", "uns"], ["(95; 100]", "dang"], ["(100; 150]", "crit"], ["(150; ∞)", "abs"]],
    current: 6,
    src: [["AG.YLD.CREL.KG", "https://data.worldbank.org/indicator/AG.YLD.CREL.KG?locations=KR"]],
    note: "Розрахунок: дані Світового банку (кг/га) ÷ 100 = ц/га.",
    comment: "Урожайність стабільно тримається в межах 62–68 ц/га, тобто у зоні «Задовільний» (вище за оптимум 45–55 ц/га). Таке перевищення означає дуже інтенсивне землеробство з великим навантаженням на ґрунти. Після піку 2021 року (68,25) видно слабку тенденцію до зниження (65,44 у 2024 р.). Головний ризик для продовольчої безпеки — не врожайність, а мала площа ріллі та сильна залежність від імпорту зерна."
  },
  {
    id: "le", title: "Очікувана тривалість життя при народженні", unit: "років", dec: 1,
    series: [{ key: "le_f", label: "Жінки" }, { key: "le_m", label: "Чоловіки" }],
    optimal: [78, null],
    scale: [["(0; 66)", "abs"], ["[66; 68)", "crit"], ["[68; 70)", "dang"], ["[70; 75)", "uns"], ["[75; 78)", "sat"], ["[78; ∞)", "opt"]],
    current: 5,
    src: [["SP.DYN.LE00.FE.IN", "https://data.worldbank.org/indicator/SP.DYN.LE00.FE.IN?locations=KR"], ["SP.DYN.LE00.MA.IN", "https://data.worldbank.org/indicator/SP.DYN.LE00.MA.IN?locations=KR"]],
    comment: "Обидва показники весь період перебувають на оптимальному рівні (≥ 78 років). Тенденція безпечна: у 2015–2024 рр. тривалість життя зросла на 1,4 року у жінок і на 1,8 року у чоловіків. Короткочасне зниження у 2022 р. (наслідки COVID-19) вже у 2023 р. було подолане. Розрив між жінками та чоловіками (≈ 5,8 року) поступово скорочується."
  },
  {
    id: "imr", title: "Смертність немовлят", unit: "на 1000 живонароджених", dec: 1,
    series: [{ key: "imr_f", label: "Дівчатка" }, { key: "imr_m", label: "Хлопчики" }],
    optimal: [null, 4],
    scale: [["[0; 4]", "opt"], ["(4; 5]", "sat"], ["(5; 7]", "uns"], ["(7; 9]", "dang"], ["(9; 11]", "crit"], ["(11; 1000]", "abs"]],
    current: 0,
    src: [["SP.DYN.IMRT.FE.IN", "https://data.worldbank.org/indicator/SP.DYN.IMRT.FE.IN?locations=KR"], ["SP.DYN.IMRT.MA.IN", "https://data.worldbank.org/indicator/SP.DYN.IMRT.MA.IN?locations=KR"]],
    comment: "Смертність немовлят дуже низька, значно нижча за поріг 4‰, тобто рівень оптимальний. Тенденція безпечна: показник постійно знижується (у дівчаток з 2,6 до 2,1, у хлопчиків з 3,1 до 2,5). Це свідчить про високу якість системи охорони здоров'я матері й дитини."
  },
  {
    id: "cov", title: "Коефіцієнт покриття імпорту експортом", unit: "разів", dec: 3,
    series: [{ key: "cov", label: "Експорт / Імпорт" }],
    optimal: [1, 1.2],
    scale: [["(0; 0,85)", "abs"], ["[0,85; 0,9)", "crit"], ["[0,9; 0,95)", "dang"], ["[0,95; 0,975)", "uns"], ["[0,975; 1)", "sat"], ["[1; 1,2]", "opt"], ["(1,2; 1,25]", "sat"], ["(1,25; 1,3]", "uns"], ["(1,3; 1,5]", "dang"], ["(1,5; 1,7]", "crit"], ["(1,7; ∞)", "abs"]],
    current: 5,
    src: [["NE.EXP.GNFS.ZS", "https://data.worldbank.org/indicator/NE.EXP.GNFS.ZS?locations=KR"], ["NE.IMP.GNFS.ZS", "https://data.worldbank.org/indicator/NE.IMP.GNFS.ZS?locations=KR"]],
    note: "Розрахунок: К = Експорт (% ВВП) ÷ Імпорт (% ВВП).",
    extra: "trade",
    comment: "Коефіцієнт увесь період перебуває в оптимальних межах [1; 1,2]. Проте у 2015–2022 рр. він знизився з 1,19 до 1,00, тобто майже до нижньої межі оптимуму. Це небезпечна тенденція: у 2022 р. імпорт подорожчав через ціни на енергоносії, і експорт ледве покривав імпорт. У 2024 р. показник відновився до 1,10. Водночас експорт становить ≈ 44 % ВВП, тож економіка дуже залежить від зовнішнього попиту."
  },
  {
    id: "rd", title: "Витрати на дослідження та розробки", unit: "% ВВП", dec: 2,
    series: [{ key: "rd", label: "Витрати на R&D, % ВВП" }],
    optimal: [3, null],
    scale: [["(0; 0,5)", "abs"], ["[0,5; 1)", "crit"], ["[1; 1,5)", "dang"], ["[1,5; 2)", "uns"], ["[2; 3)", "sat"], ["[3; ∞)", "opt"]],
    current: 5,
    src: [["GB.XPD.RSDV.GD.ZS", "https://data.worldbank.org/indicator/GB.XPD.RSDV.GD.ZS?locations=KR"]],
    comment: "Це найсильніша сторона економічної безпеки Кореї. Витрати на R&D зросли з 3,79 % до 4,94 % ВВП (2015–2023), що значно вище за оптимальний поріг 3 %. За цим показником Корея входить у число світових лідерів. Тенденція безпечна і стабільно зростаюча."
  },
  {
    id: "ineq", title: "Співвідношення доходів найбагатших 10 % і найбідніших 10 % населення", unit: "разів", dec: 2,
    series: [{ key: "ineq", label: "Децильний коефіцієнт" }],
    optimal: [null, 4.5],
    scale: [["[1; 4,5]", "opt"], ["(4,5; 5]", "sat"], ["(5; 5,5]", "uns"], ["(5,5; 6]", "dang"], ["(6; 7]", "crit"], ["(7; ∞)", "abs"]],
    current: 5,
    src: [["SI.DST.10TH.10", "https://data.worldbank.org/indicator/SI.DST.10TH.10?locations=KR"], ["SI.DST.FRST.10", "https://data.worldbank.org/indicator/SI.DST.FRST.10?locations=KR"]],
    note: "Розрахунок: Кд = частка доходів найбагатших 10 % ÷ частка доходів найбідніших 10 %. Останні доступні дані — 2021 р.",
    extra: "income",
    comment: "Це найслабше місце: увесь період показник перебуває в зоні «Абсолютна небезпека» (> 7 разів). Пік припав на 2016 р. (11,0 раза), далі тенденція позитивна: до 2021 р. коефіцієнт знизився до 8,62 раза завдяки зростанню частки доходів найбідніших (з 2,4 % до 2,9 %). Попри це, до безпечного рівня ще далеко."
  },
  {
    id: "debt", title: "Загальний борг центрального уряду", unit: "% ВВП", dec: 2,
    series: [{ key: "debt", label: "Борг уряду, % ВВП" }],
    optimal: [null, 20],
    scale: [["[0; 20]", "opt"], ["(20; 30]", "sat"], ["(30; 40]", "uns"], ["(40; 50]", "dang"], ["(50; 60]", "crit"], ["(60; ∞)", "abs"]],
    current: 3,
    src: [["GC.DOD.TOTL.GD.ZS", "https://data.worldbank.org/indicator/GC.DOD.TOTL.GD.ZS?locations=KR"]],
    comment: "Тенденція небезпечна. У 2015–2019 рр. борг становив 35–38 % ВВП (рівень «Незадовільний»). У 2020 р. через антикризові витрати під час пандемії він перейшов у зону «Небезпечний» (43,8 %) і зріс до 48,6 % у 2023 р. У 2024 р. борг трохи знизився (47,8 %), але лишається лише на ≈ 2 в. п. нижче від критичного порогу 50 %."
  }
];

const lastYear = (key) => { const ys = Object.keys(RESULTS.series[key]); return ys[ys.length - 1]; };
const firstYear = (key) => Object.keys(RESULTS.series[key])[0];
const point = (key, y) => RESULTS.series[key][y];

function renderKPIs() {
  const el = document.getElementById("kpis");
  const items = [];
  INDICATORS.forEach(ind => ind.series.forEach(s => {
    const y = lastYear(s.key), p = point(s.key, y);
    const label = ind.series.length > 1 ? `${ind.title} (${s.label.toLowerCase()})` : ind.title;
    items.push(`<div class="kpi bt-${LVL_CLASS[p.lvl]}">
      <div class="label">${label}</div>
      <div class="value">${fmt(p.v, ind.dec)} <span class="unit">${ind.unit}</span></div>
      <div class="muted small">${y} р. · ${badge(p.lvl)}</div></div>`);
  }));
  el.innerHTML = items.join("");
}

function trendText(key, lowerIsBetter) {
  const a = point(key, firstYear(key)).v, b = point(key, lastYear(key)).v;
  const diff = b - a, good = lowerIsBetter ? diff < 0 : diff > 0;
  const arrow = diff > 0 ? "▲" : diff < 0 ? "▼" : "■";
  return `<span class="${good ? "trend-up" : "trend-down"}">${arrow} ${fmt(Math.abs(diff), 2)}</span>`;
}

function renderSummary() {
  const tb = document.querySelector("#summary tbody");
  const rows = [];
  const lowerBetter = { imr_f: 1, imr_m: 1, ineq: 1, debt: 1 };
  const thr = { cereal: "[45; 55]", le_f: "[78; ∞)", le_m: "[78; ∞)", imr_f: "[0; 4]", imr_m: "[0; 4]", cov: "[1; 1,2]", rd: "[3; ∞)", ineq: "[1; 4,5]", debt: "[0; 20]" };
  const trendLabel = { cereal: "Стабільна (безпечна)", le_f: "Безпечна", le_m: "Безпечна", imr_f: "Безпечна", imr_m: "Безпечна", cov: "Небезпечна (наближення до нижньої межі)", rd: "Безпечна", ineq: "Безпечна (покращення, але рівень небезпечний)", debt: "Небезпечна" };
  let sum = 0, n = 0;
  INDICATORS.forEach(ind => ind.series.forEach(s => {
    const y0 = firstYear(s.key), y1 = lastYear(s.key), p0 = point(s.key, y0), p1 = point(s.key, y1);
    const name = ind.series.length > 1 ? `${ind.title} — ${s.label.toLowerCase()}` : ind.title;
    sum += LVL_SCORE[p1.lvl]; n++;
    rows.push(`<tr><td><a href="#${ind.id}">${name}</a>, ${ind.unit}</td><td>${thr[s.key]}</td>
      <td>${fmt(p0.v, ind.dec)} <span class="muted small">(${y0})</span></td>
      <td><strong>${fmt(p1.v, ind.dec)}</strong> <span class="muted small">(${y1})</span></td>
      <td>${trendText(s.key, lowerBetter[s.key])}</td><td>${badge(p1.lvl)}</td><td class="small">${trendLabel[s.key]}</td></tr>`);
  }));
  tb.innerHTML = rows.join("");
  const avg = sum / n;
  document.getElementById("integral").textContent = fmt(avg, 2);
  document.getElementById("integral-n").textContent = n;
}

// Горизонтальні лінії оптимальних меж на графіку
const thresholdPlugin = {
  id: "thresholds",
  afterDatasetsDraw(chart, args, opts) {
    if (!opts.lines) return;
    const { ctx, chartArea: a, scales: { y } } = chart;
    opts.lines.forEach(l => {
      if (l.value == null || l.value < y.min || l.value > y.max) return;
      const py = y.getPixelForValue(l.value);
      ctx.save();
      ctx.strokeStyle = l.color; ctx.setLineDash([6, 4]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(a.left, py); ctx.lineTo(a.right, py); ctx.stroke();
      ctx.fillStyle = l.color; ctx.font = "11px sans-serif";
      ctx.fillText(l.label, a.left + 6, py - 5);
      ctx.restore();
    });
  }
};

function renderIndicators() {
  const root = document.getElementById("indicators");
  INDICATORS.forEach((ind, idx) => {
    const years = Object.keys(RESULTS.series[ind.series[0].key]);
    const head = `<tr><th>Рік</th>${ind.series.map(s => `<th>${s.label}</th><th>Рівень</th>`).join("")}</tr>`;
    const body = years.map(y => `<tr><td>${y}</td>${ind.series.map(s => {
      const p = point(s.key, y); return p ? `<td>${fmt(p.v, ind.dec)}</td><td>${badge(p.lvl)}</td>` : "<td>—</td><td>—</td>";
    }).join("")}</tr>`).join("");
    const scale = ind.scale.map(([t, c], i) => `<div class="lvl-${c}${i === ind.current ? " current" : ""}" title="${t}">${t}</div>`).join("");
    const lastLvl = point(ind.series[0].key, lastYear(ind.series[0].key)).lvl;
    const src = ind.src.map(([c, u]) => `<a href="${u}" target="_blank" rel="noopener">${c}</a>`).join(", ");

    const sec = document.createElement("section");
    sec.className = "card indicator"; sec.id = ind.id;
    sec.innerHTML = `
      <div class="indicator-head"><h3>${idx + 1}. ${ind.title}, ${ind.unit}</h3>${badge(lastLvl)}</div>
      <div class="scale">${scale}</div>
      <p class="muted small" style="margin:0 0 12px">Шкала порогових значень (рамкою виділено інтервал, у якому перебуває останнє значення).</p>
      <div class="indicator-grid">
        <div class="chart-box"><canvas id="ch-${ind.id}"></canvas></div>
        <div class="table-wrap"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>
      </div>
      ${ind.extra ? `<div class="table-wrap" style="margin-top:14px">${extraTable(ind.extra)}</div>` : ""}
      <div class="comment">${ind.comment}</div>
      <p class="muted small" style="margin:8px 0 0">${ind.note ? ind.note + " " : ""}Джерело: World Bank, ${src}.</p>`;
    root.appendChild(sec);

    const lines = [];
    if (ind.optimal[0] != null) lines.push({ value: ind.optimal[0], color: COLORS.opt, label: `межа оптимуму ${ind.optimal[0]}` });
    if (ind.optimal[1] != null) lines.push({ value: ind.optimal[1], color: COLORS.opt, label: `межа оптимуму ${ind.optimal[1]}` });
    const vals = ind.series.flatMap(s => Object.values(RESULTS.series[s.key]).map(p => p.v));
    const all = vals.concat(lines.map(l => l.value));
    let min = Math.min(...all), max = Math.max(...all); const pad = (max - min) * 0.12 || 1;
    if (ind.id === "ineq" || ind.id === "imr") min = 0;

    new Chart(document.getElementById(`ch-${ind.id}`), {
      type: ind.id === "rd" || ind.id === "debt" ? "bar" : "line",
      data: {
        labels: years,
        datasets: ind.series.map((s, i) => ({
          label: s.label,
          data: years.map(y => point(s.key, y)?.v ?? null),
          borderColor: i ? COLORS.b : COLORS.a,
          backgroundColor: ind.id === "debt"
            ? years.map(y => getComputedStyle(document.documentElement).getPropertyValue(`--${LVL_CLASS[point(s.key, y).lvl]}`))
            : (i ? "rgba(200,16,46,.25)" : "rgba(31,78,156,.75)"),
          borderWidth: 2.5, tension: .25, pointRadius: 4
        }))
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { y: { min: Math.max(0, Math.floor((min - pad) * 10) / 10), max: Math.ceil((max + pad) * 10) / 10 } },
        plugins: { thresholds: { lines }, legend: { display: ind.series.length > 1 } }
      },
      plugins: [thresholdPlugin]
    });
  });
}

function extraTable(kind) {
  const R = RESULTS.raw;
  if (kind === "trade") {
    const ys = Object.keys(RESULTS.series.cov);
    return `<table><thead><tr><th>Рік</th>${ys.map(y => `<th>${y}</th>`).join("")}</tr></thead><tbody>
      <tr><td>Експорт, % ВВП</td>${ys.map(y => `<td>${fmt(R.exp[y])}</td>`).join("")}</tr>
      <tr><td>Імпорт, % ВВП</td>${ys.map(y => `<td>${fmt(R.imp[y])}</td>`).join("")}</tr>
      <tr><td><strong>К = Е / І</strong></td>${ys.map(y => `<td><strong>${fmt(RESULTS.series.cov[y].v, 3)}</strong></td>`).join("")}</tr></tbody></table>`;
  }
  const ys = Object.keys(RESULTS.series.ineq);
  return `<table><thead><tr><th>Рік</th>${ys.map(y => `<th>${y}</th>`).join("")}</tr></thead><tbody>
    <tr><td>Частка доходів найбагатших 10 %, %</td>${ys.map(y => `<td>${fmt(R.top10[y], 1)}</td>`).join("")}</tr>
    <tr><td>Частка доходів найбідніших 10 %, %</td>${ys.map(y => `<td>${fmt(R.bot10[y], 1)}</td>`).join("")}</tr>
    <tr><td><strong>Кд = 10 % / 10 %</strong></td>${ys.map(y => `<td><strong>${fmt(RESULTS.series.ineq[y].v)}</strong></td>`).join("")}</tr></tbody></table>`;
}

function renderRadar() {
  const labels = [], data = [];
  const short = { cereal: "Урожайність", le_f: "Тривалість життя (Ж)", le_m: "Тривалість життя (Ч)", imr_f: "Смертність немовлят (Ж)", imr_m: "Смертність немовлят (Ч)", cov: "Покриття імпорту", rd: "R&D", ineq: "Нерівність доходів", debt: "Держборг" };
  INDICATORS.forEach(ind => ind.series.forEach(s => {
    labels.push(short[s.key]); data.push(LVL_SCORE[point(s.key, lastYear(s.key)).lvl]);
  }));
  new Chart(document.getElementById("radar"), {
    type: "radar",
    data: { labels, datasets: [
      { label: "Бал рівня безпеки (0–5)", data, borderColor: COLORS.a, backgroundColor: "rgba(31,78,156,.25)", pointBackgroundColor: COLORS.a },
      { label: "Оптимальний рівень (5)", data: labels.map(() => 5), borderColor: COLORS.opt, borderDash: [5, 4], backgroundColor: "transparent", pointRadius: 0 }
    ] },
    options: { responsive: true, maintainAspectRatio: false, scales: { r: { min: 0, max: 5, ticks: { stepSize: 1 } } } }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderKPIs();
  renderSummary();
  renderIndicators();
  renderRadar();
});
