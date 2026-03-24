function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = Number(bytes) || 0;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value < 10 && unitIndex > 0 ? 2 : 1)} ${units[unitIndex]}`;
}

function formatDuration(seconds) {
  const sec = Number(seconds) || 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDate(isoTime) {
  if (!isoTime) return "-";
  const d = new Date(isoTime);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function card(label, value) {
  const el = document.createElement("article");
  el.className = "card";
  el.innerHTML = `<div class="card-label">${label}</div><div class="card-value">${value}</div>`;
  return el;
}

function renderSummary(summary, count) {
  const cardsHost = document.getElementById("summaryCards");
  cardsHost.innerHTML = "";

  cardsHost.append(
    card("Total Reports", `${count}`),
    card("Total Runtime", formatDuration(summary.totals.durationSeconds)),
    card("Total Input", formatBytes(summary.totals.inputBytes)),
    card("Total Output", formatBytes(summary.totals.outputBytes)),
    card("Average Runtime", formatDuration(summary.averages.durationSeconds)),
    card("Average Memory", `${summary.averages.memoryMb} MB`)
  );
}

function renderToolChart(summary) {
  const labels = summary.byTool.map((x) => x.name);
  const data = summary.byTool.map((x) => x.count);

  new Chart(document.getElementById("toolChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Runs",
          data,
          borderRadius: 8,
          backgroundColor: "rgba(216, 90, 52, 0.8)",
          borderColor: "rgba(216, 90, 52, 1)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } },
      },
    },
  });
}

function renderRuntimeTrend(summary) {
  const labels = summary.byDay.map((x) => x.day);
  const data = summary.byDay.map((x) => Number((x.durationSeconds / 60).toFixed(2)));

  new Chart(document.getElementById("runtimeChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Runtime (min)",
          data,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          borderColor: "rgba(47, 125, 139, 1)",
          backgroundColor: "rgba(47, 125, 139, 0.22)",
          tension: 0.3,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true },
      },
    },
  });
}

function renderTable(reports) {
  const body = document.getElementById("reportsTableBody");
  body.innerHTML = "";

  const sorted = [...reports].sort((a, b) => {
    if (!a.startTime && !b.startTime) return 0;
    if (!a.startTime) return 1;
    if (!b.startTime) return -1;
    return b.startTime.localeCompare(a.startTime);
  });

  for (const report of sorted.slice(0, 50)) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(report.startTime)}</td>
      <td>${report.toolName}</td>
      <td>${formatDuration(report.durationSeconds)}</td>
      <td>${formatBytes(report.inputSizeBytes)}</td>
      <td>${formatBytes(report.outputSizeBytes)}</td>
      <td>${report.cpuCoresUsed}/${report.cpuCoresAssigned}</td>
      <td>${report.gpuCoresUsed}</td>
    `;
    body.appendChild(tr);
  }
}

function locationQuery(location) {
  if (!location) return "";

  if (location.addressCountry) {
    return location.addressCountry;
  }

  return [
    location.name,
    location.addressLocality,
    location.addressRegion,
    location.postalCode,
    location.addressCountry,
  ]
    .filter(Boolean)
    .join(", ");
}

async function geocode(query) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", query);

  const res = await fetch(url.toString());
  if (!res.ok) {
    return null;
  }

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const first = data[0];
  const lat = Number(first.lat);
  const lon = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  return {
    lat,
    lon,
    displayName: first.display_name || query,
  };
}

async function renderLocationMap(reports) {
  const statusEl = document.getElementById("locationMapStatus");
  const europeBounds = L.latLngBounds(
    [32, -11],
    [67, 32]
  );
  const map = L.map("locationMap", {
    zoomControl: true,
    maxBounds: europeBounds.pad(0.08),
    maxBoundsViscosity: 1,
  });
  map.fitBounds(europeBounds);
  map.setZoom(map.getZoom() + 1);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  const locationCounts = new Map();
  for (const report of reports) {
    const query = locationQuery(report.location);
    if (!query) continue;
    const current = locationCounts.get(query) ?? 0;
    locationCounts.set(query, current + 1);
  }

  const queries = [...locationCounts.keys()];
  if (queries.length === 0) {
    statusEl.textContent = "No populated location fields were found in reports.";
    return;
  }

  statusEl.textContent = "Resolving location coordinates...";

  const markers = [];
  for (const query of queries) {
    try {
      const result = await geocode(query);
      if (!result) continue;

      const count = locationCounts.get(query) ?? 0;
      const marker = L.marker([result.lat, result.lon]).addTo(map);
      marker.bindPopup(`<strong>${query}</strong><br/>Reports: ${count}<br/>${result.displayName}`);
      markers.push(marker);
    } catch (_error) {
      // Ignore per-location geocoding failures and continue rendering remaining markers.
    }
  }

  if (markers.length === 0) {
    statusEl.textContent = "Location values exist, but coordinates could not be resolved.";
    return;
  }

  statusEl.textContent = `Showing ${markers.length} mapped location${markers.length === 1 ? "" : "s"}.`;
}

async function bootstrap() {
  const res = await fetch("./data/reports.json", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Could not load report data: ${res.status}`);
  }

  const data = await res.json();

  document.getElementById("generatedAt").textContent = formatDate(data.generatedAt);
  renderSummary(data.summary, data.reportCount);
  renderToolChart(data.summary);
  renderRuntimeTrend(data.summary);
  await renderLocationMap(data.reports);
  renderTable(data.reports);
}

bootstrap().catch((error) => {
  console.error(error);
  document.getElementById("generatedAt").textContent = "failed to load";
  document.getElementById("summaryCards").innerHTML = `<article class="card"><div class="card-label">Error</div><div class="card-value">Data load failed</div></article>`;
});
