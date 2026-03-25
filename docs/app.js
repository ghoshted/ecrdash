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
  if (!Array.isArray(reports) || reports.length === 0) {
    const body = document.getElementById("reportsTableBody");
    body.innerHTML = "";
    document.getElementById("tableMeta").textContent = "No report entries available.";
    document.getElementById("pageIndicator").textContent = "Page 0 / 0";
    return;
  }

  const sortValue = (report, key) => {
    if (key === "startTime") return report.startTime || "";
    if (key === "toolName") return report.toolName || "";
    if (key === "infra") return Array.isArray(report.infra) ? report.infra.join(", ") : "";
    if (key === "durationSeconds") return Number(report.durationSeconds) || 0;
    if (key === "inputSizeBytes") return Number(report.inputSizeBytes) || 0;
    if (key === "outputSizeBytes") return Number(report.outputSizeBytes) || 0;
    if (key === "cpu") {
      const used = Number(report.cpuCoresUsed) || 0;
      const assigned = Number(report.cpuCoresAssigned) || 0;
      return used * 1000 + assigned;
    }
    if (key === "gpuCoresUsed") return Number(report.gpuCoresUsed) || 0;
    return "";
  };

  const compare = (a, b, key, direction) => {
    const va = sortValue(a, key);
    const vb = sortValue(b, key);
    const base = typeof va === "number" && typeof vb === "number"
      ? va - vb
      : String(va).localeCompare(String(vb));
    return direction === "asc" ? base : -base;
  };

  const sorted = [...reports].sort((a, b) => compare(a, b, tableState.sortKey, tableState.sortDir));
  const total = sorted.length;
  const pageSize = tableState.pageSize;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  tableState.page = Math.min(Math.max(tableState.page, 1), totalPages);

  const startIndex = (tableState.page - 1) * pageSize;
  const endIndexExclusive = Math.min(startIndex + pageSize, total);
  const pageRows = sorted.slice(startIndex, endIndexExclusive);

  const body = document.getElementById("reportsTableBody");
  body.innerHTML = "";

  for (const report of pageRows) {
    const infraNames = Array.isArray(report.infra) && report.infra.length ? report.infra.join(", ") : "-";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(report.startTime)}</td>
      <td>${report.toolName}</td>
      <td>${infraNames}</td>
      <td>${formatDuration(report.durationSeconds)}</td>
      <td>${formatBytes(report.inputSizeBytes)}</td>
      <td>${formatBytes(report.outputSizeBytes)}</td>
      <td>${report.cpuCoresUsed}/${report.cpuCoresAssigned}</td>
      <td>${report.gpuCoresUsed}</td>
    `;
    body.appendChild(tr);
  }

  const tableMeta = document.getElementById("tableMeta");
  tableMeta.textContent = `Showing ${startIndex + 1}-${endIndexExclusive} of ${total}`;

  const pageIndicator = document.getElementById("pageIndicator");
  pageIndicator.textContent = `Page ${tableState.page} / ${totalPages}`;

  const prevBtn = document.getElementById("prevPageBtn");
  const nextBtn = document.getElementById("nextPageBtn");
  prevBtn.disabled = tableState.page <= 1;
  nextBtn.disabled = tableState.page >= totalPages;

  const headers = document.querySelectorAll("th.sortable");
  for (const th of headers) {
    const key = th.dataset.sortKey;
    if (key === tableState.sortKey) {
      th.classList.add("sorted");
      th.textContent = `${th.dataset.label || th.textContent.replace(/\s[↑↓]$/, "")} ${tableState.sortDir === "asc" ? "↑" : "↓"}`;
    } else {
      th.classList.remove("sorted");
      th.textContent = th.dataset.label || th.textContent.replace(/\s[↑↓]$/, "");
    }
  }
}

const tableState = {
  sortKey: "startTime",
  sortDir: "desc",
  page: 1,
  pageSize: 25,
};

function setupTableControls(reports) {
  const headers = document.querySelectorAll("th.sortable");
  for (const th of headers) {
    if (!th.dataset.label) {
      th.dataset.label = th.textContent;
    }

    th.addEventListener("click", () => {
      const key = th.dataset.sortKey;
      if (!key) return;

      if (tableState.sortKey === key) {
        tableState.sortDir = tableState.sortDir === "asc" ? "desc" : "asc";
      } else {
        tableState.sortKey = key;
        tableState.sortDir = "asc";
      }
      tableState.page = 1;
      renderTable(reports);
    });
  }

  const pageSizeSelect = document.getElementById("pageSizeSelect");
  pageSizeSelect.addEventListener("change", () => {
    tableState.pageSize = Number(pageSizeSelect.value) || 25;
    tableState.page = 1;
    renderTable(reports);
  });

  document.getElementById("prevPageBtn").addEventListener("click", () => {
    tableState.page -= 1;
    renderTable(reports);
  });

  document.getElementById("nextPageBtn").addEventListener("click", () => {
    tableState.page += 1;
    renderTable(reports);
  });
}

const COUNTRY_COORDS = {
  albania: [41.1533, 20.1683],
  andorra: [42.5063, 1.5218],
  austria: [47.5162, 14.5501],
  belgium: [50.5039, 4.4699],
  bosniaandherzegovina: [43.9159, 17.6791],
  bulgaria: [42.7339, 25.4858],
  croatia: [45.1, 15.2],
  cyprus: [35.1264, 33.4299],
  czechrepublic: [49.8175, 15.473],
  czechia: [49.8175, 15.473],
  denmark: [56.2639, 9.5018],
  estonia: [58.5953, 25.0136],
  finland: [61.9241, 25.7482],
  france: [46.2276, 2.2137],
  germany: [51.1657, 10.4515],
  greece: [39.0742, 21.8243],
  hungary: [47.1625, 19.5033],
  iceland: [64.9631, -19.0208],
  ireland: [53.1424, -7.6921],
  italy: [41.8719, 12.5674],
  latvia: [56.8796, 24.6032],
  liechtenstein: [47.166, 9.5554],
  lithuania: [55.1694, 23.8813],
  luxembourg: [49.8153, 6.1296],
  malta: [35.9375, 14.3754],
  moldova: [47.4116, 28.3699],
  montenegro: [42.7087, 19.3744],
  netherlands: [52.1326, 5.2913],
  northmacedonia: [41.6086, 21.7453],
  norway: [60.472, 8.4689],
  poland: [51.9194, 19.1451],
  portugal: [39.3999, -8.2245],
  romania: [45.9432, 24.9668],
  serbia: [44.0165, 21.0059],
  slovakia: [48.669, 19.699],
  slovenia: [46.1512, 14.9955],
  spain: [40.4637, -3.7492],
  sweden: [60.1282, 18.6435],
  switzerland: [46.8182, 8.2275],
  ukraine: [48.3794, 31.1656],
  unitedkingdom: [55.3781, -3.436],
};

function normalizeCountryKey(country) {
  return String(country || "").toLowerCase().replace(/[^a-z]/g, "");
}

function countryCoordinate(country) {
  const key = normalizeCountryKey(country);
  return COUNTRY_COORDS[key] ?? null;
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

async function renderLocationMap(byCountry) {
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

  if (!Array.isArray(byCountry) || byCountry.length === 0) {
    statusEl.textContent = "No populated location fields were found in reports.";
    return;
  }

  statusEl.textContent = "Resolving country locations...";

  const markers = [];
  const unresolved = [];

  for (const entry of byCountry) {
    const country = entry.country;
    const count = entry.count ?? 0;

    const known = countryCoordinate(country);
    if (known) {
      const marker = L.marker(known).addTo(map);
      marker.bindPopup(`<strong>${country}</strong><br/>Reports: ${count}`);
      markers.push(marker);
      continue;
    }

    try {
      const result = await geocode(country);
      if (!result) {
        unresolved.push(country);
        continue;
      }

      const marker = L.marker([result.lat, result.lon]).addTo(map);
      marker.bindPopup(`<strong>${country}</strong><br/>Reports: ${count}<br/>${result.displayName}`);
      markers.push(marker);
    } catch (_error) {
      unresolved.push(country);
    }
  }

  if (markers.length === 0) {
    statusEl.textContent = "Location values exist, but coordinates could not be resolved.";
    return;
  }

  if (unresolved.length > 0) {
    statusEl.textContent = `Showing ${markers.length} mapped countr${markers.length === 1 ? "y" : "ies"}. Unresolved: ${unresolved.join(", ")}.`;
    return;
  }

  statusEl.textContent = `Showing ${markers.length} mapped countr${markers.length === 1 ? "y" : "ies"}.`;
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
  await renderLocationMap(data.summary.byCountry || []);
  setupTableControls(data.reports);
  renderTable(data.reports);
}

bootstrap().catch((error) => {
  console.error(error);
  document.getElementById("generatedAt").textContent = "failed to load";
  document.getElementById("summaryCards").innerHTML = `<article class="card"><div class="card-label">Error</div><div class="card-value">Data load failed</div></article>`;
});
