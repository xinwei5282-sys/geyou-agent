import {COMMUNICATION_EXAMPLES} from './communicationExamples';
import type {AppState,Staff,Customer,Line} from './types';
import {hasStaffModule,setServiceDeal,updateServiceInfo,saveServiceTask,now} from './model';
import {createGuidedSale,saveGuidedSale} from './guidedSalesModel';
import {savePlannedResult} from './plannedResultModel';
import {confirmSaleAndQuote,recordSalePayment} from './saleSettlementModel';
import {saveServiceStage} from './serviceWorkflow';
import {syncNoticeWorkflow} from './serviceAutomation';
export const communicationDemoId=(staff:Staff)=>`communication-demo-${staff.agencyId}-${staff.id}`;
export function ensureCommunicationDemo(state:AppState,staff:Staff){
 if(!hasStaffModule(state,staff,'talk')||!hasStaffModule(state,staff,'customers'))throw Error('需要客户档案与服务沟通权限才能体验案例');
 const customerId=communicationDemoId(staff),deceasedId=`${customerId}-father`;
 const existing=state.consultations?.find(c=>c.customerId===customerId&&c.deceasedId===deceasedId&&c.guided?.plan?.selectedLines?.some(l=>l.productId===`${customerId}-clothes`));
 if(existing)return populateHistory(state,existing.id);
 const at=now();
 const customer:Customer={id:customerId,agencyId:staff.agencyId,ownerId:staff.id,name:'沟通验证案例（测试）',phone:'',region:'杭州',budget:0,stage:'跟进中',note:'独立测试案例，请勿作为真实家属业务。测试时间为2026-10-23。',createdAt:at,followups:[],deceased:[{id:deceasedId,name:'验证父亲（测试）',age:'80',relationship:'父亲',portraits:[{id:`${customerId}-portrait`,original:'/reference-art/portrait-source.png',result:'/reference-art/notice-demo-portrait.png',status:'已完成',createdAt:at,promptVersion:'demo-image-reference-only'}]}]};
 const products=[{id:`${customerId}-ceremony`,agencyId:staff.agencyId,name:'基础告别仪式服务（测试）',category:'礼仪服务',kind:'服务' as const,source:'自有服务' as const,price:120000,unit:'场',enabled:true,description:'仅用于验证案例，不用于实际销售'},{id:`${customerId}-clothes`,agencyId:staff.agencyId,name:'基础寿衣套装（测试）',category:'寿衣',kind:'商品' as const,source:'自有商品' as const,price:98000,unit:'套',enabled:true,description:'仅用于验证案例，不用于实际销售'}];
 let next:AppState={...state,customers:[...state.customers,customer],products:[...state.products,...products]};
 let currentId='',quoteId='';
 for(const [index,product] of products.entries()){
  const created=createGuidedSale(next,staff,{customerId,deceasedId,nickname:customer.name,scenario:'home',subjectName:'验证父亲（测试）',subjectGender:'男',subjectAge:'80',occupation:'',interests:'',faith:'无特定信仰',region:'杭州',budget:0,notes:'隔离测试，已成交后可继续聊天，不修改原清单。'});
  const line:Line={productId:product.id,name:product.name,price:product.price,unit:product.unit,kind:product.kind,quantity:1};
  next=saveGuidedSale(created.state,staff,created.session.id,{plan:{...created.session.guided!.plan!,needs:{[index===0?'ceremony':'clothes']:'needed'},scopeConfirmed:true,phase:'result',selectedLines:[line]}});
  next=savePlannedResult(next,staff,created.session.id,true);
  const sold=confirmSaleAndQuote(next,next.consultations!.find(c=>c.id===created.session.id)!.proposalId!,staff,true);next=sold.state;currentId=created.session.id;quoteId=sold.quote.id;
 }
 next=recordSalePayment(next,staff,quoteId,{amount:100000,date:'2026-10-21',method:'微信',kind:'订金',note:'测试订金，非真实收款',confirmed:true,requestId:`${customerId}-deposit`});
 next=setServiceDeal(next,customerId,deceasedId,staff,'已成交');next=updateServiceInfo(next,customerId,staff,{phase:'治丧筹备',dates:{farewell:'2026-10-23'}},deceasedId);
 next=saveServiceStage(next,staff,customerId,deceasedId,'farewell',{progress:'进行中',scheduledAt:'2026-10-23T10:00',assigneeId:staff.id,handoverNote:'测试预约10点，注意讣告仍为9点。'});
 next=saveServiceTask(next,customerId,staff,{title:'核对告别安排',date:'2026-10-23',items:'核实预约10点与讣告9点的差异，避免重复建立本事项。',message:'内部测试事项',internal:true,assigneeId:staff.id},deceasedId);
 const notice={id:`${customerId}-notice`,agencyId:staff.agencyId,customerId,deceasedId,name:'验证父亲（测试）',age:'80',date:'2026-10-21',ceremonyDate:'2026-10-23T09:00',location:'测试告别厅',text:'本内容仅为原型验证案例，不用于真实通知。',status:'已发布' as const,createdAt:at,familyConfirmedAt:at,familyConfirmedBy:staff.id,scheduleReview:'测试案例：讣告9点与告别预约10点不一致，请重新核对。'};
 next=syncNoticeWorkflow({...next,notices:[...next.notices,notice]},notice,true);
 // Historical fixture goods are not offered as live catalogue products.
 next={...next,products:next.products.map(p=>products.some(d=>d.id===p.id)?{...p,enabled:false}:p),consultations:next.consultations!.map(c=>c.id===currentId?{...c,ai:{category:'clothes',recommendedProductIds:[]},messages:[{role:'assistant',at,text:'这是独立测试案例：同一客户已确认两笔清单，成交2180元、登记订金1000元；遗照已返回修复结果但未采用，告别预约10点、讣告仍为9点。可选择上方问题试聊，并切换沟通流程核对。'}],receptionView:'ai',updatedAt:now()}:c)};
 return populateHistory(next,currentId);
}

function populateHistory(state:AppState,sessionId:string){
 const session=state.consultations!.find(c=>c.id===sessionId)!;
 if(session.communicationHistoryVersion===1)return {state,session};
 const history=COMMUNICATION_EXAMPLES.flatMap((example,index)=>[
  {role:'user' as const,text:example.question,at:new Date(Date.UTC(2026,9,21,1,index*2)).toISOString()},
  {role:'assistant' as const,text:example.referenceReply,at:new Date(Date.UTC(2026,9,21,1,index*2+1)).toISOString()}
 ]);
 const preserved=session.messages.filter(m=>!(m.role==='assistant'&&m.text.startsWith('这是独立测试案例：同一客户已确认两笔清单')));
 const updated={...session,communicationHistoryVersion:1 as const,messages:[...history,...preserved]};
 const next={...state,consultations:state.consultations!.map(c=>c.id===session.id?updated:c)};
 return {state:next,session:updated};
}
