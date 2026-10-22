import type {AppState, Staff, Consultation, Proposal} from './types';
import {id, now, canAccessSalesRecord, visibleCustomers, hasStaffModule, generateDraft, isProductAvailable, calculateTotal} from './model';
export const ELEMENTS=['金','木','水','火','土'];
const general=[
 {id:'relation',question:'家属与逝者是什么关系？',options:['父母','配偶','长辈','亲友']},
 {id:'region',question:'这次服务在哪个地区？请填写到区县，以便核对当地习俗。'},
 {id:'budget',question:'本次预算上限是多少元？请填写一个明确金额。',options:['5000','8000','10000']},
 {id:'preference',question:'家属有什么偏好或特殊安排？',options:['简约庄重，以必要项目为主','传统礼仪，重视告别安排','暂无特殊要求']},
];
const bazi=[
 {id:'birthDate',question:'逝者的出生日期是什么？请注明公历或农历；不清楚可填写“待确认”。'},
 {id:'birthTime',question:'出生时辰是什么？不清楚可以选择“不详”。',options:['不详']},
 {id:'gender',question:'请确认逝者的性别。',options:['男','女','暂不提供']},
 {id:'birthPlace',question:'出生地点在哪里？不清楚可填写“待确认”。'},
 {id:'element',question:'家属或当地顾问已确认的五行偏好是什么？未确认请选择“待确认”，本原型不会自动排盘。',options:[...ELEMENTS,'待确认']},
];
export function consultationSteps(mode:Consultation['mode']):{id:string;question:string;options?:string[]}[]{return mode==='bazi'?[...bazi,...general]:general;}
export function visibleConsultations(s:AppState,staff:Staff){return (s.consultations||[]).filter(c=>canAccessSalesRecord(s,staff,c));}
export function createConsultation(s:AppState,staff:Staff,customerId:string,mode:Consultation['mode'],productId?:string,deceasedId?:string):Consultation{
 const customer=visibleCustomers(s,staff).find(c=>c.id===customerId);
 if(!hasStaffModule(s,staff,'talk')||!customer)throw Error('请选择有权限的客户');
 if(deceasedId&&!customer.deceased?.some(d=>d.id===deceasedId))throw Error('请选择该客户对应的逝者');
 const product=productId?s.products.find(p=>p.id===productId&&p.agencyId===staff.agencyId&&isProductAvailable(s,p)):undefined;
 if(productId&&!product)throw Error('此商品当前不可提供，请重新选择');
 return {id:id('talk'),agencyId:staff.agencyId,staffId:staff.id,customerId,mode,answers:product?{focusProduct:product.id}:{},messages:[{role:'assistant',text:consultationSteps(mode)[0].question}],step:0,createdAt:now(),updatedAt:now(),deceasedId,serviceId:deceasedId?`${customerId}:${deceasedId}`:undefined};
}
export function parseBudget(text:string){const match=text.trim().replace(/^(预算|上限|预算上限)[:：]?\s*/,'').match(/^(\d+(?:\.\d{1,2})?)\s*(万|千)?\s*元?$/);if(!match)throw Error('请填写明确预算上限，例如8000或1万元');const value=Math.round(Number(match[1])*(match[2]==='万'?10000:match[2]==='千'?1000:1)*100);if(value<100||value>100000000)throw Error('预算需在1至1,000,000元之间');return value;}
export function answerConsultation(record:Consultation,text:string):Consultation{
 const value=text.trim();if(!value)throw Error('请先填写回复');if(value.length>2000)throw Error('单条回复请控制在2000字以内');
 const steps=consultationSteps(record.mode), current=steps[record.step];
 if(current?.id==='budget')parseBudget(value);
 if(current?.id==='birthDate'&&!/公历|农历|待确认|不详/.test(value))throw Error('请注明公历或农历，也可填写待确认');
 if(current?.id==='element'&&value!=='待确认'&&!ELEMENTS.includes(value))throw Error('请选择已确认的五行方向，或选择待确认');
 const answers={...record.answers,...(current?{[current.id]:value}:{supplement:[record.answers.supplement,value].filter(Boolean).join('；')})};
 const step=current?record.step+1:record.step;
 const reply=steps[step]?.question||'需求已记录。可以补充说明，或生成本店套餐。生成后请逐项核对，再由家属确认报价。';
 return {...record,answers,step,messages:[...record.messages,{role:'user',text:value},{role:'assistant',text:reply}],updatedAt:now(),proposalId:undefined};
}
export function rewindConsultation(record:Consultation):Consultation{
 if(!record.step)return record;
 const lastUser=[...record.messages].reverse().find(m=>m.role==='user')?.text;
 if(record.answers.supplement&&lastUser){const chunks=record.answers.supplement.split('；');chunks.pop();return {...record,answers:{...record.answers,supplement:chunks.join('；')},messages:record.messages.slice(0,-2),updatedAt:now(),proposalId:undefined};}
 const step=record.step-1;const answers={...record.answers};delete answers[consultationSteps(record.mode)[step].id];return {...record,answers,step,messages:record.messages.slice(0,-2),updatedAt:now(),proposalId:undefined};
}
export function generateConsultationProposal(s:AppState,staff:Staff,sessionId:string):{state:AppState;proposal:Proposal}{
 const session=visibleConsultations(s,staff).find(c=>c.id===sessionId);if(!session)throw Error('无权访问此谈单记录');
 if(s.quotes.some(q=>q.receipt&&s.proposals.some(p=>p.id===q.proposalId&&p.consultationId===session.id)))throw Error('此谈单已有收款登记，变更请先线下核对处理');
 if(session.step<consultationSteps(session.mode).length)throw Error('请先完成需求确认');
 const customer=visibleCustomers(s,staff).find(c=>c.id===session.customerId)!;
 const preference=[`关系：${session.answers.relation}`,session.answers.preference,session.answers.supplement].filter(Boolean).join('；');
 const deceasedId=session.deceasedId;
 let proposal=generateDraft(s,{...customer,region:session.answers.region,budget:parseBudget(session.answers.budget)},staff,preference,deceasedId);
 const matchingNotes:string[]=[];
 if(session.mode==='bazi'){
  const element=session.answers.element;
  if(!ELEMENTS.includes(element)){matchingNotes.push('五行方向尚未确认：当前按地区、预算和基础商品生成，未进行五行匹配。');}
  else {
   const catalog=s.products.filter(p=>p.agencyId===staff.agencyId&&isProductAvailable(s,p));
   const matches=catalog.filter(p=>(p.masterId?s.masterProducts.find(m=>m.id===p.masterId)?.elements:p.elements)?.includes(element));
   for(let index=0;index<proposal.lines.length;index++){
    const line=proposal.lines[index], product=catalog.find(p=>p.id===line.productId)!;
    const candidate=matches.filter(p=>p.category===product.category).sort((a,b)=>a.price-b.price).find(p=>calculateTotal(proposal.lines)-line.price*line.quantity+p.price*line.quantity<=proposal.budget);
    if(candidate){proposal.lines[index]={productId:candidate.id,name:candidate.name,unit:candidate.unit,kind:candidate.kind,price:candidate.price,quantity:line.quantity};matchingNotes.push(`${candidate.name}：商品资料标注「${element}」，同类项目中按预算优先匹配。`);}
   }
   if(!matchingNotes.length)matchingNotes.push(`当前本店没有可在预算内优先匹配「${element}」的同类商品，保留基础方案，需人工复核。`);
  }
  matchingNotes.push('八字帮选仅按人工确认的五行偏好与商品资料进行民俗匹配，不含自动排盘或效果承诺。');
 }
 if(session.answers.focusProduct){
  const focus=s.products.find(p=>p.id===session.answers.focusProduct&&p.agencyId===staff.agencyId&&isProductAvailable(s,p));
  if(!focus)proposal.warnings.push('商城选中的商品当前不可提供，未加入套餐。');
  else {const index=proposal.lines.findIndex(l=>s.products.find(p=>p.id===l.productId)?.category===focus.category);const line={productId:focus.id,name:focus.name,unit:focus.unit,kind:focus.kind,price:focus.price,quantity:1};const lines=[...proposal.lines];if(index>=0)lines[index]=line;else lines.push(line);if(calculateTotal(lines)<=proposal.budget){proposal.lines=lines;matchingNotes.push(`已纳入商城中关注的「${focus.name}」，请与客户核对规格。`);}else proposal.warnings.push(`商城中关注的「${focus.name}」会使方案超出预算，未自动加入，可人工调整。`);}
 }
 proposal={...proposal,consultationId:session.id,serviceId:deceasedId?`${customer.id}:${deceasedId}`:undefined,deceasedId,matchingNotes:matchingNotes.filter(note=>!note.includes('：商品资料标注')||proposal.lines.some(line=>note.startsWith(line.name+'：')))};
 return {proposal,state:{...s,proposals:[...s.proposals,proposal],consultations:(s.consultations||[]).map(c=>c.id===session.id?{...c,proposalId:proposal.id,updatedAt:now()}:c)}};
}
