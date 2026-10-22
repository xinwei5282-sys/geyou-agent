import {serviceHasPayments} from './saleScope';
import { reconcileService } from './serviceAutomation';
import type { Consultation, AppState, Customer, Staff, Line, Proposal, Quote, Product, MasterProduct, ModuleKey, ServicePhase, ServiceTask, ServiceRecord, Stage } from './types';
export const id = (prefix='id') => `${prefix}-${crypto.randomUUID()}`;
export const now = () => new Date().toISOString();
export const money = (cents:number) => `¥${(cents/100).toLocaleString('zh-CN',{minimumFractionDigits:0,maximumFractionDigits:2})}`;
export const dateLabel = (date:string) => new Date(date).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
const ago=(days:number)=>new Date(Date.now()-days*86400000).toISOString();
export const customs = [
 {region:'浙江 · 杭州 · 萧山',title:'萧山地区习俗资料',status:'示例资料 · 待当地代理确认',required:['骨灰盒','寿衣','礼仪服务'],description:'本原型以“基础用品＋礼仪服务”为示例检查规则，不代表当地统一习俗。实际使用前，由当地代理确认必备项目和家庭差异。'},
 {region:'浙江 · 杭州 · 淳安',title:'淳安地区习俗资料',status:'示例资料 · 待当地代理确认',required:['骨灰盒','寿衣','礼仪服务'],description:'用于演示地区内容的调用与缺项提醒。具体礼序、用品及禁忌须由当地代理确认后录入。'}
];
export function seedState():AppState {
 const s:AppState={schema:1,session:{agencyId:'agency-a',staffId:'boss-a'},
 agencies:[{id:'agency-a',name:'示例服务机构',region:customs[0].region,contact:'林经理',phone:''},{id:'agency-b',name:'淳安致礼服务中心',region:customs[1].region,contact:'许经理',phone:'13800000002'}],
 staff:[{id:'boss-a',agencyId:'agency-a',name:'陈店长',role:'老板',canManageProducts:true},{id:'staff-lin',agencyId:'agency-a',name:'林晓',role:'业务员',canManageProducts:true},{id:'staff-zhou',agencyId:'agency-a',name:'周宁',role:'业务员',canManageProducts:false},{id:'boss-b',agencyId:'agency-b',name:'许店长',role:'老板',canManageProducts:true}],
 products:[
 {id:'p1',agencyId:'agency-a',name:'素雅实木骨灰盒',category:'骨灰盒',kind:'商品',source:'平台商品',price:168000,unit:'件',enabled:true,description:'素雅木纹，简洁器型，适合朴素庄重的送别方案。',masterId:'master-urn'},
 {id:'p2',agencyId:'agency-a',name:'安宁传统寿衣套装',category:'寿衣',kind:'商品',source:'平台商品',price:98000,unit:'套',enabled:true,description:'棉质面料，完整套装，规格可在谈单时确认。',masterId:'master-clothes'},
 {id:'p3',agencyId:'agency-a',name:'告别仪式基础服务',category:'礼仪服务',kind:'服务',source:'自有服务',price:120000,unit:'场',enabled:true,description:'仪式流程沟通、现场引导与基础礼仪协助。'},
 {id:'p4',agencyId:'agency-a',name:'素白追思花圈',category:'花圈',kind:'商品',source:'自有商品',price:38000,unit:'个',enabled:true,description:'白色菊花搭配绿叶，挽联内容由代理线下确认。'},
 {id:'p6',agencyId:'agency-a',name:'静雅鲜花布置',category:'灵堂布置',kind:'服务',source:'自有服务',price:150000,unit:'场',enabled:true,description:'素白色系基础布置，现场尺寸另行沟通。'},
 {id:'p7',agencyId:'agency-a',name:'雅致追思花篮',category:'花圈',kind:'商品',source:'平台商品',price:58000,unit:'个',enabled:true,description:'庄重雅致的白绿花材组合。',masterId:'master-flower'},
 {id:'p8',masterId:'master-urn-carved',agencyId:'agency-a',name:'典藏雕花骨灰盒',category:'骨灰盒',kind:'商品',source:'平台商品',price:368000,unit:'件',enabled:false,description:'暂不可提供，不参与新方案生成。'},
 {id:'b1',agencyId:'agency-b',name:'淳安素雅礼盒',category:'骨灰盒',kind:'商品',source:'自有商品',price:150000,unit:'件',enabled:true,description:'另一代理的示例商品。'},
 {id:'b2',agencyId:'agency-b',name:'淳安礼仪服务',category:'礼仪服务',kind:'服务',source:'自有服务',price:180000,unit:'场',enabled:true,description:'淳安地区示例服务。'}],
 masterProducts: seedMasterProducts(),
 customers:[
 {id:'c1',agencyId:'agency-a',ownerId:'staff-lin',name:'王先生',phone:'13800001001',region:customs[0].region,budget:680000,stage:'跟进中',note:'希望简约庄重，优先说明必要项目，预算控制在6,800元内。',createdAt:ago(0),followups:[{id:'f1',at:ago(0),staffId:'staff-lin',text:'已沟通初步需求，下午确认商品与服务明细。'}]},
 {id:'c2',agencyId:'agency-a',ownerId:'staff-zhou',name:'李女士',phone:'13800001002',region:customs[0].region,budget:880000,stage:'待跟进',note:'希望先了解套餐构成及告别仪式安排。',createdAt:ago(0),followups:[]},
 {id:'c3',agencyId:'agency-a',ownerId:'staff-lin',name:'张先生',phone:'13800001003',region:customs[0].region,budget:500000,stage:'已成交',note:'已确认基础方案，按约定安排。',createdAt:ago(2),dealtAt:ago(1),dealtBy:'staff-lin',followups:[{id:'f2',at:ago(1),staffId:'staff-lin',text:'客户已确认方案，人工记录成交。'}]},
 {id:'c4',agencyId:'agency-a',ownerId:'staff-zhou',name:'沈女士',phone:'13800001004',region:customs[0].region,budget:450000,stage:'跟进中',note:'需先核实寿衣款式和尺寸。',createdAt:ago(1),followups:[{id:'f3',at:ago(0),staffId:'staff-zhou',text:'等待家属确认款式和尺寸。'}]},
 {id:'c5',agencyId:'agency-a',ownerId:'staff-lin',name:'周先生',phone:'13800001005',region:customs[0].region,budget:600000,stage:'未成交',note:'暂未确定时间，后续再联系。',createdAt:ago(4),followups:[]},
 {id:'c6',agencyId:'agency-b',ownerId:'boss-b',name:'徐女士',phone:'13800001006',region:customs[1].region,budget:700000,stage:'待跟进',note:'淳安代理独立示例客户。',createdAt:ago(0),followups:[]}],proposals:[],quotes:[],notices:[{id:'notice-1',agencyId:'agency-a',name:'陈敬安',age:'82',date:'2026-09-25',ceremonyDate:'2026-09-30T09:00',location:'杭州安礼告别厅（示例）',text:'谨以此文寄托哀思。感谢各位亲友的关怀与陪伴。愿温暖的记忆长存心间。',status:'草稿',createdAt:ago(1)}],visits:[]};
 const lines=s.products.slice(0,3).map(p=>({productId:p.id,name:p.name,unit:p.unit,price:p.price,quantity:1,kind:p.kind}));
 s.proposals.push({id:'proposal-sample',agencyId:'agency-a',customerId:'c3',staffId:'staff-lin',region:customs[0].region,budget:500000,preference:'简约庄重',lines:structuredClone(lines),status:'已确认',warnings:[],createdAt:ago(2),updatedAt:ago(1),confirmedAt:ago(1)});
 s.quotes.push({id:'quote-sample',agencyId:'agency-a',customerId:'c3',proposalId:'proposal-sample',staffId:'staff-lin',number:'FW-202609-001',version:1,lines:structuredClone(lines),total:386000,createdAt:ago(1),customerName:'张先生',agencyName:s.agencies[0].name,phone:s.agencies[0].phone,region:customs[0].region,revoked:false,note:'示例报价 · 客户确认记录由业务员录入'});
 s.customers[2].service={phase:'后续关怀',dates:{},tasks:[{id:'service-demo-followup',title:'首次回访',date:localDate(),items:'与家属核对后续关怀需求和方便联系的时间。',message:'您好，如有需要补充的安排，可随时联系服务人员。具体回访时间以您方便为准。',status:'待确认',createdAt:now(),updatedAt:now()}]};
 s.agencies=s.agencies.map(a=>({...a,access:{enabled:true,loginPhone:a.phone,modules:MODULES.map(m=>m.key)}}));
 return addDemoFollowups(s);
}
export function visibleCustomers(s:AppState,staff:Staff) {if(!hasStaffModule(s,staff,'customers'))return [];return s.customers.filter(c=>c.agencyId===staff.agencyId&&(staff.role==='老板'||c.ownerId===staff.id));}
export function calculateTotal(lines:Line[]) {
 return lines.reduce((sum,l)=>{if(!Number.isSafeInteger(l.price)||l.price<0||!Number.isInteger(l.quantity)||l.quantity<1||l.quantity>999)throw new Error('请检查项目价格和数量');const next=sum+l.price*l.quantity;if(!Number.isSafeInteger(next)||next>1e12)throw new Error('金额超出允许范围');return next;},0);
}
/** An unlinked sale belongs to its creator; it does not imply a customer record. */
export function canAccessSalesRecord(s:AppState,staff:Staff,record:{agencyId:string;staffId:string;customerId?:string}){
 return hasStaffModule(s,staff,'talk')&&record.agencyId===staff.agencyId&&(record.customerId?visibleCustomers(s,staff).some(c=>c.id===record.customerId):staff.role==='老板'||record.staffId===staff.id);
}
export function consultationLabel(s:AppState,record:Consultation){
 return s.customers.find(c=>c.id===record.customerId)?.name||record.contact?.name||`谈单 ${new Date(record.createdAt).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})}`;
}
export function consultationRootId(s:AppState,record:Consultation):string{
 const seen=new Set<string>();let current=record;
 while(current.guided?.plan?.continuedFrom&&!seen.has(current.id)){
  seen.add(current.id);const previous=s.consultations?.find(c=>c.id===current.guided?.plan?.continuedFrom&&c.agencyId===current.agencyId);
  if(!previous)break;current=previous;
 }
 return current.id;
}
export const normalizePhone=(value:string)=>value.replace(/[\s-]/g,'').trim();
export function validateCustomerInput(input:{name:string;phone:string;region:string;source:string}){
 if(!input.name.trim())throw Error('请填写姓名');
 const phone=normalizePhone(input.phone);if(!/^\+?[0-9]{6,20}$/.test(phone))throw Error('请填写有效联系电话');
 if(!input.region.trim())throw Error('请填写服务地区');
 if(!input.source.trim())throw Error('请选择客户来源');
 return { ...input, name:input.name.trim(), phone, region:input.region.trim(), source:input.source.trim() };
}
export function recomputeProposalWarnings(s:AppState,p:Proposal){
 if(p.phaseOne)return p.budget>0&&calculateTotal(p.lines)>p.budget?['已选金额超出参考预算，请与家属确认取舍。']:[];
 const local=customs.find(x=>x.region===p.region);const required=local?.required||[];const warnings:string[]=[];
 if(!local)warnings.push('该地区未预置习俗，需由当地代理人工确认。');
 for(const category of required)if(!p.lines.some(line=>s.products.find(product=>product.id===line.productId)?.category===category))warnings.push(`缺少「${category}」，请补充商品或人工确认。`);
 if(calculateTotal(p.lines)>p.budget)warnings.push('当前基础项目已超预算，请与客户确认取舍，不自动省略必备项目。');
 return warnings;
}
export function generateDraft(s:AppState,c:Customer,staff:Staff,preference:string,deceasedId?:string):Proposal {
 if(!hasStaffModule(s,staff,'talk'))throw new Error('当前代理未开通AI谈单权限');
 if(!visibleCustomers(s,staff).some(x=>x.id===c.id))throw new Error('无权为该客户生成方案');
 if(deceasedId&&!s.customers.find(x=>x.id===c.id)?.deceased?.some(d=>d.id===deceasedId))throw Error('请选择该客户对应的逝者');
 const catalog=s.products.filter(p=>p.agencyId===c.agencyId&&isProductAvailable(s,p));
 const local=customs.find(x=>x.region===c.region);const warnings:string[]=[];
 const required=local?.required||['骨灰盒','礼仪服务'];const selected:typeof catalog=[];
 for(const cat of required){const p=catalog.filter(x=>x.category===cat).sort((a,b)=>a.price-b.price)[0];if(p)selected.push(p);else warnings.push(`缺少「${cat}」，请补充商品或人工确认。`);}
 const optional=catalog.filter(x=>!selected.includes(x)&&x.category==='花圈');
 for(const p of optional){if(selected.reduce((sum,x)=>sum+x.price,0)+p.price<=c.budget)selected.push(p);}
 const lines=selected.map(p=>({productId:p.id,name:p.name,unit:p.unit,price:p.price,quantity:1,kind:p.kind}));
 const proposal={serviceId:deceasedId?`${c.id}:${deceasedId}`:undefined,deceasedId,id:id('proposal'),agencyId:c.agencyId,customerId:c.id,staffId:staff.id,region:c.region,budget:c.budget,preference,lines,status:'待客户确认' as const,warnings,createdAt:now(),updatedAt:now()};
 return {...proposal,warnings:recomputeProposalWarnings(s,proposal)};
}
export function finalizeQuote(s:AppState,proposalId:string,staff:Staff,confirmed:boolean):{state:AppState;quote:Quote} {
 if(!hasStaffModule(s,staff,'talk'))throw new Error('当前代理未开通AI谈单权限');
 if(!confirmed)throw new Error('请先与客户确认方案并勾选确认记录');
 const p=s.proposals.find(x=>x.id===proposalId);
 if(!p||!canAccessSalesRecord(s,staff,p))throw new Error('无权限生成该报价');
 if(s.quotes.some(q=>q.proposalId===p.id&&q.receipt))throw new Error('此谈单已有收款登记，报价变更请先线下核对处理');
 const previous=s.quotes.filter(q=>q.proposalId===p.id).sort((a,b)=>b.version-a.version)[0];
 if(p.status==='已确认'&&previous&&!previous.revoked)return {state:s,quote:previous};
 if(previous&&serviceHasPayments(s,previous))throw Error('本次服务已有收款登记，报价变更请先线下核对处理');
 const currentProposal={...p,warnings:recomputeProposalWarnings(s,p)};
 if(!currentProposal.lines.length)throw new Error('至少保留一个商品或服务项目');
 for(const l of currentProposal.lines){if(!s.products.some(x=>x.id===l.productId&&x.agencyId===currentProposal.agencyId&&isProductAvailable(s,x)))throw new Error('方案含不可提供的项目，请重新选择');}
 const c=s.customers.find(x=>x.id===p.customerId); const talk=s.consultations?.find(t=>t.id===p.consultationId); const a=s.agencies.find(x=>x.id===p.agencyId)!;
 if(p.deceasedId&&(!c?.deceased?.some(d=>d.id===p.deceasedId)||p.serviceId!==`${c?.id}:${p.deceasedId}`))throw Error('报价服务对象不一致，请重新谈单');
 const quote:Quote={revisionOf:p.revisionOf,phaseOne:p.phaseOne,subjectName:p.subjectName,deceasedName:c?.deceased?.find(d=>d.id===currentProposal.deceasedId)?.name,serviceId:currentProposal.serviceId,deceasedId:currentProposal.deceasedId,id:id('quote'),agencyId:currentProposal.agencyId,customerId:c?.id,proposalId:currentProposal.id,staffId:staff.id,number:previous?.number||`FW-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${String(s.quotes.length+1).padStart(3,'0')}`,version:(previous?.version||0)+1,lines:structuredClone(currentProposal.lines),total:calculateTotal(currentProposal.lines),createdAt:now(),customerName:c?.name||talk?.contact?.name||'未留称呼',agencyName:a.name,agencyLogo:a.logo,phone:a.phone,region:currentProposal.region,revoked:false,note:'客户已确认当前方案，由业务员记录。此报价不代表已付款。'};
 let next:AppState={...s,proposals:s.proposals.map(x=>x.id===p.id?{...currentProposal,status:'已确认',confirmedAt:now()}:x),quotes:[...s.quotes,quote]};
 // Saving a quotation preserves the manually recorded deal and service stages.
 return {state:next,quote};
}
export function metrics(s:AppState,agencyId:string,period:'today'|'month'|'all'='all'){
 const start=new Date();if(period==='today')start.setHours(0,0,0,0);else if(period==='month'){start.setDate(1);start.setHours(0,0,0,0);}else start.setTime(0);
 const inPeriod=(v:string)=>new Date(v)>=start&&new Date(v)<=new Date();
 const customers=s.customers.filter(c=>c.agencyId===agencyId);const proposals=s.proposals.filter(p=>p.agencyId===agencyId&&inPeriod(p.createdAt));const quotes=s.quotes.filter(q=>q.agencyId===agencyId&&!q.revoked&&inPeriod(q.createdAt));
 return {customers:customers.length,newCustomers:customers.filter(c=>inPeriod(c.createdAt)).length,proposalCustomers:new Set(proposals.map(p=>p.customerId).filter(Boolean)).size,quoteCustomers:new Set(quotes.map(q=>q.customerId).filter(Boolean)).size,quotes:new Set(quotes.map(q=>q.number)).size,followups:customers.filter(c=>c.followups.some(f=>inPeriod(f.at))).length,deals:customers.flatMap(dealRecords).filter(d=>inPeriod(d.at)).length,visits:s.visits.filter(v=>v.agencyId===agencyId&&v.type==='浏览'&&inPeriod(v.at)).length,contacts:s.visits.filter(v=>v.agencyId===agencyId&&v.type!=='浏览'&&inPeriod(v.at)).length};
}

