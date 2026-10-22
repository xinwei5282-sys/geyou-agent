import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedState, finalizeQuote, recomputeProposalWarnings, saveServiceTask, serviceRecordFor } from './model';
import { createGuidedSale, guidedSaleProposal, saveConsultationDetails, saveGuidedSale } from './guidedSalesModel';

const input={scenario:'advance' as const,subjectName:'',nickname:'',occupation:'',interests:'',faith:'待确认',region:'',budget:0,notes:''};
const legacy=(state:any,id:string)=>({...state,consultations:state.consultations.map((c:any)=>c.id===id?{...c,guided:{...c.guided,plan:undefined}}:c)});
test('提前咨询无需手机号或逝者登记，未选项目不自动加入报价',()=>{
 const seed=seedState(),staff=seed.staff[0];
 const created=createGuidedSale(seed,staff,input);
 assert.equal(created.session.customerId,undefined);assert.equal(created.state.customers.length,seed.customers.length);assert.equal(created.session.contact?.phone,'');assert.equal(created.session.deceasedId,undefined);
 const next=saveGuidedSale(legacy(created.state,created.session.id),staff,created.session.id,{step:4,selectedProductIds:['p2']});
 const result=guidedSaleProposal(next,staff,created.session.id);
 assert.deepEqual(result.proposal.lines.map(l=>l.productId),['p2']);
 assert.deepEqual(recomputeProposalWarnings(result.state,result.proposal),[]);
 assert.equal(finalizeQuote(result.state,result.proposal.id,staff,true).quote.total,98000);
 assert.throws(()=>finalizeQuote(result.state,result.proposal.id,staff,false),/确认/);
});
test('每步可不选，空清单可保存但不可出报价',()=>{
 const seed=seedState(),staff=seed.staff[0],{state,session}=createGuidedSale(seed,staff,input);
 const next=saveGuidedSale(legacy(state,session.id),staff,session.id,{step:4});
 assert.equal(next.consultations!.at(-1)!.guided!.step,4);
 assert.throws(()=>guidedSaleProposal(next,staff,session.id),/尚未选择/);
 assert.throws(()=>guidedSaleProposal(legacy(state,session.id),staff,session.id),/逐步/);
});
test('三个场景均可不关联逝者并独立报价、记录待办',()=>{
 for(const scenario of ['advance','hospital','home'] as const){
 const seed=seedState(),staff=seed.staff[0],{state,session}=createGuidedSale(seed,staff,{...input,scenario,subjectName:'示例长者',nickname:'家属',customerId:'c1'});
 const customer=state.customers.find(c=>c.id===session.customerId)!;
 assert.equal(customer.deceased,undefined);assert.equal(session.deceasedId,undefined);
 const result=guidedSaleProposal(saveGuidedSale(legacy(state,session.id),staff,session.id,{step:4,selectedProductIds:['p1']}),staff,session.id);
 assert.equal(finalizeQuote(result.state,result.proposal.id,staff,true).quote.deceasedId,undefined);
 const next=saveServiceTask(state,customer.id,staff,{title:'联系客户',date:'2026-10-10',items:'沟通用品偏好',message:'内部回访',internal:true});
 assert.equal(serviceRecordFor(next.customers.find(c=>c.id===customer.id)!).tasks.length,1);
 }
});
test('手机号选填、校验并保存至客户，已有客户可以补充且留空不清除',()=>{
 const seed=seedState(),staff=seed.staff[0];
 const created=createGuidedSale(seed,staff,{...input,phone:'139 1234 5678',customerId:'c1'});
 const customer=created.state.customers.find(c=>c.id===created.session.customerId)!;
 assert.equal(customer.phone,'13912345678');
 assert.equal(created.session.guided!.subjectName,'');
 assert.throws(()=>createGuidedSale(seed,staff,{...input,phone:'abc'}),/手机号/);
 const updated=createGuidedSale(created.state,staff,{...input,customerId:customer.id,phone:'13812345678'});
 assert.equal(updated.state.customers.find(c=>c.id===customer.id)!.phone,'13812345678');
 const unchanged=createGuidedSale(updated.state,staff,{...input,customerId:customer.id,phone:''});
 assert.equal(unchanged.state.customers.find(c=>c.id===customer.id)!.phone,'13812345678');
});
test('谈单资料打开后可回写客户档案及关联逝者资料',()=>{
 const seed=seedState(),staff=seed.staff[0];
 seed.customers[0].deceased=[{id:'person-a',name:'王父',age:'82',relationship:'父亲',portraits:[]}];
 const created=createGuidedSale(seed,staff,{...input,customerId:'c1',deceasedId:'person-a'});
 const next=saveConsultationDetails(created.state,staff,created.session.id,{nickname:'王女士',phone:'13800000000',budget:250000,subjectName:'王敬安',region:'杭州拱墅',faith:'无特定信仰',occupation:'教师',interests:'偏好简洁',notes:'寿衣已备好',scenario:'hospital'});
 const customer=next.customers.find(c=>c.id==='c1')!,session=next.consultations!.find(c=>c.id===created.session.id)!;
 assert.deepEqual({name:customer.name,phone:customer.phone,budget:customer.budget,region:customer.region,note:customer.note},{name:'王女士',phone:'13800000000',budget:250000,region:'杭州拱墅',note:'寿衣已备好'});
 assert.equal(customer.deceased?.[0].name,'王敬安');
 assert.deepEqual({name:session.contact?.name,phone:session.contact?.phone,subject:session.guided?.subjectName,budget:session.guided?.budget,notes:session.guided?.notes},{name:'王女士',phone:'13800000000',subject:'王敬安',budget:250000,notes:'寿衣已备好'});
});
test('可按需关联已有逝者，不能关联其他客户的逝者，也不创建新档案',()=>{
 const seed=seedState(),staff=seed.staff[0];
 seed.customers[0].deceased=[{id:'person-a',name:'甲',age:'',relationship:'',portraits:[]}];
 const result=createGuidedSale(seed,staff,{...input,scenario:'home',customerId:'c1',deceasedId:'person-a'});
 assert.equal(result.session.serviceId,'c1:person-a');
 assert.deepEqual(result.state.customers[0].deceased,seed.customers[0].deceased);
 assert.throws(()=>createGuidedSale(seed,staff,{...input,scenario:'home',customerId:'c1',deceasedId:'foreign'}),/不一致/);
 const unlinked=createGuidedSale(seed,staff,{...input,scenario:'home',customerId:'c1'});
 assert.equal(unlinked.session.deceasedId,undefined);
 assert.deepEqual(unlinked.state.customers[0].deceased,seed.customers[0].deceased);
});
test('已有家属提前咨询不误关联其历史逝者',()=>{
 const seed=seedState(),staff=seed.staff[0];seed.customers[0].deceased=[{id:'old',name:'历史对象',age:'',relationship:'',portraits:[]}];
 const {state,session}=createGuidedSale(seed,staff,{...input,customerId:'c1',subjectName:'本人咨询'});
 const result=guidedSaleProposal(saveGuidedSale(legacy(state,session.id),staff,session.id,{step:4,selectedProductIds:['p1']}),staff,session.id);
 const quote=finalizeQuote(result.state,result.proposal.id,staff,true).quote;
 assert.equal(quote.deceasedId,undefined);assert.equal(quote.subjectName,'本人咨询');
});
test('下架项目及跨机构记录不能带入报价',()=>{
 const seed=seedState(),staff=seed.staff[0];
 assert.throws(()=>createGuidedSale(seed,staff,{...input,customerId:'c6'}),/联系记录/);
 const {state,session}=createGuidedSale(seed,staff,input);
 for(const product of ['p8','b1'])assert.throws(()=>guidedSaleProposal(saveGuidedSale(legacy(state,session.id),staff,session.id,{step:4,selectedProductIds:[product]}),staff,session.id),/不可用/);
 assert.throws(()=>saveGuidedSale(state,seed.staff[3],session.id,{step:1}),/无法访问/);
});
test('新套餐确认范围并校验选中商品，已确认方案保持幂等',()=>{
 const seed=seedState(),staff=seed.staff[0],created=createGuidedSale(seed,staff,input);
 const base={phase:'packages' as const,processPosition:'advance' as const,needs:{clothes:'needed' as const},scopeConfirmed:true,packages:[],continuation:'undecided' as const,processExplained:true};
 const incomplete=saveGuidedSale(created.state,staff,created.session.id,{plan:base});
 assert.throws(()=>guidedSaleProposal(incomplete,staff,created.session.id),/套餐选择/);
 const ready=saveGuidedSale(incomplete,staff,created.session.id,{plan:{...base,phase:'result',selectedLines:[{productId:'p2',name:'安宁传统寿衣套装',unit:'套',price:98000,quantity:1,kind:'商品'}]}});
 const result=guidedSaleProposal(ready,staff,created.session.id); assert.equal(result.proposal.lines[0].productId,'p2');
 assert.throws(()=>saveGuidedSale(result.state,staff,created.session.id,{plan:{...base,phase:'result'}}),/已确认/);
 const idem=guidedSaleProposal(result.state,staff,created.session.id); assert.equal(idem.proposal.id,result.proposal.id);
});
