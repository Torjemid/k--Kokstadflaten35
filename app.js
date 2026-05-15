const DATA_URL = "https://hfhjbbzbuzebilfuydtm.supabase.co/functions/v1/clever-api";
const ACTIVE_TAB_STORAGE_KEY = "kokstadDashboardActiveTab";
const ONE_MINUTE_MS = 60 * 1000;
const LIVE_START_MINUTES = 14 * 60 + 30;
const EVENING_ROLLOVER_MINUTES = 18 * 60;

const state = {
  payload: null,
  activeTab: getStoredActiveTab(),
};

const elements = {
  routeSubtitle: document.getElementById("routeSubtitle"),
  routeTabs: document.getElementById("routeTabs"),
  clockValue: document.getElementById("clockValue"),
  updatedValue: document.getElementById("updatedValue"),
  queueLengthLabel: document.getElementById("queueLengthLabel"),
  queueLengthValue: document.getElementById("queueLengthValue"),
  liveDurationLabel: document.getElementById("liveDurationLabel"),
  liveDurationNote: document.getElementById("liveDurationNote"),
  heroDelay: document.getElementById("heroDelay"),
  liveDurationValue: document.getElementById("liveDurationValue"),
  freeFlowValue: document.getElementById("freeFlowValue"),
  severityLabel: document.getElementById("severityLabel"),
  statusSentence: document.getElementById("statusSentence"),
  chartTitle: document.getElementById("chartTitle"),
  chartSubtitle: document.getElementById("chartSubtitle"),
  delayChart: document.getElementById("delayChart"),
  actualLegendLabel: document.getElementById("actualLegendLabel"),
  expectedLegendLabel: document.getElementById("expectedLegendLabel"),
  yesterdayLegendLabel: document.getElementById("yesterdayLegendLabel"),
  historyLegendLabel: document.getElementById("historyLegendLabel"),
  expectedPeakTimeValue: document.getElementById("expectedPeakTimeValue"),
  expectedPeakLengthValue: document.getElementById("expectedPeakLengthValue"),
  expectedPeriodValue: document.getElementById("expectedPeriodValue"),
};

