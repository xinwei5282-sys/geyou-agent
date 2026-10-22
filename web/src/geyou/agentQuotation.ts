import {agentProductImage,includedImageKeys} from './agentProductImages';
import {PAPER_PACKAGE,paperPlanLines,type PaperPlan} from './agentPackageSource';
import type {QuotePdfInput} from './quotePdf';
export function agentPaperQuotation(plan:PaperPlan,info:{number:string;customer:string;subject:string;agency:string;phone:string}):QuotePdfInput{
 return {...info,date:plan.updatedAt.slice(0,10),status:!plan.pricesChecked?'参考方案 · 待核价 · 不代表成交或付款':plan.confirmedAt?'已记录家属确认 · 不代表付款':'待家属确认 · 不代表成交或付款',lines:paperPlanLines(plan).map((line,i)=>({...line,adjustment:i>plan.extras.length,image:agentProductImage(i===0?'package':plan.extras[i-1]?.id||includedImageKeys[PAPER_PACKAGE.included.indexOf(plan.adjustments?.[i-plan.extras.length-1]?.included||'')])})),notes:[
 '商品与服务图片为示意，具体款式与服务以本次核对为准。',
 '本次包含：'+PAPER_PACKAGE.included.filter(x=>!plan.omitted?.includes(x)).map(x=>plan.adjustments?.find(a=>a.included===x)?.name||x).join('、'),
 ...(plan.omitted?.length?['本次不包含：'+plan.omitted.join('、')]:[]),
 '代联系事项不默认含费用；家属自备物品不计价。',
 '根据原始纸单整理，价格及服务范围由代理核对。'
 ]};
}