export function seedMasterProducts():MasterProduct[] {
 const at=now();
 return [
 {id:'master-urn',sku:'FW-GH-001',name:'素雅实木骨灰盒',category:'骨灰盒',kind:'商品',price:168000,unit:'件',spec:'标准款 · 原木色',description:'素雅木纹，简洁器型，适合朴素庄重的送别方案。',status:'已发布',updatedAt:at},
 {id:'master-clothes',sku:'FW-SY-001',name:'安宁传统寿衣套装',category:'寿衣',kind:'商品',price:98000,unit:'套',spec:'传统款 · 棉质',description:'棉质面料，完整套装，规格需在谈单时确认。',status:'已发布',updatedAt:at},
 {id:'master-flower',sku:'FW-HQ-001',name:'雅致追思花篮',category:'花圈',kind:'商品',price:58000,unit:'个',spec:'白绿花材 · 基础款',description:'庄重雅致的白绿花材组合，花材以当地实际供应为准。',status:'已发布',updatedAt:at},
 {id:'master-clothes-basic',sku:'FW-SY-002',name:'素朴寿衣基础套装',category:'寿衣',kind:'商品',price:68000,unit:'套',spec:'基础款 · 素色',description:'基础寿衣与配套用品。',status:'已发布',updatedAt:at},
 {id:'master-urn-carved',sku:'FW-GH-002',name:'典藏雕花骨灰盒',category:'骨灰盒',kind:'商品',price:368000,unit:'件',spec:'雕花款',description:'资料待补充，暂不供代理选用。',status:'草稿',updatedAt:at},
 {id:'master-flower-seasonal',sku:'FW-HQ-002',name:'时令鲜花礼篮',category:'花圈',kind:'商品',price:88000,unit:'个',spec:'时令花材',description:'已下架示例。',status:'已下架',updatedAt:at}
 ];
}
export function migrateState(s:AppState):AppState {
 // Upgrade retired demo branding without replacing user-entered institution details or quote lines.
 const demo=s.agencies.find(a=>a.id==='agency-a');
 const demoName=demo&&(!demo.name.trim()||demo.name.trim()==='格优')?'示例服务机构':demo?.name;
 s={...s,agencies:s.agencies.map(a=>a.id==='agency-a'&&demoName?{...a,name:demoName}:a),products:s.products.map(p=>(p.source as string)==='格优商品'?{...p,source:'平台商品'}:p),quotes:s.quotes.map(q=>q.agencyId==='agency-a'&&(q.agencyName==='格优'||q.id==='quote-sample'&&!q.agencyName)?{...q,agencyName:demoName||'示例服务机构'}:q)};

 // Remove only the retired sample values, preserving user-entered business details.
 const oldName='杭州安礼生命礼仪', oldPhone='13800000001';
 s={...s,agencies:s.agencies.map(a=>({...a,name:a.name===oldName?'':a.name,phone:a.phone===oldPhone?'':a.phone,access:a.access?{...a.access,loginPhone:a.access.loginPhone===oldPhone&&!s.staff.some(st=>st.agencyId===a.id&&st.role==='老板'&&st.credential)?'':a.access.loginPhone}:a.access})),quotes:s.quotes.map(q=>({...q,agencyName:q.agencyName===oldName?'':q.agencyName,phone:q.phone===oldPhone?'':q.phone}))};
 s=addDemoFollowups(s);
 s={...s,agencies:s.agencies.map(a=>a.access?a:{...a,access:{enabled:true,loginPhone:a.phone,modules:MODULES.map(m=>m.key)}})};
 if(Array.isArray(s.masterProducts))return s;
 const masters=seedMasterProducts();
 // Preserve already adopted legacy directory items as independent platform records.
 for(const p of s.products){if(p.masterId&&!masters.some(m=>m.id===p.masterId))masters.push({id:p.masterId,sku:`LEGACY-${masters.length+1}`,name:p.name,category:p.category,kind:p.kind,price:p.price,unit:p.unit,spec:p.spec||'历史示例资料',description:p.description,image:p.image,status:'已发布',updatedAt:now()});}
 return {...s,masterProducts:masters,products:s.products.map(p=>p.id==='p8'&&!p.masterId?{...p,masterId:'master-urn-carved'}:p)};
}
export function isStoreProduct(p:Pick<Product,'category'>){return !/接运|遗体运输|遗体运送/.test(p.category);}
export function isProductAvailable(s:AppState,p:Product){return isStoreProduct(p)&&p.enabled&&(!p.masterId||s.masterProducts.some(m=>m.id===p.masterId&&m.status==='已发布'));}
function validateMaster(s:AppState,m:MasterProduct,publish:boolean){
 if(!isStoreProduct(m))throw new Error('接运由殡仪馆办理，不属于本店商品或服务');
 if(!m.name.trim())throw new Error('请填写商品名称');
 if(m.sku.trim()&&s.masterProducts.some(x=>x.id!==m.id&&x.sku.toLowerCase()===m.sku.trim().toLowerCase()))throw new Error('商品编码已存在，请使用唯一编码');
 if(!Number.isSafeInteger(m.price)||m.price<0||m.price>100000000)throw new Error('请填写有效的非负价格（最高1,000,000元）');
 if(publish&&(!m.sku.trim()||!m.category.trim()||!m.unit.trim()||!m.spec.trim()||!m.description.trim()||!m.image))throw new Error('发布前请补齐编码、分类、规格、单位、描述和商品图片');
 if(m.image&&!/^data:image\/(png|jpeg|webp);base64,/.test(m.image))throw new Error('图片格式无效，请上传 PNG、JPEG 或 WebP');
}
export function saveMasterProduct(s:AppState,m:MasterProduct,publish:boolean):AppState {
 validateMaster(s,m,publish);
 const next={...m,name:m.name.trim(),sku:m.sku.trim(),status:publish?'已发布' as const:'草稿' as const,updatedAt:now()};
 return {...s,masterProducts:s.masterProducts.some(p=>p.id===m.id)?s.masterProducts.map(p=>p.id===m.id?next:p):[next,...s.masterProducts],products:s.products.map(p=>p.masterId===m.id?{...p,name:next.name,category:next.category,kind:next.kind,unit:next.unit,description:next.description,spec:next.spec,image:next.image,elements:next.elements,recommendationNote:next.recommendationNote,enabled:publish?p.enabled:false}:p)};
}
export function setMasterStatus(s:AppState,masterId:string,status:'已发布'|'已下架'):AppState {
 const m=s.masterProducts.find(p=>p.id===masterId);if(!m)throw new Error('商品不存在');
 if(status==='已发布')return saveMasterProduct(s,m,true);
 return {...s,masterProducts:s.masterProducts.map(p=>p.id===masterId?{...p,status,updatedAt:now()}:p),products:s.products.map(p=>p.masterId===masterId?{...p,enabled:false}:p)};
}
export function adoptMasterProduct(s:AppState,masterId:string,staff:Staff):AppState {
 if(!hasStaffModule(s,staff,'catalog'))throw new Error('当前代理未开通商品功能');
 if(!staff.canManageProducts)throw new Error('当前账号没有商品维护权限');
 const m=s.masterProducts.find(p=>p.id===masterId&&p.status==='已发布'&&isStoreProduct(p));if(!m)throw new Error('该商品未发布或已下架，不能选用');
 if(s.products.some(p=>p.agencyId===staff.agencyId&&p.masterId===masterId))throw new Error('该商品已选用，请在本店商品中管理');
 const product:Product={id:id('product'),agencyId:staff.agencyId,masterId:m.id,name:m.name,category:m.category,kind:m.kind,source:'平台商品',price:m.price,unit:m.unit,enabled:true,description:m.description,spec:m.spec,image:m.image,elements:m.elements,recommendationNote:m.recommendationNote};
 return {...s,products:[...s.products,product]};
}

