const DATA_URL = "https://hfhjbbzbuzebilfuydtm.supabase.co/functions/v1/clever-api";
const ACTIVE_TAB_STORAGE_KEY = "kokstadDashboardActiveTab";
const ONE_MINUTE_MS = 60 * 1000;

const state = {
  payload: null,
  activeTab: getStoredActiveTab(),
};

const elements = {
  routeSubtitle: document.getElementById("routeSubtitle"),
  routeTabs: document.getElementById("routeTabs"),
  summaryGrid: document.getElementById("summaryGrid"),
  clockValue: document.getElementById("clockValue"),
  updatedValue: document.getElementById("updatedValue"),
  severityPill: document.getElementById("severityPill"),
  heroDelay: document.getElementById("heroDelay"),
  heroSummary: document.getElementById("heroSummary"),
  queueLengthValue: document.getElementById("queueLengthValue"),
  liveDurationValue: document.getElementById("liveDurationValue"),
  freeFlowValue: document.getElementById("freeFlowValue"),
  distanceValue: document.getElementById("distanceValue"),
  routeStrip: document.getElementById("routeStrip"),
  routeLegend: document.getElementById("routeLegend"),
  originLabelValue: document.getElementById("originLabelValue"),
  destinationLabelValue: document.getElementById("destinationLabelValue"),
  queueStartValue: document.getElementById("queueStartValue"),
  queueEndValue: document.getElementById("queueEndValue"),
  queueDurationValue: document.getElementById("queueDurationValue"),
  peakDelayValue: document.getElementById("peakDelayValue"),
  delayChart: document.getElementById("delayChart"),
  weekdayHeatmap: document.getElementById("weekdayHeatmap"),
  yesterdayStartValue: document.getElementById("yesterdayStartValue"),
  yesterdayEndValue: document.getElementById("yesterdayEndValue"),
  yesterdayDurationValue: document.getElementById("yesterdayDurationValue"),
  yesterdayPeakValue: document.getElementById("yesterdayPeakValue"),
  forecastTodayStartValue: document.getElementById("forecastTodayStartValue"),
  forecastTodayEndValue: document.getElementById("forecastTodayEndValue"),
  forecastTodayDurationValue: document.getElementById("forecastTodayDurationValue"),
  forecastTodayPeakValue: document.getElementById("forecastTodayPeakValue"),
  forecastTomorrowStartValue: document.getElementById("forecastTomorrowStartValue"),
  forecastTomorrowEndValue: document.getElementById("forecastTomorrowEndValue"),
  forecastTomorrowDurationValue: document.getElementById("forecastTomorrowDurationValue"),
  forecastTomorrowPeakValue: document.getElementById("forecastTomorrowPeakValue"),
};

function getStoredActiveTab() {
  try {
    return window.localStorage.getItem(ACTIVE_TAB_STORAGE_KEY) ?? "summary";
  } catch {
    return "summary";
  }
}

function setStoredActiveTab(tabId) {
  try {
    window.localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, tabId);
  } catch {
    // Ignore storage failures on locked-down kiosk devices.
  }
}

