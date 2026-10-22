import type { AppState, Consultation, GuidedSale, Proposal, Staff, Product } from './types';
import { calculateTotal, canAccessSalesRecord, hasStaffModule, id, isProductAvailable, now, visibleCustomers } from './model';
import { NEED_OPTIONS } from './packageModel';
import type { ConsultationPlan } from './packageTypes';
import { generatePackages } from './packageModel';

export const SCENARIOS = { advance: '提前咨询', hospital: '医院场景', home: '居家场景' } as const;
export const SALES_STEPS = [
  { key:'clothes', title: '寿衣', categories: ['寿衣'], description: '先了解穿衣习惯、尺码与家属意愿，再说明面料和套装内容。', tip: '已自行准备的用品不重复选购，具体穿衣安排由服务人员与家属核对。' },
  { key:'urn', title: '骨灰盒', categories: ['骨灰盒'], description: '介绍材质、款式与规格，按家属意愿选择。', tip: '尺寸需结合后续安放要求核对；不确定时可以暂不选择。' },
  { key:'ceremony', title: '告别布置', categories: ['灵堂布置', '礼仪服务', '花圈'], description: '结合在家守灵或殡仪馆告别的安排，说明可选服务。', tip: '先确认场地、人数与信仰。基督教等宗教仪式由家属联系相应人员，布置按家属要求沟通。' },
  { key:'burial', title: '安葬用品', categories: ['安葬用品', '安葬服务', '祭祀用品', '随葬用品'], description: '根据墓地或寄存安排，沟通所需用品与服务。', tip: '香烛、纸品等按当地实际套餐说明，不默认加入；临时增项另行沟通。' },
];

export const productSalesStage=(product:Product)=>product.salesStage||SALES_STEPS.find(step=>step.categories.includes(product.category))?.key||'ceremony';

type OptionalBookingDetails=Pick<Partial<GuidedSale>,'serviceAddress'|'reservationTime'|'familySupplies'>;
function normalizeOptionalBooking(input:OptionalBookingDetails):OptionalBookingDetails {
  const serviceAddress=input.serviceAddress?.trim(),familySupplies=input.familySupplies?.trim(),reservationTime=input.reservationTime?.trim();
  if(serviceAddress!==undefined&&serviceAddress.length>500)throw Error('服务地址不超过500字');
  if(familySupplies!==undefined&&familySupplies.length>500)throw Error('家属已备物品不超过500字');
  if(reservationTime){
    const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(reservationTime);
    if(!match)throw Error('请填写有效预约时间');
    const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]),hour=Number(match[4]),minute=Number(match[5]);
    const date=new Date(0);date.setFullYear(year,month-1,day);date.setHours(hour,minute,0,0);
    if(year<1000||date.getFullYear()!==year||date.getMonth()!==month-1||date.getDate()!==day||date.getHours()!==hour||date.getMinutes()!==minute)throw Error('请填写有效预约时间');
  }
  return {serviceAddress,familySupplies,reservationTime};
}