export const MODULES:{key:ModuleKey;label:string}[]=[{key:'customers',label:'客户管理'},{key:'talk',label:'AI谈单与报价'},{key:'catalog',label:'商品与服务'},{key:'dashboard',label:'本店经营看板'},{key:'content',label:'讣告与花圈'},{key:'restoration',label:'遗像修复'}];
export function hasModule(s:AppState,agencyId:string,key:ModuleKey){const a=s.agencies.find(a=>a.id===agencyId);return !!a&&a.access?.enabled!==false&&(!a.access||a.access.modules.includes(key));}
export function saveAgencyAccess(s:AppState,input:{id?:string;name:string;contact:string;phone:string;region:string;enabled:boolean;modules:ModuleKey[]}):AppState {
 const name=input.name.trim(),phone=input.phone.trim(),contact=input.contact.trim(),region=input.region.trim();
 if(!name||!contact||!region)throw new Error('请补齐代理名称、负责人和地区');
 if(!/^1\d{10}$/.test(phone))throw new Error('请填写11位登录手机号');
 if(s.agencies.some(a=>a.id!==input.id&&(a.access?.loginPhone||a.phone)===phone)||s.staff.some(st=>st.phone===phone&&!(st.agencyId===input.id&&st.role==='老板')))throw new Error('登录手机号已开通，请检查是否重复');
 if(input.id&&!s.agencies.some(a=>a.id===input.id))throw new Error('代理账号不存在');
 const modules=[...new Set(input.modules)];
 if(!modules.length||modules.some(k=>!MODULES.some(m=>m.key===k)))throw new Error('请至少选择一项有效功能');
 if((modules.includes('content')||modules.includes('restoration'))&&!modules.includes('customers'))throw Error('讣告与遗照修复需同时开通客户管理');
 if(modules.includes('talk')&&(!modules.includes('customers')||!modules.includes('catalog')))throw new Error('AI谈单需要同时开通客户管理和商品与服务');
 if(modules.includes('dashboard')&&!modules.includes('customers'))throw new Error('本店经营看板需要同时开通客户管理');
 const agencyId=input.id||id('agency');
 const access={enabled:input.enabled,loginPhone:phone,modules};
 if(input.id)return {...s,agencies:s.agencies.map(a=>a.id===input.id?{...a,name,contact,region,access}:a),staff:s.staff.map(st=>st.agencyId===input.id&&st.role==='老板'?{...st,phone}:st)};
 return {...s,agencies:[...s.agencies,{id:agencyId,name,contact,phone,region,access}],staff:[...s.staff,{id:id('boss'),agencyId,name:contact,phone,role:'老板',canManageProducts:true}]};
}

