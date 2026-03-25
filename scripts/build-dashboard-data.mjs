import { promises as fs } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const reportsDir = path.join(rootDir, "reports_output_dir");
const outputDir = path.join(rootDir, "docs", "data");
const outputFile = path.join(outputDir, "reports.json");

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseReportTimestamp(value) {
  if (!value || typeof value !== "string") return NaN;

  // Handle timestamps like "2025-12-24T14:20:14.930108" by truncating
  // fractional seconds to milliseconds and assuming UTC when no timezone is present.
  const match = value.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.(\d+))?([zZ]|[+-]\d{2}:\d{2})?$/
  );
  if (!match) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  const [, datePart, timePart, fraction = "", timezone = ""] = match;
  const millis = fraction ? fraction.slice(0, 3).padEnd(3, "0") : "000";
  const tz = timezone || "Z";
  const normalized = `${datePart}T${timePart}.${millis}${tz}`;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function durationSeconds(startTime, endTime, durationField) {
  const hasExplicitDuration = durationField !== null && durationField !== undefined && durationField !== "";
  const explicit = hasExplicitDuration ? safeNumber(durationField, NaN) : NaN;
  if (hasExplicitDuration && Number.isFinite(explicit) && explicit >= 0) {
    return explicit;
  }

  const start = parseReportTimestamp(startTime);
  const end = parseReportTimestamp(endTime);
  if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
    return Math.round((end - start) / 1000);
  }

  return 0;
}

function isoDay(ts) {
  if (!ts) return null;
  const parsed = parseReportTimestamp(ts);
  const d = Number.isFinite(parsed) ? new Date(parsed) : new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function normalizeLocation(location) {
  const name = (location?.name ?? "").trim();
  const address = location?.address ?? {};
  const addressCountry = (address.addressCountry ?? "").trim();
  const addressRegion = (address.addressRegion ?? "").trim();
  const addressLocality = (address.addressLocality ?? "").trim();
  const postalCode = (address.postalCode ?? "").trim();

  const hasValue = [name, addressCountry, addressRegion, addressLocality, postalCode].some(Boolean);
  if (!hasValue) {
    return null;
  }

  return {
    name,
    addressCountry,
    addressRegion,
    addressLocality,
    postalCode,
  };
}

function summarize(reports) {
  const totals = {
    reports: reports.length,
    inputBytes: 0,
    outputBytes: 0,
    memoryMb: 0,
    cpuAssigned: 0,
    cpuUsed: 0,
    gpuUsed: 0,
    durationSeconds: 0,
  };

  const byToolMap = new Map();
  const byDayMap = new Map();
  const byCountryMap = new Map();
  const byInfraMap = new Map();

  for (const report of reports) {
    totals.inputBytes += report.inputSizeBytes;
    totals.outputBytes += report.outputSizeBytes;
    totals.memoryMb += report.memoryUsedMb;
    totals.cpuAssigned += report.cpuCoresAssigned;
    totals.cpuUsed += report.cpuCoresUsed;
    totals.gpuUsed += report.gpuCoresUsed;
    totals.durationSeconds += report.durationSeconds;

    const toolEntry = byToolMap.get(report.toolName) ?? {
      name: report.toolName,
      count: 0,
      totalDurationSeconds: 0,
      totalInputBytes: 0,
      totalOutputBytes: 0,
    };
    toolEntry.count += 1;
    toolEntry.totalDurationSeconds += report.durationSeconds;
    toolEntry.totalInputBytes += report.inputSizeBytes;
    toolEntry.totalOutputBytes += report.outputSizeBytes;
    byToolMap.set(report.toolName, toolEntry);

    const day = report.startDay;
    if (day) {
      const dayEntry = byDayMap.get(day) ?? {
        day,
        count: 0,
        durationSeconds: 0,
      };
      dayEntry.count += 1;
      dayEntry.durationSeconds += report.durationSeconds;
      byDayMap.set(day, dayEntry);
    }

    const country = report.location?.addressCountry || "";
    if (country) {
      const countryEntry = byCountryMap.get(country) ?? {
        country,
        count: 0,
      };
      countryEntry.count += 1;
      byCountryMap.set(country, countryEntry);
    }

    for (const infraName of report.infra) {
      const infraEntry = byInfraMap.get(infraName) ?? {
        name: infraName,
        count: 0,
        totalDurationSeconds: 0,
      };
      infraEntry.count += 1;
      infraEntry.totalDurationSeconds += report.durationSeconds;
      byInfraMap.set(infraName, infraEntry);
    }
  }

  const byTool = [...byToolMap.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const byDay = [...byDayMap.values()].sort((a, b) => a.day.localeCompare(b.day));
  const byCountry = [...byCountryMap.values()].sort((a, b) => b.count - a.count || a.country.localeCompare(b.country));
  const byInfra = [...byInfraMap.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return {
    totals,
    averages: {
      durationSeconds: totals.reports ? Math.round(totals.durationSeconds / totals.reports) : 0,
      memoryMb: totals.reports ? Math.round(totals.memoryMb / totals.reports) : 0,
      inputBytes: totals.reports ? Math.round(totals.inputBytes / totals.reports) : 0,
      outputBytes: totals.reports ? Math.round(totals.outputBytes / totals.reports) : 0,
    },
    byTool,
    byDay,
    byCountry,
    byInfra,
  };
}

async function loadReports() {
  const files = (await fs.readdir(reportsDir))
    .filter((name) => name.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));

  const reports = [];

  for (const fileName of files) {
    const filePath = path.join(reportsDir, fileName);
    const raw = await fs.readFile(filePath, "utf8");
    const json = JSON.parse(raw);

    const startTime = json.start_time ?? null;
    const endTime = json.end_time ?? null;

    reports.push({
      fileName,
      toolName: json.tool?.name ?? "Unknown",
      toolVersion: json.tool?.version ?? "",
      packageVersion: json.tool?.package_version ?? "",
      infra: Array.isArray(json.infra) ? json.infra.map((x) => x.infra_name).filter(Boolean) : [],
      location: normalizeLocation(json.location),
      startTime,
      endTime,
      startDay: isoDay(startTime),
      durationSeconds: durationSeconds(startTime, endTime, json.duration),
      inputSizeBytes: safeNumber(json.input_size_bytes),
      outputSizeBytes: safeNumber(json.final_outputs_size_bytes),
      memoryUsedMb: safeNumber(json.memory_used),
      cpuCoresAssigned: safeNumber(json.cpu_cores_assigned),
      cpuCoresUsed: safeNumber(json.cpu_cores_used),
      gpuCoresUsed: safeNumber(json.gpu_cores_used),
    });
  }

  reports.sort((a, b) => {
    if (!a.startTime && !b.startTime) return a.fileName.localeCompare(b.fileName);
    if (!a.startTime) return 1;
    if (!b.startTime) return -1;
    return a.startTime.localeCompare(b.startTime);
  });

  return reports;
}

async function main() {
  const reports = await loadReports();
  const summary = summarize(reports);

  const payload = {
    generatedAt: new Date().toISOString(),
    reportCount: reports.length,
    summary,
    reports,
  };

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputFile, JSON.stringify(payload, null, 2) + "\n", "utf8");

  console.log(`Wrote ${reports.length} reports to ${path.relative(rootDir, outputFile)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