function formatTime(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function displayTime(value) {
  if (!value) {
    return "--";
  }
  return value.includes("T") ? formatTime(value) : value;
}

function formatMinutesFromSeconds(seconds) {
  return `${Math.round((seconds ?? 0) / 60)} min`;
}

function formatMinutes(value) {
  return `${Math.round(value ?? 0)} min`;
}

function formatMeters(meters) {
  if ((meters ?? 0) >= 1000) {
    return `${((meters ?? 0) / 1000).toFixed(2).replace(".", ",")} km`;
  }
  return `${Math.round(meters ?? 0)} m`;
}

function formatAxisMeters(meters) {
  if ((meters ?? 0) >= 1000) {
    return `${((meters ?? 0) / 1000).toFixed(1).replace(".", ",")} km`;
  }
  return `${Math.round(meters ?? 0)} m`;
}

function niceQueueStep(maxValue) {
  if (maxValue <= 40) {
    return 10;
  }
  if (maxValue <= 120) {
    return 20;
  }
  if (maxValue <= 240) {
    return 40;
  }
  if (maxValue <= 500) {
    return 100;
  }
  return 200;
}

function setClock() {
  elements.clockValue.textContent = new Intl.DateTimeFormat("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
}

function isActiveRefreshMinute(date) {
  const day = date.getDay();
  if (day === 0 || day === 6) {
    return false;
  }

  const totalMinutes = date.getHours() * 60 + date.getMinutes();
  const minute = date.getMinutes();

  if (totalMinutes < 8 * 60 || totalMinutes >= 17 * 60) {
    return false;
  }

  if (totalMinutes < 12 * 60) {
    return minute === 0;
  }

  if (totalMinutes < 14 * 60) {
    return minute % 10 === 0;
  }

  if (totalMinutes < 14 * 60 + 30) {
    return minute % 5 === 0;
  }

  if (totalMinutes < 16 * 60 + 30) {
    return minute % 2 === 0;
  }

  return minute % 5 === 0;
}

function getRefreshDelayMs(now = new Date()) {
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() + 1);

  for (let i = 0; i < 8 * 24 * 60; i += 1) {
    if (isActiveRefreshMinute(next)) {
      return Math.max(next.getTime() - now.getTime(), ONE_MINUTE_MS);
    }
    next.setMinutes(next.getMinutes() + 1);
  }

  return 12 * 60 * ONE_MINUTE_MS;
}

function severityInfo(delaySec, thresholds = { lightDelaySec: 120, queueDelaySec: 300, majorDelaySec: 900 }) {
  if (delaySec >= thresholds.majorDelaySec) {
    return { label: "Betydelig kø", color: "#ff6b5f" };
  }
  if (delaySec >= thresholds.queueDelaySec) {
    return { label: "Kø", color: "#ffb84d" };
  }
  if (delaySec >= thresholds.lightDelaySec) {
    return { label: "Litt kø", color: "#ffd36e" };
  }
  return { label: "Flyt i trafikken", color: "#5fd497" };
}

function summaryTrendScore(snapshot) {
  if (!snapshot) {
    return 0;
  }

  return (snapshot.delaySec ?? 0) * 2 + (snapshot.queueLengthMeters ?? 0);
}

function getSummaryTrend(baseSnapshot, targetSnapshot) {
  if (!baseSnapshot || !targetSnapshot) {
    return null;
  }

  const delta = summaryTrendScore(targetSnapshot) - summaryTrendScore(baseSnapshot);

  if (Math.abs(delta) < 45) {
    return { icon: "→", label: "Stabil", className: "flat" };
  }

  if (delta > 0) {
    return { icon: "↗", label: "Opp", className: "up" };
  }

  return { icon: "↘", label: "Ned", className: "down" };
}

function renderTabs(payload) {
  const tabs = [
    { id: "summary", label: "Summary" },
    ...(payload.routes ?? []).map((route) => ({
      id: route.id,
      label: route.tabLabel,
    })),
  ];

  elements.routeTabs.innerHTML = "";
  tabs.forEach((tab) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `route-tab${state.activeTab === tab.id ? " active" : ""}`;
    button.textContent = tab.label;
    button.addEventListener("click", () => {
      state.activeTab = tab.id;
      setStoredActiveTab(tab.id);
      applyView();
    });
    elements.routeTabs.appendChild(button);
  });
}

function renderSummarySlot(label, snapshot, thresholds, trend = null) {
  if (!snapshot) {
    return `
      <div class="summary-slot">
        <div class="summary-slot-topline">
          <span class="summary-slot-label">${label}</span>
        </div>
        <strong>--</strong>
        <span class="summary-slot-meta">Ikke tilgjengelig</span>
      </div>
    `;
  }

  const info = severityInfo(snapshot.delaySec ?? 0, thresholds);
  const trendMarkup = trend
    ? `
      <span class="summary-trend trend-${trend.className}">
        <span class="summary-trend-icon">${trend.icon}</span>
        ${trend.label}
      </span>
    `
    : "";

  return `
    <div class="summary-slot">
      <div class="summary-slot-topline">
        <span class="summary-slot-label">${label}</span>
        ${trendMarkup}
      </div>
      <strong>${formatMeters(snapshot.queueLengthMeters ?? 0)}</strong>
      <span class="summary-slot-meta">${formatMinutesFromSeconds(snapshot.delaySec ?? 0)} forsinkelse</span>
      <span class="summary-pill" style="color:${info.color};background:${info.color}1e;border-color:${info.color}33;">${info.label}</span>
    </div>
  `;
}

