import type {AppState,Consultation,Staff} from './types';
import {visibleCustomers,hasStaffModule,canAccessSalesRecord} from './model';
import {getSaleSummary} from './saleSettlementModel';
import {isPublicNotice} from './noticePublication';
import {selectedPortrait} from './memorialModel';

// Read-only, scoped facts for the model; suggestions never write business state.
export function receptionBusinessFacts(state:AppState,staff:Staff,record:Consultation):string[]{
 if(record.ai?.simulation)return [];
 const customer=visibleCustomers(state,staff).find(c=>c.id===record.customerId),person=customer?.deceased?.find(d=>d.id===record.deceasedId);
 if(!customer)return ['本次沟通未关联客户档案，不得宣称已有业务登记。'];
 const facts=[`当前客户：${customer.name.slice(0,100)}；服务对象：${person?.name.slice(0,100)||'未指定逝者，具体服务安排须先关联对象'}。`];
 if(record.guided?.plan?.outcome==='confirmed')facts.push(`当前已确认清单（历史快照，不可直接改写）：${(record.guided.plan.selectedLines||[]).map(l=>`${l.name}×${l.quantity}，单价${l.price/100}元`).join('；').slice(0,240)}。`);
 if(!person?.service)return facts;
 const service=person.service;facts.push(`档案实际服务阶段：${service.phase}；成交状态：${service.dealStage||'待跟进'}。`);
 const farewell=service.tasks.find(t=>t.flowStageId==='farewell'&&t.status!=='已取消');
 facts.push(`告别预约：${farewell?.scheduledAt||service.dates.farewell||'待确认'}${farewell?.needsReview?'，安排待重新核对':''}；安葬日期：${service.dates.burial||'待确认'}。`);
 if(hasStaffModule(state,staff,'restoration'))facts.push(`遗照实际状态：${selectedPortrait(person)?'家属已确认采用':person.portraits.length?'已有照片，尚未采用':'未上传'}。修复返回结果不等于家属已采用。`);
 if(hasStaffModule(state,staff,'content')){
  const notices=state.notices.filter(n=>n.agencyId===record.agencyId&&n.customerId===customer.id&&n.deceasedId===person.id),notice=service.activeNoticeId?notices.find(n=>n.id===service.activeNoticeId):notices.at(-1);
  facts.push(`讣告实际状态：${!notice?'未制作':notice.scheduleReview?'待重新核对':notice.status==='已发布'&&!isPublicNotice(state,notice)?'已发布记录当前不可公开，须重新核对':notice.status}${notice?`；告别时间：${notice.ceremonyDate||'待填写'}`:''}。`);
 }
 const anchor=state.quotes.find(q=>q.customerId===customer.id&&q.deceasedId===person.id&&canAccessSalesRecord(state,staff,q));
 if(anchor){const summary=getSaleSummary(state,staff,anchor.id);facts.push(`本次服务全部有效订单成交合计${summary.total/100}元，系统登记收款${summary.paid/100}元，待结算${summary.balance/100}元${summary.overpaid?'，收款超出有效成交须人工核对':''}。系统登记不代表自动支付回执，客户口述付款不能替代登记。`);}
 for(const task of service.tasks.filter(t=>!['已完成','已取消'].includes(t.status)||t.needsReview).slice(0,8))facts.push(`系统待办：${task.title.slice(0,100)}；${task.date||'时间待定'}；${task.needsReview?'待重新核对':task.status}。`);
 return facts.slice(0,16).map(text=>text.slice(0,300));
}
