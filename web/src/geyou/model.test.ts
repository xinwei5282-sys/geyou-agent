import {setServiceDeal,setCustomerDeal,updateServiceInfo,saveServiceTask,setServiceTaskStatus,serviceAgenda,serviceTaskTiming,localDate,serviceRecordFor} from './model';
import { saveStaffAccount, setStaffEnabled, hasStaffModule } from './model';
import { adoptMasterProduct, saveMasterProduct, setMasterStatus, isProductAvailable, migrateState, MODULES, saveAgencyAccess, hasModule } from './model';
import test from 'node:test';
import assert from 'node:assert/strict';
import { seedState, visibleCustomers, calculateTotal, generateDraft, finalizeQuote, metrics, recomputeProposalWarnings, normalizePhone, validateCustomerInput } from './model.ts';
import { withConsultationDemo, CONSULTATION_DEMO_CASES } from './consultationDemo';
import { NEED_OPTIONS } from './packageModel';

test('prototype fixtures populate every category and six actionable consultation cases',()=>{
 const s=withConsultationDemo(seedState());
 for(const n of NEED_OPTIONS)assert.ok(s.products.filter(p=>p.agencyId==='agency-a'&&n.categories.includes(p.category)&&isProductAvailable(s,p)).length>=2,n.label);
 assert.equal(s.products.filter(p=>p.category==='寿衣'&&p.agencyId==='agency-a'&&isProductAvailable(s,p)).length,3);
 for(const c of CONSULTATION_DEMO_CASES)assert.ok(s.consultations?.some(x=>x.id===c.sessionId));
 const get=(id:string)=>s.consultations!.find(x=>x.id===`demo-talk-${id}`)!;
 assert.equal(get('advance').guided!.plan!.phase,'process');assert.equal(get('advance').deceasedId,undefined);
 assert.equal(get('closed').guided!.plan!.continuation,'none');assert.equal(get('closed').guided!.plan!.outcome,'confirmed');
 assert.equal(get('return').guided!.plan!.needs.clothes,'prepared');assert.ok(get('return').guided!.plan!.packages.every(p=>p.lines.every(l=>s.products.find(x=>x.id===l.productId)?.category!=='寿衣')));
 assert.equal(get('home').guided!.plan!.packages.length,3);assert.equal(get('home').guided!.plan!.missingNeeds!.length,0);
 assert.equal(get('paused').guided!.plan!.selectedLines!.length,2);assert.ok(s.customers.find(c=>c.id==='demo-customer-return')?.service?.tasks.length);
});
test('prototype migration preserves user data and confirmed snapshots, then never recreates removed examples',()=>{
 const s=seedState();s.products[1].price=123400;s.products[1].name='本店自定义寿衣';s.products[1].enabled=false;
 const before=JSON.stringify(s);const next=withConsultationDemo(s);assert.equal(JSON.stringify(s),before);
 assert.deepEqual(next.products.find(p=>p.id==='p2'),s.products[1]);assert.deepEqual(next.quotes,s.quotes);assert.deepEqual(next.customers.find(c=>c.id==='c1'),s.customers[0]);
 assert.equal(withConsultationDemo(next),next);
 next.products=next.products.filter(p=>p.id!=='demo-product-clothes-basic');const result=withConsultationDemo(JSON.parse(JSON.stringify(next)));assert.equal(result.products.some(p=>p.id==='demo-product-clothes-basic'),false);
});
test('prototype fixtures do not reset existing example edits or bypass unavailable account modules',()=>{
 const s=withConsultationDemo(seedState());delete s.consultationDemoVersion;
 s.consultations!.find(c=>c.id==='demo-talk-closed')!.guided!.notes='用户补充';s.customers.find(c=>c.id==='demo-customer-return')!.service!.tasks=[];
 const snapshot=JSON.stringify(s);const next=withConsultationDemo(s);assert.equal(JSON.stringify(s),snapshot);assert.deepEqual(next.consultations,s.consultations);assert.deepEqual(next.customers,s.customers);
 const restricted=seedState();restricted.agencies[0].access!.enabled=false;assert.equal(withConsultationDemo(restricted),restricted);
});

