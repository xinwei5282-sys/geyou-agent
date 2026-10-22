import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {SharedDemoWorkspace} from './geyou-shared-workspace';
test('server demo authenticates accounts, isolates tenant and refuses member access to admin',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'geyou-shared-test-'));try{
 const store=new SharedDemoWorkspace(dir);await store.init();assert.throws(()=>store.login('13900000010','wrong'),/账号或密码/);
 const a=store.login('13900000010','SharedDemo2026!'),b=store.login('13900000030','SharedDemo2026!');
 const first=store.snapshot(a),second=store.snapshot(b);assert.equal(first.state.agencies.length,1);assert.notEqual(first.state.agencies[0].id,second.state.agencies[0].id);
 assert.ok(first.state.customers.every(c=>c.agencyId===a.agencyId));assert.ok(first.state.staff.every(s=>!s.credential));assert.throws(()=>store.adminAgencies(a),/平台管理员/);
 assert.equal(store.adminAgencies(store.login('admin','SharedDemo2026!')).length,2);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('workspace writes persist across instances, conflict rather than overwrite and reject foreign data',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'geyou-shared-test-'));try{
 const store=new SharedDemoWorkspace(dir);await store.init();const actor=store.login('13900000010','SharedDemo2026!'),base=store.snapshot(actor);
 const edit=structuredClone(base.state);edit.customers[0].note='在设备A记录的需求';await store.save(actor,base.revision,edit);
 await assert.rejects(store.save(actor,base.revision,base.state),/版本冲突/);
 const restarted=new SharedDemoWorkspace(dir);await restarted.init();assert.equal(restarted.snapshot(restarted.login('13900000010','SharedDemo2026!')).state.customers[0].note,'在设备A记录的需求');
 const latest=store.snapshot(actor),forged=structuredClone(latest.state);forged.customers[0].agencyId='agency-b';await assert.rejects(store.save(actor,latest.revision,forged),/机构|权限/);
 const grant=structuredClone(latest.state);grant.staff[0].role='业务员';await assert.rejects(store.save(actor,latest.revision,grant),/服务端|权限/);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('disabled agency is rejected by subsequent server requests',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'geyou-shared-test-'));try{
 const store=new SharedDemoWorkspace(dir);await store.init();const actor=store.login('13900000010','SharedDemo2026!');
 await store.setAgencyEnabled(store.login('admin','SharedDemo2026!'),actor.agencyId!,false);assert.throws(()=>store.snapshot(actor),/停用/);assert.throws(()=>store.login('13900000010','SharedDemo2026!'),/停用/);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('upload-first photo can be stored independently then linked without losing its data',async()=>{
 const {addUnlinkedPortrait,linkUnlinkedPortrait}=await import('./src/geyou/memorialModel');
 const dir=await mkdtemp(path.join(tmpdir(),'geyou-shared-test-'));try{
  const store=new SharedDemoWorkspace(dir);await store.init();const actor=store.login('13900000010','SharedDemo2026!');let view=store.snapshot(actor);const staff=view.state.staff.find(s=>s.id===actor.staffId)!;
  const uploaded=addUnlinkedPortrait(view.state,staff,'data:image/png;base64,dGVzdA==');view=await store.save(actor,view.revision,uploaded);const photo=view.state.unlinkedPortraits![0],c=view.state.customers[0];assert.ok(photo);
  const linked=linkUnlinkedPortrait(view.state,staff,photo.id,c.id,c.deceased![0].id);const saved=await store.save(actor,view.revision,linked);assert.equal(saved.state.unlinkedPortraits!.length,0);assert.equal(saved.state.customers.find(x=>x.id===c.id)!.deceased![0].portraits[0].original,photo.original);
 }finally{await rm(dir,{recursive:true,force:true})}
});
