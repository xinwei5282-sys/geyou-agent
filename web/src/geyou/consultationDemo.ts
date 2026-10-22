import type { AppState, Consultation, Customer, Line, Product } from './types';
import type { ConsultationPlan } from './packageTypes';
import { generatePackages } from './packageModel';
import { hasStaffModule, localDate, isStoreProduct } from './model';

export const CONSULTATION_DEMO_CASES = [
 {id:'advance',title:'提前了解',summary:'暂未确定时间，先讲完整流程；可看商品，也可只保存沟通。',sessionId:'demo-talk-advance'},
 {id:'hospital',title:'医院只买寿衣',summary:'比较三款寿衣，选定后确认；其他服务不自动加入。',sessionId:'demo-talk-hospital'},
 {id:'closed',title:'买完暂无后续',summary:'寿衣已确认，本次沟通结束；保留客户，以后仍可续谈。',sessionId:'demo-talk-closed'},
 {id:'return',title:'医院回来续谈',summary:'此前寿衣已购买，本轮只谈骨灰盒、告别仪式和花圈。',sessionId:'demo-talk-return'},
 {id:'home',title:'居家多项选择',summary:'结合预算比较三档组合，换款、调整数量后确认本次清单。',sessionId:'demo-talk-home'},
 {id:'paused',title:'暂停后继续',summary:'保留上次已选商品，接着核对；约定下次联系可添加待办。',sessionId:'demo-talk-paused'},
] as const;

const product=(id:string,name:string,category:string,price:number,spec:string,included:string,extra:Partial<Product>={}):Product=>({
 id:`demo-product-${id}`,agencyId:'agency-a',name,category,kind:'服务',source:'自有服务',price:price*100,unit:'场',enabled:true,spec,included,
 description:included,exclusions:'原型示例报价。具体规格、服务范围和时间以沟通确认为准；未列项目另行商议。',code:`DEMO-${id}`,...extra,
});
const DEMO_PRODUCTS:Product[]=[
 product('clothes-basic','素朴寿衣基础套装','寿衣',680,'米色 · 棉质 · 简约款','上衣、长裤、配套内衣、袜子与布鞋；尺码在确认时核对。',{kind:'商品',source:'自有商品',unit:'套',salesStage:'clothes',image:'/demo-products/clothes-basic.png'}),
 product('clothes-jacquard','静雅提花寿衣套装','寿衣',1680,'藏青色 · 提花面料 · 传统款','提花外衣、长裤、配套内衣、袜子与布鞋；可沟通尺码。',{kind:'商品',source:'自有商品',unit:'套',salesStage:'clothes',image:'/demo-products/clothes-jacquard.png'}),
 product('urn-ceramic','素白莲纹陶瓷骨灰盒','骨灰盒',980,'陶瓷 · 素白莲纹 · 标准款','陶瓷盒体、盒盖及防护包装；安放尺寸需先核对。',{kind:'商品',source:'自有商品',unit:'件',salesStage:'urn',image:'/demo-products/urn-ceramic.png'}),
 product('urn-walnut','典雅深棕木质骨灰盒','骨灰盒',2680,'木质 · 深棕色 · 浅雕边框','木质盒体、盒盖及防护包装；刻字与特殊尺寸另行沟通。',{kind:'商品',source:'自有商品',unit:'件',salesStage:'urn',image:'/demo-products/urn-walnut.png'}),
 product('ceremony-standard','温馨告别仪式服务','礼仪服务',2200,'约 30 分钟 · 现场引导与仪式主持','仪式沟通、流程安排、主持及现场引导；不含场地租用和火化费用。',{salesStage:'ceremony'}),
 product('ceremony-personal','追思纪念告别服务','礼仪服务',3600,'约 45 分钟 · 个性化追思','仪式沟通、主持、亲友致辞衔接及回忆资料整理；不含场地和火化费用。',{salesStage:'ceremony'}),
 product('decoration-standard','雅致追思厅布置','灵堂布置',2800,'白绿花材 · 中型空间','背景、桌花、遗像摆台及现场布置撤场；场地、用电及尺寸需先确认。',{salesStage:'ceremony'}),
 product('burial-basic','安放仪式基础协助','安葬服务',800,'一次到场 · 基础安放协助','安放流程沟通、现场引导和亲友协调；不含墓位、寄存费及墓园收费。',{unit:'次',salesStage:'burial'}),
 product('burial-family','安放与家属陪同服务','安葬服务',1500,'一次到场 · 家属陪同与仪式协调','提前核对安放要求、现场陪同、简短追思及家属协调；不含墓位和墓园收费。',{unit:'次',salesStage:'burial'}),
];
const toLine=(p:Product):Line=>({productId:p.id,name:p.name,price:p.price,unit:p.unit,kind:p.kind,quantity:1});

