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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatValue(value, key = "") {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (key.toLowerCase().includes("time")) {
    return formatDate(value);
  }

  if (key.toLowerCase().includes("bytes")) {
    return `${formatBytes(value)} (${Number(value) || 0} B)`;
  }

  if (key === "durationSeconds") {
    return `${formatDuration(value)} (${Number(value) || 0}s)`;
  }

  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "-";
  }

  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

function detailList(entries) {
  const filtered = entries.filter(([, value]) => value !== undefined);
  if (filtered.length === 0) {
    return '<p class="hint">No data available.</p>';
  }

  return `<dl class="report-detail-list">${filtered
    .map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`)
    .join("")}</dl>`;
}

function renderChipList(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return '<p class="hint">No data available.</p>';
  }

  return `<div class="report-chip-list">${values
    .map((value) => `<span class="report-chip">${escapeHtml(value)}</span>`)
    .join("")}</div>`;
}

function renderReportModal(report) {
  const modal = document.getElementById("reportModal");
  const title = document.getElementById("reportModalTitle");
  const eyebrow = document.getElementById("reportModalEyebrow");
  const content = document.getElementById("reportModalContent");

  const infraNames = Array.isArray(report.infra) && report.infra.length ? report.infra.join(", ") : "-";
  const location = report.location || null;
  const locationLines = location
    ? [location.name, location.addressLocality, location.addressRegion, location.postalCode, location.addressCountry].filter(Boolean)
    : [];

  eyebrow.textContent = report.fileName || "Report details";
  title.textContent = report.toolName || "Selected report";

  content.innerHTML = `
    <div class="report-detail-grid">
      <section class="report-detail-card">
        <h3>Run Overview</h3>
        ${detailList([
          ["Start Time", formatValue(report.startTime, "startTime")],
          ["End Time", formatValue(report.endTime, "endTime")],
          ["Duration", formatValue(report.durationSeconds, "durationSeconds")],
          ["Recorded Day", formatValue(report.startDay)],
          ["Tool", formatValue(report.toolName)],
          ["Infra", infraNames],
        ])}
      </section>
      <section class="report-detail-card">
        <h3>Resources</h3>
        ${detailList([
          ["CPU", `${formatValue(report.cpuCoresUsed)} / ${formatValue(report.cpuCoresAssigned)}`],
          ["GPU", formatValue(report.gpuCoresUsed)],
          ["Memory (MB)", formatValue(report.memoryUsedMb)],
          ["Input", formatValue(report.inputSizeBytes, "inputSizeBytes")],
          ["Output", formatValue(report.outputSizeBytes, "outputSizeBytes")],
        ])}
      </section>
      <section class="report-detail-card">
        <h3>Tool Metadata</h3>
        ${detailList([
          ["Tool Name", formatValue(report.toolName)],
          ["Tool Version", formatValue(report.toolVersion)],
          ["Package Version", formatValue(report.packageVersion)],
          ["Report File", formatValue(report.fileName)],
        ])}
      </section>
      <section class="report-detail-card">
        <h3>Location</h3>
        <div class="report-detail-stack">
          ${detailList([
            ["Place Name", formatValue(location?.name)],
            ["Country", formatValue(location?.addressCountry)],
            ["Region", formatValue(location?.addressRegion)],
            ["Locality", formatValue(location?.addressLocality)],
            ["Postal Code", formatValue(location?.postalCode)],
          ])}
          <p class="hint">${escapeHtml(locationLines.length ? locationLines.join(", ") : "No location metadata recorded.")}</p>
        </div>
      </section>
      <section class="report-detail-card report-detail-card--full">
        <h3>Infrastructure</h3>
        ${renderChipList(report.infra)}
      </section>
      <section class="report-detail-card report-detail-card--full">
        <h3>Data Footprint</h3>
        ${detailList([
          ["Input Size", formatValue(report.inputSizeBytes, "inputSizeBytes")],
          ["Output Size", formatValue(report.outputSizeBytes, "outputSizeBytes")],
          ["Memory Used", `${formatValue(report.memoryUsedMb)} MB`],
          ["CPU Used / Assigned", `${formatValue(report.cpuCoresUsed)} / ${formatValue(report.cpuCoresAssigned)}`],
          ["GPU Used", formatValue(report.gpuCoresUsed)],
        ])}
      </section>
      <section class="report-detail-card report-detail-card--full">
        <h3>Identifiers</h3>
        ${detailList([
          ["Report File", formatValue(report.fileName)],
          ["Tool Version", formatValue(report.toolVersion)],
          ["Package Version", formatValue(report.packageVersion)],
          ["Start Day", formatValue(report.startDay)],
        ])}
      </section>
    </div>
  `;

  if (typeof modal.showModal === "function") {
    modal.showModal();
  } else {
    modal.setAttribute("open", "open");
  }
}

function closeReportModal() {
  const modal = document.getElementById("reportModal");
  if (modal.open && typeof modal.close === "function") {
    modal.close();
    return;
  }
  modal.removeAttribute("open");
}

function setupReportModal() {
  const modal = document.getElementById("reportModal");
  const closeBtn = document.getElementById("closeReportModalBtn");

  closeBtn.addEventListener("click", closeReportModal);
  modal.addEventListener("click", (event) => {
    const rect = modal.getBoundingClientRect();
    const clickedBackdrop =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;

    if (clickedBackdrop) {
      closeReportModal();
    }
  });
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
  document.getElementById("totalReportsBadge").textContent = `Reports: ${count}`;

  cardsHost.append(
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
          borderRadius: 1,
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

function renderInfraChart(summary, reports) {
  let infraData = Array.isArray(summary.byInfra) ? summary.byInfra : [];

  if (infraData.length === 0) {
    const byInfraMap = new Map();
    for (const report of reports) {
      for (const infraName of report.infra || []) {
        const entry = byInfraMap.get(infraName) ?? { name: infraName, count: 0 };
        entry.count += 1;
        byInfraMap.set(infraName, entry);
      }
    }
    infraData = [...byInfraMap.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }

  const labels = infraData.map((x) => x.name);
  const data = infraData.map((x) => x.count);

  new Chart(document.getElementById("infraChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Runs",
          data,
          borderRadius: 1,
          backgroundColor: "rgba(34, 139, 34, 0.78)",
          borderColor: "rgba(34, 139, 34, 1)",
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

function colorForTool(index, total) {
  const hue = Math.round((index * 360) / Math.max(total, 1));
  return {
    border: `hsl(${hue} 62% 38%)`,
    fill: `hsl(${hue} 62% 58% / 0.78)`,
  };
}

function renderMemoryByToolDayChart(summary) {
  const byDayToolMemory = Array.isArray(summary.byDayToolMemory) ? summary.byDayToolMemory : [];
  if (byDayToolMemory.length === 0) {
    return;
  }

  const labels = byDayToolMemory.map((entry) => entry.day);
  const toolNames = [...new Set(byDayToolMemory.flatMap((entry) => (entry.tools || []).map((tool) => tool.name)))];
  const memoryByDay = new Map(
    byDayToolMemory.map((entry) => [
      entry.day,
      new Map((entry.tools || []).map((tool) => [tool.name, Number(tool.memoryMb) || 0])),
    ])
  );

  const datasets = toolNames.map((toolName, index) => {
    const color = colorForTool(index, toolNames.length);
    return {
      label: toolName,
      data: labels.map((day) => memoryByDay.get(day)?.get(toolName) ?? 0),
      borderColor: color.border,
      backgroundColor: color.fill,
      borderWidth: 1,
      stack: "memory",
    };
  });

  new Chart(document.getElementById("memoryByToolDayChart"), {
    type: "bar",
    data: {
      labels,
      datasets,
    },
    options: {
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            boxWidth: 12,
            boxHeight: 12,
          },
        },
      },
      scales: {
        x: { stacked: true },
        y: {
          stacked: true,
          beginAtZero: true,
          title: {
            display: true,
            text: "Memory (MB)",
          },
        },
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
    const tr = document.createElement("tr");
    tr.className = "report-row";
    tr.innerHTML = `
      <td>${formatDate(report.startTime)}</td>
      <td>${report.toolName}</td>
      <td><button type="button" class="details-button" aria-label="Open details for ${escapeHtml(report.toolName || "report")} run at ${escapeHtml(formatDate(report.startTime))}">Details</button></td>
      <td>${formatDuration(report.durationSeconds)}</td>
      <td>${formatBytes(report.inputSizeBytes)}</td>
      <td>${formatBytes(report.outputSizeBytes)}</td>
      <td>${report.cpuCoresUsed}/${report.cpuCoresAssigned}</td>
      <td>${report.gpuCoresUsed}</td>
    `;
    tr.querySelector(".details-button")?.addEventListener("click", () => renderReportModal(report));
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
  setupReportModal();
  renderSummary(data.summary, data.reportCount);
  renderToolChart(data.summary);
  renderRuntimeTrend(data.summary);
  renderInfraChart(data.summary, data.reports);
  renderMemoryByToolDayChart(data.summary);
  await renderLocationMap(data.summary.byCountry || []);
  setupTableControls(data.reports);
  renderTable(data.reports);
}

bootstrap().catch((error) => {
  console.error(error);
  document.getElementById("generatedAt").textContent = "failed to load";
  document.getElementById("summaryCards").innerHTML = `<article class="card"><div class="card-label">Error</div><div class="card-value">Data load failed</div></article>`;
});
