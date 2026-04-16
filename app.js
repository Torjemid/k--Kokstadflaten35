const DATA_URL = "https://hfhjbbzbuzebilfuydtm.supabase.co/functions/v1/clever-api";

const elements = {
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
  return `${Math.round(seconds / 60)} min`;
}

function formatMinutes(value) {
  return `${Math.round(value)} min`;
}

function formatMeters(meters) {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2).replace(".", ",")} km`;
  }
  return `${Math.round(meters)} m`;
}

function formatAxisMeters(meters) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1).replace(".", ",")} km` : `${Math.round(meters)} m`;
}

function niceQueueStep(maxValue) {
  if (maxValue <= 10) {
    return 5;
  }
  if (maxValue <= 30) {
    return 10;
  }
  if (maxValue <= 80) {
    return 20;
  }
  if (maxValue <= 160) {
    return 40;
  }
  return 100;
}

function evenlySpacedIndexes(length, count) {
  if (length <= count) {
    return [...Array(length).keys()];
  }

  const indexes = new Set([0, length - 1]);
  for (let i = 1; i < count - 1; i += 1) {
    indexes.add(Math.round((i / (count - 1)) * (length - 1)));
  }

  return [...indexes].sort((a, b) => a - b);
}

function setClock() {
  elements.clockValue.textContent = new Intl.DateTimeFormat("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
}

function severityInfo(delaySec) {
  if (delaySec >= 300) {
    return { label: "Tydelig kø", color: "#ff6b5f" };
  }
  if (delaySec >= 120) {
    return { label: "Moderat kø", color: "#ffb84d" };
  }
  return { label: "Flyt i trafikken", color: "#5fd497" };
}

function renderHero(data) {
  const info = severityInfo(data.current.delaySec);
  elements.severityPill.textContent = info.label;
  elements.severityPill.style.color = info.color;
  elements.severityPill.style.background = `${info.color}1e`;
  elements.severityPill.style.borderColor = `${info.color}33`;

  elements.heroDelay.textContent = formatMinutes(data.current.delaySec / 60);
  elements.heroSummary.textContent =
    `Strekningen bruker nå ${formatMinutesFromSeconds(data.current.durationSec)} mot ` +
    `${formatMinutesFromSeconds(data.current.staticDurationSec)} under normal flyt. ` +
    `Estimert købelastning ligger på ${formatMeters(data.current.queueLengthMeters)} av ruten.`;
  elements.queueLengthValue.textContent = formatMeters(data.current.queueLengthMeters);
  elements.liveDurationValue.textContent = formatMinutesFromSeconds(data.current.durationSec);
  elements.freeFlowValue.textContent = formatMinutesFromSeconds(data.current.staticDurationSec);
  elements.distanceValue.textContent = formatMeters(data.current.distanceMeters);
  elements.updatedValue.textContent = formatTime(data.updatedAt);
}

function renderRoute(data) {
  elements.routeStrip.innerHTML = "";
  data.current.segments.forEach((segment) => {
    const el = document.createElement("div");
    el.className = `route-segment speed-${segment.speed.toLowerCase().replace("traffic_jam", "jam")}`;
    el.style.setProperty("--segment-weight", String(Math.max(0.8, segment.distanceMeters / 120)));
    el.innerHTML = `<span>${segment.label}</span>`;
    elements.routeStrip.appendChild(el);
  });

  elements.routeLegend.innerHTML = `
    <span class="legend-chip normal">Normal</span>
    <span class="legend-chip slow">Sakte</span>
    <span class="legend-chip jam">Kø</span>
  `;
}

function renderTodayStats(data) {
  elements.queueStartValue.textContent = data.today.queueStart ? displayTime(data.today.queueStart) : "Ingen tydelig kø";
  elements.queueEndValue.textContent = data.today.queueEnd ? displayTime(data.today.queueEnd) : "Pågår";
  elements.queueDurationValue.textContent = formatMinutes(data.today.queueDurationMinutes);
  elements.peakDelayValue.textContent = formatMinutes(data.today.peakDelayMinutes);
}

function renderQueueChart(data) {
  const svg = elements.delayChart;
  const width = 640;
  const height = 220;
  const padding = { top: 22, right: 16, bottom: 28, left: 48 };
  const points = data.recentSnapshots?.length
    ? data.recentSnapshots
    : [{ ts: data.updatedAt, queueLengthMeters: 0 }];
  const actualMaxQueue = Math.max(...points.map((item) => item.queueLengthMeters ?? 0), 0);
  const step = niceQueueStep(actualMaxQueue);
  const maxQueue = Math.max(step * 2, Math.ceil(Math.max(actualMaxQueue, 1) / step) * step);
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const x = (index) => padding.left + (index / Math.max(points.length - 1, 1)) * innerWidth;
  const y = (value) => padding.top + innerHeight - (value / maxQueue) * innerHeight;

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${x(index).toFixed(1)} ${y(point.queueLengthMeters ?? 0).toFixed(1)}`)
    .join(" ");

  const areaPath =
    `${linePath} L ${x(points.length - 1).toFixed(1)} ${height - padding.bottom} ` +
    `L ${x(0).toFixed(1)} ${height - padding.bottom} Z`;

  const tickValues = Array.from({ length: Math.max(2, Math.round(maxQueue / step)) + 1 }, (_, index) => index * step);
  const gridLines = tickValues
    .filter((value) => value > 0)
    .map((value) => {
    const pos = y(value);
    return `
      <line x1="${padding.left}" y1="${pos}" x2="${width - padding.right}" y2="${pos}" stroke="rgba(255,255,255,0.08)" />
      <text x="${padding.left - 8}" y="${pos + 4}" text-anchor="end" fill="rgba(150,168,189,0.88)" font-size="11">${formatAxisMeters(value)}</text>
    `;
  }).join("");

  const labels = evenlySpacedIndexes(points.length, 4)
    .map((index) => `
      <text x="${x(index)}" y="${height - 8}" text-anchor="middle" fill="rgba(150,168,189,0.9)" font-size="11">
        ${displayTime(points[index].ts)}
      </text>
    `)
    .join("");

  const emptyState = actualMaxQueue === 0
    ? `<text x="${padding.left}" y="${padding.top - 4}" fill="rgba(150,168,189,0.72)" font-size="11">Ingen målbar kø siste målinger</text>`
    : "";

  svg.innerHTML = `
    <defs>
      <linearGradient id="queueArea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(255,184,77,0.40)" />
        <stop offset="100%" stop-color="rgba(255,184,77,0.03)" />
      </linearGradient>
    </defs>
    <line x1="${padding.left}" y1="${y(0)}" x2="${width - padding.right}" y2="${y(0)}" stroke="rgba(255,255,255,0.08)" />
    ${gridLines}
    ${emptyState}
    <path d="${areaPath}" fill="url(#queueArea)"></path>
    <path d="${linePath}" fill="none" stroke="#ffb84d" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"></path>
    ${points.map((point, index) => `
      <circle cx="${x(index)}" cy="${y(point.queueLengthMeters ?? 0)}" r="4" fill="#08111a" stroke="#54d5ff" stroke-width="2"></circle>
    `).join("")}
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

function renderHeatmap(data) {
  const days = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];
  const container = elements.weekdayHeatmap;
  container.innerHTML = "";

  container.appendChild(document.createElement("div"));
  days.forEach((day) => {
    const el = document.createElement("div");
    el.className = "heatmap-header";
    el.textContent = day;
    container.appendChild(el);
  });

  data.weekdayProfile.forEach((row) => {
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

function renderForecasts(data) {
  fillForecast("yesterday", data.yesterday);
  fillForecast("forecastToday", data.forecastToday);
  fillForecast("forecastTomorrow", data.forecastTomorrow);
}

async function loadDashboard() {
  const response = await fetch(DATA_URL, { cache: "no-store" });
  const data = await response.json();

  renderHero(data);
  renderRoute(data);
  renderTodayStats(data);
  renderQueueChart(data);
  renderHeatmap(data);
  renderForecasts(data);
}

setClock();
setInterval(setClock, 1000);
loadDashboard().catch((error) => {
  elements.heroSummary.textContent = `Kunne ikke laste dashboard-data: ${error.message}`;
});
