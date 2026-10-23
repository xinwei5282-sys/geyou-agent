import {PAPER_EXTRAS,type PaperPlan} from './agentPackageSource';
export function quotationAdvice(value:unknown){
 const raw=value as {reply?:unknown;recommendations?:{productId?:unknown;reason?:unknown}[]};
 const items=(Array.isArray(raw?.recommendations)?raw.recommendations:[]).flatMap(x=>{
 const extra=PAPER_EXTRAS.find(e=>'paper-'+e.id===x?.productId);
 return extra&&typeof x.reason==='string'?[{id:extra.id,reason:x.reason.slice(0,300)}]:[];
 });
 return {text:typeof raw?.reply==='string'?raw.reply.slice(0,2000):'',items:[...new Map(items.map(x=>[x.id,x])).values()].slice(0,1)};
}
export function addAdvisedExtra(plan:PaperPlan,id:string):PaperPlan{
 if(plan.confirmedAt)throw Error('已确认报价不可直接调整');
 if(!PAPER_EXTRAS.some(x=>x.id===id))throw Error('该建议项目不可加入');
 if(plan.extras.some(x=>x.id===id))return plan;
 return {...plan,extras:[...plan.extras,{id,quantity:1}],pricesChecked:false,updatedAt:new Date().toISOString()};
}
export function shouldGenerateQuoteAdvice(hadPlan:boolean){return !hadPlan;}