export const STAFF_MODULES=MODULES.filter(m=>m.key!=='dashboard');
export function hasStaffModule(s:AppState,staff:Staff,key:ModuleKey){
 if((key==='content'||key==='restoration')&&!hasStaffModule(s,staff,'customers'))return false;
 const current=s.staff.find(st=>st.id===staff.id&&st.agencyId===staff.agencyId);
 return !!current&&current.enabled!==false&&hasModule(s,current.agencyId,key)&&(current.role==='老板'||(key!=='dashboard'&&(!current.modules||current.modules.includes(key))));
}
export function saveStaffAccount(s:AppState,actor:Staff,input:{id?:string;name:string;phone:string;enabled:boolean;modules:ModuleKey[];canManageProducts:boolean}):AppState {
 const boss=s.staff.find(st=>st.id===actor.id&&st.agencyId===actor.agencyId);
 const agency=s.agencies.find(a=>a.id===actor.agencyId);
 if(!boss||boss.role!=='老板'||boss.enabled===false||agency?.access?.enabled===false)throw new Error('仅启用的本店老板可以管理子账号');
 const previous=input.id?s.staff.find(st=>st.id===input.id):undefined;
 if(input.id&&(!previous||previous.agencyId!==boss.agencyId||previous.role==='老板'))throw new Error('只能管理本店业务员子账号');
 const name=input.name.trim(),phone=input.phone.trim();
 if(!name||!/^1\d{10}$/.test(phone))throw new Error('请填写成员姓名和11位登录手机号');
 if(s.staff.some(st=>st.id!==input.id&&st.phone===phone)||s.agencies.some(a=>(a.access?.loginPhone||a.phone)===phone))throw new Error('该登录手机号已被使用');
 const modules=[...new Set(input.modules)];
 if(!modules.length||modules.some(k=>!STAFF_MODULES.some(m=>m.key===k)||!hasModule(s,boss.agencyId,k)))throw new Error('只能授权平台已为本店开通的功能，请至少选择一项');
 if((modules.includes('content')||modules.includes('restoration'))&&!modules.includes('customers'))throw Error('讣告与遗照修复需同时开通客户管理');
 if(modules.includes('talk')&&(!modules.includes('customers')||!modules.includes('catalog')))throw new Error('AI谈单需同时授权客户管理和商品与服务');
 if(input.canManageProducts&&!modules.includes('catalog'))throw new Error('维护商品需同时授权商品与服务');
 const member:Staff={...previous,id:previous?.id||id('staff'),agencyId:boss.agencyId,name,phone,enabled:input.enabled,modules,canManageProducts:input.canManageProducts,role:'业务员'};
 return {...s,staff:previous?s.staff.map(st=>st.id===previous.id?member:st):[...s.staff,member]};
}
export function setStaffEnabled(s:AppState,actor:Staff,staffId:string,enabled:boolean):AppState{
 const boss=s.staff.find(st=>st.id===actor.id&&st.agencyId===actor.agencyId),member=s.staff.find(st=>st.id===staffId);
 if(!boss||boss.role!=='老板'||boss.enabled===false||s.agencies.find(a=>a.id===boss.agencyId)?.access?.enabled===false)throw new Error('仅启用的本店老板可以管理子账号');
 if(!member||member.agencyId!==boss.agencyId||member.role==='老板')throw new Error('只能管理本店业务员子账号');
 return {...s,staff:s.staff.map(st=>st.id===staffId?{...st,enabled}:st)};
}

