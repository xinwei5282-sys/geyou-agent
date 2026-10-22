import {noticeServicePhone} from './noticeContact';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seedState} from './model';
import {withDemoAccount} from './demoAccount';
import {agentData,agentRecord,calculateAgentBazi,confirmAgentProfile,emptyAgentProfile,applyAgentReplyProfile,agentConversationTask,syncAgentArchive,ensureAgentDemo,putAgentData,generateAgentNotice,startAgentConversation} from './agentModel';
import {PAPER_PACKAGE,paperPlanLines,paperPlanTotal} from './agentPackageSource';
const fixture=()=>{const state=withDemoAccount(seedState());return {state,staff:state.staff[0]}};
test('进入套餐直接准备已核对资料的项目，保留草稿和确认快照；未核对不准备',async()=>{
 const model=await import('./agentModel');
 assert.equal(typeof model.prepareAgentPackage,'function','缺少进入套餐时的准备流程');
 const {state,staff}=fixture(),fresh=startAgentConversation(state,staff);
 assert.equal(model.prepareAgentPackage(fresh.state,staff,fresh.session.id),fresh.state);
 const checked=confirmAgentProfile(fresh.state,staff,fresh.session.id,{...emptyAgentProfile(),name:'测试逝者'},'测试家属','');
 const prepared=model.prepareAgentPackage(checked,staff,fresh.session.id);
 const data=agentData(prepared,agentRecord(prepared,staff,fresh.session.id));
 assert.ok(data.packagePreparedAt);assert.equal(data.paperPlan,undefined);
 assert.equal(model.prepareAgentPackage(prepared,staff,fresh.session.id),prepared);
 for(const confirmedAt of [undefined,'2026-10-22']){
  const paperPlan={basePrice:458000,extras:[{id:'wreath100',quantity:2}],pricesChecked:!!confirmedAt,confirmedAt,updatedAt:'2026-10-22'};
  const saved=putAgentData(checked,staff,fresh.session.id,{...agentData(checked,agentRecord(checked,staff,fresh.session.id)),paperPlan});
  assert.equal(model.prepareAgentPackage(saved,staff,fresh.session.id),saved);
  assert.deepEqual(agentData(saved,agentRecord(saved,staff,fresh.session.id)).paperPlan,paperPlan);
 }
 assert.throws(()=>model.prepareAgentPackage(checked,{...staff,agencyId:'other'},fresh.session.id));
});
test('八字使用历法结果，缺时辰不伪造；区分23点与零点口径',()=>{
 const p={...emptyAgentProfile(),birthDate:'2005-12-23',birthTime:'08:37',birthplace:'杭州'};
 const chart=calculateAgentBazi(p);assert.equal(chart.ready,true);if(chart.ready)assert.deepEqual(chart.pillars,['乙酉','戊子','辛巳','壬辰']);
 assert.equal(calculateAgentBazi({...p,birthTime:''}).ready,false);
 const a=calculateAgentBazi({...p,birthDate:'1988-02-15',birthTime:'23:30',sect:2}),b=calculateAgentBazi({...p,birthDate:'1988-02-15',birthTime:'23:30',sect:1});if(a.ready&&b.ready){assert.equal(a.pillars[2],'庚子');assert.equal(b.pillars[2],'辛丑')}else assert.fail();
 assert.throws(()=>calculateAgentBazi({...p,birthDate:'2005-02-30'}));
});
test('农历与公历相同时间排盘一致，非法农历日期被拒绝',()=>{
 const p={...emptyAgentProfile(),birthDate:'1988-02-15',birthTime:'23:30',birthplace:'杭州'};
 const solar=calculateAgentBazi(p),lunar=calculateAgentBazi({...p,birthDate:'1987-12-28',calendar:'lunar'});assert.deepEqual(solar,lunar);
 assert.throws(()=>calculateAgentBazi({...p,birthDate:'1987-12-31',calendar:'lunar'}));
});
test('代理示例按成员幂等，复用完整版的客户和持续沟通',()=>{
 const {state,staff}=fixture(),next=ensureAgentDemo(state,staff),again=ensureAgentDemo(next,staff);assert.equal(next,again);const c=next.consultations!.find(c=>c.agent?.isDemo)!;assert.ok(c.customerId&&c.deceasedId);assert.equal(c.messages.length,2);
 const reused=startAgentConversation(next,staff,c.customerId,c.deceasedId);assert.equal(reused.session.id,c.id);
 assert.throws(()=>agentRecord(next,{...staff,agencyId:'other'},c.id));
});
test('核对建档后补充资料沿用同一对象，原消息保留',()=>{
 const {state,staff}=fixture(),result=startAgentConversation(state,staff);const profile={...emptyAgentProfile(),name:'测试逝者',age:'80'};let next=confirmAgentProfile(result.state,staff,result.session.id,profile,'测试家属','');
 const first=agentRecord(next,staff,result.session.id);next=confirmAgentProfile(next,staff,first.id,{...profile,age:'81'},'测试家属','');const second=agentRecord(next,staff,first.id);assert.equal(first.customerId,second.customerId);assert.equal(first.deceasedId,second.deceasedId);assert.equal(next.customers.find(c=>c.id===first.customerId)!.deceased!.length,1);assert.equal(next.customers.find(c=>c.id===first.customerId)!.deceased![0].age,'81');
});
test('讣告只建一次草稿、不自动发布、不修改原预约',()=>{
 const {state,staff}=fixture(),next=ensureAgentDemo(state,staff),c=next.consultations!.find(c=>c.agent?.isDemo)!;const generated=generateAgentNotice(next,staff,c.id),twice=generateAgentNotice(generated,staff,c.id);assert.equal(generated,twice);const notice=generated.notices.find(n=>n.id===agentData(generated,agentRecord(generated,staff,c.id)).noticeId)!;assert.equal(notice.status,'草稿');assert.equal(notice.familyConfirmedAt,undefined);assert.equal(notice.name,'陈明德（演示）');assert.equal(generated.quotes.length,next.quotes.length);
});
test('纸单套餐4580、7个包含项不拆收费，增项按数量计费',()=>{
 assert.equal(PAPER_PACKAGE.price,458000);assert.equal(PAPER_PACKAGE.included.length,7);const plan={basePrice:458000,extras:[{id:'wreath100',quantity:2}],pricesChecked:false,updatedAt:''};assert.equal(paperPlanTotal(plan),478000);assert.equal(paperPlanLines(plan).length,2);assert.throws(()=>paperPlanTotal({...plan,extras:[{id:'unknown',quantity:1}]}));assert.throws(()=>paperPlanTotal({...plan,extras:[{id:'wreath100',quantity:-1}]}));
});
test('确认后的纸单清单在模型层冻结，旧页面不能覆盖且不自动登记付款',async()=>{
 const {saveAgentPaperPlan}=await import('./agentModel');
 const {state,staff}=fixture(),next=ensureAgentDemo(state,staff),c=next.consultations!.find(c=>c.agent?.isDemo)!;
 const plan={basePrice:458000,extras:[],pricesChecked:true,confirmedAt:'2026-10-22T00:00:00Z',updatedAt:''};
 const confirmed=saveAgentPaperPlan(next,staff,c.id,plan);assert.throws(()=>saveAgentPaperPlan(confirmed,staff,c.id,{...plan,basePrice:10000}));
 assert.equal(confirmed.quotes.length,next.quotes.length);assert.equal(confirmed.salePayments?.length,next.salePayments?.length);
 const draft=startAgentConversation(state,staff);assert.throws(()=>saveAgentPaperPlan(draft.state,staff,draft.session.id,plan));
 assert.throws(()=>saveAgentPaperPlan(next,staff,c.id,{...plan,pricesChecked:false}));
});