export function createGuidedSale(s: AppState, staff: Staff, input: Omit<GuidedSale, 'step'|'selectedProductIds'> & { nickname:string; phone?:string; customerId?:string; deceasedId?:string }): { state:AppState; session:Consultation } {
  if(!hasStaffModule(s,staff,'talk')) throw Error('当前账号未开通谈单所需权限');
  let customer = input.customerId ? visibleCustomers(s,staff).find(c=>c.id===input.customerId) : undefined;
  if(input.customerId&&!customer) throw Error('无法使用该联系记录');
  if(!Number.isSafeInteger(input.budget)||input.budget<0) throw Error('请填写有效预算或留空');
  if(!SCENARIOS[input.scenario]) throw Error('请选择本次咨询场景');
  const booking=normalizeOptionalBooking(input);
  const phone=(input.phone||'').trim().replace(/[\s-]/g,'');
  if(phone&&!/^\+?[0-9]{6,20}$/.test(phone))throw Error('请填写有效手机号，或留空稍后补充');
  let next=s;
  if(customer&&phone&&phone!==customer.phone){
    customer={...customer,phone};
    next={...next,customers:next.customers.map(c=>c.id===customer!.id?customer!:c)};
  }
  const deceasedId = input.deceasedId;
  if(deceasedId&&!customer?.deceased?.some(d=>d.id===deceasedId))throw Error('服务对象与联系记录不一致');
  const { nickname,phone: ignoredPhone,customerId,deceasedId: ignored,...details }=input;
  const prior=(next.consultations||[]).filter(c=>customer&&c.customerId===customer.id&&c.deceasedId===deceasedId&&c.guided?.plan?.outcome==='confirmed');
  const prepared:ConsultationPlan['needs']={};
  for(const old of prior){
    for(const l of old.guided?.plan?.selectedLines||[]){
      const key=NEED_OPTIONS.find(o=>o.categories.includes(next.products.find(p=>p.id===l.productId)?.category||''))?.key;
      if(key)prepared[key]='prepared';
    }
  }
  const plan:ConsultationPlan={phase:input.scenario==='advance'?'process':'packages',processPosition:input.scenario==='advance'?'advance':'immediate',needs:prepared,scopeConfirmed:false,packages:[],continuation:'undecided'};
  const session:Consultation={id:id('talk'),agencyId:staff.agencyId,staffId:staff.id,customerId:customer?.id,contact:{name:customer?.name||nickname.trim(),phone:customer?.phone||phone},deceasedId,serviceId:deceasedId?`${customer!.id}:${deceasedId}`:undefined,mode:'general',answers:{},messages:[],step:0,createdAt:now(),updatedAt:now(),guided:{...details,...booking,step:0,selectedProductIds:[],plan}};
  return {session,state:{...next,consultations:[...(next.consultations||[]),session]}};
}

export function saveGuidedSale(s:AppState,staff:Staff,sessionId:string,changes:Partial<GuidedSale>):AppState {
  const record=(s.consultations||[]).find(c=>c.id===sessionId&&canAccessSalesRecord(s,staff,c));
  if(!record?.guided||!hasStaffModule(s,staff,'talk'))throw Error('无法访问该谈单记录');
  if(Object.keys(changes).length && s.quotes.some(q=>q.receipt&&s.proposals.some(p=>p.id===q.proposalId&&p.consultationId===record.id)))throw Error('此谈单已有历史收款登记，请先线下核对');
  if(record.guided.plan?.outcome==='confirmed' && Object.keys(changes).length) throw Error('本次谈单方案已确认，请新建补充谈单');
  if(!Object.keys(changes).length)return s;
  const guided={...record.guided,...changes};
  if(!Number.isInteger(guided.step)||guided.step<0||guided.step>SALES_STEPS.length)throw Error('无效的谈单步骤');
  return {...s,consultations:(s.consultations||[]).map(c=>c.id===record.id?{...c,guided,updatedAt:now()}:c)};
}

