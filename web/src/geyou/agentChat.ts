import {currentFamilyForms,familyFormSettings} from './agentFamilyForms';
import {agentIntake} from './agentIntake';
import type {AppState,Consultation,Staff} from './types';
import {demoMaterialAdvice} from './agentDemoRules';
import {agentData,calculateAgentBazi,findAgentNotice} from './agentModel';
import {hasStaffModule,isProductAvailable} from './model';
import {receptionBusinessFacts} from './receptionBusinessContext';
import {PAPER_PACKAGE,PAPER_EXTRAS,paperPlanTotal} from './agentPackageSource';
export function agentChatRequest(state:AppState,staff:Staff,current:Consultation,mode:'reception'|'quotation'='reception'){
 const d=agentData(state,current),p=d.profile;
 const person=state.customers.find(c=>c.id===current.customerId)?.deceased?.find(x=>x.id===current.deceasedId);
 const notice=findAgentNotice(state,staff,current);
 const photo=hasStaffModule(state,staff,'restoration')?person?.portraits.at(-1):undefined;
 const catalog=[{id:'paper-simple',name:PAPER_PACKAGE.name,category:'纸单套餐',price:PAPER_PACKAGE.price/100,unit:'套',description:PAPER_PACKAGE.included.join('、'),spec:'用户纸单历史参考价，当前须核价；未注明材质'},...PAPER_EXTRAS.map(x=>({id:'paper-'+x.id,name:x.name,category:x.group,price:x.price/100,unit:x.unit,description:x.note,spec:'用户纸单参考项目，不代表实时库存'}))];
 let bazi='八字资料不全或未核对，不得推断四柱、喜用和商品对应。';
 try{const chart=mode==='quotation'?calculateAgentBazi(p):undefined;if(chart?.ready)bazi='已计算四柱：'+chart.pillars.join('、')+'；'+chart.rule+'喜用未自动判定；家属确认五行偏好：'+(p.preferredElement||'未确认')+'。';}catch{}
 const intake=agentIntake(d);
 const phase=familyFormSettings(state,current).phase;const receptionStage=intake.identity.pending?'identity-review':d.personalization==='yes'?'profile-review':p.confirmedAt?(d.paperPlan?.confirmedAt?(phase==='preparation'?'content':phase):'quote-review'):intake.question?(intake.question.field==='name'&&!intake.hasRecognition?'identity-upload':'profile-collect'):'profile-review';
 const nextStep=receptionStage==='identity-review'?'对照原件确认识别结果是否正确':receptionStage==='identity-upload'?'请先提交逝者身份文件':receptionStage==='profile-collect'?intake.question!.question:receptionStage==='profile-review'?'打开个人信息完善，对照核对并确认保存档案':receptionStage==='quote-review'?'查看已生成报价、办理材料核对单与丧家提前准备卡片，核价并确认报价':receptionStage==='content'?'先制作遗照，再制作电子讣告':'查看当前环节已展开的客户内容卡片';
 const facts=[
 '当前个性化选择：'+(d.personalization==='yes'?'已选择完善喜好与习俗，点击个人信息卡片进入表单填写并保存；卡片不提供逐项选项按钮':d.personalization==='done'?'已保存个性化资料，查看报价调整建议':d.personalization==='no'?'按基础报价继续，不追问选品资料':'身份核对后直接提供基础报价，再询问是否根据逝者喜好、习俗调整；点击是才推送完善信息卡片')+'；家属习俗：'+(p.customs||'未提供')+'。',
 '当前接待阶段：'+receptionStage+'；本轮只推进该阶段的下一步。',
 '代理简版：user是代理，接待资料和当前对象隔离；不采集预算。页面操作由人工完成，聊天不能代为确认、付款、发布或采用。',
 '身份识别核对：'+(intake.identity.pending?'识别结果等待人工确认，点击“识别正确，继续”或“有误，修改资料”。':intake.hasRecognition?'已有识别记录，无待核对结果。':'没有识别结果，不得称已读取证件。'),
 '个人信息完善状态：'+(p.confirmedAt?'已人工核对':intake.missing.length?'尚未人工核对，待补充'+intake.missing.join('、'):'资料已整理，待整体人工核对')+'；本轮只追问：'+nextStep+'；推荐选项：'+(receptionStage==='profile-collect'?intake.question?.options.map(x=>x.label).join('、')||'个人信息完善':'使用卡片已有按钮，不重复提供选项')+'。',
 '选品信息已询问但暂不清楚：'+(d.preferenceReviewed?.filter(k=>!p[k as keyof typeof p]||p[k as keyof typeof p]==='待确认').join('、')||'无')+'；未知不代表没有，不重复追问。',
 '当前可提供客户表单：'+(currentFamilyForms(state,staff,current).map(f=>f.title).join('、')||'暂无')+'；点击卡片查看详情和下载PDF；生成不代表已发送、预约或付款。',
 d.paperPlan?'当前代理清单'+(d.paperPlan.confirmedAt?'已记录家属确认，原单冻结，可先制作遗照，再制作电子讣告':'仍待核价及家属确认，不提前引导遗照讣告')+'；金额'+paperPlanTotal(d.paperPlan)/100+'元；核价状态：'+(d.paperPlan.pricesChecked?'已核价':'未核价')+'；未自动登记收款。':'尚未保存纸单套餐清单，先完成资料整体人工确认。',
 '遗照实际记录：'+(person?.selectedPortraitId?'已人工确认采用':photo?'已有照片，状态'+photo.status+'，尚未采用':'未关联可用照片')+'；已有记录查看当前进度，不重复新建。',
 '当前讣告记录：'+(notice?notice.status+'；稿件时间'+(notice.ceremonyDate||'未填')+(notice.scheduleReview?'；待重新核对':''):'尚未生成或无权访问')+'。',
 '日期统一读取个人信息表单：出生日期'+(p.birthDate||'待确认')+'；逝世日期'+(p.deathDate||'待确认')+'；系统享年'+(p.age||'待确认')+'。AI不得自行计算或用今天补齐逝世日期。告别时间：'+(p.farewell||'待确认')+'；地点：'+(p.location||'待确认')+'，不代表场地已预约。',
 '服务进度：'+phase+'；丧事办理'+(familyFormSettings(state,current).funeralCompleted?'已登记完成，可查看五七材料准备清单':'尚未登记完成，不提前推五七')+'。',
 '单品更换：'+(d.paperPlan?.adjustments?.map(a=>a.included+'更换为'+a.name+'，核实补差'+a.delta/100+'元').join('；')||'无')+'；参考价不是本次核价，已含、自备不重复收费。',
 ...(mode==='quotation'?['报价清单生成模式：仅整理可选商品匹配与核价建议，不自动加购、不修改金额、不确认报价。缺少可信八字依据则不使用八字推荐。',bazi,...(d.isDemo?['演示客户模拟材质规则：'+demoMaterialAdvice(p,true).map(x=>x.name+'，'+x.material).join('；')]:[])]:[]),
 ...receptionBusinessFacts(state,staff,current).slice(0,1)
 ];
 return {messages:current.messages.slice(-20).map(m=>({role:m.role,text:m.text.slice(0,2000)})),profile:{...(p.occupation?{occupation:p.occupation}:{}),...(p.interests?{interests:p.interests}:{}),...(p.name?{subjectName:p.name}:{}),...(p.gender?{subjectGender:p.gender}:{}),...(p.age?{subjectAge:p.age}:{}),...(p.relationship?{relationship:p.relationship}:{}),...(p.birthDate?{birthDate:p.birthDate}:{}),...(p.deathDate?{deathDate:p.deathDate}:{}),...(p.farewell?{farewell:p.farewell}:{}),...(p.location?{location:p.location}:{}),...(current.contact?.name?{contactName:current.contact.name}:{}),...(current.contact?.phone?{contactPhone:current.contact.phone}:{}),...(p.faithDetail?{faithDetail:p.faithDetail}:{}),faith:p.faith,scenario:'home' as const},staffContext:{stage:d.paperPlan?.confirmedAt?'confirmed' as const:'consulting' as const,selectedItems:[],businessFacts:facts.map(x=>x.slice(0,300)).slice(0,16)},catalog};
}