test('recomputes required item warnings after a proposal line is removed',()=>{
 const s=seedState(); const staff=s.staff.find(x=>x.id==='staff-lin')!; const p=generateDraft(s,s.customers[0],staff,'');
 const removed={...p,lines:p.lines.filter(l=>l.name!=='素雅实木骨灰盒')};
 assert.ok(recomputeProposalWarnings(s,removed).some(w=>w.includes('骨灰盒')));
});
test('normalizes phone whitespace for save and duplicate comparison',()=>{
 assert.equal(normalizePhone(' 138 5555 0001 '),'13855550001');
 assert.equal(validateCustomerInput({name:'新客户',phone:' 138 5555 0001 ',region:'浙江',source:'电话咨询'}).phone,'13855550001');
});
test('requires customer region and source',()=>{assert.throws(()=>validateCustomerInput({name:'新客户',phone:'13855550001',region:'',source:''}),/地区/);});

test('staff visibility keeps agencies and customer ownership separate',()=>{
 const s=seedState();
 assert.deepEqual(visibleCustomers(s,s.staff.find(x=>x.id==='staff-lin')!).map(x=>x.id).sort(),['c1','c3','c5']);
 assert.equal(visibleCustomers(s,s.staff.find(x=>x.id==='boss-b')!).length,1);
});
test('calculates cents exactly and rejects invalid quantities and prices',()=>{
 assert.equal(calculateTotal([{productId:'x',name:'x',unit:'件',kind:'商品',price:1299,quantity:3}]),3897);
 assert.throws(()=>calculateTotal([{productId:'x',name:'x',unit:'件',kind:'商品',price:-1,quantity:1}]));
 assert.throws(()=>calculateTotal([{productId:'x',name:'x',unit:'件',kind:'商品',price:10,quantity:0}]));
});
test('draft only uses enabled current agency products and flags uncovered regions',()=>{
 const s=seedState(); const c={...s.customers[0],region:'未覆盖地区'};
 const p=generateDraft(s,c,s.staff.find(x=>x.id==='staff-lin')!,'简约');
 assert.ok(p.lines.every(l=>s.products.some(x=>x.id===l.productId&&x.agencyId===c.agencyId&&x.enabled)));
 assert.ok(p.warnings.some(x=>x.includes('未预置')));
});
test('unconfirmed, unauthorized or empty proposals cannot become final quotes',()=>{
 const s=seedState();const staff=s.staff.find(x=>x.id==='staff-lin')!;
 const p=generateDraft(s,s.customers[0],staff,'');s.proposals.push(p);
 assert.throws(()=>finalizeQuote(s,p.id,staff,false),/确认/);
 assert.throws(()=>finalizeQuote(s,p.id,s.staff.find(x=>x.id==='boss-b')!,true),/权限/);
 p.lines=[];assert.throws(()=>finalizeQuote(s,p.id,staff,true),/项目/);
});
test('quote snapshots survive price changes and repeated confirmation is idempotent',()=>{
 const s=seedState();const staff=s.staff.find(x=>x.id==='staff-lin')!;
 const p=generateDraft(s,s.customers[0],staff,'');s.proposals.push(p);
 const first=finalizeQuote(s,p.id,staff,true); const total=first.quote.total;
 first.state.products[0].price=99999999;
 assert.equal(first.quote.total,total);
 assert.notEqual(first.quote.lines[0].price,first.state.products[0].price);
 const twice=finalizeQuote(first.state,p.id,staff,true);
 assert.equal(twice.state.quotes.length,first.state.quotes.length);
 assert.equal(twice.quote.id,first.quote.id);
 assert.deepEqual(first.state.customers,s.customers);
});
test('editing a confirmed draft creates a new version without overwriting the old snapshot',()=>{
 const s=seedState();const staff=s.staff.find(x=>x.id==='staff-lin')!;
 const p=generateDraft(s,s.customers[0],staff,'');s.proposals.push(p);
 const first=finalizeQuote(s,p.id,staff,true);
 const edited={...first.state,proposals:first.state.proposals.map(x=>x.id===p.id?{...x,status:'待客户确认' as const,lines:x.lines.map((l,i)=>i===0?{...l,quantity:2}:l)}:x)};
 const next=finalizeQuote(edited,p.id,staff,true);
 assert.equal(next.quote.version,2);assert.equal(first.quote.lines[0].quantity,1);
 assert.equal(next.quote.number,first.quote.number);
});
test('metrics count real local records and filter agencies',()=>{
 const s=seedState(); const a=metrics(s,'agency-a','all'); const b=metrics(s,'agency-b','all');
 assert.equal(a.customers,8);assert.equal(b.customers,1);
 assert.equal(a.deals,1);assert.equal(b.deals,0);
 assert.equal(a.quoteCustomers,1);
 assert.ok(!('revenue' in a));
});

