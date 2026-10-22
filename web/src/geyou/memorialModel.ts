import { reconcileService } from './serviceAutomation';
import type { AppState, Staff, Customer, Deceased, Notice, PortraitRecord, ModuleKey, UnlinkedPortraitRecord } from './types';
import { hasStaffModule, visibleCustomers } from './model';
const uid = () => crypto.randomUUID();
function actor(s:AppState, staff:Staff, module:ModuleKey='customers') {
 const current=s.staff.find(x=>x.id===staff.id&&x.agencyId===staff.agencyId);
 if(!current||!hasStaffModule(s,current,module))throw Error('无权访问此功能');
 return current;
}
export function memorialCustomer(s:AppState,staff:Staff,customerId:string):Customer {
 const current=actor(s,staff);
 const customer=visibleCustomers(s,current).find(c=>c.id===customerId);
 if(!customer)throw Error('客户不存在或无权访问');
 return customer;
}
export function memorialDeceased(s:AppState,staff:Staff,customerId:string,deceasedId:string):Deceased {
 const person=memorialCustomer(s,staff,customerId).deceased?.find(d=>d.id===deceasedId);
 if(!person)throw Error('请选择该客户对应的逝者');
 return person;
}
function replacePerson(s:AppState,customerId:string,person:Deceased):AppState {
 const next={...s,customers:s.customers.map(c=>c.id!==customerId?c:{...c,deceased:c.deceased?.some(d=>d.id===person.id)?c.deceased.map(d=>d.id===person.id?person:d):[...(c.deceased||[]),person]})};
 if(!person.service)return next;
 const customer=next.customers.find(c=>c.id===customerId)!;
 const service=reconcileService(next,customer,person.id,person.service);
 return {...next,customers:next.customers.map(c=>c.id===customerId?{...c,deceased:c.deceased!.map(d=>d.id===person.id?{...d,service}:d)}:c)};
}
export function saveDeceased(s:AppState,staff:Staff,customerId:string,input:{id?:string;name:string;age:string;relationship:string}):AppState {
 const customer=memorialCustomer(s,staff,customerId);
 if(!input.name.trim())throw Error('请填写逝者姓名');
 if(input.age.trim()&&!/^\d{1,3}$/.test(input.age.trim()))throw Error('享年请填写0–999之间的整数');
 const previous=customer.deceased?.find(d=>d.id===input.id);
 const person:Deceased={...previous,id:previous?.id||input.id||uid(),name:input.name.trim(),age:input.age.trim(),relationship:input.relationship.trim(),portraits:previous?.portraits||[]};
 return replacePerson(s,customerId,person);
}
export function addPortrait(s:AppState,staff:Staff,customerId:string,deceasedId:string,image:string):AppState {
 actor(s,staff,'restoration');const person=memorialDeceased(s,staff,customerId,deceasedId);
 if(!/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(image)||image.length>1000000)throw Error('请上传有效且已压缩的遗照');
 const record:PortraitRecord={id:uid(),original:image,status:'原图',createdAt:new Date().toISOString()};
 return replacePerson(s,customerId,{...person,portraits:[...person.portraits,record]});
}
export function visibleUnlinkedPortraits(s:AppState,staff:Staff):UnlinkedPortraitRecord[] {
 const current=actor(s,staff,'restoration');
 return (s.unlinkedPortraits||[]).filter(record=>record.agencyId===current.agencyId&&(current.role==='老板'||record.staffId===current.id));
}
export function addUnlinkedPortrait(s:AppState,staff:Staff,image:string):AppState {
 const current=actor(s,staff,'restoration');
 if(!/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(image)||image.length>1000000)throw Error('请上传有效且已压缩的照片');
 const record:UnlinkedPortraitRecord={id:uid(),agencyId:current.agencyId,staffId:current.id,original:image,status:'原图',createdAt:new Date().toISOString()};
 return {...s,unlinkedPortraits:[...(s.unlinkedPortraits||[]),record]};
}
function updateUnlinked(s:AppState,staff:Staff,recordId:string,change:(r:UnlinkedPortraitRecord)=>UnlinkedPortraitRecord):AppState {
 const current=actor(s,staff,'restoration');const record=visibleUnlinkedPortraits(s,current).find(item=>item.id===recordId);
 if(!record)throw Error('照片记录不存在或无权访问');
 return {...s,unlinkedPortraits:(s.unlinkedPortraits||[]).map(item=>item.id===recordId?change(item):item)};
}
export function startUnlinkedPortraitRepair(s:AppState,staff:Staff,recordId:string,clothing?:import('./portraitClothing').PortraitClothing):AppState {
 return updateUnlinked(s,staff,recordId,r=>{if(r.status==='处理中')throw Error('该照片正在处理中');return {...r,clothing,status:'处理中',result:undefined,promptVersion:undefined,jobId:undefined,errorMessage:undefined};});
}
export function startUnlinkedPortraitGeneration(s:AppState,staff:Staff,recordId:string,clothing:import('./portraitClothing').PortraitClothing){
 const record=visibleUnlinkedPortraits(s,staff).find(r=>r.id===recordId);if(!record)throw Error('照片记录不存在或无权访问');
 let state=s,id=recordId;if(record.result||record.confirmedAt){state=addUnlinkedPortrait(s,staff,record.original);id=state.unlinkedPortraits!.at(-1)!.id}
 return {state:startUnlinkedPortraitRepair(state,staff,id,clothing),recordId:id};
}
export function setUnlinkedPortraitJob(s:AppState,staff:Staff,recordId:string,jobId:string):AppState {
 if(!jobId.trim())throw Error('修复服务未返回任务编号');
 return updateUnlinked(s,staff,recordId,r=>{if(r.status!=='处理中')throw Error('该修复任务已结束');return {...r,jobId};});
}
export function finishUnlinkedPortraitRepair(s:AppState,staff:Staff,recordId:string,result:string,promptVersion:string):AppState {
 if(!/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(result)||result.length>1000000)throw Error('修复结果无效或超过本地保存限制');
 if(!promptVersion.trim())throw Error('修复服务未返回模型版本信息');
 return updateUnlinked(s,staff,recordId,r=>{if(r.status!=='处理中')throw Error('该修复任务已结束');return {...r,result,status:'已完成',promptVersion,errorMessage:undefined};});
}
export function failUnlinkedPortraitRepair(s:AppState,staff:Staff,recordId:string,message?:string):AppState {
 return updateUnlinked(s,staff,recordId,r=>r.status==='处理中'?{...r,status:'失败',errorMessage:message||r.errorMessage||'修复任务已结束，可重试'}:r);
}
export function linkUnlinkedPortrait(s:AppState,staff:Staff,recordId:string,customerId:string,deceasedId:string):AppState {
 const record=visibleUnlinkedPortraits(s,actor(s,staff,'restoration')).find(item=>item.id===recordId);
 if(!record)throw Error('照片记录不存在或无权访问');
 if(record.status==='处理中')throw Error('照片修复完成或取消后才能关联');
 const person=memorialDeceased(s,staff,customerId,deceasedId);
 const {agencyId:_agencyId,staffId:_staffId,...portrait}:UnlinkedPortraitRecord=record;
 const next=replacePerson(s,customerId,{...person,portraits:[...person.portraits,portrait]});
 return {...next,unlinkedPortraits:(next.unlinkedPortraits||[]).filter(item=>item.id!==recordId)};
}
function updateRecord(s:AppState,staff:Staff,customerId:string,deceasedId:string,recordId:string,change:(r:PortraitRecord)=>PortraitRecord,select=false):AppState {
 actor(s,staff,'restoration');const person=memorialDeceased(s,staff,customerId,deceasedId);
 if(!person.portraits.some(r=>r.id===recordId))throw Error('遗照记录不存在');
 return replacePerson(s,customerId,{...person,...(select?{selectedPortraitId:recordId}:{}),portraits:person.portraits.map(r=>r.id===recordId?change(r):r)});
}
export function startPortraitRepair(s:AppState,staff:Staff,customerId:string,deceasedId:string,recordId:string,clothing?:import('./portraitClothing').PortraitClothing):{state:AppState;recordId:string} {
 const person=memorialDeceased(s,actor(s,staff,'restoration'),customerId,deceasedId);
 const record=person.portraits.find(r=>r.id===recordId);
 if(!record)throw Error('遗照记录不存在');
 if(record.status==='处理中')throw Error('该照片正在处理中');
 if(record.status==='已完成'||record.confirmedAt){
  const copy:PortraitRecord={id:uid(),original:record.original,clothing,status:'处理中',createdAt:new Date().toISOString(),jobId:undefined,errorMessage:undefined};
  return {state:replacePerson(s,customerId,{...person,portraits:[...person.portraits,copy]}),recordId:copy.id};
 }
 return {state:updateRecord(s,staff,customerId,deceasedId,recordId,r=>({...r,clothing,status:'处理中',result:undefined,promptVersion:undefined,jobId:undefined,errorMessage:undefined})),recordId};
}
export function setPortraitJob(s:AppState,staff:Staff,customerId:string,deceasedId:string,recordId:string,jobId:string):AppState {
 if(!jobId.trim())throw Error('修复服务未返回任务编号');
 return updateRecord(s,staff,customerId,deceasedId,recordId,r=>{if(r.status!=='处理中')throw Error('该修复任务已结束');return {...r,jobId};});
}
export function finishPortraitRepair(s:AppState,staff:Staff,customerId:string,deceasedId:string,recordId:string,result:string,promptVersion:string):AppState {
 if(!/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(result)||result.length>1000000)throw Error('修复结果无效或超过本地保存限制');
 if(!promptVersion.trim())throw Error('修复服务未返回模型版本信息');
 return updateRecord(s,staff,customerId,deceasedId,recordId,r=>{
  if(r.status!=='处理中')throw Error('该修复任务已结束');
  return {...r,result,status:'已完成',promptVersion,errorMessage:undefined};
 });
}
export function failPortraitRepair(s:AppState,staff:Staff,customerId:string,deceasedId:string,recordId:string,message?:string):AppState {
 return updateRecord(s,staff,customerId,deceasedId,recordId,r=>r.status==='处理中'?{...r,status:'失败',errorMessage:message||r.errorMessage||'修复任务已结束，可重试'}:r);
}
/** Legacy API retained for older callers; a request records failure rather than pretending the service is available. */
export function requestPortraitRepair(s:AppState,staff:Staff,customerId:string,deceasedId:string,recordId:string):AppState {
 return updateRecord(s,staff,customerId,deceasedId,recordId,r=>r.status==='已完成'?r:{...r,status:'失败',result:undefined});
}
export function confirmPortrait(s:AppState,staff:Staff,customerId:string,deceasedId:string,recordId:string,source:'original'|'result'):AppState {
 return updateRecord(s,staff,customerId,deceasedId,recordId,r=>{
  if(source==='result'&&(!r.result||r.status!=='已完成'))throw Error('尚无可采用的真实修复结果');
  if(source==='result'&&r.confirmedAt)throw Error('已确认记录不可覆盖，请保留历史记录');
  return {...r,selectedSource:source,confirmedAt:new Date().toISOString()};
 },true);
}
export function selectedPortrait(person:Deceased):{image:string;recordId:string}|undefined {
 const r=person.portraits.find(r=>r.id===person.selectedPortraitId&&r.confirmedAt);
 if(!r)return;
 const image=r.selectedSource==='original'?r.original:r.selectedSource==='result'&&r.status==='已完成'?r.result:undefined;
 return image?{image,recordId:r.id}:undefined;
}
export function canAccessNotice(s:AppState,staff:Staff,notice:Notice):boolean {
 try {const current=actor(s,staff,'content');if(notice.agencyId!==current.agencyId)return false;
 if(!notice.customerId&&!notice.deceasedId)return true; // Legacy unbound notices remain available to the original agency.
 memorialDeceased(s,current,notice.customerId||'',notice.deceasedId||'');return true;
 }catch{return false;}
}
export function bindNotice(s:AppState,staff:Staff,notice:Notice,customerId:string,deceasedId:string):Notice {
 actor(s,staff,'content');
 if(notice.agencyId!==staff.agencyId)throw Error('无权修改其他代理的讣告');
 const person=memorialDeceased(s,staff,customerId,deceasedId),portrait=selectedPortrait(person);
 return {...notice,customerId,deceasedId,name:person.name,age:person.age,portrait:portrait?.image,portraitRecordId:portrait?.recordId};
}
export function validateNoticeBinding(s:AppState,staff:Staff,notice:Notice):void {
 actor(s,staff,'content');
 if(notice.agencyId!==staff.agencyId)throw Error('无权修改其他代理的讣告');
 if(!notice.customerId||!notice.deceasedId)throw Error('请先关联客户及逝者');
 const person=memorialDeceased(s,staff,notice.customerId,notice.deceasedId);
 if(notice.portraitRecordId&&!person.portraits.some(r=>r.id===notice.portraitRecordId))throw Error('遗照与逝者关联不一致');
}
// Saving an explicitly chosen notice photo also files it under the selected deceased.
// This does not change the archive's selected version or any existing public notice.
export function archiveNoticePortrait(s:AppState,staff:Staff,notice:Notice):{state:AppState;notice:Notice} {
 validateNoticeBinding(s,staff,notice);
 if(!notice.portrait)return {state:s,notice:{...notice,portraitRecordId:undefined}};
 const person=memorialDeceased(s,staff,notice.customerId!,notice.deceasedId!);
 const existing=person.portraits.find(r=>r.id===notice.portraitRecordId&&(r.original===notice.portrait||r.result===notice.portrait));
 if(existing)return {state:s,notice};
 if(!/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(notice.portrait)||notice.portrait.length>1000000)throw Error('请上传有效且已压缩的遗照');
 const record:PortraitRecord={id:uid(),original:notice.portrait,status:'原图',createdAt:new Date().toISOString()};
 return {state:replacePerson(s,notice.customerId!,{...person,portraits:[...person.portraits,record]}),notice:{...notice,portraitRecordId:record.id}};
}