export const SERVICE_PHASES:ServicePhase[]=['接洽登记','治丧筹备','告别仪式','安葬安置','后续关怀','服务结束'];
export const localDate=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const validServiceDate=(date:string)=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&localDate(new Date(`${date}T12:00:00`))===date;
function serviceCustomer(s:AppState,cid:string,staff:Staff){const c=visibleCustomers(s,staff).find(c=>c.id===cid);if(!c)throw new Error('无权限管理该客户的服务安排');return c;}
export function serviceRecordFor(c:Customer,deceasedId?:string):ServiceRecord {
 if(deceasedId&&!c.deceased?.some(d=>d.id===deceasedId))throw Error('逝者不存在或不属于该客户');
 return (deceasedId?c.deceased!.find(d=>d.id===deceasedId)!.service:c.service)||{phase:'接洽登记',dates:{},tasks:[]};
}
function applyService(s:AppState,c:Customer,staff:Staff,service:ServiceRecord,text:string,deceasedId?:string):AppState {
 return {...s,customers:s.customers.map(x=>x.id===c.id?{...x,...(deceasedId?{deceased:x.deceased!.map(d=>d.id===deceasedId?{...d,service}:d)}:{service}),followups:[...x.followups,{id:id('follow'),at:now(),staffId:staff.id,text:`${deceasedId?`${x.deceased!.find(d=>d.id===deceasedId)!.name} · `:''}${text}`}]}:x)};
}
export function setServiceDeal(s:AppState,cid:string,deceasedId:string,staff:Staff,stage:Stage):AppState {
 const c=serviceCustomer(s,cid,staff),prev=serviceRecordFor(c,deceasedId);
 if(!['待跟进','跟进中','已成交','未成交'].includes(stage))throw Error('请选择有效成交状态');
 if(stage!=='已成交'&&prev.phase!=='接洽登记')throw Error('请先将本次服务退回接洽登记并说明原因，再调整成交状态');
 if(prev.dealStage===stage)return s;
 return applyService(s,c,staff,{...prev,dealStage:stage,dealtAt:stage==='已成交'?now():undefined,dealtBy:stage==='已成交'?staff.id:undefined},`本次服务成交状态更新为${stage}`,deceasedId);
}
export function setCustomerDeal(s:AppState,cid:string,staff:Staff,stage:Stage):AppState {
 const c=serviceCustomer(s,cid,staff);
 if(c.deceased?.length)throw Error('该客户有逝者档案，请按本次服务分别更新成交状态');
 if(!['待跟进','跟进中','已成交','未成交'].includes(stage))throw Error('请选择有效成交状态');
 if(stage!=='已成交'&&(c.service?.phase||'接洽登记')!=='接洽登记')throw Error('请先将服务退回接洽登记并说明原因，再调整成交状态');
 if(c.stage===stage)return s;
 const at=stage==='已成交'?now():undefined;
 return {...s,customers:s.customers.map(x=>x.id===c.id?{...x,stage,dealtAt:at,dealtBy:stage==='已成交'?staff.id:undefined,followups:[...x.followups,{id:id('follow'),at:now(),staffId:staff.id,text:`客户成交状态更新为${stage}`}]}:x)};
}
export function customerDealLabel(c:Customer):string {
 if(!c.deceased?.length)return c.stage;
 const deals=c.deceased.filter(d=>d.service?.dealStage==='已成交').length;
 return deals?`${deals}/${c.deceased.length}项服务已成交`:'服务尚未成交';
}
export function dealRecords(c:Customer){
 return [...(c.stage==='已成交'&&c.dealtAt?[{name:'历史未关联成交',at:c.dealtAt,by:c.dealtBy,deceasedId:undefined as string|undefined}]:[]),...(c.deceased||[]).filter(d=>d.service?.dealStage==='已成交'&&d.service.dealtAt).map(d=>({name:d.name,at:d.service!.dealtAt!,by:d.service!.dealtBy,deceasedId:d.id}))];
}
export function updateServiceInfo(s:AppState,cid:string,staff:Staff,input:{phase?:ServicePhase;dates?:ServiceRecord['dates'];transitionReason?:string},deceasedId?:string):AppState{
 const c=serviceCustomer(s,cid,staff),prev=serviceRecordFor(c,deceasedId);
 if(input.phase&&input.phase!==prev.phase&&input.phase!=='接洽登记'&&(deceasedId?prev.dealStage:c.stage)!=='已成交')throw new Error('请先确认本次服务已成交，再推进服务阶段；无需先登记收款');
 if(input.phase&&!SERVICE_PHASES.includes(input.phase))throw new Error('请选择有效服务阶段');
 if(input.dates&&Object.values(input.dates).some(d=>d&&!validServiceDate(d)))throw new Error('请填写有效的公历日期');
 if(input.phase==='服务结束'&&prev.tasks.some(t=>t.needsReview||(t.status!=='已完成'&&t.status!=='已取消')))throw new Error('仍有未完成事项，请先完成或取消后再结束服务');
 if(input.phase&&input.phase!==prev.phase&&SERVICE_PHASES.indexOf(input.phase)!==SERVICE_PHASES.indexOf(prev.phase)+1&&!input.transitionReason?.trim())throw Error('跨阶段或回退请填写调整原因');
 let next:ServiceRecord={...prev,phase:input.phase||prev.phase,dates:{...prev.dates,...input.dates}};
 const changed=!!input.dates&&Object.keys(input.dates).some(k=>prev.dates[k as keyof ServiceRecord['dates']]!==input.dates![k as keyof ServiceRecord['dates']]);
 const farewellChanged=!!input.dates&&Object.prototype.hasOwnProperty.call(input.dates,'farewell')&&prev.dates.farewell!==input.dates.farewell;
 if(changed && Object.keys(input.dates||{}).some(k=>prev.dates[k as keyof ServiceRecord['dates']]&&prev.dates[k as keyof ServiceRecord['dates']]!==input.dates![k as keyof ServiceRecord['dates']])){
  const reason=`关键日期已调整${farewellChanged?`：告别日期 ${prev.dates.farewell||'未定'} → ${next.dates.farewell||'待定'}`:''}，请核对原安排日期、内容及已分享信息。`;
  next={...next,tasks:prev.tasks.map(t=>t.status==='已取消'||t.autoKey==='verify-profile'||t.autoKey==='prepare-portrait'?t:{...t,needsReview:reason})};
  if(farewellChanged&&deceasedId)s={...s,notices:s.notices.map(n=>n.customerId===cid&&n.deceasedId===deceasedId&&n.status==='已发布'?{...n,scheduleReview:reason}:n)};
 }
 if(deceasedId)next=reconcileService(s,c,deceasedId,next);
 return applyService(s,c,staff,next,input.phase?`服务阶段更新为${input.phase}${input.transitionReason?.trim()?`；原因：${input.transitionReason.trim()}`:''}${changed?'；日期变更需核对关联安排':''}`:'服务关键日期已更新；相关事项时间需人工核对',deceasedId);
}
export const validReminderTime=(value:string)=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)&&validServiceDate(value.slice(0,10))&&Number(value.slice(11,13))<24&&Number(value.slice(14,16))<60;
export function serviceTaskDateLabel(task:ServiceTask){return task.remindAt?task.remindAt.replace('T',' '):task.date;}
export function saveServiceTask(s:AppState,cid:string,staff:Staff,input:{id?:string;title:string;date:string;items:string;message:string;internal?:boolean;assigneeId?:string;remindAt?:string;receptionSource?:ServiceTask['receptionSource']},deceasedId?:string):AppState{
 const c=serviceCustomer(s,cid,staff),prev=serviceRecordFor(c,deceasedId),old=input.id?prev.tasks.find(t=>t.id===input.id):undefined;
 if(input.id&&!old)throw new Error('服务事项不存在');
 if(old?.flowStageId)throw Error('请在丧事流程中调整该环节');
 if(!input.title.trim()||!input.items.trim()||!input.message.trim()||!validServiceDate(input.date))throw new Error('请补齐事项名称、有效日期、事项安排和给家属的消息');
 if(old&&(old.status==='已完成'||old.status==='已取消'))throw new Error('已结束事项不能修改，请新建后续安排');
 if(prev.phase==='服务结束')throw new Error('请先恢复服务阶段，再添加后续安排');
 const assigneeId=input.assigneeId??old?.assigneeId,remindAt=input.remindAt??(old?.remindAt?`${input.date}T${old.remindAt.slice(11)}`:undefined);
 if(assigneeId&&!s.staff.some(member=>member.id===assigneeId&&member.enabled!==false&&visibleCustomers(s,member).some(customer=>customer.id===cid)))throw Error('负责人无权限访问该客户');
 if(remindAt&&(!validReminderTime(remindAt)||remindAt.slice(0,10)!==input.date))throw Error('请填写有效提醒时间');
 const task:ServiceTask={assigneeId,remindAt,receptionSource:old?.receptionSource||input.receptionSource,deceasedId,autoKey:old?.autoKey,internal:old?.receptionSource||input.receptionSource?true:old?.autoKey?old.internal:(input.internal??old?.internal),noticeId:old?.noticeId,id:old?.id||id('service'),title:input.title.trim(),date:input.date,items:input.items.trim(),message:input.message.trim(),status:'待确认',createdAt:old?.createdAt||now(),updatedAt:now()};
 return applyService(s,c,staff,{...prev,tasks:old?prev.tasks.map(t=>t.id===old.id?task:t):[...prev.tasks,task]},`${old?'调整':'新增'}服务事项：${task.title}（${task.date}），待业务员确认`,deceasedId);
}
export function setServiceTaskStatus(s:AppState,cid:string,taskId:string,staff:Staff,status:ServiceTask['status'],deceasedId?:string):AppState{
 const c=serviceCustomer(s,cid,staff),prev=serviceRecordFor(c,deceasedId),task=prev.tasks.find(t=>t.id===taskId);if(!task)throw new Error('服务事项不存在');
 if(task.flowStageId)throw Error('请在丧事流程中更新该环节');
 if(task.status===status)return s;
 if(task.needsReview&&status!=='已取消')throw Error('请先核对日期变更');
 if(task.internal&&status!=='已取消'){
  if(task.autoKey&&task.autoKey!=='verify-profile')throw Error('请完成对应操作，系统将同步待办状态');
  if(status!=='已完成'||task.status!=='待确认')throw Error('内部事项仅可确认完成或取消');
  return applyService(s,c,staff,{...prev,tasks:prev.tasks.map(t=>t.id===taskId?{...t,status,completedAt:now(),updatedAt:now()}:t)},`${task.title}：已确认完成`,deceasedId);
 }
 const transitions:Record<ServiceTask['status'],ServiceTask['status'][]>= {'待确认':['待发送','已取消'],'待发送':['已发送','已取消'],'已发送':['已完成','已取消'],'已完成':[],'已取消':[]};
 const manualCompletion=status==='已完成'&&!['已完成','已取消'].includes(task.status);
 if(!manualCompletion&&!transitions[task.status].includes(status))throw new Error(['已完成','已取消'].includes(task.status)?'已结束事项不能再次处理':'请先确认安排，再按顺序记录发送');
 const next={...task,status,needsReview:status==='已取消'?undefined:task.needsReview,updatedAt:now(),...(status==='已发送'?{sentAt:now()}:{}),...(status==='已完成'?{completedAt:now()}:{})};
 return applyService(s,c,staff,{...prev,tasks:prev.tasks.map(t=>t.id===taskId?next:t)},`${task.title}：${status==='已发送'?'业务员人工记录已发送':status==='已完成'?'业务员人工确认完成':status}`,deceasedId);
}
export function serviceTaskTiming(task:ServiceTask,at=new Date()):'已逾期'|'今日到期'|'待办'|'已结束'{if(task.status==='已完成'||task.status==='已取消')return '已结束';if(!task.date)return '待办';const today=localDate(at);if(task.date<today)return '已逾期';if(task.date!==today)return '待办';return task.remindAt&&validReminderTime(task.remindAt)&&new Date(task.remindAt).getTime()>at.getTime()?'待办':'今日到期';}
export function serviceAgenda(s:AppState,staff:Staff){return visibleCustomers(s,staff).flatMap(c=>[
 ...(c.service?.tasks||[]).map(task=>({customer:c,task,deceased:undefined as NonNullable<Customer['deceased']>[number]|undefined,service:c.service!})),
 ...(c.deceased||[]).flatMap(deceased=>(deceased.service?.tasks||[]).map(task=>({customer:c,task,deceased,service:deceased.service!})))
 ]).filter(({task})=>!task.assigneeId||staff.role==='老板'||task.assigneeId===staff.id).sort((a,b)=>(a.task.remindAt||a.task.date||'9999').localeCompare(b.task.remindAt||b.task.date||'9999'));}
