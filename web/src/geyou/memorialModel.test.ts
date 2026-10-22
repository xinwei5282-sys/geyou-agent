import test from 'node:test';
import assert from 'node:assert/strict';
import { seedState } from './model';
import { saveDeceased, addPortrait, addUnlinkedPortrait, visibleUnlinkedPortraits, linkUnlinkedPortrait, startUnlinkedPortraitRepair, setUnlinkedPortraitJob, finishUnlinkedPortraitRepair, failUnlinkedPortraitRepair, requestPortraitRepair, startPortraitRepair, setPortraitJob, finishPortraitRepair, failPortraitRepair, confirmPortrait, bindNotice, validateNoticeBinding, canAccessNotice, archiveNoticePortrait, selectNoticeCustomer, ensureNoticeSubject } from './memorialModel';
const image='data:image/png;base64,dGVzdA==';
const setup=()=>{const s=seedState();return {s,boss:s.staff[0]}};
const person={id:'d1',name:'逝者甲',age:'82',relationship:'父亲'};
const notice=()=>({...seedState().notices[0],status:'草稿' as const});
test('explicit deceased relation preserves legacy records and family identity',()=>{
 const {s,boss}=setup();const next=saveDeceased(s,boss,'c1',person);assert.equal(next.customers[0].name,s.customers[0].name);assert.equal(next.customers[0].deceased?.[0].name,'逝者甲');assert.deepEqual(next.notices,s.notices);assert.equal(s.customers[0].deceased,undefined);
 assert.throws(()=>saveDeceased(s,boss,'c6',person),/无权/);assert.throws(()=>saveDeceased(s,s.staff[1],'c2',person),/无权/);
});
test('portrait repair state follows actual callbacks and protects adopted history',()=>{
 let {s,boss}=setup();s=saveDeceased(s,boss,'c1',person);
 assert.throws(()=>addPortrait(s,boss,'c1','missing',image),/逝者/);assert.throws(()=>addPortrait(s,boss,'c6','d1',image),/无权/);
 s=addPortrait(s,boss,'c1','d1',image);const r=s.customers[0].deceased![0].portraits[0];assert.equal(r.status,'原图');
 assert.throws(()=>confirmPortrait(s,boss,'c1','d1',r.id,'result'),/结果/);
 const started=startPortraitRepair(s,boss,'c1','d1',r.id);s=started.state;assert.equal(s.customers[0].deceased![0].portraits[0].status,'处理中');s=setPortraitJob(s,boss,'c1','d1',started.recordId,'job-linked-1');assert.equal(s.customers[0].deceased![0].portraits[0].jobId,'job-linked-1');
 s=finishPortraitRepair(s,boss,'c1','d1',r.id,image,'v1');assert.equal(s.customers[0].deceased![0].portraits[0].status,'已完成');assert.equal(s.customers[0].deceased![0].portraits[0].promptVersion,'v1');
 s=confirmPortrait(s,boss,'c1','d1',r.id,'result');const adopted=s.customers[0].deceased![0].portraits[0];
 const retry=startPortraitRepair(s,boss,'c1','d1',r.id);assert.notEqual(retry.recordId,r.id);assert.equal(retry.state.customers[0].deceased![0].portraits[0].result,adopted.result);assert.equal(retry.state.customers[0].deceased![0].portraits[0].confirmedAt,adopted.confirmedAt);
 assert.equal(retry.state.customers[0].deceased![0].portraits[1].status,'处理中');
 const failed=failPortraitRepair(retry.state,boss,'c1','d1',retry.recordId);assert.equal(failed.customers[0].deceased![0].portraits[1].status,'失败');assert.equal(failed.customers[0].deceased![0].portraits[1].result,undefined);
 assert.throws(()=>finishPortraitRepair(failed,boss,'c1','d1',retry.recordId,image,'v1'),/已结束/);
 assert.throws(()=>startPortraitRepair({...s,staff:s.staff.map(x=>x.id===boss.id?{...x,enabled:false}:x)},boss,'c1','d1',r.id),/无权|权限/);
});
test('repair callbacks update only their pending record and never adopt automatically',()=>{
 let {s,boss}=setup();s=saveDeceased(s,boss,'c1',person);s=addPortrait(s,boss,'c1','d1',image);s=addPortrait(s,boss,'c1','d1','data:image/png;base64,b3RoZXI=');
 const [first,second]=s.customers[0].deceased![0].portraits;
 const started=startPortraitRepair(s,boss,'c1','d1',first.id);assert.throws(()=>confirmPortrait(started.state,boss,'c1','d1',first.id,'result'),/结果/);assert.equal(started.state.customers[0].deceased![0].selectedPortraitId,undefined);
 const finished=finishPortraitRepair(started.state,boss,'c1','d1',started.recordId,image,'prompt-v2');const records=finished.customers[0].deceased![0].portraits;
 assert.equal(records.find(r=>r.id===first.id)?.status,'已完成');assert.equal(records.find(r=>r.id===first.id)?.result,image);
 assert.equal(records.find(r=>r.id===second.id)?.original,second.original);assert.equal(records.find(r=>r.id===second.id)?.status,'原图');assert.equal(records.find(r=>r.id===second.id)?.result,undefined);
 assert.equal(records.find(r=>r.id===started.recordId)?.result,image);assert.equal(records.find(r=>r.id===started.recordId)?.status,'已完成');assert.equal(finished.customers[0].deceased![0].selectedPortraitId,undefined);
 const failed=failPortraitRepair(started.state,boss,'c1','d1',started.recordId);const failedRecord=failed.customers[0].deceased![0].portraits.find(r=>r.id===started.recordId)!;
 assert.equal(failedRecord.status,'失败');assert.equal(failedRecord.original,first.original);assert.equal(failedRecord.result,undefined);
});
test('unlinked photos persist, repair directly, stay scoped, and bind with the complete repair record',()=>{
 let {s,boss}=setup();s=saveDeceased(s,boss,'c1',person);const saved=addUnlinkedPortrait(s,boss,image);const record=saved.unlinkedPortraits![0];assert.equal(record.status,'原图');
 assert.equal(visibleUnlinkedPortraits(saved,s.staff[1]).some(r=>r.id===record.id),false);
 let next=startUnlinkedPortraitRepair(saved,boss,record.id);assert.equal(next.unlinkedPortraits![0].status,'处理中');next=setUnlinkedPortraitJob(next,boss,record.id,'job-unlinked-1');assert.equal(next.unlinkedPortraits![0].jobId,'job-unlinked-1');
 assert.throws(()=>linkUnlinkedPortrait(next,boss,record.id,'c1','d1'),/修复完成或取消/);
 next=finishUnlinkedPortraitRepair(next,boss,record.id,image,'portrait-v3');assert.equal(next.unlinkedPortraits![0].promptVersion,'portrait-v3');
 const linked=linkUnlinkedPortrait(next,boss,record.id,'c1','d1');const portrait=linked.customers[0].deceased![0].portraits[0];
 assert.equal(portrait.status,'已完成');assert.equal(portrait.result,image);assert.equal(portrait.promptVersion,'portrait-v3');assert.equal(linked.unlinkedPortraits!.length,0);
 assert.throws(()=>linkUnlinkedPortrait(next,s.staff[1],record.id,'c1','d1'),/不存在|无权/);
 const failed=failUnlinkedPortraitRepair(startUnlinkedPortraitRepair(saved,boss,record.id),boss,record.id,'服务暂不可用');assert.equal(failed.unlinkedPortraits![0].status,'失败');assert.equal(failed.unlinkedPortraits![0].errorMessage,'服务暂不可用');
});
test('confirmed portrait is copied as independent notice snapshot',()=>{
 let {s,boss}=setup();s=saveDeceased(s,boss,'c1',person);s=addPortrait(s,boss,'c1','d1',image);
 let draft=bindNotice(s,boss,notice(),'c1','d1');assert.equal(draft.portrait,undefined);
 const r=s.customers[0].deceased![0].portraits[0];s=confirmPortrait(s,boss,'c1','d1',r.id,'original');draft=bindNotice(s,boss,draft,'c1','d1');assert.equal(draft.portrait,image);assert.equal(draft.name,person.name);assert.equal(draft.portraitRecordId,r.id);
 s={...s,notices:[{...draft,status:'已发布'}]};s=addPortrait(s,boss,'c1','d1',image+'other');const latest=s.customers[0].deceased![0].portraits.at(-1)!;s=confirmPortrait(s,boss,'c1','d1',latest.id,'original');assert.equal(s.notices[0].portrait,image);
 s=saveDeceased(s,boss,'c1',{...person,name:'更新姓名'});assert.equal(s.customers[0].deceased![0].portraits.length,2);assert.equal(s.notices[0].name,person.name);
});
test('rebinding clears old photo and enforces access',()=>{
 let {s,boss}=setup();s=saveDeceased(s,boss,'c1',person);s=saveDeceased(s,boss,'c2',{...person,id:'d2',name:'逝者乙'});
 const rebound=bindNotice(s,boss,{...notice(),portrait:image,portraitRecordId:'old'},'c2','d2');assert.equal(rebound.portrait,undefined);assert.equal(rebound.portraitRecordId,undefined);
 assert.throws(()=>validateNoticeBinding(s,boss,notice()),/关联/);assert.throws(()=>validateNoticeBinding(s,boss,{...rebound,deceasedId:'d1'}),/逝者/);
 assert.equal(canAccessNotice(s,s.staff[1],rebound),false);assert.equal(canAccessNotice(s,boss,notice()),true);
 assert.throws(()=>addPortrait({...s,staff:s.staff.map(x=>x.id===boss.id?{...x,enabled:false}:x)},boss,'c1','d1',image),/无权|权限/);
});