/** Additive, once-only fixtures for this local prototype. Never replace an existing record. */
export function withConsultationDemo(input:AppState):AppState {
 if(input.consultationDemoVersion===3)return input;
 if(input.consultationDemoVersion===2)return retireTransport(input);
 if(input.consultationDemoVersion===1)return retireTransport(upgradeProfileExamples(input));
 const staff=input.staff.find(s=>s.id==='boss-a'&&s.agencyId==='agency-a');
 if(!staff||!hasStaffModule(input,staff,'talk')||!hasStaffModule(input,staff,'customers'))return input;
 let s:AppState={...input,products:[...input.products,...DEMO_PRODUCTS.filter(p=>!input.products.some(x=>x.id===p.id||(x.agencyId===p.agencyId&&x.category===p.category&&x.name===p.name)))],customers:[...input.customers],consultations:[...(input.consultations||[])],proposals:[...input.proposals]};
 const addedSessions=new Set<string>();
 const at=new Date().toISOString();
 const later=new Date();later.setDate(later.getDate()+1);const tomorrow=localDate(later);
 const makeCustomer=(key:string,name:string,note:string,budget:number):Customer=>{
  const existing=s.customers.find(c=>c.id===`demo-customer-${key}`);if(existing)return structuredClone(existing);
  const c:Customer={id:`demo-customer-${key}`,agencyId:'agency-a',ownerId:staff.id,name:`${name}（示例）`,phone:'',region:input.agencies.find(a=>a.id==='agency-a')!.region,budget,stage:'跟进中',note,source:'到店咨询',createdAt:at,followups:[{id:`demo-note-${key}`,at,staffId:staff.id,text:note}]};
  s.customers.push(c);return c;
 };
 const makeSession=(key:string,c:Customer,scenario:'advance'|'hospital'|'home',needs:ConsultationPlan['needs'],budget:number,patch:Partial<ConsultationPlan>={}):Consultation=>{
  const existing=s.consultations!.find(x=>x.id===`demo-talk-${key}`);if(existing)return structuredClone(existing);
  const generated=Object.values(needs).includes('needed')?generatePackages(s,staff,{needs,budget}):{packages:[],warnings:[],missingNeeds:[]};
  const record:Consultation={id:`demo-talk-${key}`,agencyId:'agency-a',staffId:staff.id,customerId:c.id,mode:'general',answers:{},messages:[],step:0,createdAt:at,updatedAt:at,guided:{scenario,subjectName:'',occupation:'',interests:'偏好素雅款式，先说明包含内容和价格差异',faith:'按家属意愿沟通',region:c.region,budget,notes:c.note,step:0,selectedProductIds:[],plan:{phase:scenario==='advance'?'process':'packages',processPosition:scenario==='advance'?'advance':'immediate',needs,scopeConfirmed:Object.values(needs).includes('needed'),...generated,continuation:'undecided',...patch}}};
  s.consultations!.push(record);addedSessions.add(record.id);return record;
 };
 const confirmed=(record:Consultation,productId:string,continuation:'none'|'continue')=>{
  if(record.proposalId||!addedSessions.has(record.id))return;
  const p=s.products.find(p=>p.id===productId);if(!p)return;
  const lines=[toLine(p)];const proposalId=`${record.id}-proposal`;
  record.guided={...record.guided!,plan:{...record.guided!.plan!,phase:'result',selectedLines:lines,outcome:'confirmed',confirmedAt:at,continuation}};
  record.proposalId=proposalId;
  s.proposals.push({id:proposalId,phaseOne:true,agencyId:'agency-a',staffId:staff.id,customerId:record.customerId,consultationId:record.id,region:record.guided.region,budget:record.guided.budget,preference:record.guided.notes,lines:structuredClone(lines),status:'待客户确认',warnings:[],createdAt:at,updatedAt:at,matchingNotes:['示例：仅确认本次选择，不代表付款或后续服务结束。']});
 };
 const advance=makeCustomer('advance','赵先生','提前了解，尚未确定办理时间。先讲全流程和大致费用，不必选货，也暂不登记逝者。',0);
 makeSession('advance',advance,'advance',{},0);
 const hospital=makeCustomer('hospital','陈女士','医院咨询，当前先选一套寿衣，预算 1,500 元；其他安排尚未确定。',150000);
 makeSession('hospital',hospital,'hospital',{clothes:'needed'},150000);
 const closed=makeCustomer('closed','孙先生','医院购买寿衣已确认，客户表示暂无其他需求。本次结束，不自动添加后续服务。',100000);
 confirmed(makeSession('closed',closed,'hospital',{clothes:'needed'},100000),'p2','none');
 const returning=makeCustomer('return','林女士','上次已购买寿衣；这次回来继续了解骨灰盒、告别仪式与花圈，本轮参考预算 5,000 元。',500000);
 const previous=makeSession('return-previous',returning,'hospital',{clothes:'needed'},100000);
 confirmed(previous,'p2','continue');
 if(!returning.service)returning.service={phase:'接洽登记',dates:{},tasks:[{id:'demo-return-followup',title:'确认后续告别安排',date:tomorrow,items:'按约定继续沟通骨灰盒与告别安排；寿衣已购，不重复加入。',message:'',internal:true,status:'待确认',createdAt:at,updatedAt:at}]};
 makeSession('return',returning,'hospital',{clothes:'prepared',urn:'needed',ceremony:'needed',flowers:'needed'},500000,{continuedFrom:previous.id,processPosition:'farewell'});
 const home=makeCustomer('home','吴女士','居家接待，先了解整体安排。偏好素雅，参考预算 8,000 元，比较寿衣、骨灰盒、布置、告别和花圈。',800000);
 makeSession('home',home,'home',{clothes:'needed',urn:'needed',decoration:'needed',ceremony:'needed',flowers:'needed'},800000,{processPosition:'farewell'});
 const paused=makeCustomer('paused','周先生','上次选好骨灰盒与花圈，等其他家属商量后再确认；本次继续核对款式和数量。',260000);
 const pending=makeSession('paused',paused,'home',{urn:'needed',flowers:'needed'},260000);
 if(addedSessions.has(pending.id)&&pending.guided!.plan!.packages[0]&&!pending.guided!.plan!.selectedLines)pending.guided={...pending.guided!,plan:{...pending.guided!.plan!,phase:'result',selectedPackageId:pending.guided!.plan!.packages[0].id,selectedLines:pending.guided!.plan!.packages[0].lines.map(l=>({...l})),followupDate:tomorrow,followupNote:'与家属核对上次选择的款式及最终数量。',continuation:'continue'}};
 return retireTransport(upgradeProfileExamples({...s,consultationDemoVersion:1}));
}