function getStoredActiveTab() {
  try {
    return window.localStorage.getItem(ACTIVE_TAB_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function setStoredActiveTab(tabId) {
  try {
    window.localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, tabId);
  } catch {
    // Some kiosk browsers lock down local storage.
  }
}

function coalesce(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function validDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function localDayStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function calendarDayDelta(fromDate, toDate = new Date()) {
  const from = localDayStart(fromDate);
  const to = localDayStart(toDate);
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function getRouteUpdatedDate(route) {
  return validDate(route?.updatedAt ?? state.payload?.updatedAt);
}

function getDashboardDayContext(route, now = new Date()) {
  const updatedDate = getRouteUpdatedDate(route);
  const currentMinutes = minutesSinceMidnight(now);
  const dataAgeDays = updatedDate ? calendarDayDelta(updatedDate, now) : null;
  const isSameDay = dataAgeDays === 0;
  const hasLiveWindowStarted = currentMinutes >= LIVE_START_MINUTES;
  const isEvening = currentMinutes >= EVENING_ROLLOVER_MINUTES;
  const isLiveNow = isSameDay && hasLiveWindowStarted && !isEvening;

  let actualLabel = "Siste målte kø";
  if (isSameDay) {
    actualLabel = "Kø i dag";
  } else if (dataAgeDays === 1) {
    actualLabel = "Kø i går";
  }

  return {
    updatedDate,
    dataAgeDays,
    isSameDay,
    hasLiveWindowStarted,
    isEvening,
    isLiveNow,
    actualLabel,
    expectedLabel: "Forventet i dag",
    historyLabel: "Historisk snitt",
    markerLabel: isLiveNow ? "Nå" : "Sist",
    showMarker: isSameDay && Boolean(updatedDate),
  };
}

function normalizeSnapshot(snapshot) {
  if (!snapshot) {
    return null;
  }

  return {
    ...snapshot,
    durationSec: coalesce(snapshot.durationSec, snapshot.duration_sec),
    staticDurationSec: coalesce(snapshot.staticDurationSec, snapshot.static_duration_sec),
    delaySec: coalesce(snapshot.delaySec, snapshot.delay_sec),
    queueLengthMeters: coalesce(snapshot.queueLengthMeters, snapshot.queue_length_m),
    trafficSeverity: coalesce(snapshot.trafficSeverity, snapshot.traffic_severity),
  };
}

function normalizeRoutes(payload) {
  const routes = Array.isArray(payload?.routes) ? payload.routes : [];

  if (routes.length) {
    return routes.map((route, index) => ({
      ...route,
      id: route.id ?? `route-${index}`,
      tabLabel: route.tabLabel ?? route.label ?? route.destinationLabel ?? `Rute ${index + 1}`,
      subtitle: route.subtitle ?? `Odfjell Drilling → ${route.destinationLabel ?? "Kokstadvegen"}`,
      current: normalizeSnapshot(route.current),
      updatedAt: route.updatedAt ?? payload.updatedAt,
      queueChart: route.queueChart ?? payload.queueChart,
      forecastToday: route.forecastToday ?? payload.forecastToday,
      today: route.today ?? payload.today,
      yesterday: route.yesterday ?? payload.yesterday,
    }));
  }

  return [
    {
      id: "kokstadvegen",
      tabLabel: "Kokstadvegen",
      subtitle: "Odfjell Drilling → Kokstadvegen",
      current: normalizeSnapshot(payload?.current),
      updatedAt: payload?.updatedAt,
      queueChart: payload?.queueChart,
      forecastToday: payload?.forecastToday,
      today: payload?.today,
      yesterday: payload?.yesterday,
    },
  ];
}

function formatClock(value) {
  return new Intl.DateTimeFormat("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatTime(value) {
  if (!value) {
    return "--";
  }

  if (typeof value === "string" && !value.includes("T")) {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return formatClock(date);
}

function formatMinutesFromSeconds(seconds, fallback = "-- min") {
  if (seconds === undefined || seconds === null || Number.isNaN(Number(seconds))) {
    return fallback;
  }

  return `${Math.round(Number(seconds) / 60)} min`;
}

function formatDelay(seconds) {
  if (seconds === undefined || seconds === null || Number.isNaN(Number(seconds))) {
    return "-- min";
  }

  const minutes = Math.round(Math.max(0, Number(seconds)) / 60);
  return minutes > 0 ? `+${minutes} min` : "0 min";
}

function formatMeters(meters, fallback = "-- m") {
  if (meters === undefined || meters === null || Number.isNaN(Number(meters))) {
    return fallback;
  }

  const value = Math.max(0, Number(meters));
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace(".", ",")} km`;
  }

  return `${Math.round(value / 10) * 10} m`;
}

function formatAxisMeters(meters) {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
  }

  return `${Math.round(meters)} m`;
}

function niceQueueStep(maxValue) {
  if (maxValue <= 100) {
    return 25;
  }
  if (maxValue <= 250) {
    return 50;
  }
  if (maxValue <= 600) {
    return 100;
  }
  if (maxValue <= 1200) {
    return 200;
  }
  return 500;
}

function severityInfo(snapshot, thresholds = {}) {
  const delaySec = Number(snapshot?.delaySec ?? 0);
  const queueMeters = Number(snapshot?.queueLengthMeters ?? 0);
  const severity = String(snapshot?.trafficSeverity ?? "").toUpperCase();
  const light = thresholds.lightDelaySec ?? 60;
  const queue = thresholds.queueDelaySec ?? 300;
  const major = thresholds.majorDelaySec ?? 900;

  if (severity.includes("MAJOR") || delaySec >= major || queueMeters >= 900) {
    return { key: "MAJOR_QUEUE", label: "Mye kø nå" };
  }
  if (severity === "QUEUE" || delaySec >= queue || queueMeters >= 350) {
    return { key: "QUEUE", label: "Kø nå" };
  }
  if (severity.includes("LIGHT") || delaySec > light || queueMeters > 0) {
    return { key: "LIGHT_QUEUE", label: "Lett kø nå" };
  }

  return { key: "NORMAL", label: queueMeters > 0 ? "Flyter fint nå" : "Ingen kø nå" };
}

function buildStatusSentence(snapshot, thresholds, context) {
  if (!snapshot) {
    return "Venter på data.";
  }

  const queueMeters = Number(snapshot.queueLengthMeters ?? 0);
  const durationText = formatMinutesFromSeconds(snapshot.durationSec);
  const normalText = formatMinutesFromSeconds(snapshot.staticDurationSec);
  const info = severityInfo(snapshot, thresholds);

  if (!context?.isSameDay) {
    const measuredWhen = context?.dataAgeDays === 1 ? "i går" : "sist";
    if (context?.hasLiveWindowStarted) {
      return `Live-måling er startet. Venter på første oppdatering fra dagens trafikk. Grafen viser forventet kø videre, ${context?.actualLabel.toLowerCase() ?? "siste målte kø"} og historisk snitt til ny måling kommer. Sist målt ${measuredWhen}: ${formatMeters(queueMeters)} kø og ${durationText} reisetid.`;
    }
    return `Neste live-måling starter 14:30. Grafen viser forventet kø i dag, ${context?.actualLabel.toLowerCase() ?? "siste målte kø"} og historisk snitt. Sist målt ${measuredWhen}: ${formatMeters(queueMeters)} kø og ${durationText} reisetid.`;
  }

  if (context?.isEvening) {
    return `Dagens live-målinger er ferdige. Sist målt kl. ${formatTime(context.updatedDate)}: ${formatMeters(queueMeters)} kø og ${durationText} reisetid.`;
  }

  const parts = [info.label + "."];
  parts.push(`Reisetiden er ${durationText}${normalText !== "-- min" ? `, normalt ${normalText}` : ""}.`);

  if (queueMeters > 0) {
    parts.push(`Estimert kø: ${formatMeters(queueMeters).replace(" m", " meter").replace(" km", " km")}.`);
  }

  return parts.join(" ");
}

function setClock() {
  elements.clockValue.textContent = formatClock(new Date());
}

function isActiveRefreshMinute(date) {
  const day = date.getDay();
  if (day === 0 || day === 6) {
    return false;
  }

  const totalMinutes = date.getHours() * 60 + date.getMinutes();
  const minute = date.getMinutes();
  const isFriday = day === 5;

  if (isFriday) {
    return totalMinutes >= 13 * 60 && totalMinutes <= 16 * 60 + 30 && minute % 5 === 0;
  }

  return totalMinutes >= 14 * 60 + 30 && totalMinutes <= 16 * 60 + 30 && minute % 5 === 0;
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

function getActiveRoute() {
  const routes = normalizeRoutes(state.payload);
  if (!routes.length) {
    return null;
  }

  const storedRoute = routes.find((route) => route.id === state.activeTab);
  return storedRoute ?? routes[0];
}

function renderHeader(route) {
  if (!route) {
    elements.routeSubtitle.textContent = "Odfjell Drilling → Kokstadvegen";
    elements.updatedValue.textContent = "Venter";
    return;
  }

  elements.routeSubtitle.textContent = route.subtitle ?? "Odfjell Drilling → Kokstadvegen";
  elements.updatedValue.textContent = route.updatedAt ? formatTime(route.updatedAt) : "Venter";
}

function renderRouteTabs(payload) {
  const routes = normalizeRoutes(payload);
  elements.routeTabs.innerHTML = "";

  routes.forEach((route) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `route-tab${route.id === state.activeTab ? " active" : ""}`;
    button.textContent = route.tabLabel;
    button.setAttribute("aria-pressed", route.id === state.activeTab ? "true" : "false");
    button.addEventListener("click", () => {
      state.activeTab = route.id;
      setStoredActiveTab(route.id);
      applyView();
    });
    elements.routeTabs.appendChild(button);
  });
}

function renderCurrentStatus(route) {
  const snapshot = route?.current;
  const thresholds = route?.thresholds ?? state.payload?.thresholds ?? {};
  const info = severityInfo(snapshot, thresholds);
  const context = getDashboardDayContext(route);
  const isStale = snapshot && !context.isLiveNow;
  const measuredSuffix = context.dataAgeDays === 1 ? "i går" : "sist målt";

  elements.queueLengthLabel.textContent = isStale ? `Kø ${measuredSuffix}` : "Kø nå";
  elements.liveDurationLabel.textContent = isStale ? `Reisetid ${measuredSuffix}` : "Reisetid nå";
  elements.queueLengthValue.textContent = formatMeters(snapshot?.queueLengthMeters);
  elements.heroDelay.textContent = formatDelay(snapshot?.delaySec);
  elements.liveDurationValue.textContent = formatMinutesFromSeconds(snapshot?.durationSec);
  elements.freeFlowValue.textContent = formatMinutesFromSeconds(snapshot?.staticDurationSec);
  elements.severityLabel.textContent = snapshot
    ? isStale
      ? `Sist målt ${context.dataAgeDays === 1 ? "i går" : `kl. ${formatTime(context.updatedDate)}`}`
      : info.label
    : "Venter på data";
  const weatherComment = route?.forecastToday?.weatherComment ?? route?.weatherInsight?.comment;
  elements.statusSentence.textContent = [
    buildStatusSentence(snapshot, thresholds, context),
    weatherComment,
  ].filter(Boolean).join(" ");
  document.body.dataset.severity = snapshot ? info.key : "UNKNOWN";
}

function normalizeSeriesPoint(point, index, slots) {
  if (!point) {
    return null;
  }

  const queueLengthMeters = coalesce(point.queueLengthMeters, point.queue_length_m);
  const delaySec = coalesce(point.delaySec, point.delay_sec);
  const timestamp = coalesce(point.ts, point.time, point.timestamp, slots?.[index]);

  if (queueLengthMeters === undefined && delaySec === undefined) {
    return null;
  }

  return {
    index,
    time: timestamp,
    queueLengthMeters: queueLengthMeters !== undefined ? Number(queueLengthMeters) : Math.max(0, Number(delaySec) * 1.25),
  };
}

function getChart(route) {
  const chart = route?.queueChart ?? {};
  const fallbackRecent = route?.recentSnapshots ?? state.payload?.recentSnapshots ?? [];
  const seriesCandidates = [chart.today, fallbackRecent, chart.average, chart.yesterday].filter((series) => Array.isArray(series) && series.length);
  const sourceSeries = seriesCandidates[0] ?? [];
  const slots = chart.slots?.length
    ? chart.slots
    : sourceSeries.map((point, index) => {
        const label = formatTime(point?.ts ?? point?.time ?? point?.timestamp);
        return label === "--" ? String(index + 1) : label;
      });

  return {
    slots,
    today: (chart.today ?? fallbackRecent).map((point, index) => normalizeSeriesPoint(point, index, slots)).filter(Boolean),
    forecastToday: (chart.forecastToday ?? chart.forecast_today ?? chart.forecast ?? chart.average ?? [])
      .map((point, index) => normalizeSeriesPoint(point, index, slots))
      .filter(Boolean),
    average: (chart.average ?? chart.forecast ?? []).map((point, index) => normalizeSeriesPoint(point, index, slots)).filter(Boolean),
    yesterday: (chart.yesterday ?? []).map((point, index) => normalizeSeriesPoint(point, index, slots)).filter(Boolean),
  };
}

function pathFor(points, x, y) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.index).toFixed(1)} ${y(point.queueLengthMeters).toFixed(1)}`)
    .join(" ");
}

function smoothPathFor(points, x, y) {
  if (!points.length) {
    return "";
  }

  const coords = points.map((point) => ({
    x: x(point.index),
    y: y(point.queueLengthMeters),
  }));

  if (coords.length < 3) {
    return coords
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
      .join(" ");
  }

  const d = [`M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`];
  for (let i = 0; i < coords.length - 1; i += 1) {
    const p0 = coords[Math.max(0, i - 1)];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[Math.min(coords.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d.push(`C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`);
  }

  return d.join(" ");
}

function areaPathFor(points, x, y, baseline) {
  const linePath = smoothPathFor(points, x, y);
  if (!linePath || points.length < 2) {
    return "";
  }

  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath} L ${x(last.index).toFixed(1)} ${baseline.toFixed(1)} L ${x(first.index).toFixed(1)} ${baseline.toFixed(1)} Z`;
}

function currentSlotIndex(slots, referenceTime) {
  if (!slots.length) {
    return null;
  }

  const referenceDate = referenceTime ? new Date(referenceTime) : new Date();
  const markerDate = Number.isNaN(referenceDate.getTime()) ? new Date() : referenceDate;
  const nowLabel = formatClock(markerDate);
  const exact = slots.findIndex((slot) => String(slot).slice(0, 5) === nowLabel);
  if (exact >= 0) {
    return exact;
  }

  const nowMinutes = markerDate.getHours() * 60 + markerDate.getMinutes();
  const slotMinutes = slots.map((slot) => {
    const match = String(slot).match(/(\d{1,2}):(\d{2})/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  });

  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  slotMinutes.forEach((minutes, index) => {
    if (minutes === null) {
      return;
    }
    const distance = Math.abs(minutes - nowMinutes);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  if (bestDistance > 45) {
    return null;
  }

  return bestIndex;
}

function renderQueueChart(route) {
  const svg = elements.delayChart;
  const width = 960;
  const height = 360;
  const padding = { top: 28, right: 36, bottom: 44, left: 72 };
  const chart = getChart(route);
  const slots = chart.slots;
  const context = getDashboardDayContext(route);
  const showToday = context.isSameDay && context.hasLiveWindowStarted;
  const nowIndex = context.showMarker ? currentSlotIndex(slots, route?.updatedAt ?? state.payload?.updatedAt) : null;
  const actualToday = showToday
    ? chart.today.filter((point) => nowIndex === null || point.index <= nowIndex)
    : [];
  const forecastSource = chart.forecastToday.length ? chart.forecastToday : chart.average;
  const visibleForecast = forecastSource.filter((point) => !showToday || nowIndex === null || point.index >= nowIndex);
  const visibleAverage = chart.average;
  const visibleYesterday = chart.yesterday;
  const showActualLegend = actualToday.length > 0;

  elements.chartTitle.textContent = "Købildet for i dag";
  elements.chartSubtitle.textContent =
    showToday
      ? "Faktisk nå, forventet videre, i går og historisk snitt"
      : "Forventet i dag, kø i går og historisk snitt";
  elements.actualLegendLabel.textContent = "Faktisk i dag";
  elements.expectedLegendLabel.textContent = "Forventet i dag";
  elements.yesterdayLegendLabel.textContent = "Kø i går";
  elements.historyLegendLabel.textContent = "Historisk snitt";
  elements.actualLegendLabel.parentElement.style.display = showActualLegend ? "inline-flex" : "none";

  if (!slots.length || (!actualToday.length && !visibleForecast.length && !visibleAverage.length && !visibleYesterday.length)) {
    svg.innerHTML = `
      <text x="48" y="78" fill="#637381" font-size="22" font-family="IBM Plex Sans, Arial">Venter på data</text>
    `;
    return;
  }

  const allValues = [...actualToday, ...visibleForecast, ...visibleAverage, ...visibleYesterday].map((point) => point.queueLengthMeters);
  const maxValue = Math.max(40, ...allValues);
  const step = niceQueueStep(maxValue);
  const maxQueue = Math.ceil(maxValue / step) * step;
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const x = (index) => padding.left + (index / Math.max(slots.length - 1, 1)) * innerWidth;
  const y = (value) => padding.top + innerHeight - (value / maxQueue) * innerHeight;
  const tickValues = [0, maxQueue / 2, maxQueue].map((value) => Math.round(value / step) * step);
  const labelIndexes = slots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }, index) => index === 0 || index === slots.length - 1 || String(slot).endsWith(":00") || String(slot).endsWith(":30"))
    .map(({ index }) => index);
  const uniqueLabelIndexes = [...new Set(labelIndexes)].filter((index, listIndex, list) => listIndex === 0 || index - list[listIndex - 1] > 1);
  const todayAtNow = actualToday.find((point) => point.index === nowIndex);

  const grid = tickValues
    .map((value) => `
      <line x1="${padding.left}" y1="${y(value)}" x2="${width - padding.right}" y2="${y(value)}" stroke="rgba(255,255,255,0.075)" stroke-width="1" />
      <text x="${padding.left - 14}" y="${y(value) + 5}" text-anchor="end" fill="rgba(255,255,255,0.42)" font-size="15" font-family="IBM Plex Sans, Arial">${formatAxisMeters(value)}</text>
    `)
    .join("");

  const labels = uniqueLabelIndexes
    .map((index) => `
      <text x="${x(index)}" y="${height - 12}" text-anchor="middle" fill="rgba(255,255,255,0.46)" font-size="15" font-family="IBM Plex Sans, Arial">${slots[index]}</text>
    `)
    .join("");

  const nowMarker =
    nowIndex !== null
      ? `
        <line x1="${x(nowIndex)}" y1="${padding.top}" x2="${x(nowIndex)}" y2="${height - padding.bottom}" stroke="#00c4d8" stroke-width="2" opacity="0.88" />
        <rect x="${x(nowIndex) - 28}" y="${padding.top - 26}" width="56" height="22" rx="11" fill="#00c4d8" />
        <text x="${x(nowIndex)}" y="${padding.top - 10}" text-anchor="middle" fill="#101010" font-size="13" font-weight="700" font-family="IBM Plex Sans, Arial">${context.markerLabel}</text>
        ${
          todayAtNow
            ? `<circle cx="${x(todayAtNow.index)}" cy="${y(todayAtNow.queueLengthMeters)}" r="6" fill="#171717" stroke="#67d7ff" stroke-width="4" />`
            : ""
        }
      `
      : "";
  const actualPath = smoothPathFor(actualToday, x, y);
  const forecastPath = smoothPathFor(visibleForecast, x, y);
  const averagePath = smoothPathFor(visibleAverage, x, y);
  const yesterdayPath = smoothPathFor(visibleYesterday, x, y);
  const baseline = height - padding.bottom;

  svg.innerHTML = `
    <defs>
      <linearGradient id="todayArea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#67d7ff" stop-opacity="0.26" />
        <stop offset="100%" stop-color="#67d7ff" stop-opacity="0" />
      </linearGradient>
      <linearGradient id="forecastArea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#94e7ff" stop-opacity="0.16" />
        <stop offset="100%" stop-color="#94e7ff" stop-opacity="0" />
      </linearGradient>
      <linearGradient id="averageArea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#a9b8c8" stop-opacity="0.12" />
        <stop offset="100%" stop-color="#a9b8c8" stop-opacity="0" />
      </linearGradient>
      <linearGradient id="historyArea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#85a8ff" stop-opacity="0.12" />
        <stop offset="100%" stop-color="#85a8ff" stop-opacity="0" />
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="#1f1f1f" />
    ${grid}
    <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" />
    ${visibleAverage.length ? `<path d="${areaPathFor(visibleAverage, x, y, baseline)}" fill="url(#averageArea)" />` : ""}
    ${visibleYesterday.length ? `<path d="${areaPathFor(visibleYesterday, x, y, baseline)}" fill="url(#historyArea)" />` : ""}
    ${visibleForecast.length ? `<path d="${areaPathFor(visibleForecast, x, y, baseline)}" fill="url(#forecastArea)" />` : ""}
    ${actualToday.length ? `<path d="${areaPathFor(actualToday, x, y, baseline)}" fill="url(#todayArea)" />` : ""}
    ${averagePath ? `<path d="${averagePath}" fill="none" stroke="#a9b8c8" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round" opacity="0.46" />` : ""}
    ${yesterdayPath ? `<path d="${yesterdayPath}" fill="none" stroke="#85a8ff" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" opacity="0.5" />` : ""}
    ${forecastPath ? `<path d="${forecastPath}" fill="none" stroke="#94e7ff" stroke-width="4" stroke-dasharray="10 10" stroke-linejoin="round" stroke-linecap="round" opacity="0.92" />` : ""}
    ${actualPath ? `<path d="${actualPath}" fill="none" stroke="#67d7ff" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" />` : ""}
    ${visibleAverage
      .filter((_, index) => index % 5 === 0)
      .map((point) => `<circle cx="${x(point.index)}" cy="${y(point.queueLengthMeters)}" r="3.7" fill="#a9b8c8" stroke="#1f1f1f" stroke-width="2" opacity="0.76" />`)
      .join("")}
    ${visibleForecast
      .filter((_, index) => index % 5 === 0)
      .map((point) => `<circle cx="${x(point.index)}" cy="${y(point.queueLengthMeters)}" r="4" fill="#94e7ff" stroke="#1f1f1f" stroke-width="2" opacity="0.88" />`)
      .join("")}
    ${actualToday
      .filter((_, index) => index % 5 === 0)
      .map((point) => `<circle cx="${x(point.index)}" cy="${y(point.queueLengthMeters)}" r="4.6" fill="#67d7ff" stroke="#1f1f1f" stroke-width="2" />`)
      .join("")}
    ${nowMarker}
    ${labels}
  `;
}

function getForecastPeriod(route) {
  const forecast = route?.forecastToday;
  const today = route?.today;
  const start = coalesce(forecast?.startLabel, forecast?.start_label, forecast?.start, today?.queueStart, today?.queue_start);
  const end = coalesce(forecast?.endLabel, forecast?.end_label, forecast?.end, today?.queueEnd, today?.queue_end);

  if (!start && !end) {
    const expectedSeries = getChart(route).average;
    const activePoints = getExpectedQueueWindow(expectedSeries);
    if (!activePoints) {
      return "Venter på data";
    }
    return `${activePoints.start}–${activePoints.end}`;
  }

  return `${formatTime(start)}–${end ? formatTime(end) : "pågår"}`;
}

function getExpectedQueueWindow(points) {
  if (!points.length) {
    return null;
  }

  const maxQueue = Math.max(...points.map((point) => point.queueLengthMeters), 0);
  const threshold = Math.max(40, maxQueue * 0.18);
  const active = points.filter((point) => point.queueLengthMeters >= threshold);
  if (!active.length) {
    return null;
  }

  return {
    start: formatTime(active[0].time),
    end: formatTime(active[active.length - 1].time),
  };
}

function getExpectedPeak(route) {
  const forecast = route?.forecastToday;
  const peakMeters = coalesce(forecast?.peakQueueLengthMeters, forecast?.peak_queue_length_m, forecast?.maxQueueLengthMeters, forecast?.max_queue_length_m);
  const peakTime = coalesce(forecast?.peakLabel, forecast?.peak_label, forecast?.peakTime, forecast?.peak_time);
  const expectedSeries = getChart(route).average;

  if (peakMeters !== undefined && peakMeters !== null) {
    const inferredPeak = expectedSeries.length
      ? expectedSeries.reduce((best, point) => (point.queueLengthMeters > best.queueLengthMeters ? point : best), expectedSeries[0])
      : null;

    return {
      time: peakTime ? formatTime(peakTime) : inferredPeak ? formatTime(inferredPeak.time) : "--",
      length: formatMeters(peakMeters),
    };
  }

  if (!expectedSeries.length) {
    return { time: "--", length: "-- m" };
  }

  const peak = expectedSeries.reduce((best, point) => (point.queueLengthMeters > best.queueLengthMeters ? point : best), expectedSeries[0]);
  return {
    time: formatTime(peak.time),
    length: formatMeters(peak.queueLengthMeters),
  };
}

function renderInsights(route) {
  const peak = getExpectedPeak(route);
  elements.expectedPeakTimeValue.textContent = peak.time === "--" ? "Venter på data" : `ca. ${peak.time}`;
  elements.expectedPeakLengthValue.textContent = peak.length;
  elements.expectedPeriodValue.textContent = getForecastPeriod(route);
}

function applyView() {
  if (!state.payload) {
    return;
  }

  const routes = normalizeRoutes(state.payload);
  if (!routes.some((route) => route.id === state.activeTab)) {
    state.activeTab = routes[0]?.id ?? null;
    if (state.activeTab) {
      setStoredActiveTab(state.activeTab);
    }
  }

  const route = getActiveRoute();
  renderHeader(route);
  renderRouteTabs(state.payload);
  renderCurrentStatus(route);
  renderQueueChart(route);
  renderInsights(route);
}

async function loadDashboard() {
  const response = await fetch(DATA_URL, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.detail ?? data.error ?? data.message ?? data.msg ?? `HTTP ${response.status}`);
  }

  state.payload = data;
  applyView();
}

function scheduleDashboardPolling() {
  const delay = getRefreshDelayMs();

  window.setTimeout(() => {
    loadDashboard()
      .catch((error) => {
        elements.routeSubtitle.textContent = `Kunne ikke oppdatere dashboard-data: ${error.message}`;
        elements.statusSentence.textContent = "Venter på data.";
      })
      .finally(scheduleDashboardPolling);
  }, delay);
}

setClock();
setInterval(setClock, 1000);
setInterval(() => {
  if (state.payload) {
    applyView();
  }
}, ONE_MINUTE_MS);
scheduleDashboardPolling();

loadDashboard().catch((error) => {
  elements.routeSubtitle.textContent = `Kunne ikke laste dashboard-data: ${error.message}`;
  elements.statusSentence.textContent = "Venter på data.";
  renderQueueChart(null);
});
