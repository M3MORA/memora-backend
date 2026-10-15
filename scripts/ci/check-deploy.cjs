#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = process.cwd();
const required = [
  'deploy/infra/compose.yaml',
  'deploy/infra/.env.example',
  'deploy/backend/compose.yaml',
  'deploy/backend/.env.example',
  'deploy/scripts/lib.sh',
  'deploy/scripts/preflight.sh',
  'deploy/scripts/bootstrap-infra.sh',
  'deploy/scripts/bootstrap-backend.sh',
  'deploy/scripts/migrate.sh',
  'deploy/scripts/health-check.sh',
  'deploy/scripts/deploy-backend.sh',
  'deploy/scripts/rollback.sh',
  'deploy/scripts/backup.sh',
  'deploy/host/memora-deploy.sh',
  'deploy/host/install-host-prerequisites.sh',
  'deploy/host/install-docker.sh',
  'deploy/host/install-deploy-helper.sh',
  'deploy/host/sudoers.memora-deploy.example',
  'docker/iam-migrate.Dockerfile',
  '.github/workflows/bootstrap.yml',
  '.github/workflows/deploy.yml',
  'docs/deployment/infrastructure-bootstrap.md',
  'docs/deployment/mini-pc-deployment.md',
  'docs/deployment/disaster-recovery.md',
];

const missing = required.filter((file) => !existsSync(join(root, file)));
if (missing.length > 0) {
  process.stderr.write(`FAIL missing deploy files:\n${missing.join('\n')}\n`);
  process.exit(1);
}

for (const file of required.filter((item) => item.endsWith('.sh'))) {
  const abs = join(root, file);
  const bash = spawnSync('bash', ['-n', abs], { encoding: 'utf8' });
  if (bash.status !== 0) {
    process.stderr.write(`FAIL bash -n ${file}\n${bash.stderr}\n`);
    process.exit(1);
  }
}

const helper = readFileSync(join(root, 'deploy/host/memora-deploy.sh'), 'utf8');
if (helper.includes('set -x')) {
  process.stderr.write('FAIL memora-deploy.sh must not use set -x\n');
  process.exit(1);
}
if (helper.includes('compose down')) {
  process.stderr.write('FAIL helper must not docker compose down\n');
  process.exit(1);
}

const bootstrap = readFileSync(join(root, '.github/workflows/bootstrap.yml'), 'utf8');
const deploy = readFileSync(join(root, '.github/workflows/deploy.yml'), 'utf8');
for (const [name, body] of [
  ['bootstrap.yml', bootstrap],
  ['deploy.yml', deploy],
]) {
  if (!body.includes('workflow_dispatch')) {
    process.stderr.write(`FAIL ${name} must be workflow_dispatch\n`);
    process.exit(1);
  }
  if (body.includes('pull_request:')) {
    process.stderr.write(`FAIL ${name} must not run on pull_request\n`);
    process.exit(1);
  }
  if (!body.includes('memora-cd')) {
    process.stderr.write(`FAIL ${name} must pin memora-cd runner\n`);
    process.exit(1);
  }
  if (body.includes('npm ci') || body.includes('nest build')) {
    process.stderr.write(`FAIL ${name} must not build source on Mini PC\n`);
    process.exit(1);
  }
}

process.stdout.write('deploy layout and shell syntax ok\n');