test('notice upload is filed under its deceased without altering archive selection or duplicating saves',()=>{
 let {s,boss}=setup();s=saveDeceased(s,boss,'c1',person);
 const draft={...bindNotice(s,boss,notice(),'c1','d1'),portrait:image};
 const first=archiveNoticePortrait(s,boss,draft);assert.equal(first.state.customers[0].deceased![0].portraits.length,1);assert.ok(first.notice.portraitRecordId);assert.equal(first.state.customers[0].deceased![0].selectedPortraitId,undefined);
 const again=archiveNoticePortrait(first.state,boss,first.notice);assert.equal(again.state.customers[0].deceased![0].portraits.length,1);
 assert.throws(()=>archiveNoticePortrait(first.state,first.state.staff[2],first.notice),/无权/);
 const restricted={...first.state,staff:first.state.staff.map(st=>st.id===boss.id?{...st,role:'业务员' as const,modules:['customers','content'] as ('customers'|'content')[]}:st),customers:first.state.customers.map(c=>c.id==='c1'?{...c,ownerId:boss.id}:c)};
 assert.doesNotThrow(()=>archiveNoticePortrait(restricted,boss,first.notice));assert.throws(()=>requestPortraitRepair(restricted,boss,'c1','d1',first.notice.portraitRecordId!),/无权/);
});