function upgradeProfileExamples(input:AppState):AppState {
 const staff=input.staff.find(s=>s.id==='boss-a'&&s.agencyId==='agency-a');
 if(!staff||!hasStaffModule(input,staff,'talk')||!hasStaffModule(input,staff,'customers'))return input;
 const services=[
  product('ceremony-christian','基督教家庭告别协助','礼仪服务',2200,'家属意愿布置 · 现场引导','按基督教家属意愿沟通鲜花、音乐和现场引导；宗教仪式主持由家属另行对接。',{salesStage:'ceremony'}),
  product('ceremony-buddhist','佛教家庭告别协助','礼仪服务',2200,'家属意愿布置 · 现场引导','按佛教家属意愿沟通鲜花、场地和现场引导；宗教仪式另行沟通，不默认包含法事或用品。',{salesStage:'ceremony'}),
 ];
 const profiles:Record<string,{occupation:string;faith:string}>={advance:{occupation:'企业职工',faith:'无特定信仰'},hospital:{occupation:'教师',faith:'佛教'},return:{occupation:'医护工作者',faith:'无特定信仰'},home:{occupation:'教育工作者',faith:'基督教'},paused:{occupation:'退休职工',faith:'无特定信仰'}};
 const next:AppState={...input,products:[...input.products,...services.filter(p=>!input.products.some(x=>x.id===p.id))]};
 next.consultations=(input.consultations||[]).map(c=>{
  const profile=profiles[c.id.replace('demo-talk-','')];
  if(!profile||!c.guided?.plan||c.guided.plan.outcome==='confirmed'||c.guided.occupation||c.guided.faith!=='按家属意愿沟通')return c;
  const guided={...c.guided,...profile};
  const generated=Object.values(guided.plan!.needs).includes('needed')?generatePackages(next,staff,{needs:guided.plan!.needs,budget:guided.budget,...profile}):{packages:[],warnings:[],missingNeeds:[]};
  return {...c,guided:{...guided,plan:{...guided.plan!,...generated}}};
 });
 return {...next,consultationDemoVersion:2};
}