test('打开新接待不预置输出，已有讣告从完整版复用',()=>{
 const {state,staff}=fixture();const fresh=startAgentConversation(state,staff);assert.ok(fresh.session.agent);assert.equal(fresh.session.messages.length,0);assert.equal(fresh.session.agent!.noticeId,undefined);assert.equal(fresh.session.agent!.packagePreparedAt,undefined);
 const demo=ensureAgentDemo(state,staff),c=demo.consultations!.find(c=>c.agent?.isDemo)!;
 const existing={id:'full-version-notice',agencyId:staff.agencyId,customerId:c.customerId,deceasedId:c.deceasedId,name:'已有对象',age:'',date:'',ceremonyDate:'',location:'',text:'已有草稿',status:'草稿' as const,createdAt:''};
 const next=generateAgentNotice({...demo,notices:[...demo.notices,existing]},staff,c.id);assert.equal(next.notices.length,demo.notices.length+1);assert.equal(agentRecord(next,staff,c.id).agent!.noticeId,existing.id);
});
test('未关联聊天可明确关联已有客户与逝者，保留消息且不重复建档',async()=>{
 const {agentMessage}=await import('./agentModel');
 const {state,staff}=fixture(),demo=ensureAgentDemo(state,staff),existing=demo.consultations!.find(c=>c.agent?.isDemo)!,draft=startAgentConversation(demo,staff);
 const chatted=agentMessage(draft.state,staff,draft.session.id,'未关联时已经说过的需求','user');
 const linked=confirmAgentProfile(chatted,staff,draft.session.id,agentData(demo,existing).profile,'','',{customerId:existing.customerId!,deceasedId:existing.deceasedId!});
 const c=agentRecord(linked,staff,draft.session.id);assert.equal(c.customerId,existing.customerId);assert.equal(c.deceasedId,existing.deceasedId);assert.equal(c.messages[0].text,'未关联时已经说过的需求');assert.equal(linked.customers.length,demo.customers.length);assert.equal(linked.customers.find(x=>x.id===existing.customerId)!.deceased!.length,1);
});

