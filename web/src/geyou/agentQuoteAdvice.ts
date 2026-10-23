import type {AgentProfile} from './agentTypes';
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

export function personalizedPaperPlan(plan:PaperPlan,advice:ReturnType<typeof quotationAdvice>,profile?:Pick<AgentProfile,'faith'>):PaperPlan{
 if(plan.confirmedAt)throw Error('已确认套餐不可直接重新生成');
 if(advice.items.some(x=>!PAPER_EXTRAS.some(e=>e.id===x.id)))throw Error('套餐项目需来自有效目录');
 const extras=plan.extras.filter(x=>!plan.autoExtraIds?.includes(x.id));
 const generated=advice.items.filter(x=>!extras.some(e=>e.id===x.id));
 const omitted=profile?[...(plan.omitted||[]).filter(x=>x!=='佛经10包'),...(profile.faith==='佛教'?[]:['佛经10包'])]:plan.omitted;
 const at=new Date().toISOString();
 return {...plan,omitted,extras:[...extras,...generated.map(x=>({id:x.id,quantity:1}))],autoExtraIds:generated.map(x=>x.id),personalizedAt:at,personalizationSummary:advice.text,pricesChecked:false,confirmedAt:undefined,updatedAt:at};
}
