#!/usr/bin/env node
'use strict';

const { join } = require('node:path');
const { loadSync } = require('@grpc/proto-loader');

const root = process.cwd();
const loader = {
  includeDirs: [join(root, 'proto')],
  keepCase: false,
  longs: String,
  defaults: true,
  oneofs: true,
};

const files = [
  'proto/iam/v1/iam.proto',
  'proto/grpc/health/v1/health.proto',
  'proto/common/v1/pagination.proto',
];

for (const relative of files) {
  loadSync(join(root, relative), loader);
}

process.stdout.write(`proto load ok: ${files.join(', ')}\n`);