test('新建讣告不复用未关联旧稿，错误引用及撤回稿也不带入其他对象',async()=>{
 const {findAgentNotice}=await import('./agentModel');const {state,staff}=fixture(),fresh=startAgentConversation(state,staff);
 assert.equal(findAgentNotice(fresh.state,staff,fresh.session),undefined);
 let demo=ensureAgentDemo(state,staff),c=demo.consultations!.find(c=>c.agent?.isDemo)!;const data=agentData(demo,c);
 demo=putAgentData(demo,staff,c.id,{...data,noticeId:state.notices[0].id});c=agentRecord(demo,staff,c.id);assert.equal(findAgentNotice(demo,staff,c),undefined);
 const next=generateAgentNotice(demo,staff,c.id),newNotice=findAgentNotice(next,staff,agentRecord(next,staff,c.id))!;assert.equal(newNotice.deceasedId,c.deceasedId);assert.notEqual(newNotice.id,state.notices[0].id);
 const revoked={...next,notices:next.notices.map(n=>n.id===newNotice.id?{...n,status:'已撤回' as const}:n)};assert.equal(findAgentNotice(revoked,staff,agentRecord(revoked,staff,c.id)),undefined);
});

test('接待资料自动归档，提前上传的人像只转存一次且不自动采用',()=>{
 const {state,staff}=fixture(),started=startAgentConversation(state,staff),sid=started.session.id;
 const data=agentData(started.state,started.session);
 let next=putAgentData(started.state,staff,sid,{...data,materials:[{id:'pending-photo',name:'人像',kind:'人像照片',at:'2026-10-22',image:'data:image/png;base64,AAAA'}]});
 assert.equal(syncAgentArchive(next,staff,sid),next);
 next=putAgentData(next,staff,sid,{...agentData(next,agentRecord(next,staff,sid)),profile:{...data.profile,name:'自动建档测试',age:'80'}});
 next=syncAgentArchive(next,staff,sid);const record=agentRecord(next,staff,sid);
 assert.ok(record.customerId&&record.deceasedId);assert.equal(record.agent!.profile.confirmedAt,undefined);
 const person=next.customers.find(c=>c.id===record.customerId)!.deceased![0];assert.equal(person.name,'自动建档测试');assert.equal(person.portraits.length,1);assert.equal(person.selectedPortraitId,undefined);
 assert.equal(record.agent!.materials[0].image,undefined);assert.equal(record.agent!.materials[0].portraitId,person.portraits[0].id);
 next=syncAgentArchive(next,staff,sid);assert.equal(next.customers.find(c=>c.id===record.customerId)!.deceased!.length,1);assert.equal(next.customers.find(c=>c.id===record.customerId)!.deceased![0].portraits.length,1);
});
test('自动归档不覆盖既有人工档案或跨权限关联',()=>{
 const {state,staff}=fixture(),started=startAgentConversation(state,staff),sid=started.session.id;
 let next=confirmAgentProfile(started.state,staff,sid,{...emptyAgentProfile(),name:'人工确认',age:'80'},'家属','');
 const c=agentRecord(next,staff,sid);next=putAgentData(next,staff,sid,{...agentData(next,c),profile:{...emptyAgentProfile(),name:'模型姓名',age:'90'}});
 next=syncAgentArchive(next,staff,sid);const person=next.customers.find(x=>x.id===c.customerId)!.deceased![0];assert.equal(person.name,'人工确认');assert.equal(person.age,'80');
 assert.throws(()=>syncAgentArchive(next,{...staff,agencyId:'other'},sid));
});

