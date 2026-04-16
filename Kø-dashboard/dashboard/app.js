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
  episodesTableBody: document.getElementById("episodesTableBody"),
};

function formatTime(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDate(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatMinutes(seconds) {
  return `${Math.round(seconds / 60)} min`;
}

function formatMeters(meters) {
  return meters >= 1000
    ? `${(meters / 1000).toFixed(2).replace(".", ",")} km`
    : `${Math.round(meters)} m`;
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

  elements.heroDelay.textContent = `${Math.round(data.current.delaySec / 60)} min`;
  elements.heroSummary.textContent = `Strekningen bruker nå ${formatMinutes(data.current.durationSec)} mot ${formatMinutes(data.current.staticDurationSec)} under normal flyt. Estimert købelastning ligger på ${formatMeters(data.current.queueLengthMeters)} av ruten.`;
  elements.queueLengthValue.textContent = formatMeters(data.current.queueLengthMeters);
  elements.liveDurationValue.textContent = formatMinutes(data.current.durationSec);
  elements.freeFlowValue.textContent = formatMinutes(data.current.staticDurationSec);
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
  elements.queueStartValue.textContent = data.today.queueStart ? formatTime(data.today.queueStart) : "Ingen tydelig kø";
  elements.queueEndValue.textContent = data.today.queueEnd ? formatTime(data.today.queueEnd) : "Pågår";
  elements.queueDurationValue.textContent = `${data.today.queueDurationMinutes} min`;
  elements.peakDelayValue.textContent = `${data.today.peakDelayMinutes} min`;
}

function renderDelayChart(data) {
  const svg = elements.delayChart;
  const width = 640;
  const height = 240;
  const padding = { top: 18, right: 22, bottom: 28, left: 28 };
  const points = data.recentSnapshots;
  const maxDelay = Math.max(...points.map((item) => item.delaySec), 60);
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const x = (index) => padding.left + (index / Math.max(points.length - 1, 1)) * innerWidth;
  const y = (value) => padding.top + innerHeight - (value / maxDelay) * innerHeight;

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${x(index).toFixed(1)} ${y(point.delaySec).toFixed(1)}`)
    .join(" ");

  const areaPath = `${linePath} L ${x(points.length - 1).toFixed(1)} ${height - padding.bottom} L ${x(0).toFixed(1)} ${height - padding.bottom} Z`;

  const gridLines = Array.from({ length: 4 }, (_, index) => {
    const value = (maxDelay / 4) * (index + 1);
    const pos = y(value);
    return `
      <line x1="${padding.left}" y1="${pos}" x2="${width - padding.right}" y2="${pos}" stroke="rgba(255,255,255,0.08)" />
      <text x="${padding.left}" y="${pos - 6}" fill="rgba(150,168,189,0.9)" font-size="11">${Math.round(value / 60)} min</text>
    `;
  }).join("");

  const labelEvery = Math.max(1, Math.floor(points.length / 5));
  const labels = points
    .filter((_, index) => index % labelEvery === 0 || index === points.length - 1)
    .map((point) => {
      const index = points.indexOf(point);
      return `
        <text x="${x(index)}" y="${height - 8}" text-anchor="middle" fill="rgba(150,168,189,0.9)" font-size="11">
          ${formatTime(point.ts)}
        </text>
      `;
    }).join("");

  svg.innerHTML = `
    <defs>
      <linearGradient id="delayArea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(255,184,77,0.45)" />
        <stop offset="100%" stop-color="rgba(255,184,77,0.02)" />
      </linearGradient>
    </defs>
    ${gridLines}
    <path d="${areaPath}" fill="url(#delayArea)"></path>
    <path d="${linePath}" fill="none" stroke="#ffb84d" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"></path>
    ${points.map((point, index) => `
      <circle cx="${x(index)}" cy="${y(point.delaySec)}" r="4" fill="#08111a" stroke="#54d5ff" stroke-width="2"></circle>
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

function renderEpisodes(data) {
  elements.episodesTableBody.innerHTML = data.episodes
    .map((episode) => `
      <tr>
        <td>${formatDate(episode.date)}</td>
        <td>${episode.start ? formatTime(episode.start) : "-"}</td>
        <td>${episode.end ? formatTime(episode.end) : "-"}</td>
        <td>${episode.durationMinutes} min</td>
        <td>${episode.maxDelayMinutes} min</td>
        <td>${formatMeters(episode.maxQueueLengthMeters)}</td>
      </tr>
    `)
    .join("");
}

async function loadDashboard() {
  const response = await fetch(DATA_URL, { cache: "no-store" });
  const data = await response.json();

  renderHero(data);
  renderRoute(data);
  renderTodayStats(data);
  renderDelayChart(data);
  renderHeatmap(data);
  renderEpisodes(data);
}

setClock();
setInterval(setClock, 1000);
loadDashboard().catch((error) => {
  elements.heroSummary.textContent = `Kunne ikke laste dashboard-data: ${error.message}`;
});
