import test from 'node:test';
import assert from 'node:assert/strict';
import { seedState, setStaffEnabled, visibleCustomers, migrateState } from './model';
import { authenticate, createCredential, resolveSession, saveMemberLogin, saveOwnerLogin } from './auth';
const ownerPhone='13911112222',memberPhone='13911113333',password='Demo-pass-27';
const member={name:'测试成员',phone:memberPhone,enabled:true,modules:['customers'] as const,canManageProducts:false};
const input=()=>({...member,modules:[...member.modules]});
// Existing sample workspace is provisioned only through the platform account operation.
const provisionOwner=(s:ReturnType<typeof seedState>,phone:string,password:string)=>saveOwnerLogin(s,{id:'agency-a',name:'测试企业',contact:'测试负责人',phone,region:s.agencies[0].region,enabled:true,modules:s.agencies[0].access!.modules},password);
test('platform provision preserves business records and login rejects unprovisioned or wrong credentials',async()=>{
 const original=seedState();const s=await provisionOwner(original,ownerPhone,password);
 assert.deepEqual(s.customers,original.customers);assert.deepEqual(s.products,original.products);
assert.ok(!JSON.stringify(s).includes(password));
 const session=await authenticate(s,ownerPhone,password);assert.equal(resolveSession(s,session)?.id,'boss-a');
 await assert.rejects(()=>authenticate(original,ownerPhone,password),/账号或密码/);
 assert.ok(original.staff.every(st=>!st.credential));
 await assert.rejects(()=>authenticate(s,ownerPhone,'bad-password'),/账号或密码/);
 await assert.rejects(()=>authenticate(s,'13900000000',password),/账号或密码/);
 assert.equal(resolveSession(s,null),undefined);
});
test('password validation, unique salts and duplicate login accounts',async()=>{
 await assert.rejects(()=>createCredential('short'),/8–72/);await assert.rejects(()=>createCredential('        '),/空格/);
 const a=await createCredential(password),b=await createCredential(password);assert.notEqual(a.hash,b.hash);assert.notEqual(a.salt,b.salt);
 const s=await provisionOwner(seedState(),ownerPhone,password);
 await assert.rejects(()=>saveMemberLogin(s,s.staff[0],{...input(),phone:ownerPhone},password),/已被使用/);
 await assert.rejects(()=>saveMemberLogin(s,s.staff[0],input(),''),/8–72/);
});
test('owner creates staff login with restricted customer scope and staff cannot create accounts',async()=>{
 let s=await provisionOwner(seedState(),ownerPhone,password);s=await saveMemberLogin(s,s.staff[0],input(),password);
 const session=await authenticate(s,memberPhone,password),staff=resolveSession(s,session)!;
 assert.equal(staff.role,'业务员');assert.equal(staff.agencyId,'agency-a');assert.equal(visibleCustomers(s,staff).length,0);
 await assert.rejects(()=>saveMemberLogin(s,staff,{...input(),phone:'13911114444'},password),/仅启用/);
 await assert.rejects(()=>saveMemberLogin(s,s.staff.find(x=>x.id==='boss-b')!,{...input(),id:staff.id},password),/本店/);
});
test('disable and password reset invalidate existing sessions; empty edit retains password',async()=>{
 let s=await provisionOwner(seedState(),ownerPhone,password);s=await saveMemberLogin(s,s.staff[0],input(),password);
 const session=await authenticate(s,memberPhone,password),id=session.staffId;
 s=await saveMemberLogin(s,s.staff[0],{...input(),id,name:'更名'},'');assert.ok(resolveSession(s,session));
 const disabled=setStaffEnabled(s,s.staff[0],id,false);assert.equal(resolveSession(disabled,session),undefined);
 await assert.rejects(()=>authenticate(disabled,memberPhone,password),/停用/);
 s=await saveMemberLogin(s,s.staff[0],{...input(),id},'New-pass-28');assert.equal(resolveSession(s,session),undefined);
 await assert.rejects(()=>authenticate(s,memberPhone,password),/账号或密码/);assert.ok(await authenticate(s,memberPhone,'New-pass-28'));
 const disabledAgency={...s,agencies:s.agencies.map(a=>a.id==='agency-a'?{...a,access:{...a.access!,enabled:false}}:a)};
 await assert.rejects(()=>authenticate(disabledAgency,memberPhone,'New-pass-28'),/停用/);
});
test('platform opens owner login and login-account change invalidates the old session',async()=>{
 let s=seedState();const form={name:'测试企业',contact:'负责人',phone:ownerPhone,region:'浙江 · 杭州',enabled:true,modules:['customers'] as ('customers')[]};
 s=await saveOwnerLogin(s,form,password);const session=await authenticate(s,ownerPhone,password);const staff=resolveSession(s,session)!;
 assert.equal(staff.role,'老板');assert.notEqual(staff.agencyId,'agency-a');
 s=await saveOwnerLogin(s,{...form,id:staff.agencyId,phone:'13911115555'},'');assert.equal(resolveSession(s,session),undefined);
 await assert.rejects(()=>authenticate(s,ownerPhone,password),/账号或密码/);assert.ok(await authenticate(s,'13911115555',password));
});

test('legacy sample cleanup cannot erase an explicitly configured login phone',async()=>{
 const s=await provisionOwner(seedState(),'13800000001',password);
 const restored=migrateState(JSON.parse(JSON.stringify(s)));
 assert.ok(await authenticate(restored,'13800000001',password));
});


test('public prototype demo account can log in and preserves user data and configured credentials',async()=>{
 const {withDemoAccount,DEMO_PHONE}=await import('./demoAccount');
 const original=seedState();const s=withDemoAccount(original);
 const session=await authenticate(s,DEMO_PHONE,'Geyou2026!');
 assert.equal(resolveSession(s,session)?.id,'boss-a');
 assert.deepEqual(s.customers,original.customers);assert.deepEqual(s.products,original.products);
 assert.equal(s.agencies[0].name,original.agencies[0].name);assert.equal(s.agencies[0].phone,original.agencies[0].phone);
 assert.equal(withDemoAccount(s),s);
 const configured=await provisionOwner(original,ownerPhone,password);assert.equal(withDemoAccount(configured),configured);
 const disabled={...original,staff:original.staff.map(st=>st.id==='boss-a'?{...st,enabled:false}:st)};assert.equal(withDemoAccount(disabled),disabled);
 const used={...original,staff:[...original.staff,{...original.staff[1],id:'existing-account',phone:DEMO_PHONE}]};assert.equal(withDemoAccount(used),used);
});
