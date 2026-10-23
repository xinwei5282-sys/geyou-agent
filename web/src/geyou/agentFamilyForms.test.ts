import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seedState} from './model';
import {withDemoAccount} from './demoAccount';
import {startAgentConversation,confirmAgentProfile,emptyAgentProfile,agentData,agentRecord,saveAgentPaperPlan} from './agentModel';
import {agentFamilyForms,currentFamilyForms,familyFormSettings,setFamilyFormSettings,familyFormSharePayload} from './agentFamilyForms';
import {validateFuneralPlanShare} from './funeralPlanShare';
const fixture=()=>{const s=withDemoAccount(seedState()),staff={...s.staff[0],name:'当前代理测试',phone:'13911112222'},fresh=startAgentConversation(s,staff);const profile={...emptyAgentProfile(),name:'表单测试逝者',deathDate:'2026-10-20',faith:'无特定信仰'};const state=confirmAgentProfile(fresh.state,staff,fresh.session.id,profile,'表单家属','13933334444');return {state,staff,sid:fresh.session.id,profile}};
test('documents use current agent and exact subject, no original vendor contacts or invented payment',()=>{
 const f=fixture(),forms=agentFamilyForms(f.state,f.staff,agentRecord(f.state,f.staff,f.sid)),all=JSON.stringify(forms);
 assert.deepEqual(forms.map(x=>x.id),['documents','family-preparation']);assert.match(all,/当前代理测试/);assert.match(all,/13911112222/);assert.match(all,/表单测试逝者/);assert.doesNotMatch(all,/13003692090|13606619958/);assert.ok(!forms.some(x=>x.id==='reservation'));assert.ok(!forms.some(x=>x.id==='fees'));
 assert.equal(familyFormSettings(f.state,agentRecord(f.state,f.staff,f.sid)).phase,'preparation');assert.throws(()=>agentFamilyForms(f.state,{...f.staff,agencyId:'other'},agentRecord(f.state,f.staff,f.sid)));
});
test('quotation confirmation and explicit custom consent gate later forms; skips persist and date references are bounded',()=>{
 const f=fixture(),d=agentData(f.state,agentRecord(f.state,f.staff,f.sid));let s=saveAgentPaperPlan(f.state,f.staff,f.sid,{...d.paperPlan!,pricesChecked:true,confirmedAt:'2026-10-23'});
 const forms=()=>agentFamilyForms(s,f.staff,agentRecord(s,f.staff,f.sid));assert.ok(!forms().some(x=>x.id==='reservation'));assert.doesNotMatch(JSON.stringify(forms()),/预订单与交接核对单/);
 const advance=(phase:'后续关怀'|'安葬安置'|'服务结束')=>{const c=agentRecord(s,f.staff,f.sid);s={...s,customers:s.customers.map(x=>x.id===c.customerId?{...x,deceased:x.deceased?.map(p=>p.id===c.deceasedId?{...p,service:{phase,dates:{},tasks:[]}}:p)}:x)}};
 advance('服务结束');s=setFamilyFormSettings(s,f.staff,f.sid,{customs:'pending'});assert.ok(!forms().some(x=>x.id==='seven'));assert.deepEqual(currentFamilyForms(s,f.staff,agentRecord(s,f.staff,f.sid)).map(x=>x.id),['five-seven']);
 s=setFamilyFormSettings(s,f.staff,f.sid,{customs:'yes'});assert.deepEqual(currentFamilyForms(s,f.staff,agentRecord(s,f.staff,f.sid)).map(x=>x.id),['seven','five-seven']);const seven=forms().find(x=>x.id==='seven')!;assert.match(seven.lines.join(''),/首七参考日期：2026-10-26/);assert.match(seven.lines.join(''),/五七参考日期：2026-11-23/);assert.ok(validateFuneralPlanShare(familyFormSharePayload(seven,'测试机构',f.staff.phone)));
 advance('安葬安置');s=setFamilyFormSettings(s,f.staff,f.sid,{customs:'yes'});assert.ok(forms().some(x=>x.id==='burial'));assert.ok(!forms().some(x=>x.id==='seven'));assert.deepEqual(currentFamilyForms(s,f.staff,agentRecord(s,f.staff,f.sid)).map(x=>x.id),['burial']);
 s=setFamilyFormSettings(s,f.staff,f.sid,{customs:'no'});s=JSON.parse(JSON.stringify(s));assert.ok(!forms().some(x=>x.id==='burial'));
});

test('bereaved family preparation appears after profile confirmation, before quote confirmation',()=>{
 const state=withDemoAccount(seedState()),staff=state.staff[0],fresh=startAgentConversation(state,staff);
 assert.ok(!currentFamilyForms(fresh.state,staff,fresh.session).some(x=>x.id==='family-preparation'));const f=fixture();const forms=currentFamilyForms(f.state,f.staff,agentRecord(f.state,f.staff,f.sid)),prep=forms.find(x=>x.id==='family-preparation');
 assert.ok(prep);assert.match(prep.title,/丧家.*提前准备/);assert.match(prep.lines.join(''),/门板\s*1块/);assert.match(prep.lines.join(''),/方凳\s*4张/);assert.match(prep.lines.join(''),/牙刷/);assert.match(prep.lines.join(''),/水果/);assert.equal(fresh.session.agent?.profile.confirmedAt,undefined);assert.doesNotMatch(prep.lines.join(''),/告别时间|告别地点/);const materials=forms.find(x=>x.id==='documents')!;assert.doesNotMatch(materials.lines.join(''),/告别时间|告别地点/);
});
