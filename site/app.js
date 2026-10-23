"use strict";

const DAY = 86400;
const PROBE_INTERVAL = 15 * 60;
const STALE_AFTER = 3 * PROBE_INTERVAL;
const BARS = 90;
const INCIDENTS_SHOWN = 5;

const el = (tag, className, ...children) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children);
  return node;
};

const uptime = (checks, since) => {
  const window = checks.filter((c) => c[0] >= since);
  return window.length ? (100 * window.filter((c) => c[1]).length) / window.length : null;
};

const formatUptime = (percent) => {
  if (percent === null) return "n/a";
  return percent === 100 ? "100%" : `${percent.toFixed(percent > 99 ? 2 : 1)}%`;
};

const averageLatency = (checks, since) => {
  const times = checks.filter((c) => c[0] >= since && c[1]).map((c) => c[2]);
  return times.length ? `${Math.round(times.reduce((a, b) => a + b, 0) / times.length)} ms` : "n/a";
};

const formatDuration = (seconds) => {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
};

// Consecutive failed checks make one incident; its length is at least one probe interval.
const incidents = (checks) => {
  const found = [];
  let current = null;
  for (const [time, ok] of checks) {
    if (!ok && !current) current = { start: time, end: time, ongoing: false };
    else if (!ok) current.end = time;
    else if (current) { found.push(current); current = null; }
  }
  if (current) { current.ongoing = true; found.push(current); }
  return found.reverse();
};

const stat = (label, value) => el("span", "", `${label} `, el("strong", "", value));

const card = (target, now) => {
  const checks = target.checks;
  const last = checks[checks.length - 1];
  const state = !last || now - last[0] > STALE_AFTER ? "unknown" : last[1] ? "up" : "down";
  const label = { up: "Operational", down: "Down", unknown: "No recent data" }[state];

  const bars = el("div", "bars");
  bars.setAttribute("aria-hidden", "true");
  for (const [time, ok, ms] of checks.slice(-BARS)) {
    const bar = el("span", ok ? "" : "down");
    bar.title = `${new Date(time * 1000).toLocaleString()}: ${ok ? `${ms} ms` : "down"}`;
    bars.append(bar);
  }

  const link = el("a", "", target.name);
  link.href = target.url;
  const node = el("section", "card",
    el("h2", "", link, el("span", `state ${state}`, label)),
    bars,
    el("p", "stats",
      stat("24 h", formatUptime(uptime(checks, now - DAY))),
      stat("7 days", formatUptime(uptime(checks, now - 7 * DAY))),
      stat("30 days", formatUptime(uptime(checks, now - 30 * DAY))),
      stat("Response time (24 h)", averageLatency(checks, now - DAY))));

  const past = incidents(checks).slice(0, INCIDENTS_SHOWN);
  if (past.length) {
    const list = el("ul", "incidents");
    for (const incident of past) {
      const when = new Date(incident.start * 1000).toLocaleString();
      const length = formatDuration(incident.end - incident.start + PROBE_INTERVAL);
      list.append(el("li", "", `${when}: down for ${length}${incident.ongoing ? " (ongoing)" : ""}`));
    }
    node.append(list);
  }
  return { node, state };
};

const render = (history) => {
  const now = Math.floor(Date.now() / 1000);
  const cards = Object.values(history.targets).map((target) => card(target, now));
  const states = cards.map((c) => c.state);
  const overall = states.includes("down") ? "down" : states.includes("unknown") ? "unknown" : "up";
  const banner = document.getElementById("banner");
  banner.className = `banner ${overall}`;
  banner.textContent = { up: "All systems operational", down: "Outage in progress", unknown: "No recent data" }[overall];
  document.getElementById("targets").replaceChildren(...cards.map((c) => c.node));
  document.getElementById("updated").textContent = `Last check: ${new Date(history.updated * 1000).toLocaleString()}.`;
};

fetch("checks.json", { cache: "no-store" })
  .then((response) => response.json())
  .then(render)
  .catch(() => {
    const banner = document.getElementById("banner");
    banner.className = "banner unknown";
    banner.textContent = "The checks could not be loaded.";
  });
