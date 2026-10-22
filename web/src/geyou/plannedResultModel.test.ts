import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedState, serviceRecordFor } from './model';
import { createGuidedSale, saveGuidedSale, setConsultationNeeds, saveConsultationDetails } from './guidedSalesModel';
import { savePlannedResult, continuePlannedSale } from './plannedResultModel';
function setup(){
 const seed=seedState(),staff=seed.staff[0];
 const x=createGuidedSale(seed,staff,{customerId:'c1',scenario:'hospital',subjectName:'',nickname:'仅咨询寿衣',occupation:'',interests:'',faith:'待确认',region:'',budget:0,notes:''});
 const state=setConsultationNeeds(x.state,staff,x.session.id,{clothes:'needed'});
 const plan=state.consultations!.at(-1)!.guided!.plan!;
 return {staff,session:x.session,plan,state};
}
function ready(){const x=setup();const plan={...x.plan,phase:'result' as const,selectedLines:x.plan.packages[0].lines};return {...x,plan,state:saveGuidedSale(x.state,x.staff,x.session.id,{plan})}}
test('医院可直接选寿衣，不必讲完流程；确认不关闭客户、不建收款或待办',()=>{
 const {state,staff,session,plan}=ready();assert.equal(plan.processExplained,undefined);
 const next=savePlannedResult(saveGuidedSale(state,staff,session.id,{plan:{...plan,continuation:'none'}}),staff,session.id,true);
 const c=next.customers.find(c=>c.id===session.customerId)!;
 assert.equal(c.stage,state.customers.find(x=>x.id===session.customerId)!.stage);assert.equal(c.deceased,undefined);assert.equal(serviceRecordFor(c).tasks.length,0);assert.equal(next.quotes.length,state.quotes.length);
 assert.equal(next.proposals.at(-1)!.lines.length,1);assert.ok(c.contactFollowupDoneAt);
 assert.equal(savePlannedResult(next,staff,session.id,true).proposals.length,next.proposals.length);
});
test('保存沟通及保存跟进待办不登记成交或推进逝者服务阶段',()=>{
 const {state,staff,session,plan}=ready();
 const withDeceased={...state,customers:state.customers.map(c=>c.id===session.customerId?{...c,deceased:[{id:'d1',name:'测试逝者',age:'80',relationship:'父亲',portraits:[]}]}:c)};
 const saved=savePlannedResult(saveGuidedSale(withDeceased,staff,session.id,{plan:{...plan,continuation:'continue',followupDate:'2026-10-20',followupNote:'稍后沟通'}}),staff,session.id,false);
 const customer=saved.customers.find(c=>c.id===session.customerId)!;
 assert.equal(customer.stage,withDeceased.customers.find(c=>c.id===session.customerId)!.stage);
 assert.equal(serviceRecordFor(customer,'d1').dealStage,undefined);assert.equal(serviceRecordFor(customer,'d1').phase,'接洽登记');assert.equal(saved.quotes.length,withDeceased.quotes.length);
});
test('跟进待办选填，保存后确认只建一条，可无逝者',()=>{
 const {state,staff,session,plan}=ready();
 let next=saveGuidedSale(state,staff,session.id,{plan:{...plan,continuation:'continue',followupDate:'2026-10-20',followupNote:'按约定补充告别需求'}});
 next=savePlannedResult(next,staff,session.id,false);assert.equal(next.proposals.length,state.proposals.length);
 next=savePlannedResult(next,staff,session.id,true);
 const tasks=serviceRecordFor(next.customers.find(c=>c.id===session.customerId)!).tasks;
 assert.equal(tasks.length,1);assert.equal(tasks[0].internal,true);assert.equal(next.consultations!.at(-1)!.guided!.plan!.followupTaskId,tasks[0].id);
 assert.equal(serviceRecordFor(savePlannedResult(next,staff,session.id,true).customers.find(c=>c.id===session.customerId)!).tasks.length,1);
});
test('待办或商品校验失败不产生半条记录',()=>{
 const {state,staff,session,plan}=ready();
 assert.throws(()=>savePlannedResult(saveGuidedSale(state,staff,session.id,{plan:{...plan,followupDate:''}}),staff,session.id,true),/跟进日期/);
 const invalid=saveGuidedSale({...state,products:state.products.map(p=>p.id==='p2'?{...p,enabled:false}:p)},staff,session.id,{plan:{...plan,followupDate:'2026-10-20',followupNote:'跟进'}});
 assert.throws(()=>savePlannedResult(invalid,staff,session.id,true),/变动/);assert.equal(serviceRecordFor(invalid.customers.find(c=>c.id===session.customerId)!).tasks.length,0);
});
test('范围覆盖、跨机构、下架、价格与数量校验继续生效',()=>{
 const {state,staff,session,plan}=ready();
 for(const patch of [{scopeConfirmed:false},{needs:{clothes:'prepared' as const}},{needs:{clothes:'needed' as const,urn:'needed' as const}},{selectedLines:plan.selectedLines.map(l=>({...l,quantity:0}))}])assert.throws(()=>savePlannedResult(saveGuidedSale(state,staff,session.id,{plan:{...plan,...patch}}),staff,session.id,true));
 for(const patch of [{enabled:false},{agencyId:'foreign'},{price:99000}])assert.throws(()=>savePlannedResult({...state,products:state.products.map(p=>p.id==='p2'?{...p,...patch}:p)},staff,session.id,true),/变动/);
});
test('回来续谈直接看商品、默认已准备，保留原快照并复用未完成轮次',()=>{
 const {state,staff,session}=ready(),confirmed=savePlannedResult(state,staff,session.id,true);
 const before=JSON.stringify(confirmed.consultations!.find(c=>c.id===session.id));
 const continued=continuePlannedSale(confirmed,staff,session.id);
 assert.equal(continued.session.customerId,session.customerId);assert.equal(continued.session.guided!.scenario,'hospital');assert.equal(continued.session.guided!.plan!.phase,'packages');assert.equal(continued.session.guided!.plan!.processExplained,undefined);assert.equal(continued.session.guided!.plan!.needs.clothes,'prepared');assert.equal(continued.session.guided!.plan!.selectedLines,undefined);assert.equal(continued.session.guided!.budget,0);
 assert.equal(JSON.stringify(continued.state.consultations!.find(c=>c.id===session.id)),before);assert.equal(continuePlannedSale(continued.state,staff,session.id).session.id,continued.session.id);
 const other={...continued.state,customers:continued.state.customers.map(c=>c.id===session.customerId?{...c,deceased:[{id:'other',name:'另一对象',age:'',relationship:'',portraits:[]}]}:c)};
 const x=createGuidedSale(other,staff,{scenario:'home',subjectName:'',nickname:'',occupation:'',interests:'',faith:'',region:'',budget:0,notes:'',customerId:session.customerId,deceasedId:'other'});
 assert.equal(x.session.guided!.plan!.needs.clothes,undefined);
});
test('点选需求自动组合；同范围刷新保留清单；换范围清除未确认选择',()=>{
 const {state,staff,session,plan}=ready();
 assert.equal(plan.packages.length,1);assert.equal(plan.phase,'result');
 const same=setConsultationNeeds(state,staff,session.id,{clothes:'needed'});assert.deepEqual(same.consultations!.at(-1)!.guided!.plan!.selectedLines,plan.selectedLines);
 const changed=setConsultationNeeds(state,staff,session.id,{urn:'needed'});const next=changed.consultations!.at(-1)!.guided!.plan!;assert.equal(next.phase,'packages');assert.equal(next.selectedLines,undefined);assert.equal(next.packages[0].lines[0].productId,'p1');
 const empty=setConsultationNeeds(changed,staff,session.id,{});assert.equal(empty.consultations!.at(-1)!.guided!.plan!.packages.length,0);assert.equal(empty.consultations!.at(-1)!.guided!.plan!.scopeConfirmed,false);
});
test('补充资料不清空选择、数量与所在区域，电话校验且空值不抹已有电话',()=>{
 const {state,staff,session,plan}=ready();const withQty=saveGuidedSale(state,staff,session.id,{plan:{...plan,selectedLines:plan.selectedLines.map(l=>({...l,quantity:2}))}});
 const data={nickname:'王先生',phone:'139 1234 5678',budget:50000,subjectName:'',region:'杭州',faith:'无特殊要求',occupation:'',interests:'',notes:'稍后继续',scenario:'hospital' as const};
 const next=saveConsultationDetails(withQty,staff,session.id,data);assert.equal(next.consultations!.at(-1)!.guided!.plan!.phase,'result');assert.equal(next.consultations!.at(-1)!.guided!.plan!.selectedLines![0].quantity,2);assert.equal(next.consultations!.at(-1)!.guided!.plan!.packages[0].overBudget,48000);assert.equal(next.customers.find(c=>c.id===session.customerId)!.phone,'13912345678');
 const blank=saveConsultationDetails(next,staff,session.id,{...data,phone:''});assert.equal(blank.customers.find(c=>c.id===session.customerId)!.phone,'13912345678');assert.throws(()=>saveConsultationDetails(next,staff,session.id,{...data,phone:'bad'}),/手机号/);
 const confirmed=savePlannedResult(next,staff,session.id,true);assert.throws(()=>setConsultationNeeds(confirmed,staff,session.id,{}),/已确认/);assert.throws(()=>saveConsultationDetails(confirmed,staff,session.id,data),/已确认/);
 assert.throws(()=>setConsultationNeeds(state,state.staff.find(x=>x.agencyId!==staff.agencyId)!,session.id,{}),/无法访问/);
});
test('只看流程可保存；选择场景不自动加入商品',()=>{
 const s=seedState(),staff=s.staff[0];for(const scenario of ['advance','hospital','home'] as const){const x=createGuidedSale(s,staff,{scenario,subjectName:'',nickname:'',occupation:'',interests:'',faith:'',region:'',budget:0,notes:''});assert.equal(x.session.guided!.plan!.phase,scenario==='advance'?'process':'packages');assert.deepEqual(x.session.guided!.plan!.needs,{});const saved=savePlannedResult(x.state,staff,x.session.id,false);assert.equal(saved.proposals.length,s.proposals.length);assert.equal(saved.quotes.length,s.quotes.length)}
});