test('platform products are published, adopted once and isolated per agency',()=>{
 let s=seedState();const staff=s.staff.find(s=>s.id==='staff-lin')!;
 s=adoptMasterProduct(s,'master-clothes-basic',staff);
 assert.equal(s.products.filter(p=>p.masterId==='master-clothes-basic').length,1);
 assert.throws(()=>adoptMasterProduct(s,'master-clothes-basic',staff),/已选用/);
 assert.throws(()=>adoptMasterProduct(s,'master-urn-carved',staff),/未发布/);
 assert.throws(()=>adoptMasterProduct(s,'master-clothes-basic',s.staff.find(s=>s.id==='staff-zhou')!),/权限/);
 assert.equal(s.products.find(p=>p.masterId==='master-clothes-basic')?.agencyId,staff.agencyId);
});
test('master edits preserve store prices and quote snapshots; withdrawal blocks new proposals',()=>{
 let s=seedState();const oldQuote=structuredClone(s.quotes[0]);const oldPrice=s.products[0].price;
 const m={...s.masterProducts[0],name:'新商品名称',price:200000,image:'data:image/png;base64,aA=='};
 s=saveMasterProduct(s,m,true);
 assert.equal(s.products[0].name,'新商品名称');assert.equal(s.products[0].price,oldPrice);assert.deepEqual(s.quotes[0],oldQuote);
 s=setMasterStatus(s,m.id,'已下架');assert.equal(isProductAvailable(s,s.products[0]),false);
 const p=generateDraft(s,s.customers[0],s.staff[0],'简约');assert.ok(!p.lines.some(l=>l.productId==='p1'));
 assert.throws(()=>adoptMasterProduct(s,m.id,s.staff[0]),/下架/);
});
test('master validation rejects duplicate codes and incomplete publish but permits draft',()=>{
 const s=seedState();const m={...s.masterProducts[0],id:'new-master',sku:'NEW-01',image:undefined};
 assert.throws(()=>saveMasterProduct(s,m,true),/补齐/);
 assert.equal(saveMasterProduct(s,m,false).masterProducts[0].status,'草稿');
 assert.throws(()=>saveMasterProduct(s,{...m,sku:s.masterProducts[0].sku},false),/编码已存在/);
});
test('old local states migrate without losing quotes or custom adopted products',()=>{
 const s=seedState();delete (s as any).masterProducts;const migrated=migrateState(s);assert.ok(migrated.masterProducts.length);assert.deepEqual(migrated.quotes,s.quotes);
});
test('platform opens agency boss accounts with feature dependencies and unique login',()=>{
 const s=seedState();const input={name:'新代理',contact:'测试店长',phone:'13900009999',region:'浙江 · 杭州 · 萧山',enabled:true,modules:MODULES.map(m=>m.key)};
 const next=saveAgencyAccess(s,input);const a=next.agencies.at(-1)!;assert.equal(next.staff.at(-1)?.agencyId,a.id);assert.equal(next.staff.at(-1)?.role,'老板');assert.ok(hasModule(next,a.id,'talk'));
 assert.throws(()=>saveAgencyAccess(next,input),/已开通/);
 assert.throws(()=>saveAgencyAccess(s,{...input,modules:['talk']}),/同时开通/);
});
test('platform permissions and disabled accounts block new quote and catalog operations',()=>{
 let s=seedState();Object.assign(s.agencies[0],{name:'测试企业',phone:'13900009999'});const a=s.agencies[0];s=saveAgencyAccess(s,{...a,enabled:false,modules:MODULES.map(m=>m.key)});
 assert.equal(hasModule(s,a.id,'talk'),false);assert.throws(()=>generateDraft(s,s.customers[0],s.staff[0],''),/未开通/);assert.throws(()=>adoptMasterProduct(s,'master-clothes-basic',s.staff[0]),/未开通/);
 assert.throws(()=>finalizeQuote(s,'proposal-sample',s.staff[0],true),/未开通/);
 s=saveAgencyAccess(s,{...a,phone:'13912345678',enabled:true,modules:['customers']});assert.equal(s.agencies[0].phone,a.phone);assert.equal(s.agencies[0].access?.loginPhone,'13912345678');assert.equal(hasModule(s,a.id,'catalog'),false);
});

