import { canAccessSalesRecord, consultationRootId } from './model';
import {readServiceWorkflow} from './serviceWorkflow';
import type { AppState, Consultation, Staff } from './types';

export type CustomerFuneralPlanStep={id:string;title:string;detail:string;status:string};
export type CustomerFuneralPlanResult={title:string;scenario:string;steps:CustomerFuneralPlanStep[];pending:string[];familyPrepared:string[];agencyPrepared:string[]};

function noHomeHallChosen(session:Consultation):boolean {
  const summary=session.ai?.summary;
  const sources=[session.guided?.notes||'',...(summary?.confirmed||[])];
  const chosen=/不设(?:居家)?灵堂|不需要(?:居家)?灵堂|无需(?:居家)?灵堂|不安排(?:居家)?灵堂|不办(?:居家)?灵堂|不在家设灵堂/;
  const unresolved=/不确定|没决定|未决定|尚未决定|还没想好|暂时待定|待商量/;
  const reversal=/不要不设灵堂|不是不设灵堂|不想不设灵堂|不希望不设灵堂/;
  return sources.some(source=>source.split(/[。！？；\n]/).some(part=>chosen.test(part)&&!unresolved.test(part)&&!reversal.test(part)));
}

const isUnknown=(value:string|undefined)=>!value?.trim()||/^(待确认|未知|不详|未填写|)$/u.test(value.trim());

function relatedSessions(state:AppState,session:Consultation){
  const root=consultationRootId(state,session);
  return (state.consultations||[]).filter(item=>item.agencyId===session.agencyId&&item.customerId===session.customerId&&item.deceasedId===session.deceasedId&&consultationRootId(state,item)===root);
}

function confirmedSaleLines(state:AppState,sessions:Consultation[]){
  const sessionIds=new Set(sessions.map(item=>item.id));
  const proposals=state.proposals.filter(proposal=>proposal.consultationId&&sessionIds.has(proposal.consultationId)&&proposal.agencyId===sessions[0]?.agencyId);
  const lines:string[]=[];
  for(const proposal of proposals){
    const versions=state.quotes.filter(quote=>quote.proposalId===proposal.id&&quote.agencyId===proposal.agencyId);
    const latestConfirmed=versions.filter(quote=>!quote.revoked&& (!!quote.dealConfirmedAt||!!quote.receipt)).sort((a,b)=>b.version-a.version)[0];
    if(latestConfirmed)lines.push(...latestConfirmed.lines.map(line=>line.name));
  }
  return [...new Set(lines)];
}

