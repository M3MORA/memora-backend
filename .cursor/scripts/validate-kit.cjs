#!/usr/bin/env node
'use strict';
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const rulesDir=path.join(root,'.cursor/rules');
const skillsDir=path.join(root,'.cursor/skills');
let errors=[];
if(!fs.existsSync(rulesDir))errors.push('Missing .cursor/rules');
const rules=fs.existsSync(rulesDir)?fs.readdirSync(rulesDir).filter(f=>f.endsWith('.mdc')):[];
let coreCount=0;
function header(content){const m=/^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(content);return m?m[1]:null;}
for(const rule of rules){
 const text=fs.readFileSync(path.join(rulesDir,rule),'utf8');const fm=header(text);
 if(!fm){errors.push(`${rule}: missing YAML frontmatter`);continue;}
 if(!/^description:\s*\S+/m.test(fm))errors.push(`${rule}: description missing`);
 const always=/^alwaysApply:\s*(true|false)\s*$/m.exec(fm);
 if(!always){errors.push(`${rule}: invalid alwaysApply`);continue;}
 if(always[1]==='true')coreCount++;
 if(always[1]==='true'&&/^globs:/m.test(fm))errors.push(`${rule}: globs ignored by alwaysApply=true; remove`);
 if(always[1]==='false'&&!/^globs:\s*\S+/m.test(fm)&&!/^description:\s*\S+/m.test(fm))errors.push(`${rule}: unreachable rule`);
 if(/\/api\/v1\/iam\/ping|Gateway\s*→\s*IAM Ping/.test(text))errors.push(`${rule}: stale Ping references`);
}
if(coreCount!==1)errors.push(`Expected exactly 1 alwaysApply:true rule, found ${coreCount} (remove previous always-on rules).`);
const names=[];
if(fs.existsSync(skillsDir)) for(const d of fs.readdirSync(skillsDir,{withFileTypes:true})) {
 if(!d.isDirectory())continue;
 const f=path.join(skillsDir,d.name,'SKILL.md');if(!fs.existsSync(f))continue;
 const fm=header(fs.readFileSync(f,'utf8'));
 if(!fm){errors.push(`Skill ${d.name}: frontmatter missing`);continue;}
 const n=/^name:\s*([^\r\n]+)/m.exec(fm);
 if(!n||n[1].trim()!==d.name)errors.push(`Skill ${d.name}: name must match directory`);
 if(!/^description:\s*\S+/m.test(fm))errors.push(`Skill ${d.name}: description missing`);
 names.push(d.name);
}
const hooksFile=path.join(root,'.cursor/hooks.json');
if(fs.existsSync(hooksFile)) {
 try {
  const json=JSON.parse(fs.readFileSync(hooksFile,'utf8'));
  if(json.version!==1||!json.hooks||typeof json.hooks!=='object')errors.push('Invalid hooks.json shape');
 }catch(e){errors.push(`Invalid hooks.json: ${e.message}`);}
}
for(const e of errors)process.stderr.write('FAIL: '+e+'\n');
process.stdout.write(`MEMORA AI kit validation: ${rules.length} rules, ${names.length} skills, ${errors.length} error(s)\n`);
process.exitCode=errors.length?1:0;