test('AI明确收集的信息与联系人进入同一档案，空回复不清空已收集资料',()=>{
 const {state,staff}=fixture(),started=startAgentConversation(state,staff),sid=started.session.id;
 let next=applyAgentReplyProfile(started.state,staff,sid,{subjectName:'测试姓名',subjectAge:'80岁',contactName:'王女士',contactPhone:'13800138000',deathDate:'2026-10-20',location:'告别厅'});
 const c=agentRecord(next,staff,sid),customer=next.customers.find(x=>x.id===c.customerId)!;assert.equal(customer.name,'王女士');assert.equal(customer.phone,'13800138000');assert.equal(customer.deceased![0].agentProfile?.deathDate,'2026-10-20');
 next=applyAgentReplyProfile(next,staff,sid,{subjectName:'',subjectAge:null});assert.equal(agentData(next,agentRecord(next,staff,sid)).profile.name,'测试姓名');assert.equal(next.customers.filter(x=>x.id===c.customerId).length,1);
});
test('对话入口只跟随当前明确需求，不因资料确认常驻全部服务',()=>{
 const {state,staff}=fixture(),started=startAgentConversation(state,staff),c=started.session;
 const at=(text:string)=>({...c,messages:[{role:'user' as const,text}]});
 assert.equal(agentConversationTask(at('现在该做什么')),undefined);
 assert.equal(agentConversationTask(at('请先准备讣告')),'notice');
 assert.equal(agentConversationTask(at('现在制作遗像')),'portrait');
 assert.equal(agentConversationTask(at('请核对报价')),'package');
 assert.equal(agentConversationTask(at('暂不做讣告')),undefined);
});
test('讣告服务电话取代理账号，机构电话不替代缺失的代理电话',()=>{
 const {state,staff}=fixture();const s={...state,staff:state.staff.map(x=>x.id===staff.id?{...x,phone:'13800138000'}:x)};const n={...state.notices[0],agencyId:staff.agencyId,serviceStaffId:staff.id};
 assert.equal(noticeServicePhone(s,n),'13800138000');
 assert.equal(noticeServicePhone({...s,staff:s.staff.map(x=>x.id===staff.id?{...x,phone:''}:x)},n),'');
 assert.equal(noticeServicePhone(s,{...n,agencyId:'other'}),'');
});

test('已核对档案只补空缺，不用模型的新姓名替换人工内容',()=>{
 const {state,staff}=fixture(),started=startAgentConversation(state,staff),sid=started.session.id;
 let next=confirmAgentProfile(started.state,staff,sid,{...emptyAgentProfile(),name:'人工姓名',age:'80'},'家属','');
 next=syncAgentArchive(next,staff,sid);
 next=applyAgentReplyProfile(next,staff,sid,{subjectName:'其他姓名',subjectAge:'90',location:'后补告别厅'});
 const c=agentRecord(next,staff,sid);assert.equal(c.agent!.profile.name,'人工姓名');assert.equal(c.agent!.profile.age,'80');assert.equal(c.agent!.profile.location,'后补告别厅');assert.equal(next.customers.find(x=>x.id===c.customerId)!.deceased![0].agentProfile?.location,'后补告别厅');
});

test('AI给出明确下一步时，对应办理入口跟随本轮答复',()=>{
 const {state,staff}=fixture(),{session}=startAgentConversation(state,staff);
 assert.equal(agentConversationTask({...session,messages:[{role:'user',text:'现在该做什么'},{role:'assistant',text:'先准备讣告，请核对告别时间。'}]}),'notice');
});

