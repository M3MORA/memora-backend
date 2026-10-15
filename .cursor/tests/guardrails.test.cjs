'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {checkSource,getImports}=require('../scripts/check-boundaries.cjs');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');

test('valid Gateway client import',()=>{
 assert.equal(checkSource('apps/api-gateway/src/modules/iam/clients/x.ts',"import { X } from '@app/contracts';").length,0);
});
test('reject Gateway importing Prisma directly',()=>{
 assert.equal(checkSource('apps/api-gateway/src/modules/iam/auth/controllers/a.ts',"import { PrismaClient } from '@prisma/client';").length,1);
});
test('reject Gateway crossing relative IAM service boundary',()=>{
 assert.equal(checkSource('apps/api-gateway/src/modules/iam/c.ts',"import { Foo } from '../../../../iam-service/src/foo';").length,1);
});
test('reject generic Auth importing Prisma',()=>{
 assert.equal(checkSource('libs/auth/authorization/src/x.ts',"import { Prisma } from '@prisma/client';").length,1);
});
test('reject contract importing service implementation',()=>{
 assert.equal(checkSource('libs/contracts/src/iam/foo.ts',"export { Foo } from 'apps/iam-service/src/foo';").length,1);
});
test('ignore spec sources so fixtures can model violations',()=>{
 assert.equal(checkSource('libs/auth/authorization/src/foo.spec.ts',"import { Prisma } from '@prisma/client';").length,0);
});
test('module extractor handles imports and requires',()=>{
 assert.deepEqual(getImports("import x from 'x'; export {y} from 'y'; const z=require('z')"),['x','y','z']);
});
test('beforeReadFile allows .env.example but denies .env.local',()=>{
 const script=path.join(root,'.cursor/hooks/before-read-file.cjs');
 const run=file=>JSON.parse(execFileSync(process.execPath,[script],{input:JSON.stringify({file_path:file}),encoding:'utf8'}));
 assert.equal(run('C:\\memora\\.env.example').permission,'allow');
 assert.equal(run('C:\\memora\\.env.local').permission,'deny');
 assert.equal(run('/memora/keys/private.pem').permission,'deny');
});
