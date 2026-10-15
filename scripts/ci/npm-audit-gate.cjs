#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');

const allowedHigh = new Set([
  'GHSA-ggr8-5vv4-36mx',
  'GHSA-3f6p-5ww8-9rcr',
  'GHSA-rgwj-5xj2-c3m3',
]);

const result = spawnSync('npm', ['audit', '--omit=dev', '--json'], {
  encoding: 'utf8',
  shell: true,
});

let report;
try {
  report = JSON.parse(result.stdout || '{}');
} catch {
  process.stderr.write('npm audit did not return JSON\n');
  process.exit(1);
}

const vulns = report.vulnerabilities ?? {};
const blocking = [];
const allowed = [];

function ghsaFromViaItem(item) {
  if (typeof item !== 'object' || item === null) {
    return [];
  }
  const record = item;
  const url = typeof record.url === 'string' ? record.url : '';
  const match = /GHSA-[a-z0-9-]+/.exec(url);
  return match === null ? [] : [match[0]];
}

function collectGhsa(name, seen) {
  if (seen.has(name)) {
    return [];
  }
  seen.add(name);
  const entry = vulns[name];
  if (entry === undefined || !Array.isArray(entry.via)) {
    return [];
  }
  const ids = [];
  for (const item of entry.via) {
    if (typeof item === 'string') {
      ids.push(...collectGhsa(item, seen));
      continue;
    }
    ids.push(...ghsaFromViaItem(item));
  }
  return [...new Set(ids)];
}

for (const [name, entry] of Object.entries(vulns)) {
  const severity = String(entry.severity ?? '');
  if (severity === 'critical') {
    blocking.push(`${name} (${severity})`);
    continue;
  }
  if (severity !== 'high') {
    continue;
  }
  const ghsa = collectGhsa(name, new Set());
  const allowlisted = ghsa.length > 0 && ghsa.every((id) => allowedHigh.has(id));
  if (allowlisted) {
    allowed.push(`${name}: ${ghsa.join(', ')}`);
  } else {
    blocking.push(`${name} (${severity}) ${ghsa.join(' ') || 'unidentified'}`);
  }
}

for (const line of allowed) {
  process.stdout.write(`::warning::Allowlisted production high advisory: ${line}\n`);
}

if (blocking.length > 0) {
  process.stderr.write(
    `FAIL: unallowlisted high/critical advisories:\n${blocking.join('\n')}\n`,
  );
  process.exit(1);
}

const counts = report.metadata?.vulnerabilities ?? {};
process.stdout.write(
  `npm audit gate: critical=${counts.critical ?? 0} high=${counts.high ?? 0} moderate=${counts.moderate ?? 0} (allowlisted high=${allowed.length})\n`,
);