export function acknowledgeServiceReview(s:AppState,cid:string,staff:Staff,taskId:string,deceasedId?:string):AppState {
 const c=serviceCustomer(s,cid,staff),prev=serviceRecordFor(c,deceasedId),task=prev.tasks.find(t=>t.id===taskId);if(!task)throw Error('服务事项不存在');
 return applyService(s,c,staff,{...prev,tasks:prev.tasks.map(t=>t.id===taskId?{...t,needsReview:undefined,updatedAt:now()}:t)},`${task.title}：已人工核对日期变更，保留当前安排`,deceasedId);
}


// Explicit prototype fixtures; applied once without replacing existing customer or task data.
export function addDemoFollowups(s:AppState):AppState {
 if(s.demoFollowupsVersion===1)return s;
 if(!s.agencies.some(a=>a.id==='agency-a')||!s.staff.some(p=>p.id==='boss-a'&&p.agencyId==='agency-a'))return {...s,demoFollowupsVersion:1};
 const date=(offset:number)=>{const d=new Date();d.setDate(d.getDate()+offset);return localDate(d)};
 const task=(key:string,title:string,offset:number,status:ServiceTask['status'],items:string):ServiceTask=>({id:`demo-task-${key}`,title,date:date(offset),status,items,message:`您好，${items}具体安排以您确认的时间和当地习俗为准。`,createdAt:ago(3),updatedAt:now(),...(status==='已发送'||status==='已完成'?{sentAt:ago(1)}:{}),...(status==='已完成'?{completedAt:ago(1)}:{})});
 const base={agencyId:'agency-a',ownerId:'boss-a',region:customs[0].region,budget:680000,stage:'跟进中' as const,createdAt:ago(3),followups:[]};
 const fixtures:Customer[]=[
  {...base,id:'demo-c-prep',name:'许先生（示例）',phone:'13800002001',note:'模拟客户：需要灵堂布置，请先确认场地与家属意见。',service:{phase:'治丧筹备',dates:{},tasks:[task('layout','确认灵堂布置方案',-1,'待发送','请核对灵堂布置方案、场地尺寸和花材色系。'),task('portrait','核对遗像照片',0,'待确认','请家属提供清晰照片并确认遗像用照。')]}},
  {...base,id:'demo-c-ceremony',name:'刘女士（示例）',phone:'13800002002',note:'模拟客户：告别仪式流程已初步沟通，待确认亲友到场安排。',service:{phase:'告别仪式',dates:{farewell:date(1)},tasks:[task('arrival','告别仪式到场提醒',1,'已发送','请核对明日告别仪式的到场时间、地点及注意事项。'),task('ceremony-check','核对告别仪式流程',-1,'已完成','告别仪式流程、主持与家属发言安排已核对。')]}},
  {...base,id:'demo-c-care',name:'陈女士（示例）',phone:'13800002003',note:'模拟客户：已进入后续关怀，纪念节点日期由家属人工核定。',service:{phase:'后续关怀',dates:{},tasks:[task('memorial','百日纪念安排',7,'待确认','请与家属确认纪念日期、参加人员和具体事项。'),task('care','首次关怀回访',-2,'已完成','已回访家属，确认后续联系意愿与需要协助的事项。')]}}
 ];
 return {...s,demoFollowupsVersion:1,customers:[...s.customers,...fixtures.filter(c=>!s.customers.some(x=>x.id===c.id))]};
}
