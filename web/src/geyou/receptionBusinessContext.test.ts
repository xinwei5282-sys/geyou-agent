import test from 'node:test';
import assert from 'node:assert/strict';
import {seedState,setServiceDeal,updateServiceInfo} from './model';
import {saveDeceased} from './memorialModel';
import {createGuidedSale} from './guidedSalesModel';
import {saveServiceStage} from './serviceWorkflow';
import {receptionBusinessFacts} from './receptionBusinessContext';
test('business facts read actual subject schedule, review state and adoption instead of chat claims',()=>{
 let state=seedState();const staff=state.staff[0];state=saveDeceased(state,staff,'c1',{id:'d-facts',name:'当前父亲',age:'80',relationship:'父亲'});state=setServiceDeal(state,'c1','d-facts',staff,'已成交');state=updateServiceInfo(state,'c1',staff,{phase:'治丧筹备',dates:{farewell:'2026-10-23'}},'d-facts');state=saveServiceStage(state,staff,'c1','d-facts','farewell',{progress:'进行中',scheduledAt:'2026-10-23T10:00'});
 const created=createGuidedSale(state,staff,{customerId:'c1',deceasedId:'d-facts',nickname:'测试',scenario:'home',subjectName:'当前父亲',occupation:'',interests:'',faith:'待确认',region:'杭州',budget:0,notes:'客户说讣告已经发出'});
 created.state.notices=[{...created.state.notices[0],agencyId:staff.agencyId,customerId:'c1',deceasedId:'d-facts',status:'已发布',ceremonyDate:'2026-10-23T09:00',scheduleReview:'告别时间待核对'}];
 const text=receptionBusinessFacts(created.state,staff,created.session).join('\n');assert.match(text,/治丧筹备/);assert.match(text,/10:00/);assert.match(text,/待重新核对/);assert.match(text,/未上传/);assert.ok(!text.includes('客户说讣告已经发出'));
 const restricted=created.state.staff.find(s=>s.agencyId!==staff.agencyId)!;assert.ok(!receptionBusinessFacts(created.state,restricted,created.session).join('').includes('当前父亲'));
});