export function buildCustomerFuneralPlan(state:AppState,staff:Staff,sessionId:string):CustomerFuneralPlanResult {
  const session=state.consultations?.find(item=>item.id===sessionId);
  if(!session||!session.guided||!canAccessSalesRecord(state,staff,session))throw new Error('无权限查看本次沟通流程');
  const guided=session.guided, summary=session.ai?.summary, plan=guided.plan;
  const sessions=relatedSessions(state,session);
  const sessionsNewestFirst=[...sessions].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  const saleLines=confirmedSaleLines(state,sessions);
  const scenario=guided.scenario==='hospital'?'医院':guided.scenario==='home'?'居家':'提前咨询';
  const steps:CustomerFuneralPlanStep[]=[];
  const pending=[...(summary?.pending||[])];
  const addPending=(text:string)=>{if(!pending.includes(text))pending.push(text);};
  const confirmed=summary?.confirmed||[];
  const confirmedText=confirmed.join('；');
  const reservationTime=sessionsNewestFirst.find(item=>item.guided?.reservationTime?.trim())?.guided?.reservationTime?.trim();
  const serviceAddress=sessionsNewestFirst.find(item=>item.guided?.serviceAddress?.trim())?.guided?.serviceAddress?.trim();
  const contactName=session.contact?.name?.trim()||sessionsNewestFirst.find(item=>item.contact?.name?.trim())?.contact?.name.trim();
  const contactPhone=session.contact?.phone?.trim()||sessionsNewestFirst.find(item=>item.contact?.phone?.trim())?.contact?.phone.trim();
  const timeKnown=!!reservationTime||confirmed.some(item=>/时间已确认|已确认.{0,8}时间|已约定.{0,8}时间|定于\s*\d{1,2}[:：点]/.test(item));
  const placeKnown=confirmed.some(item=>/地点已确认|已确认.{0,8}(?:地点|场地)|定在.{0,12}(?:殡仪馆|告别厅|家中|家里)/.test(item));
  const noHall=noHomeHallChosen(session);

  const sceneDetail=guided.scenario==='hospital'
    ?'当前在医院。先按医院实际流程核实手续、可办理时间和家属对接人；死亡证明所需材料以办理机构说明为准。后续接运由殡仪馆办理。'
    :guided.scenario==='home'
      ?'当前为居家场景。先确认家属意愿、服务地点和后续安排；涉及接运时由殡仪馆办理。'
      :'当前为提前咨询。先记录家属意愿和需要了解的事项，具体时间、地点与服务范围确定后再安排。';
  steps.push({id:'scene',title:guided.scenario==='advance'?'提前了解与需求确认':'当前情况与手续核实',detail:sceneDetail,status:'按当前场景'});
  if(confirmed.length)steps.push({id:'known-facts',title:'已确认情况',detail:confirmed.slice(0,8).join('；'),status:'已记录'});

  const preparedClothes=plan?.needs.clothes==='prepared'||(summary?.prepared||[]).some(item=>/寿衣|衣物|衣服/.test(item));
  const clothesConfirmed=saleLines.some(name=>/寿衣|寿被|衣物/.test(name));
  steps.push({id:'clothes',title:'衣物准备',detail:preparedClothes?'家属已说明衣物已备，不重复购买；后续仅核对款式、尺码和实际交接。':clothesConfirmed?'当前已确认报价中列有衣物项目，按该报价清单核对具体款式和交接。':'衣物是否需要准备尚待确认；如需要，再沟通款式、尺码与协助方式。',status:preparedClothes?'已准备':clothesConfirmed?'已确认':'待确认'});

  const venueDetail=noHall
    ?'已记录家属选择不安排居家灵堂；按家属确认的告别地点继续衔接，不安排在家布置。'
    :guided.scenario==='home'
      ?'是否在家守灵或改到其他场地尚待家属确认；确认前不安排居家灵堂布置。'
      :'根据家属意愿确认告别地点及是否需要场地布置；未确认前不视为已安排。';
  steps.push({id:'venue',title:noHall?'告别地点衔接':'告别地点与场地安排',detail:venueDetail,status:noHall?'按已述意愿':placeKnown?'已确认':'待确认'});
  if(!placeKnown)addPending('确认告别地点及场地安排');

  const reservationFacts=[serviceAddress?`服务地址：${serviceAddress}`:'',contactName?`联系人：${contactName}`:'',contactPhone?`联系电话：${contactPhone}`:'',reservationTime?`预定时间：${reservationTime}`:''].filter(Boolean);
  steps.push({id:'reservation',title:'预订信息与费用核对',detail:[...reservationFacts,'按实际预订单核对服务地址、家属与联系人、预订项目、预定时间、定金及支付方式；费用和服务内容只按已选并确认的项目记录。'].join('；'),status:reservationFacts.length?'部分信息已记录':'待核对'});
  if(!serviceAddress&&!/地址.{0,8}(?:已确认|已登记|：|:|为)/.test(confirmedText))addPending('确认服务地址');
  if(!(contactName&&contactPhone)&&!/(?:家属|联系人).{0,6}(?:已确认|已登记|：|:|为)/.test(confirmedText))addPending('确认家属与联系人');
  if(!/预订项目.{0,8}已确认|已确认.{0,8}项目清单/.test(confirmedText))addPending('核对预订项目清单');
  if(!/定金|订金/.test(confirmedText))addPending('记录已付定金及支付方式');

  const workflow=session.customerId&&session.deceasedId&&state.customers.some(c=>c.id===session.customerId&&c.deceased?.some(d=>d.id===session.deceasedId))?readServiceWorkflow(state,staff,session.customerId,session.deceasedId):undefined;
  steps.push({id:'notice',title:'讣告与亲友通知',detail:workflow?.noticeReady?'本次讣告已由家属确认并发布，具体告别安排以当前确认版本为准。':'如家属需要发布讣告，先核对姓名、日期、时间和地点；经家属确认后再发布。',status:workflow?.noticeReady?'已发布':'按需办理'});
  if(workflow)for(const stage of workflow.stages.filter(x=>x.task||x.id==='notice'&&workflow.noticeReady))steps.push({id:`service-progress-${stage.id}`,title:stage.title,detail:stage.needsReview?'安排有变化，需重新核对。':stage.task?.scheduledAt?`约定时间：${stage.task.scheduledAt.replace('T',' ')}。具体衔接请与服务人员核对。`:'具体安排请与服务人员核对。',status:stage.needsReview?'待核对':stage.progress});

  const faithKnown=!isUnknown(guided.faith)&&guided.faith!=='无特定信仰';
  const faithDetail=isUnknown(guided.faith)
    ?'信仰与仪式偏好尚未确认，不安排宗教仪式。'
    :guided.faith==='无特定信仰'
      ?'记录为无特定信仰，不据此安排宗教仪式。'
      :`当前记录的信仰为「${guided.faith}」；具体仪式、布置和主持人员由家属确认后再衔接，不作预设。`;
  steps.push({id:'farewell',title:'告别与仪式安排',detail:faithDetail,status:faithKnown?'待家属核对':isUnknown(guided.faith)?'待确认':'按家属意愿'});
  if(isUnknown(guided.faith))addPending('确认家属的信仰与仪式意愿');

  steps.push({id:'cremation',title:'火化与骨灰交接',detail:'火化预约、办理材料及骨灰交接按殡仪馆实际流程核实；骨灰盒等用品仅按已确认清单核对。',status:'待确认'});
  if(saleLines.length)steps.push({id:'confirmed-items',title:'已确认销售项目',detail:`关联的已确认报价列有：${[...new Set(saleLines)].join('、')}。以报价明细为准。`,status:'已确认'});

  const familyStatements=[guided.notes,...(session.messages||[]).filter(message=>message.role==='user').map(message=>message.text),...confirmed].join('；');
  const followupMention=familyStatements.split(/[。！？；\n]/).some(part=>!/(?:不需要|不要|无需|不安排|暂不|不确定|未决定|尚未决定)/.test(part)&&/(?:需要|安排|想做|想安排|预订|购买|已确认).{0,8}(?:五七|做七|落土|下葬|安葬)|(?:五七|做七|落土|下葬|安葬).{0,8}(?:需要|安排|想做|预订|购买|已确认)/.test(part));
  const followupQuoted=saleLines.some(line=>/五七|做七|落土|下葬|安葬/.test(line));
  if(followupMention||followupQuoted)steps.push({id:'later-rites',title:'后续项目单独确认',detail:'当前记录已提及七祭、落土或安葬相关安排；具体日期和项目按家属意愿另行核对，不自动加入本次报价。',status:'待单独确认'});

  if(!timeKnown)addPending('确认治丧或告别时间');
  if(summary?.nextActions)for(const action of summary.nextActions)addPending(action);
  const familyPrepared=[...new Set(sessions.flatMap(item=>item.ai?.summary?.prepared||[]))];
  if(sessions.some(item=>item.guided?.plan?.needs.clothes==='prepared')&&!familyPrepared.some(item=>/寿衣|衣物|衣服/.test(item)))familyPrepared.push('寿衣或衣物已由家属准备，按实际使用核对');
  const familySupplies=sessionsNewestFirst.find(item=>item.guided?.familySupplies?.trim())?.guided?.familySupplies?.trim();
  if(familySupplies)familyPrepared.push(...familySupplies.split(/[，,、；;\n]+/).map(item=>item.trim()).filter(Boolean));
  if(guided.scenario==='home'&&!noHall&&plan?.needs.decoration==='needed')familyPrepared.push('仅在家中设灵堂时核对门板、方凳、靠背椅、供桌、供品及家属自备衣物与洗漱用品；以家属选择和当地实际为准');
  const agencyPrepared=saleLines.map(item=>`按已确认报价准备或衔接：${item}`);
  return {title:'本次丧事流程',scenario,steps,pending:[...new Set(pending)],familyPrepared:[...new Set(familyPrepared)],agencyPrepared};
}
