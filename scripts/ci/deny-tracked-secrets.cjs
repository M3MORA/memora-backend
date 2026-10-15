#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');

const git = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
  encoding: 'utf8',
});
if (git.status !== 0) {
  process.stdout.write('deny-tracked-secrets: skipped (not a git repository)\n');
  process.exit(0);
}

const listed = spawnSync('git', ['ls-files'], { encoding: 'utf8' });
if (listed.status !== 0) {
  process.stderr.write('git ls-files failed\n');
  process.exit(1);
}

const forbidden = listed.stdout
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((file) => {
    if (file === '.env.example') {
      return false;
    }
    if (/(^|\/)\.env($|\.)/.test(file)) {
      return true;
    }
    return /\.(pem|p12|pfx)$/i.test(file) || /(^|\/)credentials\.json$/.test(file);
  });

if (forbidden.length > 0) {
  process.stderr.write(
    `FAIL: secret-like files must not be tracked:\n${forbidden.join('\n')}\n`,
  );
  process.exit(1);
}

process.stdout.write('deny-tracked-secrets: ok\n');
