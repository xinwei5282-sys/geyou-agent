import {Solar,Lunar} from 'lunar-javascript';
import type {AppState,Consultation,Staff,Notice} from './types';
import type {AgentData,AgentProfile} from './agentTypes';
import {canAccessSalesRecord,hasStaffModule,id,now,visibleCustomers,isProductAvailable} from './model';
import {createGuidedSale} from './guidedSalesModel';
import {openCustomerConversation} from './customerCommunicationModel';
import {associateSalesCustomer} from './salesCustomerModel';
import {PAPER_PACKAGE,PAPER_EXTRAS,paperPlanLines,type PaperPlan} from './agentPackageSource';
import {selectedPortrait,canAccessNotice,saveDeceased,addPortrait} from './memorialModel';

export const emptyAgentProfile=():AgentProfile=>({name:'',age:'',gender:'',relationship:'',birthDate:'',birthTime:'',calendar:'solar',leap:false,birthplace:'',sect:2,deathDate:'',farewell:'',location:'',budget:'',faith:'待确认',preferredElement:'',prepared:[]});
export function agentRecord(s:AppState,staff:Staff,sid:string){const c=s.consultations?.find(c=>c.id===sid&&canAccessSalesRecord(s,staff,c));if(!c)throw Error('无权访问该客户沟通');return c;}
export function agentData(s:AppState,c:Consultation):AgentData{
 const person=s.customers.find(x=>x.id===c.customerId)?.deceased?.find(d=>d.id===c.deceasedId);
 return c.agent||{profile:{...emptyAgentProfile(),...person?.agentProfile,name:person?.name||c.guided?.subjectName||'',age:person?.age||'',relationship:person?.relationship||'',budget:person?.agentProfile?.budget||(c.guided?.budget?String(c.guided.budget/100):''),faith:person?.agentProfile?.faith||c.guided?.faith||'待确认'},materials:[]};
}
export function putAgentData(s:AppState,staff:Staff,sid:string,data:AgentData):AppState{agentRecord(s,staff,sid);return {...s,consultations:s.consultations!.map(c=>c.id===sid?{...c,agent:data,updatedAt:now()}:c)};}
export function prepareAgentPackage(s:AppState,staff:Staff,sid:string):AppState{
 const data=agentData(s,agentRecord(s,staff,sid));
 if(!data.profile.confirmedAt||data.packagePreparedAt||data.paperPlan)return s;
 return putAgentData(s,staff,sid,{...data,packagePreparedAt:now()});
}
export function applyAgentReplyProfile(s:AppState,staff:Staff,sid:string,value:unknown):AppState{
 if(!value||typeof value!=='object'||Array.isArray(value))return s;
 const raw=value as Record<string,unknown>,c=agentRecord(s,staff,sid),data=agentData(s,c),profile={...data.profile};
 {
  const mapping={occupation:'occupation',interests:'interests',subjectName:'name',subjectAge:'age',subjectGender:'gender',faith:'faith',relationship:'relationship',birthDate:'birthDate',deathDate:'deathDate',farewell:'farewell',location:'location'} as const;
  for(const [from,to] of Object.entries(mapping))if(typeof raw[from]==='string'&&(raw[from] as string).trim()){
   if(profile.confirmedAt&&profile[to as keyof AgentProfile])continue;
   let v=(raw[from] as string).trim().slice(0,200);
   if(to==='age'){v=v.replace(/岁/g,'');if(!/^\d{1,3}$/.test(v))continue;}
   if(['birthDate','deathDate'].includes(to)&&!/^\d{4}-\d{2}-\d{2}$/.test(v))continue;
   if(to==='farewell'&&!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v))continue;
   Object.assign(profile,{[to]:v});
  }
  // Reception no longer collects budget; preserve legacy values without accepting model updates.
 }
 const contact={name:c.contact?.name||'',phone:c.contact?.phone||''};
 if(typeof raw.contactName==='string'&&raw.contactName.trim())contact.name=raw.contactName.trim().slice(0,100);
 if(typeof raw.contactPhone==='string'&&/^\+?[0-9]{6,20}$/.test(raw.contactPhone.replace(/[\s-]/g,'')))contact.phone=raw.contactPhone.replace(/[\s-]/g,'');
 let next=putAgentData(s,staff,sid,{...data,profile});
 next={...next,consultations:next.consultations!.map(x=>x.id===sid?{...x,contact}:x)};
 // Only fill missing contact fields; existing client data is never overwritten by a model reply.
 if(c.customerId)next={...next,customers:next.customers.map(x=>x.id===c.customerId?{...x,name:x.name==='待核对家属'&&contact.name?contact.name:x.name,phone:x.phone||(next.customers.some(other=>other.id!==x.id&&other.agencyId===x.agencyId&&other.phone&&other.phone===contact.phone)?'':contact.phone)}:x)};
 return syncAgentArchive(next,staff,sid);
}
export function agentConversationTask(c:Consultation):'notice'|'portrait'|'package'|undefined{
 const latest=c.messages.at(-1);
 const directive=latest?.role==='assistant'?/(?:先|现在|接下来|下一步|当前)(?:请|可以|建议|需要|应|进入|准备|整理|制作|办理|核对|查看|\s){0,8}(讣告|遗照|遗像|人像|套餐|报价|清单)/.exec(latest.text):null;
 const text=directive?.[0]||c.messages.filter(m=>m.role==='user').at(-1)?.text||'';
 if(/(?:暂不|不要|不用|取消|别)(?:做|制作|准备|生成|发布)?(?:讣告|遗照|遗像|套餐|报价)/.test(text))return;
 const match=/(讣告|遗照|遗像|人像|套餐|报价|清单)/.exec(text);
 return match?match[0]==='讣告'?'notice':/遗照|遗像|人像/.test(match[0])?'portrait':'package':undefined;
}
/** Archive collected drafts without asserting family confirmation or adopting a portrait. */
export function syncAgentArchive(s:AppState,staff:Staff,sid:string):AppState{
 let record=agentRecord(s,staff,sid);const data=agentData(s,record),p=data.profile;
 if(!p.name.trim()||!hasStaffModule(s,staff,'customers'))return s;
 let next=s;
 if(!record.customerId){
  const matches=record.contact?.phone?next.customers.filter(c=>c.agencyId===staff.agencyId&&c.phone.replace(/[\s-]/g,'')===record.contact!.phone):[];
  if(matches.length){if(matches.length!==1||!visibleCustomers(next,staff).some(c=>c.id===matches[0].id))return s;next=associateSalesCustomer(next,staff,sid,{customerId:matches[0].id});}
  else next=associateSalesCustomer(next,staff,sid,{newCustomer:{name:record.contact?.name?.trim()||'待核对家属',phone:record.contact?.phone||''}});
  record=agentRecord(next,staff,sid);
 }
 const cid=record.customerId!,customer=visibleCustomers(next,staff).find(c=>c.id===cid);
 if(!customer)return s;
 // Preserve the bound object. Within one associated customer, reuse only a unique exact match.
 const matches=(customer.deceased||[]).filter(d=>d.name===p.name.trim());
 if(!record.deceasedId&&matches.length>1)return s;
 const existing=customer.deceased?.find(d=>d.id===record.deceasedId)||(!record.deceasedId&&matches.length===1?matches[0]:undefined);
 const did=existing?.id||id('agent-person');
 const age=/^\d{1,3}$/.test(p.age.trim())?p.age.trim():'';
 const value=(key:'name'|'age'|'relationship',incoming:string)=>!existing?.[key]||(!existing.agentProfile?.confirmedAt&&existing[key]===existing.agentProfile?.[key])?incoming||existing?.[key]||'':existing[key];
 next=saveDeceased(next,staff,cid,{id:did,name:value('name',p.name.trim()),age:value('age',age),relationship:value('relationship',p.relationship)});
 const archived={...existing?.agentProfile};
 for(const [key,value] of Object.entries(p))if(value!==''&&value!==undefined&&(!Array.isArray(value)||value.length))Object.assign(archived,{[key]:value});
 next={...next,customers:next.customers.map(c=>c.id===cid?{...c,deceased:c.deceased!.map(d=>d.id===did?{...d,agentProfile:existing?.agentProfile?.confirmedAt&&!p.confirmedAt?existing.agentProfile:archived as AgentProfile}:d)}:c),consultations:next.consultations!.map(c=>c.id===sid?{...c,deceasedId:did,serviceId:`${cid}:${did}`} :c)};
 const materials=data.materials.map(m=>({...m}));
 for(const material of materials){
  if(material.kind!=='人像照片'||!material.image||material.portraitId||!hasStaffModule(next,staff,'restoration'))continue;
  next=addPortrait(next,staff,cid,did,material.image);
  material.portraitId=next.customers.find(c=>c.id===cid)!.deceased!.find(d=>d.id===did)!.portraits.at(-1)!.id;
  delete material.image;
 }
 return {...next,consultations:next.consultations!.map(c=>c.id===sid?{...c,agent:{...data,materials}}:c)};
}
export function agentMessage(s:AppState,staff:Staff,sid:string,text:string,role:'assistant'|'user'='assistant'):AppState{agentRecord(s,staff,sid);return {...s,consultations:s.consultations!.map(c=>c.id===sid?{...c,messages:[...c.messages,{role,text,at:now()}],updatedAt:now()}:c)};}
export function startAgentConversation(s:AppState,staff:Staff,cid?:string,did?:string){
 const result=cid?openCustomerConversation(s,staff,cid,did):createGuidedSale(s,staff,{nickname:'新客户接待',scenario:'home',subjectName:'',occupation:'',interests:'',faith:'待确认',region:s.agencies.find(a=>a.id===staff.agencyId)?.region||'',budget:0,notes:''});
 if(result.session.agent)return result;
 const next=putAgentData(result.state,staff,result.session.id,agentData(result.state,result.session));return {state:next,session:next.consultations!.find(c=>c.id===result.session.id)!};
}
export function findAgentNotice(s:AppState,staff:Staff,c:Consultation):Notice|undefined{
 if(!c.customerId||!c.deceasedId||!hasStaffModule(s,staff,'content'))return;
 agentRecord(s,staff,c.id);
 const candidates=s.notices.filter(n=>n.agencyId===staff.agencyId&&n.customerId===c.customerId&&n.deceasedId===c.deceasedId&&n.status!=='已撤回');
 return candidates.find(n=>n.id===c.agent?.noticeId)||candidates.at(-1);
}
export function calculateAgentBazi(p:AgentProfile){
 if(!p.birthDate||!p.birthTime)return {ready:false as const,reason:'请补充出生日期和出生时间；时辰不详时不生成完整四柱。'};
 if(!p.birthplace.trim())return {ready:false as const,reason:'请补充出生地，核对是否适用北京时间。'};
 if(!/^\d{4}-\d{2}-\d{2}$/.test(p.birthDate)||!/^\d{2}:\d{2}$/.test(p.birthTime))throw Error('请核对出生日期和时间格式');
 const [y,m,d]=p.birthDate.split('-').map(Number),[h,min]=p.birthTime.split(':').map(Number);
 if(y<1900||y>new Date().getFullYear()||m<1||m>12||d<1||d>31||h>23||min>59)throw Error('出生日期或时间不在有效范围内');
 let lunar;
 try{if(p.calendar==='solar'){const date=new Date(Date.UTC(y,m-1,d));if(date.getUTCMonth()!==m-1||date.getUTCDate()!==d)throw Error();lunar=Solar.fromYmdHms(y,m,d,h,min,0).getLunar();}else lunar=Lunar.fromYmdHms(y,p.leap?-m:m,d,h,min,0);}catch{throw Error('日期无效，请核对农历月份、日期及是否闰月');}
 if(lunar.getSolar().toYmd()>new Date().toISOString().slice(0,10))throw Error('出生日期不能晚于今天');
 const ec=lunar.getEightChar();ec.setSect(p.sect);
 const pillars=[ec.getYear(),ec.getMonth(),ec.getDay(),ec.getTime()];
 const elements=[ec.getYearWuXing(),ec.getMonthWuXing(),ec.getDayWuXing(),ec.getTimeWuXing()].join('');
 return {ready:true as const,pillars,solarDate:lunar.getSolar().toYmd(),counts:['木','火','土','金','水'].map(name=>({name,count:elements.split('').filter(e=>e===name).length})),rule:`北京时间（UTC+8），未校正真太阳时；${p.sect===2?'零点':'23点'}换日。`};
}
export function confirmAgentProfile(s:AppState,staff:Staff,sid:string,input:AgentProfile,contactName:string,phone:string,target?:{customerId:string;deceasedId?:string}):AppState{
 let record=agentRecord(s,staff,sid);if(!input.name.trim())throw Error('请填写逝者姓名');
 if(input.budget&&(!/^\d+(\.\d{1,2})?$/.test(input.budget)||Number(input.budget)>100000000))throw Error('请填写有效预算');
 if(input.birthDate&&input.birthTime)calculateAgentBazi(input);
 let next=s;if(!record.customerId){next=associateSalesCustomer(next,staff,sid,target?{customerId:target.customerId}:{newCustomer:{name:contactName,phone}});record=agentRecord(next,staff,sid);}
 const cid=record.customerId!;
 if(target?.deceasedId&&!next.customers.find(c=>c.id===cid)?.deceased?.some(d=>d.id===target.deceasedId))throw Error('请选择该客户对应的服务对象');
 const did=record.deceasedId||target?.deceasedId||id('agent-person');
 if(!record.deceasedId&&!target?.deceasedId&&next.customers.find(c=>c.id===cid)?.deceased?.some(d=>d.name===input.name.trim()))throw Error('该客户已有同名服务对象，请先选择已有对象，避免重复建档');
 next=saveDeceased(next,staff,cid,{id:did,name:input.name,age:input.age,relationship:input.relationship});
 const previous=agentData(next,record),profile={...input,name:input.name.trim(),confirmedAt:now()};
 // Existing published content and confirmed orders remain snapshots; changes are flagged in the agent view.
 return {...next,consultations:next.consultations!.map(c=>c.id===sid?{...c,deceasedId:did,serviceId:`${cid}:${did}`,agent:{...previous,profile,serviceReminderAt:previous.serviceReminderAt||now()},guided:c.guided?{...c.guided,subjectName:profile.name,subjectAge:profile.age,subjectGender:profile.gender,budget:Math.round(Number(profile.budget||0)*100),faith:profile.faith}:c.guided,updatedAt:now()}:c)};
}
export function generateAgentNotice(s:AppState,staff:Staff,sid:string):AppState{
 const c=agentRecord(s,staff,sid),data=agentData(s,c),p=data.profile;
 if(!hasStaffModule(s,staff,'content'))throw Error('未开通电子讣告权限');
 if(!c.customerId||!c.deceasedId||!p.confirmedAt)throw Error('请先核对并保存逝者档案');
 const existing=findAgentNotice(s,staff,c);if(existing)return data.noticeId===existing.id?s:putAgentData(s,staff,sid,{...data,noticeId:existing.id});
 const person=s.customers.find(x=>x.id===c.customerId)!.deceased!.find(x=>x.id===c.deceasedId)!;const portrait=selectedPortrait(person);
 const notice:Notice={id:id('agent-notice'),agencyId:staff.agencyId,customerId:c.customerId,deceasedId:c.deceasedId,name:p.name,age:p.age,date:p.deathDate,ceremonyDate:p.farewell,location:p.location,text:`${p.name}${p.deathDate?`于${p.deathDate}逝世`:'逝世日期待家属确认'}${p.age?`，享年${p.age}岁`:''}。${p.farewell&&p.location?`谨定于${p.farewell.replace('T',' ')}在${p.location}举行告别仪式。`:'告别时间与地点待家属确认后补充。'}谨此讣告。`,status:'草稿',createdAt:now(),template:'flower',portrait:portrait?.image,portraitRecordId:portrait?.recordId};
 return putAgentData({...s,notices:[...s.notices,notice]},staff,sid,{...data,noticeId:notice.id});
}