test('现场单品替换只收核实补差，重复替换不叠加，冻结订单不覆盖',async()=>{
 const {applyPaperAdjustment,packageExplanationRequest,replacementProducts}=await import('./packageExplanationModel');
 const {saveAgentPaperPlan}=await import('./agentModel');
 const {state,staff}=fixture(),next=ensureAgentDemo(state,staff),c=next.consultations!.find(c=>c.agent?.isDemo)!;
 const product=replacementProducts(next,staff,PAPER_PACKAGE.included[0])[0];assert.ok(product);
 const base={basePrice:458000,extras:[],pricesChecked:true,updatedAt:''};
 const item={included:PAPER_PACKAGE.included[0],productId:product.id,name:product.name,need:'家属希望棉质传统款',delta:60000,priceChecked:true};
 const adjusted=applyPaperAdjustment(base,item);assert.equal(paperPlanTotal(adjusted),518000);assert.equal(adjusted.pricesChecked,false);
 const again=applyPaperAdjustment(adjusted,{...item,delta:30000});assert.equal(paperPlanTotal(again),488000);assert.equal(again.adjustments.length,1);
 assert.match(paperPlanLines(adjusted).at(-1)!.name,/更换补差/);
 const {agentPaperQuotation}=await import('./agentQuotation');const quotation=agentPaperQuotation({...adjusted,pricesChecked:true},{number:'测试清单',customer:'测试家属',subject:'测试逝者',agency:'测试机构',phone:''});
 assert.equal(quotation.lines.reduce((n,l)=>n+l.price*l.quantity,0),518000);assert.equal(quotation.lines.at(-1)?.adjustment,true);assert.ok(quotation.notes?.some(x=>x.includes(product.name)));assert.equal(quotation.subject,'测试逝者');
 const saved=saveAgentPaperPlan(next,staff,c.id,{...adjusted,pricesChecked:true});assert.equal(agentData(saved,agentRecord(saved,staff,c.id)).paperPlan?.adjustments?.[0].productId,product.id);
 assert.throws(()=>applyPaperAdjustment({...base,confirmedAt:'yes'},item));assert.throws(()=>applyPaperAdjustment({...base,omitted:[item.included]},item));assert.throws(()=>applyPaperAdjustment(base,{...item,delta:NaN}));
 assert.throws(()=>saveAgentPaperPlan(next,staff,c.id,{...adjusted,pricesChecked:true,adjustments:[{...item,productId:'foreign'}]}));
 const req=packageExplanationRequest(base,'5000',{included:item.included,product,need:item.need});assert.match(req.staffContext.businessFacts.join(' '),/补差尚未核实/);assert.equal(req.messages.length,1);
});

test('商品详情仅给一个可追溯备选，不按职业刻板推断或缺五行强推',async()=>{
 const {recommendPackageProduct}=await import('./packageExplanationModel');const {state,staff}=fixture();
 const source=state.products.find(p=>p.id==='p2')!;
 const next={...state,products:[...state.products,{...source,id:'clothes-optional',masterId:undefined,name:'素雅棉质寿衣',price:128000,description:'棉质面料，素雅款式。',recommendationNote:'适合明确偏好棉质素雅款的家属。',elements:['木']}]};
 const plan={basePrice:458000,extras:[],pricesChecked:true,updatedAt:''};
 const rec=recommendPackageProduct(next,staff,plan,PAPER_PACKAGE.included[0],{occupation:'教师',interests:'喜欢棉质素雅款',preferredElement:'木',confirmedAt:'yes'})!;
 assert.equal(rec.product.id,'clothes-optional');assert.equal(rec.reasons.length,2);assert.ok(rec.reasons.some(r=>r.includes('偏好')));assert.ok(!rec.reasons.some(r=>r.includes('教师')));
 const unknown=recommendPackageProduct(state,staff,plan,PAPER_PACKAGE.included[0],{occupation:'教师',preferredElement:'木'})!;assert.equal(unknown.score,0);assert.ok(unknown.reasons[0].includes('没有足够'));
 assert.equal(recommendPackageProduct(state,staff,plan,PAPER_PACKAGE.included[1],{}),undefined);
 const replaced={...plan,adjustments:[{included:PAPER_PACKAGE.included[0],productId:source.id,name:source.name,need:'款式',delta:0,priceChecked:true}]};
 assert.equal(recommendPackageProduct(next,staff,replaced,PAPER_PACKAGE.included[0],{})?.product.id,'clothes-optional');
});

