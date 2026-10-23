import type {AgentProfile} from './agentTypes';
import {PAPER_PACKAGE,type PaperPlan} from './agentPackageSource';
export function initialAgentPlan(profile:AgentProfile,at:string):PaperPlan{
 return {basePrice:PAPER_PACKAGE.price,extras:[],pricesChecked:false,updatedAt:at,...(profile.faith!=='佛教'?{omitted:['佛经10包']}:{} )};
}
export function agentQuoteNotes(profile:AgentProfile,plan:PaperPlan):string[]{
 return [
  '请核对报价中的项目、数量、服务范围和实际价格；参考价不代表最终报价，确认报价不代表已付款。',
  ...(profile.occupation?['已记录生前职业：'+profile.occupation+'。如需融入纪念文字，可补充任职经历及家属认可的纪念内容。']:[]),
  ...(profile.interests?['已记录生前喜好：'+profile.interests+'。如希望融入选品，可与代理核对具体图案、材质与款式，新增项目另行确认。']:[]),
  profile.faith==='待确认'?'逝者本人信仰暂不清楚，宗教用品和仪式先与家属确认，不默认安排。':'逝者本人信仰：'+(profile.faithDetail||profile.faith)+'；宗教用品及仪式仍需另行确认家属意愿。',
  ...(plan.omitted?.length?['本次不包含：'+plan.omitted.join('、')+'。取消项目不按单品价格自动抵扣，合计需重新核价。']:[]),
  '已含、自备和取消项目避免重复收费；代联系事项不默认包含费用，特殊需求另行核实。',
  '办理材料以当地实际要求为准，可准备逝者身份证、户口本、死亡证明及经办人身份证，原件妥善保管。',
  '告别时间、地点和到场安排须另行核实；完成报价确认后，再按需制作电子讣告和遗照，内容及照片需家属核对。',
 ];
}