test('boss creates scoped subaccounts with unique phones and bounded modules',()=>{
 let s=seedState();const boss=s.staff[0];const input={name:'新成员',phone:'13988880001',enabled:true,modules:['customers','catalog','talk'] as const,canManageProducts:false};
 s=saveStaffAccount(s,boss,{...input,modules:[...input.modules]});const member=s.staff.at(-1)!;assert.equal(member.role,'业务员');assert.equal(member.agencyId,boss.agencyId);assert.equal(visibleCustomers(s,member).length,0);assert.ok(hasStaffModule(s,member,'talk'));assert.equal(hasStaffModule(s,member,'dashboard'),false);
 assert.throws(()=>saveStaffAccount(s,boss,{...input,modules:[...input.modules]}),/手机号/);
 assert.throws(()=>saveStaffAccount(s,member,{...input,phone:'13988880002',modules:[...input.modules]}),/老板/);
 assert.throws(()=>saveStaffAccount(s,boss,{...input,id:s.staff.find(st=>st.agencyId!==boss.agencyId)!.id,modules:[...input.modules]}),/本店/);
 assert.throws(()=>saveStaffAccount(s,boss,{...input,phone:'13988880002',modules:['dashboard']}),/只能授权/);
});
test('disabled subaccount cannot use old session privileges; records are preserved',()=>{
 const s=seedState(),member=s.staff.find(st=>st.id==='staff-lin')!;const next=setStaffEnabled(s,s.staff[0],member.id,false);
 assert.deepEqual(next.customers,s.customers);assert.equal(hasStaffModule(next,member,'talk'),false);assert.equal(visibleCustomers(next,member).length,0);assert.throws(()=>generateDraft(next,s.customers[0],member,''),/未开通/);assert.throws(()=>adoptMasterProduct(next,'master-clothes-basic',member),/未开通/);
 const active=setStaffEnabled(next,next.staff[0],member.id,true);assert.ok(hasStaffModule(active,member,'talk'));assert.throws(()=>setStaffEnabled(s,s.staff[0],s.staff[0].id,false),/业务员/);
});
test('platform permissions bound subaccount grants and can revoke effective access',()=>{
 let s=seedState();const boss=s.staff[0];s=saveAgencyAccess(s,{...s.agencies[0],name:'测试企业',phone:'13900009999',enabled:true,modules:['customers']});
 assert.throws(()=>saveStaffAccount(s,boss,{name:'成员',phone:'13988880003',enabled:true,modules:['restoration'],canManageProducts:false}),/已为本店开通/);
 assert.equal(hasStaffModule(s,s.staff[1],'catalog'),false);
});

