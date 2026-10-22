import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seedState,finalizeQuote,migrateState,setServiceTaskStatus} from './model';
import {createGuidedSale,saveGuidedSale} from './guidedSalesModel';
import {savePlannedResult,continuePlannedSale} from './plannedResultModel';
const input={scenario:'advance' as const,subjectName:'',nickname:'完整流程样例',occupation:'',interests:'',faith:'待确认',region:'杭州',budget:500000,notes:''};
function draft(){const seed=seedState(),staff=seed.staff[0],created=createGuidedSale(seed,staff,input);const plan=created.session.guided!.plan!;const selectedLines=['p2','p1'].map(id=>{const p=seed.products.find(p=>p.id===id)!;return {productId:p.id,name:p.name,unit:p.unit,kind:p.kind,price:p.price,quantity:id==='p2'?2:1}});const state=saveGuidedSale(created.state,staff,created.session.id,{plan:{...plan,phase:'result',scopeConfirmed:true,needs:{...plan.needs,clothes:'needed',urn:'needed'},selectedLines}});return {state,staff,id:created.session.id};}
test('本次清单保存恢复、确认报价、刷新、继续新一轮保留原快照',()=>{
 const {state,staff,id}=draft();const saved=savePlannedResult(state,staff,id,false);const restored=migrateState(JSON.parse(JSON.stringify(saved)));
 assert.deepEqual(restored.consultations!.find(c=>c.id===id)!.guided!.plan!.selectedLines?.map(l=>l.quantity),[2,1]);
 const confirmed=savePlannedResult(restored,staff,id,true),session=confirmed.consultations!.find(c=>c.id===id)!;
 assert.equal(session.guided!.plan!.outcome,'confirmed');const result=finalizeQuote(confirmed,session.proposalId!,staff,true);
 assert.equal(result.quote.total,364000);assert.deepEqual(result.quote.lines.map(l=>[l.productId,l.quantity]),[['p2',2],['p1',1]]);assert.equal(result.quote.receipt,undefined);
 const reloaded=migrateState(JSON.parse(JSON.stringify(result.state)));assert.equal(finalizeQuote(reloaded,session.proposalId!,staff,true).quote.id,result.quote.id);
 assert.throws(()=>saveGuidedSale(reloaded,staff,id,{budget:1}),/确认/);
 const next=continuePlannedSale(reloaded,staff,id);assert.notEqual(next.session.id,id);assert.equal(next.session.guided!.plan!.selectedLines?.length||0,0);assert.deepEqual(next.state.quotes.find(q=>q.id===result.quote.id)?.lines,result.quote.lines);
});
test('未核对、价格变化、下架和越权不能生成有效确认结果',()=>{
 const {state,staff,id}=draft();assert.throws(()=>savePlannedResult(state,state.staff[3],id,true),/无法访问|权限/);
 for(const patch of [{enabled:false},{price:1}]){const changed={...state,products:state.products.map(p=>p.id==='p2'?{...p,...patch}:p)};assert.throws(()=>savePlannedResult(changed,staff,id,true));}
 const confirmed=savePlannedResult(state,staff,id,true);const proposal=confirmed.consultations!.find(c=>c.id===id)!.proposalId!;assert.throws(()=>finalizeQuote(confirmed,proposal,staff,false));
});

test('业务员可直接完成线下待办，保留真实发送状态和完成审计',()=>{
 const seed=seedState(),staff=seed.staff[0],customer=seed.customers.find(c=>c.agencyId===staff.agencyId)!;
 const task={id:'manual-check',title:'线下回访',date:'2026-10-10',items:'核对需求',message:'回访',status:'待确认' as const,createdAt:'2026-10-10',updatedAt:'2026-10-10'};
 const state={...seed,customers:seed.customers.map(c=>c.id===customer.id?{...c,service:{phase:'接洽登记' as const,dates:{},tasks:[task]}}:c)};
 const done=setServiceTaskStatus(state,customer.id,task.id,staff,'已完成');
 const saved=done.customers.find(c=>c.id===customer.id)!;
 assert.equal(saved.service!.tasks[0].status,'已完成');assert.ok(saved.service!.tasks[0].completedAt);assert.equal(saved.service!.tasks[0].sentAt,undefined);
 assert.ok(saved.followups.some(f=>f.staffId===staff.id&&f.text.includes('人工确认完成')));
 const patch=(fields:Partial<typeof task>&{internal?:boolean;autoKey?:'prepare-portrait';needsReview?:string})=>({...state,customers:state.customers.map(c=>c.id===customer.id?{...c,service:{...c.service!,tasks:[{...task,...fields}]}}:c)});
 assert.throws(()=>setServiceTaskStatus(patch({internal:true,autoKey:'prepare-portrait'}),customer.id,task.id,staff,'已完成'),/对应操作/);
 assert.throws(()=>setServiceTaskStatus(patch({needsReview:'日期已调整'}),customer.id,task.id,staff,'已完成'),/核对日期/);
 assert.throws(()=>setServiceTaskStatus(done,customer.id,task.id,staff,'待发送'),/已结束/);
});
