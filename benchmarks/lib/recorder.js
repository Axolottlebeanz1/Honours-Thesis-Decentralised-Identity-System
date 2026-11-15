const fs = require("fs");
const path = require("path");
const os = require("os");

// Handles recording and saving results from the benchmark scripts.
// Each script creates a Recorder, adds its measurements and checks, then calls save() to write the results to a JSON file.
// The report.js script later combines the latest results from each suite into tables.

const RESULTS_DIR = path.join(__dirname, "..", "results");

function stats(samples) {
  const xs = samples.filter((x) => Number.isFinite(x)).slice().sort((a, b) => a - b);
  const n = xs.length;
  if (!n) return { n: 0 };
  const sum = xs.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const variance = n > 1 ? xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
  const pct = (p) => xs[Math.min(n - 1, Math.max(0, Math.ceil((p / 100) * n) - 1))];
  return {
    n,
    min: xs[0],
    max: xs[n - 1],
    mean,
    median: pct(50),
    p95: pct(95),
    p99: pct(99),
    stddev: Math.sqrt(variance),
  };
}

class Recorder {
  constructor(suite, meta = {}) {
    this.suite = suite;
    this.startedAt = new Date();
    this.meta = {
      node: process.version,
      platform: `${os.platform()} ${os.release()} (${os.arch()})`,
      cpu: (os.cpus()[0] || {}).model || "unknown",
      cpuCount: os.cpus().length,
      memGB: Math.round((os.totalmem() / 1e9) * 10) / 10,
      ...meta,
    };
    this.metrics = {}; // name -> { unit, samples[], note }
    this.checks = []; // { id, category, description, expected, actual, pass }
    this.values = {}; // sizes, counts, etc.
  }

  // Records a measurement for a named metric, such as gas usage or the time taken to complete an operation.
  sample(name, value, unit = "", note = "") {
    if (!this.metrics[name]) this.metrics[name] = { unit, note, samples: [] };
    this.metrics[name].samples.push(Number(value));
  }

  // Measures how long an async function takes to complete and records the result in milliseconds. 
  async time(name, fn) {
    const t0 = process.hrtime.bigint();
    const result = await fn();
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    this.sample(name, ms, "ms");
    return result;
  }

  // Records a single value, such as the encrypted size of a file.
  value(name, value, unit = "") {
    this.values[name] = { value, unit };
  }

  // Record a pass/fail check. The expected and actual values are stored as strings for reporting.
  check(id, category, description, expected, actual, pass) {
    this.checks.push({ id, category, description, expected: String(expected), actual: String(actual), pass: Boolean(pass) });
    const tag = pass ? "PASS" : "FAIL";
    console.log(`  [${tag}] ${id} - ${description}`);
  }

  // Runs a function that is expected to fail.
  // The check passes if the function throws an error, and can optionally check that the error message contains the expected text.
  async expectRevert(id, category, description, fn, matcher) {
    try {
      await fn();
      this.check(id, category, description, "rejected", "accepted", false);
    } catch (err) {
      const msg = (err && (err.shortMessage || err.message)) || String(err);
      const ok = matcher ? msg.includes(matcher) : true;
      this.check(id, category, description, matcher ? `rejected: ${matcher}` : "rejected", ok ? "rejected" : `rejected for other reason: ${msg.slice(0, 120)}`, ok);
    }
  }

  summary() {
    const metrics = {};
    for (const [name, m] of Object.entries(this.metrics)) {
      metrics[name] = { unit: m.unit, note: m.note, ...stats(m.samples), samples: m.samples };
    }
    const passed = this.checks.filter((c) => c.pass).length;
    return {
      suite: this.suite,
      startedAt: this.startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      meta: this.meta,
      metrics,
      values: this.values,
      checks: this.checks,
      checkTotals: { total: this.checks.length, passed, failed: this.checks.length - passed },
    };
  }

  save() {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    const stamp = this.startedAt.toISOString().replace(/[:.]/g, "-");
    const file = path.join(RESULTS_DIR, `${this.suite}-${stamp}.json`);
    fs.writeFileSync(file, JSON.stringify(this.summary(), null, 2));
    console.log(`\nResults saved -> ${path.relative(process.cwd(), file)}`);
    return file;
  }
}

module.exports = { Recorder, stats, RESULTS_DIR };
