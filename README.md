# ecrdash

Web dashboard for JSON reports in `reports_output_dir`.

## What this includes

- A static web dashboard in `docs/`
- A data build script in `scripts/build-dashboard-data.mjs`
- GitHub Actions workflow that rebuilds and deploys the dashboard on every push to `main`

## Dashboard features

- Summary cards: total runs, runtime, input/output size, average runtime, average memory
- Charts:
  - runs per tool
  - runtime trend by day
- Recent report table (latest 50 entries)

## Local usage

1. Build aggregated data from raw report files:

	```bash
	npm run build:data
	```

2. Serve the dashboard locally:

	```bash
	npm run serve
	```

3. Open `http://localhost:4173`

## Automatic updates on commits

Workflow: `.github/workflows/deploy-dashboard.yml`

Trigger:
- Any push to `main`
- Manual run (`workflow_dispatch`)

What happens on each commit:
1. Checkout repository
2. Build dashboard data from `reports_output_dir/*.json`
3. Publish `docs/` to GitHub Pages

## Notes

- Ensure GitHub Pages is enabled for the repository (Actions deployment source).
- The generated dashboard dataset is written to `docs/data/reports.json`.