test('service lifecycle continues beyond burial independently from sale state',()=>{
 let s=seedState();s.customers[0].stage='已成交';const c=s.customers[0],staff=s.staff[0];s=updateServiceInfo(s,c.id,staff,{phase:'后续关怀',transitionReason:'补录既有服务阶段',dates:{burial:'2026-09-28'}});assert.equal(s.customers[0].stage,c.stage);assert.equal(s.customers[0].service?.phase,'后续关怀');
 s=saveServiceTask(s,c.id,staff,{title:'周年纪念',date:'2027-09-28',items:'核对家属意愿和时间',message:'请与我们确认纪念安排。'});assert.equal(s.customers[0].service?.tasks[0].status,'待确认');assert.throws(()=>updateServiceInfo(s,c.id,staff,{phase:'服务结束'}),/未完成/);
});
test('arrangements require confirmation and edits revoke previous confirmation',()=>{
 let s=seedState(),staff=s.staff[0];s=saveServiceTask(s,'c1',staff,{title:'回访',date:localDate(),items:'关怀回访',message:'您好，方便时与我们联系。'});let t=s.customers[0].service!.tasks[0];
 assert.throws(()=>setServiceTaskStatus(s,'c1',t.id,staff,'已发送'),/先确认/);s=setServiceTaskStatus(s,'c1',t.id,staff,'待发送');s=setServiceTaskStatus(s,'c1',t.id,staff,'已发送');assert.ok(s.customers[0].service!.tasks[0].sentAt);
 s=saveServiceTask(s,'c1',staff,{...t,message:'调整后的消息'});t=s.customers[0].service!.tasks[0];assert.equal(t.status,'待确认');assert.equal(t.sentAt,undefined);
 s=setServiceTaskStatus(s,'c1',t.id,staff,'已取消');s.customers[0].stage='已成交';s=updateServiceInfo(s,'c1',staff,{phase:'服务结束',transitionReason:'历史事项已全部结束'});assert.equal(s.customers[0].service?.phase,'服务结束');
});
test('service reminders classify dates and enforce owner/agency permissions',()=>{
 let s=seedState(),staff=s.staff[0];s=saveServiceTask(s,'c1',staff,{title:'回访',date:localDate(),items:'待核对',message:'您好'});const task=s.customers[0].service!.tasks[0];assert.equal(serviceTaskTiming(task),'今日到期');assert.equal(serviceTaskTiming({...task,date:'2000-01-01'}),'已逾期');assert.equal(serviceTaskTiming({...task,status:'已取消'}),'已结束');
 assert.equal(serviceAgenda(s,s.staff.find(st=>st.id==='staff-zhou')!).length,0);assert.throws(()=>saveServiceTask(s,'c1',s.staff.find(st=>st.id==='boss-b')!,{...task}),/无权限/);assert.throws(()=>saveServiceTask(s,'c1',staff,{...task,date:'2026-02-30'}),/有效日期/);
});

test('service task fields persist and generated internal tasks cannot be made public',()=>{
 let s=seedState(),staff=s.staff[0];
 s={...s,customers:s.customers.map(c=>c.id==='c1'?{...c,stage:'已成交' as const,deceased:[{id:'d1',name:'测试逝者',age:'80',relationship:'父亲',portraits:[],service:{phase:'接洽登记',dates:{},tasks:[],dealStage:'已成交'}}]}:c)};
 s=updateServiceInfo(s,'c1',staff,{phase:'治丧筹备'},'d1');
 const generated=s.customers[0].deceased![0].service!.tasks.find(t=>t.autoKey==='draft-notice');
 assert.ok(generated);assert.equal(generated.internal,true);
 s=saveServiceTask(s,'c1',staff,{...generated!,internal:false},'d1');
 assert.equal(serviceRecordFor(s.customers[0],'d1').tasks.find(t=>t.id===generated!.id)!.internal,true);
 assert.throws(()=>setServiceTaskStatus(s,'c1',generated!.id,staff,'已完成','d1'),/对应操作/);
 s=saveServiceTask(s,'c1',staff,{title:'内部核对',date:'2026-10-02',items:'核对资料',message:'仅供业务员处理',internal:true},'d1');
 let manual=serviceRecordFor(s.customers[0],'d1').tasks.at(-1)!;
 assert.equal(manual.internal,true);assert.equal(manual.status,'待确认');
 s=setServiceTaskStatus(s,'c1',manual.id,staff,'已完成','d1');
 assert.equal(serviceRecordFor(s.customers[0],'d1').tasks.find(t=>t.id===manual.id)!.status,'已完成');
 s=JSON.parse(JSON.stringify(s));
 assert.equal(serviceRecordFor(s.customers[0],'d1').tasks.find((t:any)=>t.id===manual.id).internal,true);
});

test('demo followups migrate once without overwriting existing records and cover timing states',()=>{const s=seedState();const legacy={...s,demoFollowupsVersion:undefined,customers:s.customers.filter(c=>!c.id.startsWith('demo-c-'))};legacy.customers[0]={...legacy.customers[0],note:'已编辑客户资料'};const next=migrateState(legacy);assert.equal(next.customers[0].note,'已编辑客户资料');assert.equal(next.customers.filter(c=>c.id.startsWith('demo-c-')).length,3);assert.deepEqual(migrateState(next),next);const timing=new Set(serviceAgenda(next,next.staff[0]).map(({task})=>serviceTaskTiming(task)));assert(timing.has('今日到期'));assert(timing.has('已逾期'));assert(timing.has('待办'));assert(timing.has('已结束'));});