/** Retire transport from open sales only; confirmed records remain historical snapshots. */
function retireTransport(input:AppState):AppState {
 const retired=new Set(['p5','demo-product-transport-assisted',...input.products.filter(p=>!isStoreProduct(p)).map(p=>p.id)]);
 const keep=(line:Line)=>!retired.has(line.productId);
 const protectedProposals=new Set([...input.quotes.map(q=>q.proposalId),...(input.consultations||[]).filter(c=>c.guided?.plan?.outcome==='confirmed').map(c=>c.proposalId)]);
 const products=input.products.map(p=>{
  if(retired.has(p.id))return {...p,enabled:false};
  const original=DEMO_PRODUCTS.find(x=>x.id===p.id);
  if(!original||!p.id.startsWith('demo-product-ceremony-'))return p;
  // Only remove the retired phrase in the original example descriptions.
  return {...p,description:p.description.replace('、接运和火化费用','和火化费用'),included:p.included?.replace('、接运和火化费用','和火化费用')};
 });
 const consultations=input.consultations?.map(c=>{
  const g=c.guided,plan=g?.plan;
  if(!g||plan?.outcome==='confirmed'||(c.proposalId&&protectedProposals.has(c.proposalId)))return c;
  const affected=g.selectedProductIds.some(id=>retired.has(id))||plan&&(plan.needs.transport!==undefined||plan.selectedLines?.some(l=>!keep(l))||plan.packages.some(p=>p.lines.some(l=>!keep(l))));
  if(!affected)return c;
  if(!plan)return {...c,guided:{...g,selectedProductIds:g.selectedProductIds.filter(id=>!retired.has(id))}};
  const needs={...plan.needs};delete needs.transport;
  const seen=new Set<string>();
  const packages=plan.packages.map(p=>{
   const lines=p.lines.filter(keep),total=lines.reduce((sum,l)=>sum+l.price*l.quantity,0);
   return {...p,lines,total,overBudget:g.budget?Math.max(0,total-g.budget):0,reasons:p.reasons.filter(r=>!r.includes('接运'))};
  }).filter(p=>{const key=p.lines.map(l=>`${l.productId}:${l.quantity}`).sort().join('|');if(!key||seen.has(key))return false;seen.add(key);return true;});
  const selectedLines=plan.selectedLines?.filter(keep);
  return {...c,guided:{...g,selectedProductIds:g.selectedProductIds.filter(id=>!retired.has(id)),plan:{...plan,needs,packages,selectedLines,selectedPackageId:undefined,phase:plan.phase==='result'&&!selectedLines?.length?'packages' as const:plan.phase,scopeConfirmed:Object.values(needs).includes('needed'),missingNeeds:plan.missingNeeds?.filter(n=>n!=='transport'),warnings:plan.warnings?.filter(w=>!w.includes('接运'))}}};
 });
 const proposals=input.proposals.map(p=>p.status==='已确认'||protectedProposals.has(p.id)?p:{...p,lines:p.lines.filter(keep)});
 const customers=input.customers.map(c=>{
  const note=c.id==='c4'&&c.note==='需先核实接运地点。'?'需先核实寿衣款式和尺寸。':c.id==='demo-c-prep'&&c.note==='模拟客户：需要接运及灵堂布置，请先确认地点与家属意见。'?'模拟客户：需要灵堂布置，请先确认场地与家属意见。':c.note;
  const service=c.id==='demo-c-prep'&&c.service?{...c.service,tasks:c.service.tasks.filter(t=>!(t.id==='demo-task-transport'&&t.title==='核实接运地址和时间'&&['待确认','待发送'].includes(t.status)))}:c.service;
  return note===c.note&&service===c.service?c:{...c,note,service};
 });
 return {...input,products,consultations,proposals,customers,consultationDemoVersion:3};
}