export function guidedSaleProposal(s:AppState,staff:Staff,sessionId:string):{state:AppState;proposal:Proposal} {
  const checked=saveGuidedSale(s,staff,sessionId,{});
  const record=checked.consultations!.find(c=>c.id===sessionId)!;
  const guided=record.guided!;
  if(guided.plan){
    const plan=guided.plan;
    const existing=checked.proposals.find(p=>p.consultationId===record.id);
    if(plan.outcome==='confirmed'&&existing)return {state:checked,proposal:existing};
    if(!plan.scopeConfirmed)throw Error('请先确认本次需求范围');
    if(plan.phase!=='result')throw Error('请先完成本次套餐选择');
    const selected=plan.selectedLines||[];
    if(!selected.length)throw Error('请先选择套餐或商品');
    const requested=NEED_OPTIONS.filter(o=>plan.needs[o.key]==='needed');
    for(const o of requested)if(!selected.some(l=>{const p=s.products.find(x=>x.id===l.productId);return p&&o.categories.includes(p.category)}))throw Error(`缺少「${o.label}」商品，请重新选择套餐`);
    for(const l of selected){
      const p=s.products.find(x=>x.id===l.productId&&x.agencyId===staff.agencyId&&isProductAvailable(s,x));
      if(!p||p.price!==l.price||p.name!==l.name||!Number.isInteger(l.quantity)||l.quantity<1)throw Error('已选商品有变动，请重新生成套餐');
      const allowed=requested.some(o=>o.categories.includes(p.category));
      if(!allowed)throw Error('方案包含范围外商品，请重新选择');
    }
    const lines=selected.map(l=>({...l})); calculateTotal(lines);
    const proposal:Proposal={id:id('proposal'),phaseOne:true,subjectName:guided.subjectName.trim()||undefined,agencyId:staff.agencyId,customerId:record.customerId,staffId:staff.id,consultationId:record.id,deceasedId:record.deceasedId,serviceId:record.serviceId,region:guided.region,budget:guided.budget,preference:[SCENARIOS[guided.scenario],guided.faith&&`信仰：${guided.faith}`,guided.occupation&&`职业：${guided.occupation}`,guided.interests&&`喜好：${guided.interests}`,guided.notes].filter(Boolean).join('；'),lines,status:'待客户确认',warnings:plan.warnings||[],createdAt:now(),updatedAt:now(),matchingNotes:['套餐仅包含本次已确认范围内的实际商品，后续需求可另行补充。']};
    const nextPlan={...plan,outcome:'confirmed' as const,confirmedAt:now()};
    return {proposal,state:{...checked,proposals:[...checked.proposals,proposal],consultations:checked.consultations!.map(c=>c.id===sessionId?{...c,proposalId:proposal.id,guided:{...c.guided!,plan:nextPlan}}:c)}};
  }
  if(guided.step!==SALES_STEPS.length)throw Error('请先逐步完成商品讲解');
  const products=[...new Set(guided.selectedProductIds)].map(productId=>s.products.find(p=>p.id===productId&&p.agencyId===staff.agencyId&&isProductAvailable(s,p)));
  if(products.some(p=>!p))throw Error('已选项目有变动，请返回检查下架或不可用商品');
  if(!products.length)throw Error('尚未选择商品，可保存当前谈单，选货后再报价');
  const lines=products.map(p=>({productId:p!.id,name:p!.name,unit:p!.unit,price:p!.price,quantity:1,kind:p!.kind}));
  calculateTotal(lines);
  const proposal:Proposal={id:id('proposal'),phaseOne:true,subjectName:guided.subjectName.trim()||undefined,agencyId:staff.agencyId,customerId:record.customerId,staffId:staff.id,consultationId:record.id,deceasedId:record.deceasedId,serviceId:record.serviceId,region:guided.region,budget:guided.budget,preference:[SCENARIOS[guided.scenario],guided.faith&&`信仰：${guided.faith}`,guided.occupation&&`职业：${guided.occupation}`,guided.interests&&`喜好：${guided.interests}`,guided.notes].filter(Boolean).join('；'),lines,status:'待客户确认',warnings:[],createdAt:now(),updatedAt:now(),matchingNotes:['清单仅包含本次主动选择的商品与服务。未选项目不自动补入，后续可调整数量和价格。']};
  return {proposal,state:{...checked,proposals:[...checked.proposals,proposal],consultations:checked.consultations!.map(c=>c.id===sessionId?{...c,proposalId:proposal.id}:c)}};
}