test('notice customer selection brings latest registered subject and keeps subjects scoped',()=>{let {s,boss}=setup();s=saveDeceased(s,boss,'c1',person);s=saveDeceased(s,boss,'c1',{id:'d2',name:'最近逝者',age:'88',relationship:'母亲'});const draft=selectNoticeCustomer(s,boss,notice(),'c1');assert.equal(draft.deceasedId,'d2');assert.equal(draft.name,'最近逝者');assert.equal(draft.age,'88');assert.throws(()=>selectNoticeCustomer(s,boss,notice(),'c6'),/无权/);const manual=selectNoticeCustomer(s,boss,draft,'c2');assert.equal(manual.deceasedId,undefined);assert.equal(manual.name,'');assert.equal(manual.portrait,undefined);});
test('manual notice subject is created once on save under selected customer',()=>{const {s,boss}=setup();assert.throws(()=>ensureNoticeSubject(s,boss,{...notice(),customerId:undefined,deceasedId:undefined}),/选择/);const manual={...notice(),customerId:'c1',deceasedId:undefined,name:'手动填写',age:'80'};const saved=ensureNoticeSubject(s,boss,manual);assert.equal(saved.state.customers[0].deceased?.at(-1)?.name,'手动填写');assert.ok(saved.notice.deceasedId);assert.equal(s.customers[0].deceased,undefined);assert.equal(ensureNoticeSubject(saved.state,boss,saved.notice).state,saved.state);});

test('换装重新生成保存新款式并保留旧确认结果',()=>{
 let {s,boss}=setup();s=saveDeceased(s,boss,'c1',person);s=addPortrait(s,boss,'c1','d1',image);const rid=s.customers[0].deceased![0].portraits[0].id;
 const first=startPortraitRepair(s,boss,'c1','d1',rid,'tang');s=finishPortraitRepair(first.state,boss,'c1','d1',rid,image,'v-tang');s=confirmPortrait(s,boss,'c1','d1',rid,'result');
 const old=structuredClone(s.customers[0].deceased![0].portraits[0]);const retry=startPortraitRepair(s,boss,'c1','d1',rid,'suit');const d=retry.state.customers[0].deceased![0];
 assert.deepEqual(d.portraits[0],old);assert.equal(d.portraits[1].clothing,'suit');assert.equal(d.portraits[1].result,undefined);assert.equal(d.selectedPortraitId,rid);
});
test('未关联照片重新换装也保留此前结果，仍可稍后关联',async()=>{
 const {startUnlinkedPortraitGeneration}=await import('./memorialModel');let {s,boss}=setup();s=addUnlinkedPortrait(s,boss,image);const oldId=s.unlinkedPortraits![0].id;
 s=startUnlinkedPortraitRepair(s,boss,oldId,'tang');s=finishUnlinkedPortraitRepair(s,boss,oldId,image,'v-tang');const old=structuredClone(s.unlinkedPortraits![0]);
 const next=startUnlinkedPortraitGeneration(s,boss,oldId,'suit');assert.notEqual(next.recordId,oldId);assert.deepEqual(next.state.unlinkedPortraits![0],old);assert.equal(next.state.unlinkedPortraits![1].clothing,'suit');assert.equal(next.state.unlinkedPortraits![1].result,undefined);
});
