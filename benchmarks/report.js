// Merges the newest result file of every suite into one file:
//   benchmarks/results/REPORT.md 
//   benchmarks/results/metrics.csv
//   benchmarks/results/checks.csv 
//   node benchmarks/report.js
const fs = require("fs");
const path = require("path");
const { RESULTS_DIR } = require("./lib/recorder");

const SUITES = ["chain", "ipfs", "auth", "e2e"];
const fmt = (x, d = 2) => (typeof x === "number" && Number.isFinite(x) ? (Math.abs(x) >= 1000 ? Math.round(x).toLocaleString("en-AU") : x.toFixed(d)) : "-");
const csvEsc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

function latest(suite) {
  if (!fs.existsSync(RESULTS_DIR)) return null;
  const files = fs.readdirSync(RESULTS_DIR).filter((f) => f.startsWith(`${suite}-`) && f.endsWith(".json")).sort();
  if (!files.length) return null;
  return JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, files[files.length - 1]), "utf8"));
}

function metricTable(res, filter) {
  const rows = Object.entries(res.metrics).filter(([n]) => !filter || filter(n));
  if (!rows.length) return "_No samples recorded._\n";
  let md = "| Metric | Unit | n | Mean | Median | P95 | Min | Max | Std dev |\n|---|---|--:|--:|--:|--:|--:|--:|--:|\n";
  for (const [n, m] of rows) md += `| ${n} | ${m.unit || ""} | ${m.n} | ${fmt(m.mean)} | ${fmt(m.median)} | ${fmt(m.p95)} | ${fmt(m.min)} | ${fmt(m.max)} | ${fmt(m.stddev)} |\n`;
  return md + "\n";
}

function checkTable(res) {
  if (!res.checks.length) return "";
  let md = `**Checks: ${res.checkTotals.passed}/${res.checkTotals.total} passed**\n\n| ID | Category | Check | Expected | Actual | Result |\n|---|---|---|---|---|---|\n`;
  for (const c of res.checks) md += `| ${c.id} | ${c.category} | ${c.description} | ${c.expected} | ${c.actual} | ${c.pass ? "PASS" : "**FAIL**"} |\n`;
  return md + "\n";
}

function valueTable(res) {
  const rows = Object.entries(res.values).filter(([n, v]) => typeof v.value !== "object");
  if (!rows.length) return "";
  let md = "| Item | Value | Unit |\n|---|---|---|\n";
  for (const [n, v] of rows) md += `| ${n} | ${String(v.value).replace(/\|/g, "/")} | ${v.unit || ""} |\n`;
  return md + "\n";
}

function main() {
  const data = {};
  for (const s of SUITES) data[s] = latest(s);
  const present = SUITES.filter((s) => data[s]);
  if (!present.length) { console.error("No result files found. Run the benchmarks first (see benchmarks/README.md)."); process.exit(1); }

  let md = `# Prototype evaluation results\n\nGenerated ${new Date().toISOString()}\n\n`;
  const first = data[present[0]];
  md += `**Environment:** Node ${first.meta.node}; ${first.meta.platform}; ${first.meta.cpu} (${first.meta.cpuCount} cores, ${first.meta.memGB} GB)\n\n`;
  md += "| Suite | Run at | Network / target | Iterations | Checks passed |\n|---|---|---|--:|--:|\n";
  for (const s of present) {
    const r = data[s];
    md += `| ${s} | ${r.startedAt} | ${r.meta.network || r.meta.ipfsApi || "in-process"} | ${r.meta.N ?? "-"} | ${r.checkTotals.passed}/${r.checkTotals.total} |\n`;
  }
  md += "\n> Local-network caveat (thesis Section 2.13.2): latency and cost figures from a local Hardhat chain reflect ideal conditions, not public-network behaviour.\n\n";

  const titles = { chain: "Smart contracts: gas, latency and access control", ipfs: "IPFS storage layer", auth: "Wallet-signature authentication", e2e: "End-to-end lifecycle (backend + IPFS + chain)" };
  for (const s of present) {
    const r = data[s];
    md += `## ${titles[s]}\n\n### Measurements\n\n`;
    if (s === "chain") {
      md += "**Gas (units)**\n\n" + metricTable(r, (n) => n.endsWith(".gas"));
      md += "**Latency (ms)**\n\n" + metricTable(r, (n) => !n.endsWith(".gas"));
      const cost = r.values.costEstimate;
      if (cost) {
        md += `**Estimated cost per operation** (${cost.unit}; gas price and ETH/USD are assumptions)\n\n| Operation | Mean gas | USD |\n|---|--:|--:|\n`;
        for (const [op, c] of Object.entries(cost.value)) md += `| ${op} | ${fmt(c.meanGas)} | $${c.usd.toFixed(2)} |\n`;
        md += "\n";
      }
      md += "**Deployment and other values**\n\n" + valueTable(r);
    } else {
      md += metricTable(r);
      md += valueTable(r);
    }
    md += "### Checks\n\n" + checkTable(r);
  }

  fs.writeFileSync(path.join(RESULTS_DIR, "REPORT.md"), md);

  let mcsv = "suite,metric,unit,n,mean,median,p95,min,max,stddev\n";
  let ccsv = "suite,id,category,description,expected,actual,result\n";
  for (const s of present) {
    const r = data[s];
    for (const [n, m] of Object.entries(r.metrics)) mcsv += [s, n, m.unit, m.n, m.mean, m.median, m.p95, m.min, m.max, m.stddev].map(csvEsc).join(",") + "\n";
    for (const c of r.checks) ccsv += [s, c.id, c.category, c.description, c.expected, c.actual, c.pass ? "PASS" : "FAIL"].map(csvEsc).join(",") + "\n";
  }
  fs.writeFileSync(path.join(RESULTS_DIR, "metrics.csv"), mcsv);
  fs.writeFileSync(path.join(RESULTS_DIR, "checks.csv"), ccsv);
  console.log(`Wrote REPORT.md, metrics.csv, checks.csv to ${path.relative(process.cwd(), RESULTS_DIR)} (suites: ${present.join(", ")})`);
}
main();
