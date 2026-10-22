import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seedState} from './model';
import {createGuidedSale} from './guidedSalesModel';
import {backfillReceptionProfile} from './receptionArchiveModel';
const input={scenario:'advance' as const,nickname:'新咨询',subjectName:'',occupation:'',interests:'',faith:'待确认',region:'',budget:0,notes:'原始话术不应存为确认事实'};
test('真实线索自动关联档案，刷新后回填同一客户并保留整体预算',()=>{
 const seed=seedState(),staff=seed.staff[0],created=createGuidedSale(seed,staff,input);
 const first=backfillReceptionProfile(created.state,staff,created.session.id,{occupation:'退休教师',budget:100000,faith:'待确认'});
 const cid=first.consultations!.find(c=>c.id===created.session.id)!.customerId!;
 const customer=first.customers.find(c=>c.id===cid)!;
 assert.equal(customer.name,'新线索 · 待补充');assert.equal(customer.budget,0);assert.equal(customer.note,'');assert.equal(customer.receptionProfile?.faith,undefined);
 const reloaded=JSON.parse(JSON.stringify(first));
 const next=backfillReceptionProfile(reloaded,staff,created.session.id,{occupation:'工程师',interests:'素雅'});
 assert.equal(next.customers.length,first.customers.length);assert.equal(next.customers.find(c=>c.id===cid)?.receptionProfile?.occupation,'工程师');assert.equal(next.customers.find(c=>c.id===cid)?.receptionProfile?.budget,100000);
});
test('空事实、预设案例与无权限人员不写入档案',()=>{
 const seed=seedState(),staff=seed.staff[0],created=createGuidedSale(seed,staff,input);
 assert.equal(backfillReceptionProfile(created.state,staff,created.session.id,{}),created.state);
 const simulated={...created.state,consultations:created.state.consultations!.map(c=>({...c,ai:{category:'clothes' as const,recommendedProductIds:[],simulation:{caseId:'hospital-clothes' as const,turn:1}}}))};
 assert.equal(backfillReceptionProfile(simulated,staff,created.session.id,{region:'杭州'}),simulated);
 assert.equal(backfillReceptionProfile(created.state,seed.staff.find(s=>s.agencyId!==staff.agencyId)!,created.session.id,{region:'杭州'}),created.state);
});

test('性别年龄习俗回填，明确撤回清除旧事实，未提供字段保留',()=>{
 const seed=seedState(),staff=seed.staff[0],created=createGuidedSale(seed,staff,input);
 const first=backfillReceptionProfile(created.state,staff,created.session.id,{subjectGender:'男士',subjectAge:'65岁',customs:'素雅便装',occupation:'教师',faith:'佛教'});
 const cid=first.consultations!.find(c=>c.id===created.session.id)!.customerId!;
 assert.equal(first.customers.find(c=>c.id===cid)?.receptionProfile?.subjectAge,'65岁');
 const next=backfillReceptionProfile(first,staff,created.session.id,{occupation:'',faith:'待确认'});
 const profile=next.customers.find(c=>c.id===cid)!.receptionProfile!;
 assert.equal(profile.occupation,'');assert.equal(profile.faith,'待确认');assert.equal(profile.subjectGender,'男士');assert.equal(profile.customs,'素雅便装');
});