test('retired sample agency details are cleared from existing browser records without erasing real edits',()=>{const s=seedState();s.agencies[0].name='杭州安礼生命礼仪';s.agencies[0].phone='13800000001';s.agencies[0].access!.loginPhone='13800000001';s.quotes[0].agencyName=s.agencies[0].name;s.quotes[0].phone=s.agencies[0].phone;const m=migrateState(s);assert.equal(m.agencies[0].name,'');assert.equal(m.agencies[0].phone,'');assert.equal(m.agencies[0].access!.loginPhone,'');assert.equal(m.quotes[0].agencyName,'');assert.equal(m.quotes[0].phone,'');m.agencies[0].name='用户填写的企业';m.agencies[0].phone='13911112222';const preserved=migrateState(m);assert.equal(preserved.agencies[0].name,'用户填写的企业');assert.equal(preserved.agencies[0].phone,'13911112222');assert.deepEqual(preserved.customers,m.customers);});

test('service deals belong to one deceased and phase selector cannot bypass confirmation',()=>{
 let s=seedState();const staff=s.staff[0];s.customers[0].stage='已成交';s.customers[0].deceased=[{id:'d1',name:'甲',age:'80',relationship:'父亲',portraits:[]},{id:'d2',name:'乙',age:'80',relationship:'母亲',portraits:[]}];
 for(const phase of ['治丧筹备','告别仪式','安葬安置','服务结束'] as const)assert.throws(()=>updateServiceInfo(s,'c1',staff,{phase},'d1'),/本次服务.*成交/);
 s=setServiceDeal(s,'c1','d1',staff,'已成交');
 s=updateServiceInfo(s,'c1',staff,{phase:'治丧筹备'},'d1');assert.equal(s.customers[0].deceased![0].service!.tasks.length,3);
 assert.throws(()=>updateServiceInfo(s,'c1',staff,{phase:'治丧筹备'},'d2'),/本次服务.*成交/);
 assert.throws(()=>updateServiceInfo(s,'c1',staff,{phase:'安葬安置'},'d1'),/原因/);
 assert.throws(()=>setServiceDeal(s,'c1','d1',staff,'未成交'),/接洽登记/);
 s=updateServiceInfo(s,'c1',staff,{phase:'接洽登记',transitionReason:'家属暂缓服务'},'d1');
 s=setServiceDeal(s,'c1','d1',staff,'未成交');assert.equal(s.customers[0].deceased![0].service!.dealStage,'未成交');
});
test('customer deal status is manually auditable, permission scoped, and cannot be downgraded after preparation',()=>{
 let s=seedState();const staff=s.staff.find(x=>x.id==='staff-lin')!,other=s.staff.find(x=>x.id==='staff-zhou')!;
 const before=s.customers.find(c=>c.id==='c1')!;
 s=setCustomerDeal(s,'c1',staff,'已成交');let customer=s.customers.find(c=>c.id==='c1')!;
 assert.equal(customer.stage,'已成交');assert.equal(customer.dealtBy,staff.id);assert.ok(customer.dealtAt);assert.equal(customer.followups.length,before.followups.length+1);assert.match(customer.followups.at(-1)!.text,/已成交/);
 const unchanged=setCustomerDeal(s,'c1',staff,'已成交');assert.equal(unchanged,s);
 assert.throws(()=>setCustomerDeal(s,'c1',other,'未成交'),/无权限/);
 s=updateServiceInfo(s,'c1',staff,{phase:'治丧筹备'});
 assert.throws(()=>setCustomerDeal(s,'c1',staff,'未成交'),/退回接洽登记/);
 assert.equal(s.customers.find(c=>c.id==='c1')!.stage,'已成交');
});
test('customer deal helper refuses customers with deceased records to preserve per-service isolation',()=>{
 const s=seedState(),customer=s.customers.find(c=>c.id==='c1')!,staff=s.staff[0];
 s.customers[0]={...customer,deceased:[{id:'d1',name:'甲',age:'80',relationship:'父亲',portraits:[]}]};
 assert.throws(()=>setCustomerDeal(s,'c1',staff,'已成交'),/分别更新/);
 assert.equal(s.customers[0].deceased![0].service,undefined);
});
test('content and restoration permissions require customer access for both agency and member',()=>{
 const s=seedState();
 assert.throws(()=>saveStaffAccount(s,s.staff[0],{name:'图片人员',phone:'13912345678',enabled:true,modules:['restoration'],canManageProducts:false}),/客户管理/);
 assert.throws(()=>saveAgencyAccess(s,{name:'测试',contact:'甲',phone:'13912345678',region:'杭州',enabled:true,modules:['content']}),/客户管理/);
});
test('quote preserves service identity and rejects foreign deceased',()=>{
 let s=seedState();const staff=s.staff[0];s.customers[0].deceased=[{id:'d1',name:'甲',age:'80',relationship:'父亲',portraits:[]}];
 const p=generateDraft(s,s.customers[0],staff,'简约','d1');s.proposals.push(p);
 const {quote}=finalizeQuote(s,p.id,staff,true);assert.equal(quote.serviceId,'c1:d1');assert.equal(quote.deceasedId,'d1');
 assert.throws(()=>generateDraft(s,s.customers[0],staff,'简约','other'),/逝者/);
});

