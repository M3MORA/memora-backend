#!/usr/bin/env node
'use strict';
// Non-blocking and cheap afterFileEdit hook. Does not run npm install/build/lint.
const fs=require('node:fs');const path=require('node:path');
const {checkSource}=require('../scripts/check-boundaries.cjs');
const root=path.resolve(__dirname,'../..');
let input={};
try{input=JSON.parse(fs.readFileSync(0,'utf8')||'{}');}catch{};
try{
 const file=input.file_path;
 if(typeof file==='string') {
  const abs=path.resolve(file),rel=path.relative(root,abs).split(path.sep).join('/');
  if(!rel.startsWith('../')&&!path.isAbsolute(rel)&&fs.existsSync(abs)&&fs.statSync(abs).size<=1024*1024){
   const findings=checkSource(rel,fs.readFileSync(abs,'utf8'));
   for(const p of findings)process.stderr.write(`MEMORA warning: ${p.rule} in ${p.file} (${p.import}). Run node .cursor/scripts/check-boundaries.cjs --all\n`);
  }
 }
}catch(e){process.stderr.write(`MEMORA afterFileEdit hook warning: ${e.message}\n`);}
// Edits have already happened: this is advisory. CI scanner is the enforcement gate.
process.stdout.write('{}\n');
