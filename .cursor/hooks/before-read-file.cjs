#!/usr/bin/env node
'use strict';
// Supported Cursor beforeReadFile hook; blocks likely credential paths from AI reads.
const fs=require('node:fs');const path=require('node:path');
let input={};
try{input=JSON.parse(fs.readFileSync(0,'utf8')||'{}');}catch{}
const raw=typeof input.file_path==='string'?input.file_path:'';
const parts=raw.replace(/\\/g,'/').toLowerCase().split('/');
const base=parts[parts.length-1]||'';
const deny=(base==='.env'||(/^\.env\./.test(base)&&base!=='.env.example')||
             /\.(?:pem|key)$/.test(base)||['id_rsa','id_ed25519','credentials.json','secrets.json'].includes(base)||
             /^client_secret.*\.json$/.test(base)||parts.includes('.secrets'));
process.stdout.write(JSON.stringify(deny?{
 permission:'deny',user_message:'MEMORA: credential files are not available to the AI; inspect .env.example and ask the developer for needed configuration facts.'
}:{permission:'allow'})+'\n');