function renderSummary(payload) {
  elements.summaryGrid.innerHTML = (payload.summary ?? [])
    .map((item) => {
      const trendTo30 = getSummaryTrend(item.now, item.plus30);
      const trendTo60 = getSummaryTrend(item.plus30 ?? item.now, item.plus60);

      return `
        <article class="summary-card">
          <div class="summary-card-head">
            <div>
              <h4>${item.label}</h4>
              <p>${item.title}</p>
            </div>
            <span class="summary-updated">${item.updatedAt ? displayTime(item.updatedAt) : "--"}</span>
          </div>
          <div class="summary-slots">
            ${renderSummarySlot("Nå", item.now, item.thresholds)}
            ${renderSummarySlot("+30 min", item.plus30, item.thresholds, trendTo30)}
            ${renderSummarySlot("+1 time", item.plus60, item.thresholds, trendTo60)}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderHero(route) {
  const info = severityInfo(route.current.delaySec ?? 0, route.thresholds);
  elements.severityPill.textContent = info.label;
  elements.severityPill.style.color = info.color;
  elements.severityPill.style.background = `${info.color}1e`;
  elements.severityPill.style.borderColor = `${info.color}33`;

  elements.heroDelay.textContent = formatMinutes((route.current.delaySec ?? 0) / 60);
  elements.heroSummary.textContent =
    `Strekningen bruker nå ${formatMinutesFromSeconds(route.current.durationSec ?? 0)} mot ` +
    `${formatMinutesFromSeconds(route.current.staticDurationSec ?? 0)} under normal flyt. ` +
    `Estimert købelastning ligger på ${formatMeters(route.current.queueLengthMeters ?? 0)} av ruten.`;
  elements.queueLengthValue.textContent = formatMeters(route.current.queueLengthMeters ?? 0);
  elements.liveDurationValue.textContent = formatMinutesFromSeconds(route.current.durationSec ?? 0);
  elements.freeFlowValue.textContent = formatMinutesFromSeconds(route.current.staticDurationSec ?? 0);
  elements.distanceValue.textContent = formatMeters(route.current.distanceMeters ?? 0);
  elements.updatedValue.textContent = route.updatedAt ? formatTime(route.updatedAt) : "--";
  elements.routeSubtitle.textContent = route.subtitle;
  elements.originLabelValue.textContent = route.originLabel;
  elements.destinationLabelValue.textContent = route.destinationLabel;
}

function renderRoute(route) {
  elements.routeStrip.innerHTML = "";
  (route.current.segments ?? []).forEach((segment) => {
    const el = document.createElement("div");
    el.className = `route-segment speed-${String(segment.speed ?? "NORMAL").toLowerCase().replace("traffic_jam", "jam")}`;
    el.style.setProperty("--segment-weight", String(Math.max(0.8, (segment.distanceMeters ?? 0) / 180)));
    el.innerHTML = `<span>${segment.label}</span>`;
    elements.routeStrip.appendChild(el);
  });

  elements.routeLegend.innerHTML = `
    <span class="legend-chip normal">Normal</span>
    <span class="legend-chip slow">Sakte</span>
    <span class="legend-chip jam">Kø</span>
  `;
}

function renderTodayStats(route) {
  elements.queueStartValue.textContent = route.today.queueStart ? displayTime(route.today.queueStart) : "Ingen tydelig kø";
  elements.queueEndValue.textContent = route.today.queueEnd ? displayTime(route.today.queueEnd) : "Pågår";
  elements.queueDurationValue.textContent = formatMinutes(route.today.queueDurationMinutes ?? 0);
  elements.peakDelayValue.textContent = formatMinutes(route.today.peakDelayMinutes ?? 0);
}

function renderQueueChart(route) {
  const svg = elements.delayChart;
  const width = 640;
  const height = 220;
  const padding = { top: 28, right: 12, bottom: 30, left: 54 };

  const chart = route.queueChart ?? {
    slots: [],
    today: [],
    yesterday: [],
    average: [],
  };

  const slots = chart.slots ?? [];
  const todaySeries = chart.today ?? [];
  const yesterdaySeries = chart.yesterday ?? [];
  const averageSeries = chart.average ?? [];

  if (!slots.length) {
    svg.innerHTML = "";
    return;
  }

  const allValues = [
    ...todaySeries.map((item) => item.queueLengthMeters ?? 0),
    ...yesterdaySeries.map((item) => item.queueLengthMeters ?? 0),
    ...averageSeries.map((item) => item.queueLengthMeters ?? 0),
  ];

  const actualMaxQueue = Math.max(...allValues, 0);
  const step = niceQueueStep(actualMaxQueue);
  const maxQueue = Math.max(40, Math.ceil(Math.max(actualMaxQueue, 1) / step) * step);
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const tickValues = [0, maxQueue / 2, maxQueue].map((value) => Math.round(value / step) * step);
  const labelIndexes = slots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => slot.endsWith(":00") || slot.endsWith(":30"))
    .map(({ index }) => index);

  const x = (index) => padding.left + (index / Math.max(slots.length - 1, 1)) * innerWidth;
  const y = (value) => padding.top + innerHeight - (value / maxQueue) * innerHeight;
  const pathFor = (series) =>
    series
      .map((point, index) => `${index === 0 ? "M" : "L"} ${x(index).toFixed(1)} ${y(point.queueLengthMeters ?? 0).toFixed(1)}`)
      .join(" ");

  const todayPath = pathFor(todaySeries);
  const yesterdayPath = pathFor(yesterdaySeries);
  const averagePath = pathFor(averageSeries);
  const areaPath =
    `${todayPath} L ${x(slots.length - 1).toFixed(1)} ${height - padding.bottom} ` +
    `L ${x(0).toFixed(1)} ${height - padding.bottom} Z`;

  const gridLines = [...new Set(tickValues.filter((value) => value > 0))]
    .map((value) => {
      const pos = y(value);
      return `
        <line x1="${padding.left}" y1="${pos}" x2="${width - padding.right}" y2="${pos}" stroke="rgba(255,255,255,0.08)" />
        <text x="${padding.left - 10}" y="${pos + 4}" text-anchor="end" fill="rgba(150,168,189,0.88)" font-size="11">${formatAxisMeters(value)}</text>
      `;
    })
    .join("");

  const labels = labelIndexes
    .map((index) => `
      <text x="${x(index)}" y="${height - 8}" text-anchor="middle" fill="rgba(150,168,189,0.9)" font-size="11">
        ${slots[index]}
      </text>
    `)
    .join("");

  const emptyState =
    actualMaxQueue === 0
      ? `<text x="${padding.left}" y="${padding.top - 8}" fill="rgba(150,168,189,0.72)" font-size="11">14:00–17:00 uten tydelig kø</text>`
      : "";

  const legend = `
    <g transform="translate(${padding.left}, 10)">
      <line x1="0" y1="0" x2="18" y2="0" stroke="rgba(130,152,179,0.72)" stroke-width="2" stroke-dasharray="6 6"></line>
      <text x="24" y="4" fill="rgba(150,168,189,0.88)" font-size="11">Historisk snitt</text>
      <line x1="148" y1="0" x2="166" y2="0" stroke="rgba(127,191,255,0.55)" stroke-width="2"></line>
      <text x="172" y="4" fill="rgba(150,168,189,0.88)" font-size="11">Gårsdag</text>
      <line x1="252" y1="0" x2="270" y2="0" stroke="#ffb84d" stroke-width="3"></line>
      <text x="276" y="4" fill="rgba(240,247,255,0.92)" font-size="11">I dag</text>
    </g>
  `;

  svg.innerHTML = `
    <defs>
      <linearGradient id="queueArea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(255,184,77,0.36)" />
        <stop offset="100%" stop-color="rgba(255,184,77,0.02)" />
      </linearGradient>
    </defs>
    ${legend}
    <line x1="${padding.left}" y1="${y(0)}" x2="${width - padding.right}" y2="${y(0)}" stroke="rgba(255,255,255,0.08)" />
    ${gridLines}
    ${emptyState}
    <path d="${areaPath}" fill="url(#queueArea)"></path>
    <path d="${averagePath}" fill="none" stroke="rgba(130,152,179,0.72)" stroke-width="2" stroke-dasharray="6 6" stroke-linejoin="round" stroke-linecap="round"></path>
    <path d="${yesterdayPath}" fill="none" stroke="rgba(127,191,255,0.55)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path>
    <path d="${todayPath}" fill="none" stroke="#ffb84d" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"></path>
    ${todaySeries
      .map(
        (point, index) => `
      <circle cx="${x(index)}" cy="${y(point.queueLengthMeters ?? 0)}" r="3.5" fill="#08111a" stroke="#54d5ff" stroke-width="2"></circle>
    `,
      )
      .join("")}
    ${labels}
  `;
}

function heatColor(value) {
  const alpha = 0.12 + value * 0.68;
  const red = Math.round(84 + value * 171);
  const green = Math.round(213 - value * 82);
  const blue = Math.round(255 - value * 167);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function renderHeatmap(route) {
  const days = state.payload?.weekdayLabels ?? ["Man", "Tir", "Ons", "Tor", "Fre"];
  const container = elements.weekdayHeatmap;
  container.innerHTML = "";

  container.appendChild(document.createElement("div"));
  days.forEach((day) => {
    const el = document.createElement("div");
    el.className = "heatmap-header";
    el.textContent = day;
    container.appendChild(el);
  });

  (route.weekdayProfile ?? []).forEach((row) => {
    const label = document.createElement("div");
    label.className = "heatmap-row-label";
    label.textContent = row.time;
    container.appendChild(label);

    row.values.forEach((value) => {
      const cell = document.createElement("div");
      cell.className = "heatmap-cell";
      cell.style.background = heatColor(value);
      cell.textContent = `${Math.round(value * 10) / 10}`;
      container.appendChild(cell);
    });
  });
}

function fillForecast(prefix, payload) {
  const fallbackText = payload?.sampleSize ? "--" : "Bygger historikk";
  elements[`${prefix}StartValue`].textContent = payload?.startLabel ?? fallbackText;
  elements[`${prefix}EndValue`].textContent = payload?.endLabel ?? fallbackText;
  elements[`${prefix}DurationValue`].textContent = payload ? formatMinutes(payload.durationMinutes ?? 0) : fallbackText;
  elements[`${prefix}PeakValue`].textContent = payload ? formatMeters(payload.peakQueueLengthMeters ?? 0) : fallbackText;
}

function renderForecasts(route) {
  fillForecast("yesterday", route.yesterday);
  fillForecast("forecastToday", route.forecastToday);
  fillForecast("forecastTomorrow", route.forecastTomorrow);
}

function applyView() {
  if (!state.payload) {
    return;
  }

  renderTabs(state.payload);

  if (state.activeTab === "summary") {
    document.body.classList.add("summary-mode");
    document.body.classList.remove("route-mode");
    elements.routeSubtitle.textContent = "Oversikt over flere ruter fra Kokstad, med estimering nå og frem i tid.";
    elements.updatedValue.textContent = state.payload.updatedAt ? formatTime(state.payload.updatedAt) : "Laster";
    renderSummary(state.payload);
    return;
  }

  const route = state.payload.routes.find((item) => item.id === state.activeTab) ?? state.payload.routes[0];
  if (!route || !route.current) {
    return;
  }

  document.body.classList.remove("summary-mode");
  document.body.classList.add("route-mode");
  renderHero(route);
  renderRoute(route);
  renderTodayStats(route);
  renderQueueChart(route);
  renderHeatmap(route);
  renderForecasts(route);
}

async function loadDashboard() {
  const response = await fetch(DATA_URL, { cache: "no-store" });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail ?? data.error ?? "Ukjent feil");
  }

  state.payload = data;
  if (state.activeTab !== "summary" && !data.routes.some((route) => route.id === state.activeTab)) {
    state.activeTab = "summary";
    setStoredActiveTab("summary");
  }

  applyView();
}

function scheduleDashboardPolling() {
  const delay = getRefreshDelayMs();

  window.setTimeout(() => {
    loadDashboard()
      .catch((error) => {
        elements.routeSubtitle.textContent = `Kunne ikke oppdatere dashboard-data: ${error.message}`;
      })
      .finally(scheduleDashboardPolling);
  }, delay);
}

setClock();
setInterval(setClock, 1000);
scheduleDashboardPolling();

loadDashboard().catch((error) => {
  elements.routeSubtitle.textContent = `Kunne ikke laste dashboard-data: ${error.message}`;
});