// Registration order is preserved in deceased[]; its last entry is the latest registered subject.
export function selectNoticeCustomer(s:AppState,staff:Staff,notice:Notice,customerId:string):Notice{
 actor(s,staff,'content');if(notice.agencyId!==staff.agencyId)throw Error('无权修改其他代理的讣告');
 const cleared={...notice,customerId:customerId||undefined,deceasedId:undefined,name:'',age:'',portrait:undefined,portraitRecordId:undefined};
 if(!customerId)return cleared;
 const customer=memorialCustomer(s,staff,customerId);const recent=customer.deceased?.at(-1);
 return recent?bindNotice(s,staff,cleared,customerId,recent.id):cleared;
}
export function ensureNoticeSubject(s:AppState,staff:Staff,notice:Notice):{state:AppState;notice:Notice}{
 actor(s,staff,'content');if(notice.agencyId!==staff.agencyId)throw Error('无权修改其他代理的讣告');
 if(!notice.customerId)throw Error('请先选择关联客户');
 const customer=memorialCustomer(s,staff,notice.customerId);
 if(notice.deceasedId){memorialDeceased(s,staff,customer.id,notice.deceasedId);return {state:s,notice};}
 const id=uid();const next=saveDeceased(s,staff,customer.id,{id,name:notice.name,age:notice.age,relationship:''});
 return {state:next,notice:{...notice,deceasedId:id}};
}
