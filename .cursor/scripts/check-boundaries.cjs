#!/usr/bin/env node
'use strict';
// Lightweight, dependency-free, heuristic guardrail. Does NOT replace ESLint, typecheck or security review.
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const EXCLUDE = new Set(['node_modules', 'dist', 'coverage', 'generated', '.git', '.next']);
const checks = [
  {
    name: 'gateway-must-not-import-persistence',
    owner: /^apps\/api-gateway\/src\//,
    forbidden: /^(?:@prisma\/client(?:\/.*)?|@app\/iam-service(?:\/.*)?|@app\/[^/]*-service(?:\/.*)?|.*(?:^|\/)apps\/(?:iam-service|catalog-service|ordering-service)(?:\/.*)?|.*(?:^|\/)generated\/prisma(?:\/.*)?)$/,
    message: 'Gateway must use owning-service RPC client; do not import Prisma/service implementation.',
  },
  {
    name: 'auth-library-must-not-own-iam-data',
    owner: /^libs\/auth\//,
    forbidden: /^(?:@prisma\/client(?:\/.*)?|@app\/iam-service(?:\/.*)?|.*(?:^|\/)apps\/iam-service(?:\/.*)?|.*(?:^|\/)generated\/prisma(?:\/.*)?)$/,
    message: 'Reusable auth library must not import IAM app or Prisma.',
  },
  {
    name: 'contracts-must-not-import-applications',
    owner: /^libs\/contracts\//,
    forbidden: /^(?:@prisma\/client(?:\/.*)?|@app\/iam-service(?:\/.*)?|.*(?:^|\/)apps\/(?:iam-service|api-gateway)(?:\/.*)?)$/,
    message: 'Cross-process contracts must not import application or persistence implementation.',
  },
  {
    name: 'iam-must-not-import-gateway',
    owner: /^apps\/iam-service\//,
    forbidden: /^(?:@app\/api-gateway(?:\/.*)?|.*(?:^|\/)apps\/api-gateway(?:\/.*)?)$/,
    message: 'IAM must not import API Gateway application code.',
  },
];

function norm(v) { return v.split(path.sep).join('/'); }
function getImports(source) {
  const modules = [];
  // Import/export-from; bare side-effect import; import('...'); require('...').
  const re = /\b(?:from\s*|import\s*\(\s*|import\s*|require\s*\(\s*)["']([^"']+)["']/g;
  for (const m of source.matchAll(re)) modules.push(m[1]);
  return modules;
}
function checkSource(rel, source) {
  const errors=[];
  const normalized=norm(rel).replace(/^\.\//,'');
  if (!/\.(?:[cm]?ts|[cm]?js)$/.test(normalized) || /\.(?:spec|test)\.[cm]?[jt]s$/.test(normalized)) return errors;
  const imports=getImports(source);
  for (const cfg of checks) {
    if (!cfg.owner.test(normalized)) continue;
    for (const imp of imports) {
      // Relative import is resolved to prevent ../ escaping a boundary.
      const candidate=imp.startsWith('.') ? norm(path.posix.normalize(path.posix.join(path.posix.dirname(normalized),imp))) : imp;
      if (cfg.forbidden.test(candidate)) errors.push({file:normalized,rule:cfg.name,import:imp,message:cfg.message});
    }
  }
  return errors;
}
function walk(dir, result=[]) {
  if(!fs.existsSync(dir))return result;
  for (const d of fs.readdirSync(dir,{withFileTypes:true})) {
    if(EXCLUDE.has(d.name))continue;
    const loc=path.join(dir,d.name);
    if(d.isDirectory())walk(loc,result);
    else if(d.isFile() && /\.(?:ts|tsx|js|mjs|cjs)$/.test(d.name)) result.push(loc);
  }
  return result;
}
function checkFile(full){
  const abs=path.resolve(full), rel=norm(path.relative(ROOT,abs));
  if(rel.startsWith('../') || path.isAbsolute(rel)) throw Error('Path outside repository is not accepted');
  const bytes=fs.statSync(abs).size;
  if(bytes>1024*1024) return [];
  return checkSource(rel,fs.readFileSync(abs,'utf8'));
}
function run(argv) {
  const fArg=argv.indexOf('--file');
  if(fArg!==-1 && !argv[fArg+1]) throw Error('--file requires a path');
  let files=[];
  if(fArg!==-1) {
    if(!fs.existsSync(argv[fArg+1])) throw Error(`File does not exist: ${argv[fArg+1]}`);
    files=[argv[fArg+1]];
  }
  else if(argv.includes('--all')) {
    files=['apps/api-gateway/src','apps/iam-service/src','libs/auth','libs/contracts'].flatMap(p=>walk(path.join(ROOT,p)));
    if(files.length===0) throw Error('No MEMORA application/library sources found. Install kit at repository root before --all.');
  }
  else {process.stdout.write('Use --all or --file <path>\n');return 2;}
  const problems=[];
  for (const file of files) if(fs.existsSync(file)) problems.push(...checkFile(file));
  for(const p of problems) process.stderr.write(`[${p.rule}] ${p.file}: ${p.import} — ${p.message}\n`);
  process.stdout.write(`MEMORA boundary check: ${files.length} files, ${problems.length} finding(s)\n`);
  return problems.length?1:0;
}
if(require.main===module){try{process.exitCode=run(process.argv.slice(2));}catch(e){process.stderr.write(String(e.message)+'\n');process.exitCode=2;}}
module.exports={checkSource,getImports};
