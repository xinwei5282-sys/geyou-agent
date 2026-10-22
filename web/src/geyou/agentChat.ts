import type {AppState,Consultation,Staff} from './types';
import {demoMaterialAdvice} from './agentDemoRules';
import {agentData,calculateAgentBazi,findAgentNotice} from './agentModel';
import {hasStaffModule,isProductAvailable} from './model';
import {receptionBusinessFacts} from './receptionBusinessContext';
import {PAPER_PACKAGE,PAPER_EXTRAS,paperPlanTotal} from './agentPackageSource';
export function agentChatRequest(state:AppState,staff:Staff,current:Consultation){
 const d=agentData(state,current),p=d.profile;
 const person=state.customers.find(c=>c.id===current.customerId)?.deceased?.find(x=>x.id===current.deceasedId);
 const notice=findAgentNotice(state,staff,current);
 const photo=hasStaffModule(state,staff,'restoration')?person?.portraits.at(-1):undefined;
 const catalog=[{id:'paper-simple',name:PAPER_PACKAGE.name,category:'纸单套餐',price:PAPER_PACKAGE.price/100,unit:'套',description:PAPER_PACKAGE.included.join('、'),spec:'用户纸单历史参考价，当前须核价；未注明材质'},...PAPER_EXTRAS.map(x=>({id:'paper-'+x.id,name:x.name,category:x.group,price:x.price/100,unit:x.unit,description:x.note,spec:'用户纸单参考项目，不代表实时库存'}))];
 let bazi='八字资料不全或未核对，不得推断四柱、喜用和商品对应。';
 try{const chart=calculateAgentBazi(p);if(chart.ready)bazi='已计算四柱：'+chart.pillars.join('、')+'；'+chart.rule+'喜用未自动判定；家属确认五行偏好：'+(p.preferredElement||'未确认')+'。';}catch{}
 const facts=[...receptionBusinessFacts(state,staff,current).slice(0,4),
 '代理简版：聊天提取到明确姓名后自动建立待核对档案，资料和人像随接待同步；不自动发布、采用、确认套餐或收款。证件可通过本机识别，只有存在识别记录才可称已识别，且仍需人工核对。当前界面只有对话及底部输入/上传栏；当前办理入口随本轮讣告、遗照或报价需求出现，不能指引用户寻找“本次服务”固定板块。资料可从底部加号上传后核对；也可从客户列表进入档案。',
 '资料核对状态：'+(p.confirmedAt?'已人工核对':'尚未人工核对，自动归档只表示待核对，不代表确认完成')+'；套餐建议状态：'+(d.packagePreparedAt?'已发起生成':'尚未发起生成')+'；家属预算：'+(p.budget||'待确认')+'元；逝者宗教信仰：'+p.faith+'。',
 bazi,
 '原图套餐：简朴套餐4580元，包含'+PAPER_PACKAGE.included.join('、')+'。原图历史参考价须核实，不混用本店单品价；未注明材质，不编造木种工艺。',
 '代联系念佛、树灯、豆腐饭、水晶棺和防腐针，不代表费用包含；家属自备不收费。原图民俗内容仅在家属认可时采用；已备寿衣或不需要佛经时先移除相应范围并重新人工核价，不按单品随意扣减。',
 d.paperPlan?'当前代理清单'+(d.paperPlan.confirmedAt?'已记录家属确认':'仍待确认')+'，金额'+paperPlanTotal(d.paperPlan)/100+'元；单品更换：'+(d.paperPlan.adjustments?.map(a=>a.included+'更换为'+a.name+'，核实补差'+a.delta/100+'元').join('；')||'无')+'；未自动登记收款。':'尚未保存纸单套餐清单。未沟通客户不得直接给出已定制完成的套餐或话术。',
 '遗照服装可按资料建议或家属选择唐装、西服、素色正装、保留原衣；切换需重新生成。实际记录：'+(person?.selectedPortraitId?'已人工确认采用':photo?'已有照片，状态'+photo.status+'，尚未采用':'未关联可用照片')+'。',
 '当前讣告记录：'+(notice?notice.status+'；稿件时间'+(notice.ceremonyDate||'未填')+(notice.scheduleReview?'；待重新核对':''):'尚未生成或无权访问')+'。',
 '已核对资料中的告别时间：'+(p.farewell||'待确认')+'；地点：'+(p.location||'待确认')+'。这不代表外部场地已预约。',
 '当前资料识别：'+(d.materials.some(m=>m.recognition)?'存在本机识别候选，待核对或已人工核对；不能声称所有字段都准确':'没有识别结果，不得宣称已读取证件')+'。',
 ...(d.isDemo?['当前为演示客户，材质规则是模拟资料，不代表真实商品或报价：'+(demoMaterialAdvice(p,true).map(x=>x.name+'，'+x.material).join('；')||'家属尚未确认五行偏好，不匹配样品')]:[]),
 '推荐理由必须能追溯到家属需求或真实商品资料；八字不等于缺什么就补什么，不承诺转运、保佑或影响家运，不用恐惧促单。'];
 return {messages:current.messages.slice(-20).map(m=>({role:m.role,text:m.text.slice(0,2000)})),profile:{...(p.occupation?{occupation:p.occupation}:{}),...(p.interests?{interests:p.interests}:{}),...(p.name?{subjectName:p.name}:{}),...(p.gender?{subjectGender:p.gender}:{}),...(p.age?{subjectAge:p.age}:{}),...(p.relationship?{relationship:p.relationship}:{}),...(p.birthDate?{birthDate:p.birthDate}:{}),...(p.deathDate?{deathDate:p.deathDate}:{}),...(p.farewell?{farewell:p.farewell}:{}),...(p.location?{location:p.location}:{}),...(current.contact?.name?{contactName:current.contact.name}:{}),...(current.contact?.phone?{contactPhone:current.contact.phone}:{}),faith:p.faith,scenario:'home' as const,...(p.budget?{budgetYuan:Number(p.budget)}:{})},staffContext:{stage:d.paperPlan?.confirmedAt?'confirmed' as const:'consulting' as const,selectedItems:[],businessFacts:facts.map(x=>x.slice(0,300)).slice(0,16)},catalog};
}