test('confirmed quote preserves deal state and service tasks until manual confirmation',()=>{
 let s=seedState();const staff=s.staff.find(x=>x.id==='staff-lin')!;
 s.customers[0].deceased=[{id:'d1',name:'甲',age:'80',relationship:'父亲',portraits:[]},{id:'d2',name:'乙',age:'80',relationship:'母亲',portraits:[]}];
 const p=generateDraft(s,s.customers[0],staff,'简约','d1');s.proposals.push(p);
 const result=finalizeQuote(s,p.id,staff,true),customer=result.state.customers.find(x=>x.id==='c1')!;
 const linked=serviceRecordFor(customer,'d1');
 assert.equal(linked.dealStage,undefined);assert.equal(linked.phase,'接洽登记');assert.equal(linked.tasks.length,0);assert.deepEqual(customer,s.customers[0]);
 assert.equal(serviceRecordFor(customer,'d2').dealStage,undefined);assert.equal(serviceRecordFor(customer,'d2').phase,'接洽登记');
 assert.equal(result.quote.receipt,undefined);assert.equal(customer.stage,'跟进中');
});

test('confirmed quote does not regress advanced linked service or alter an unrelated deceased',()=>{
 let s=seedState();const staff=s.staff.find(x=>x.id==='staff-lin')!;
 s.customers[0].deceased=[
  {id:'d1',name:'甲',age:'80',relationship:'父亲',portraits:[],service:{phase:'后续关怀',dates:{},tasks:[],dealStage:'跟进中'}},
  {id:'d2',name:'乙',age:'80',relationship:'母亲',portraits:[],service:{phase:'接洽登记',dates:{},tasks:[],dealStage:'跟进中'}}
 ];
 const p=generateDraft(s,s.customers[0],staff,'简约','d1');s.proposals.push(p);
 const result=finalizeQuote(s,p.id,staff,true),customer=result.state.customers.find(x=>x.id==='c1')!;
 assert.equal(serviceRecordFor(customer,'d1').dealStage,'跟进中');assert.equal(serviceRecordFor(customer,'d1').phase,'后续关怀');
 assert.equal(serviceRecordFor(customer,'d2').dealStage,'跟进中');assert.equal(serviceRecordFor(customer,'d2').phase,'接洽登记');
});

test('unlinked confirmed quote does not imply a completed sale',()=>{
 let s=seedState();const staff=s.staff.find(x=>x.id==='staff-lin')!;s.customers[0].deceased=[{id:'d1',name:'甲',age:'80',relationship:'父亲',portraits:[]}];
 const p=generateDraft(s,s.customers[0],staff,'简约');s.proposals.push(p);
 const result=finalizeQuote(s,p.id,staff,true),customer=result.state.customers.find(x=>x.id==='c1')!;
 assert.equal(customer.stage,'跟进中');assert.equal(serviceRecordFor(customer,'d1').dealStage,undefined);assert.equal(serviceRecordFor(customer,'d1').phase,'接洽登记');
});


