import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

function extractSnippet(source, pattern, label) {
  const match = source.match(pattern);
  assert.ok(match, `Expected to find ${label} snippet in docs/app.js`);
  return match[0];
}

async function loadRouteFunctions(windowState) {
  const source = await readFile(new URL("../docs/app.js", import.meta.url), "utf8");

  const initialPageUrlSnippet = extractSnippet(
    source,
    /const initialPageUrl = new URL\(window\.location\.href\);/,
    "initialPageUrl"
  );
  const dashboardBaseUrlSnippet = extractSnippet(
    source,
    /function dashboardBaseUrl\(\) \{[\s\S]*?\n\}/,
    "dashboardBaseUrl"
  );
  const dashboardRoutePathSnippet = extractSnippet(
    source,
    /function dashboardRoutePath\(toolSlug = null\) \{[\s\S]*?\n\}/,
    "dashboardRoutePath"
  );
  const toolFromLocationSnippet = extractSnippet(
    source,
    /function toolFromLocation\(\) \{[\s\S]*?\n\}/,
    "toolFromLocation"
  );

  const context = {
    URL,
    window: {
      ECRDASH_BASE_PATH: windowState.basePath,
      location: {
        href: windowState.href,
        pathname: new URL(windowState.href).pathname,
      },
    },
  };

  const script = `
${initialPageUrlSnippet}
${dashboardBaseUrlSnippet}
${dashboardRoutePathSnippet}
${toolFromLocationSnippet}
globalThis.__routeFns = { dashboardBaseUrl, dashboardRoutePath, toolFromLocation };
`;

  vm.runInNewContext(script, context);
  return { context, ...context.__routeFns };
}

test("tool route generation stays stable across repeated sidebar clicks", async () => {
  const { context, dashboardRoutePath } = await loadRouteFunctions({
    href: "http://localhost:4173/tool/fastp",
    basePath: "../..",
  });

  assert.equal(dashboardRoutePath("fastqc"), "/tool/fastqc");

  // Simulate navigation after the first click.
  context.window.location.href = "http://localhost:4173/tool/fastqc";
  context.window.location.pathname = "/tool/fastqc";

  assert.equal(dashboardRoutePath("vcfsort"), "/tool/vcfsort");
  assert.equal(dashboardRoutePath(null), "/");
});

test("toolFromLocation reads a single tool segment and rejects stacked paths", async () => {
  const { context, toolFromLocation } = await loadRouteFunctions({
    href: "http://localhost:4173/tool/fastp",
    basePath: "../..",
  });

  assert.equal(toolFromLocation(), "fastp");

  context.window.location.href = "http://localhost:4173/tool/fastqc";
  context.window.location.pathname = "/tool/fastqc";
  assert.equal(toolFromLocation(), "fastqc");

  // Invalid nested path must not be treated as a valid tool route.
  context.window.location.href = "http://localhost:4173/tool/fastqc/tool/vcfsort";
  context.window.location.pathname = "/tool/fastqc/tool/vcfsort";
  assert.equal(toolFromLocation(), null);
});