test('待确认清单自动保存增项与商品补差，不要求核价、不伪造家属确认且不能覆盖冻结单',async()=>{
 const {saveAgentPaperDraft,saveAgentPaperPlan}=await import('./agentModel');
 const {state,staff}=fixture(),next=ensureAgentDemo(state,staff),session=next.consultations!.find(c=>c.agent?.isDemo)!;
 const product=next.products.find(p=>p.id==='p2')!;
 const draft={basePrice:458000,extras:[{id:'wreath100',quantity:2}],omitted:[PAPER_PACKAGE.included[1]],adjustments:[{included:PAPER_PACKAGE.included[0],productId:product.id,name:product.name,need:'家属希望传统款',delta:60000,priceChecked:true}],pricesChecked:false,confirmedAt:'forged',updatedAt:'2026-10-22T12:00:00Z'};
 const saved=saveAgentPaperDraft(next,staff,session.id,draft),record=agentRecord(saved,staff,session.id),reopened=structuredClone(agentData(saved,record).paperPlan!);
 assert.deepEqual(reopened.extras,draft.extras);assert.deepEqual(reopened.adjustments,draft.adjustments);assert.deepEqual(reopened.omitted,draft.omitted);assert.equal(reopened.pricesChecked,false);assert.equal(reopened.confirmedAt,undefined);assert.equal(paperPlanTotal(reopened),538000);assert.equal(record.messages.length,session.messages.length);
 const checked=saveAgentPaperDraft(saved,staff,session.id,{...reopened,pricesChecked:true});assert.equal(agentData(checked,agentRecord(checked,staff,session.id)).paperPlan?.pricesChecked,true);
 const frozen=saveAgentPaperPlan(checked,staff,session.id,{...reopened,pricesChecked:true,confirmedAt:'confirmed'});assert.throws(()=>saveAgentPaperDraft(frozen,staff,session.id,draft));
 assert.throws(()=>saveAgentPaperDraft(next,{...staff,agencyId:'foreign'},session.id,draft));
 assert.throws(()=>saveAgentPaperDraft(saved,staff,session.id,{...draft,extras:[{id:'wreath100',quantity:0}]}));
});

test('商品推荐按逝者信仰排除冲突宗教款，并把职业信仰喜好带入真实推荐请求',async()=>{
 const {recommendPackageProduct,packageProductRecommendationRequest}=await import('./packageExplanationModel');const {state,staff}=fixture();
 const source=state.products.find(p=>p.id==='p2')!;
 const buddhist={...source,id:'buddhist',religion:'佛教',price:128000};
 const christian={...source,id:'christian',religion:'基督教',price:99000};
 const next={...state,products:[buddhist,christian]};
 const plan={basePrice:458000,extras:[],pricesChecked:true,updatedAt:''};
 const preference={occupation:'教师',faith:'佛教',interests:'喜欢素雅'};
 const rec=recommendPackageProduct(next,staff,plan,PAPER_PACKAGE.included[0],preference)!;
 assert.equal(rec.product.id,'buddhist');
 assert.equal(recommendPackageProduct(next,staff,plan,PAPER_PACKAGE.included[0],{faith:'待确认'}),undefined);
 assert.equal(recommendPackageProduct(next,staff,plan,PAPER_PACKAGE.included[0],{faith:'无特定信仰'}),undefined);
 const facts=packageProductRecommendationRequest(plan,PAPER_PACKAGE.included[0],rec.product,preference).staffContext.businessFacts.join('\n');
 assert.match(facts,/教师/);assert.match(facts,/逝者本人宗教信仰：佛教/);assert.match(facts,/喜欢素雅/);
});

test('核对建档后提示可选服务，跳过后再次保存不重复提醒',async()=>{
 const {agentServiceReminder,dismissAgentServiceReminder}=await import('./agentModel');const {state,staff}=fixture();
 const opened=startAgentConversation(state,staff);const sid=opened.session.id;
 assert.equal(agentServiceReminder(opened.state,staff,sid),false);
 const profile={...emptyAgentProfile(),name:'提醒测试逝者'};
 const saved=confirmAgentProfile(opened.state,staff,sid,profile,'测试家属','');
 assert.equal(agentServiceReminder(saved,staff,sid),true);
 const dismissed=dismissAgentServiceReminder(saved,staff,sid);
 assert.equal(agentServiceReminder(dismissed,staff,sid),false);
 const again=confirmAgentProfile(dismissed,staff,sid,profile,'测试家属','');
 assert.equal(agentServiceReminder(again,staff,sid),false);
});