test('proposal warnings clear on repair and recompute budget, unknown region and legacy draft at finalization',()=>{
 const s=seedState(),staff=s.staff.find(x=>x.id==='staff-lin')!,p=generateDraft(s,s.customers[0],staff,'');
 const missing={...p,lines:p.lines.filter(l=>s.products.find(x=>x.id===l.productId)?.category!=='骨灰盒')};
 assert.ok(recomputeProposalWarnings(s,missing).some(w=>w.includes('骨灰盒')));
 assert.ok(!recomputeProposalWarnings(s,p).some(w=>w.includes('骨灰盒')));
 assert.ok(recomputeProposalWarnings(s,{...p,budget:1}).some(w=>w.includes('超预算')));
 assert.ok(recomputeProposalWarnings(s,{...p,region:'未预置地区'}).some(w=>w.includes('未预置')));
 const legacy={...missing,warnings:[]};s.proposals.push(legacy);
 const result=finalizeQuote(s,legacy.id,staff,true);
 assert.ok(result.state.proposals.find(x=>x.id===legacy.id)!.warnings.some(w=>w.includes('骨灰盒')));
});

test('customer with deceased records can finalize an unlinked quotation',()=>{
 const s=seedState(),staff=s.staff[0];s.customers[0].deceased=[{id:'d1',name:'甲',age:'80',relationship:'父亲',portraits:[]}];
 const p=generateDraft(s,s.customers[0],staff,'简约');s.proposals.push(p);
 assert.equal(finalizeQuote(s,p.id,staff,true).quote.deceasedId,undefined);
});

test('transport is outside store scope even in a saved enabled catalog',()=>{
 const s=withConsultationDemo(seedState());
 assert.ok(!NEED_OPTIONS.some(n=>n.key==='transport'));
 assert.ok(!s.products.some(p=>p.category==='接运服务'));
 const old={...s.products[0],id:'p5',category:'接运服务',enabled:true};
 assert.equal(isProductAvailable(s,old),false);
 const master={...s.masterProducts[0],id:'old-transport',category:'接运服务'};
 s.masterProducts.push(master);
 assert.throws(()=>adoptMasterProduct(s,master.id,s.staff.find(x=>x.id==='boss-a')!));
});

test('scope upgrade removes transport from open sales and sample tasks while preserving confirmation history',()=>{
 const s=withConsultationDemo(seedState());s.consultationDemoVersion=2;
 const old={...s.products[0],id:'p5',category:'接运服务',name:'礼仪接运服务',enabled:true};s.products.push(old);
 const line={productId:old.id,name:old.name,price:60000,unit:'次',quantity:1,kind:'服务' as const};
 const open=s.consultations!.find(c=>c.id==='demo-talk-paused')!;
 open.guided!.plan!.needs.transport='needed';
 open.guided!.plan!.selectedLines!.push(line);
 open.guided!.selectedProductIds.push(old.id);
 for(const p of open.guided!.plan!.packages){p.lines.push(line);p.total+=line.price;}
 const closed=s.consultations!.find(c=>c.id==='demo-talk-closed')!;
 closed.guided!.plan!.selectedLines!.push(line);
 s.proposals.find(p=>p.id===closed.proposalId)!.lines.push(line);
 const protectedSnapshot=structuredClone(closed),proposals=structuredClone(s.proposals),quotes=structuredClone(s.quotes);
 const prep=s.customers.find(c=>c.id==='demo-c-prep')!;
 prep.service!.tasks.push({...prep.service!.tasks[0],id:'demo-task-transport',title:'核实接运地址和时间',status:'待确认'});
 const before=JSON.stringify(s),next=withConsultationDemo(s);
 assert.equal(JSON.stringify(s),before);
 const plan=next.consultations!.find(c=>c.id===open.id)!.guided!.plan!;
 assert.equal(plan.needs.transport,undefined);assert.ok(plan.selectedLines!.every(l=>l.productId!=='p5'));
 assert.ok(plan.packages.every(p=>p.lines.every(l=>l.productId!=='p5')&&p.total===p.lines.reduce((v,l)=>v+l.price*l.quantity,0)));
 assert.deepEqual(next.consultations!.find(c=>c.id===closed.id),protectedSnapshot);
 assert.deepEqual(next.proposals,proposals);assert.deepEqual(next.quotes,quotes);
 assert.ok(!next.customers.find(c=>c.id===prep.id)!.service!.tasks.some(t=>t.id==='demo-task-transport'));
 assert.equal(next.products.find(p=>p.id==='p5')!.enabled,false);
 assert.equal(withConsultationDemo(next),next);
});