export function ensureAgentDemo(s:AppState,staff:Staff):AppState{
 if(!hasStaffModule(s,staff,'customers')||!hasStaffModule(s,staff,'talk'))return s;
 const cid=`agent-demo-${staff.agencyId}-${staff.id}`;if(s.customers.some(c=>c.id===cid))return s;
 let next:AppState={...s,customers:[...s.customers,{id:cid,agencyId:staff.agencyId,ownerId:staff.id,name:'林女士（演示）',phone:'',region:'浙江 · 杭州',budget:500000,stage:'跟进中',source:'代理版演示',note:'本地演示案例，不是真实客户。',createdAt:now(),followups:[],deceased:[]}]};
 const result=startAgentConversation(next,staff,cid);next=result.state;
 next=confirmAgentProfile(next,staff,result.session.id,{...emptyAgentProfile(),name:'陈明德（演示）',age:'82',gender:'男',relationship:'父亲',birthDate:'1944-05-16',birthTime:'08:30',birthplace:'浙江杭州',deathDate:'2026-10-21',farewell:'2026-10-23T10:00',location:'示例告别厅',budget:'5000',faith:'无特定信仰'},'林女士（演示）','');
 const c=agentRecord(next,staff,result.session.id);next=putAgentData(next,staff,c.id,{...agentData(next,c),isDemo:true});
 next=agentMessage(next,staff,c.id,'父亲的资料已经核对，预算在5000元以内。请先准备讣告，再帮我看看合适的套餐。','user');
 return agentMessage(next,staff,c.id,'资料已保存到陈明德的档案。可以继续核对八字资料，整理讣告草稿与套餐建议；遗照请补充清晰的人像照片。已确认的内容会保留在这个客户的沟通记录里。');
}
export function agentCustomers(s:AppState,staff:Staff){return visibleCustomers(s,staff).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}

