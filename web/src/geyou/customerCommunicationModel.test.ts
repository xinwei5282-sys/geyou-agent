import test from 'node:test';
import assert from 'node:assert/strict';
import {seedState} from './model';
import {createGuidedSale} from './guidedSalesModel';
import {findCustomerConversation,openCustomerConversation,selectCustomerConversation,communicationMessages,appendConfirmedConversation} from './customerCommunicationModel';
const input={scenario:'advance' as const,nickname:'测试',subjectName:'',occupation:'',interests:'',faith:'待确认',region:'杭州',budget:0,notes:''};
test('customer reentry reuses manual and confirmed sessions without creating supplementary orders',()=>{
 const base=seedState(),staff=base.staff[0],created=createGuidedSale(base,staff,{...input,customerId:'c1'});
 const record=created.session;record.guided!.plan!.outcome='confirmed';
 const result=openCustomerConversation(created.state,staff,'c1');assert.equal(result.session.id,record.id);assert.equal(result.state,created.state);assert.equal(result.session.ai,undefined);
 assert.equal(openCustomerConversation(result.state,staff,'c1').state.consultations!.length,created.state.consultations!.length);
});
test('customer and subject lookup never borrow another person or restricted agency',()=>{
 const base=seedState(),staff=base.staff[0];base.customers[0].deceased=[{id:'father',name:'父亲',age:'80',relationship:'父亲',portraits:[]},{id:'mother',name:'母亲',age:'80',relationship:'母亲',portraits:[]}];
 const first=openCustomerConversation(base,staff,'c1','father');const second=openCustomerConversation(first.state,staff,'c1','mother');
 assert.notEqual(first.session.id,second.session.id);assert.equal(findCustomerConversation(second.state,staff,'c1','father')!.id,first.session.id);assert.throws(()=>openCustomerConversation(second.state,staff,'c1','missing'),/不存在/);
 const other=base.staff.find(s=>s.agencyId!==staff.agencyId)!;assert.equal(findCustomerConversation(second.state,other,'c1'),undefined);assert.throws(()=>openCustomerConversation(second.state,other,'c1'),/权限/);
});
test('customer timeline includes their service history and excludes simulations and other customers',()=>{
 const base=seedState(),staff=base.staff[0],a=createGuidedSale(base,staff,{...input,customerId:'c1'});a.session.messages=[{role:'user',text:'首次需求',at:'2026-10-21T09:00:00Z'}];
 const b=createGuidedSale(a.state,staff,{...input,customerId:'c1'});b.session.messages=[{role:'user',text:'后续沟通',at:'2026-10-21T10:00:00Z'}];
 const stranger=createGuidedSale(b.state,staff,input);stranger.session.messages=[{role:'user',text:'其他咨询'}];
 const demo={...b.session,id:'demo',messages:[{role:'user' as const,text:'演示案例'}],ai:{category:'clothes' as const,recommendedProductIds:[],simulation:{caseId:'hospital-clothes' as const,turn:1}}};stranger.state.consultations!.push(demo);
 assert.deepEqual(communicationMessages(stranger.state,staff,b.session).map(e=>e.message.text),['首次需求','后续沟通']);
});
test('continued chat preserves confirmed cart, quote, proposal and prior AI context',()=>{
 const base=seedState(),staff=base.staff[0],created=createGuidedSale(base,staff,{...input,customerId:'c1'});created.session.guided!.plan!.outcome='confirmed';created.session.ai={category:'clothes',recommendedProductIds:['keep']};
 const before=JSON.stringify({guided:created.session.guided,ai:created.session.ai,quotes:created.state.quotes,proposals:created.state.proposals});
 const result=appendConfirmedConversation(created.state,staff,created.session.id,[{role:'user',text:'后续还有哪些安排？'}],{reply:'可查看对应流程',todos:['核对预约']});const saved=result.consultations!.find(c=>c.id===created.session.id)!;
 assert.equal(saved.messages.length,2);assert.equal(JSON.stringify({guided:saved.guided,ai:saved.ai,quotes:result.quotes,proposals:result.proposals}),before);
});
test('choosing customer after unbound chat associates existing history instead of losing it or creating again',()=>{
 const base=seedState(),staff=base.staff[0],created=createGuidedSale(base,staff,input);created.session.messages=[{role:'user',text:'先聊的需求'}];
 const result=selectCustomerConversation(created.state,staff,'c1',created.session);assert.equal(result.session.id,created.session.id);assert.equal(result.session.customerId,'c1');assert.equal(result.session.messages[0].text,'先聊的需求');assert.equal(result.state.consultations!.length,created.state.consultations!.length);
});
test('authorized replacement staff can read legacy history after reload while unrelated staff cannot',()=>{
 const base=seedState(),boss=base.staff[0],created=createGuidedSale(base,boss,{...input,customerId:'c1'});created.session.messages=[{role:'user',text:'原业务员的接待记录',at:'2026-10-20T09:00:00Z'}];
 const legacy={...created.session,id:'legacy-answer',guided:undefined,messages:[{role:'assistant' as const,text:'历史问答中的安排说明',at:'2026-10-19T09:00:00Z'}]};created.state.consultations!.push(legacy);
 const replacement=created.state.staff.find(s=>s.agencyId===boss.agencyId&&s.role!=='老板')!;created.state.customers.find(c=>c.id==='c1')!.ownerId=replacement.id;
 const restored=JSON.parse(JSON.stringify(created.state));assert.deepEqual(communicationMessages(restored,replacement,created.session).map(e=>e.message.text),['历史问答中的安排说明','原业务员的接待记录']);
 const other=restored.staff.find((s:typeof boss)=>s.agencyId!==boss.agencyId)!;assert.equal(findCustomerConversation(restored,other,'c1'),undefined);
});