export function setConsultationNeeds(s:AppState,staff:Staff,sessionId:string,needs:ConsultationPlan['needs']):AppState {
  const record=(s.consultations||[]).find(c=>c.id===sessionId&&canAccessSalesRecord(s,staff,c));
  if(!record?.guided?.plan||!hasStaffModule(s,staff,'talk'))throw Error('无法访问该谈单记录');
  if(record.guided.plan.outcome==='confirmed')throw Error('本次谈单方案已确认，请新建补充谈单');
  saveGuidedSale(s,staff,sessionId,{plan:record.guided.plan});
  const packages=Object.values(needs).some(v=>v==='needed') ? generatePackages(s,staff,{needs,budget:record.guided.budget,faith:record.guided.faith,occupation:record.guided.occupation}) : {packages:[],warnings:[],missingNeeds:[]};
  const changed=NEED_OPTIONS.some(o=>(record.guided!.plan!.needs[o.key]==='needed')!==(needs[o.key]==='needed'));
  const plan={...record.guided.plan,needs,packages:packages.packages, warnings:packages.warnings, missingNeeds:packages.missingNeeds,scopeConfirmed:Object.values(needs).some(v=>v==='needed'),phase:'packages' as const,selectedLines:changed?undefined:record.guided.plan.selectedLines,selectedPackageId:changed?undefined:record.guided.plan.selectedPackageId};
  return {...s,consultations:(s.consultations||[]).map(c=>c.id===record.id?{...c,guided:{...c.guided!,plan},updatedAt:now()}:c)};
}

export function saveConsultationDetails(s:AppState,staff:Staff,sessionId:string,input:{nickname:string;phone?:string;budget:number;subjectName:string;region:string;faith:string;occupation:string;interests:string;notes:string;scenario:'advance'|'hospital'|'home'}&OptionalBookingDetails):AppState {
  const record=(s.consultations||[]).find(c=>c.id===sessionId&&canAccessSalesRecord(s,staff,c));
  if(!record?.guided?.plan||!hasStaffModule(s,staff,'talk'))throw Error('无法访问该谈单记录');
  const booking=normalizeOptionalBooking(input);
  if(record.guided.plan.outcome==='confirmed')throw Error('本次谈单方案已确认，请新建补充谈单');
  saveGuidedSale(s,staff,sessionId,{plan:record.guided.plan});
  if(!SCENARIOS[input.scenario])throw Error('请选择有效场景');
  if(!Number.isSafeInteger(input.budget)||input.budget<0)throw Error('请填写有效预算或留空');
  const phone=(input.phone||'').trim().replace(/[\s-]/g,''); if(phone&&!/^\+?[0-9]{6,20}$/.test(phone))throw Error('请填写有效手机号，或留空稍后补充');
  const customer=s.customers.find(c=>c.id===record.customerId);const region=input.region.trim()||customer?.region||record.guided.region;
  const subjectName=input.subjectName.trim();
  const nextCustomer=customer?{...customer,name:input.nickname.trim()||customer.name,phone:phone||customer.phone,budget:input.budget,region,note:input.notes,deceased:record.deceasedId&&subjectName?customer.deceased?.map(person=>person.id===record.deceasedId?{...person,name:subjectName}:person):customer.deceased}:undefined;
  const guided={...record.guided,scenario:input.scenario,subjectName,region,faith:input.faith,occupation:input.occupation,interests:input.interests,notes:input.notes,budget:input.budget,serviceAddress:input.serviceAddress===undefined?record.guided.serviceAddress:booking.serviceAddress,reservationTime:input.reservationTime===undefined?record.guided.reservationTime:booking.reservationTime,familySupplies:input.familySupplies===undefined?record.guided.familySupplies:booking.familySupplies};
  const plan={...guided.plan}; const generated=Object.values(plan.needs).some(v=>v==='needed')?generatePackages(s,staff,{needs:plan.needs,budget:input.budget,faith:input.faith,occupation:input.occupation}):{packages:[],warnings:[],missingNeeds:[]}; plan.packages=generated.packages;plan.warnings=generated.warnings;plan.missingNeeds=generated.missingNeeds;
  return {...s,customers:nextCustomer?s.customers.map(c=>c.id===nextCustomer.id?nextCustomer:c):s.customers,consultations:(s.consultations||[]).map(c=>c.id===record.id?{...c,contact:{name:nextCustomer?.name||input.nickname.trim(),phone:nextCustomer?.phone||phone||record.contact?.phone||''},guided:{...guided,plan},updatedAt:now()}:c)};
}