export function saveAgentPaperPlan(s:AppState,staff:Staff,sid:string,input:PaperPlan):AppState{
 if(!input.pricesChecked)throw Error('请先核对本次实际价格及服务范围');
 return storeAgentPaperPlan(s,staff,sid,input);
}
export function saveAgentPaperDraft(s:AppState,staff:Staff,sid:string,input:PaperPlan):AppState{
 return storeAgentPaperPlan(s,staff,sid,{...input,confirmedAt:undefined});
}
function storeAgentPaperPlan(s:AppState,staff:Staff,sid:string,input:PaperPlan):AppState{
 const c=agentRecord(s,staff,sid),data=agentData(s,c);
 if(!c.customerId||!c.deceasedId||!data.profile.confirmedAt)throw Error('请先核对并保存逝者档案');
 if(data.paperPlan?.confirmedAt)throw Error('已确认清单不能直接修改，请另行沟通增购');
 if(!Number.isSafeInteger(input.basePrice)||input.basePrice<0||input.basePrice>10000000000)throw Error('请核对套餐金额');
 const omitted=input.omitted||[];
 if(omitted.some(x=>!PAPER_PACKAGE.included.includes(x))||new Set(omitted).size!==omitted.length||omitted.length>=PAPER_PACKAGE.included.length)throw Error('请至少保留一项有效套餐内容');
 if(new Set(input.extras.map(x=>x.id)).size!==input.extras.length)throw Error('增项不能重复登记');
 const adjustments=input.adjustments||[];
 if(new Set(adjustments.map(x=>x.included)).size!==adjustments.length)throw Error('同一包含项目不能重复替换');
 for(const a of adjustments){const product=s.products.find(p=>p.id===a.productId&&p.agencyId===staff.agencyId&&isProductAvailable(s,p));
  if(!product||product.name!==a.name||!PAPER_PACKAGE.included.includes(a.included)||omitted.includes(a.included)||!a.need.trim()||!a.priceChecked||!Number.isSafeInteger(a.delta)||Math.abs(a.delta)>10000000000)throw Error('请重新核对替换商品与补差');
  if(!(a.included.includes('寿衣')&&product.category==='寿衣'||a.included.includes('骨灰盒')&&product.category==='骨灰盒'))throw Error('替换商品类别不匹配');
 }
 const lines=paperPlanLines(input);if(lines.reduce((n,x)=>n+x.price*x.quantity,0)<0)throw Error('清单总价不能小于零');
 return putAgentData(s,staff,sid,{...data,paperPlan:structuredClone(input)});
}

/** One persisted, optional follow-up after the first human profile confirmation. */
export function agentServiceReminder(s:AppState,staff:Staff,sid:string){
 const c=agentRecord(s,staff,sid),data=agentData(s,c);
 return !!(data.profile.confirmedAt&&data.serviceReminderAt&&!data.serviceReminderDismissedAt&&c.customerId&&c.deceasedId);
}
export function dismissAgentServiceReminder(s:AppState,staff:Staff,sid:string){
 const c=agentRecord(s,staff,sid),data=agentData(s,c);
 return putAgentData(s,staff,sid,{...data,serviceReminderDismissedAt:now()});
}
