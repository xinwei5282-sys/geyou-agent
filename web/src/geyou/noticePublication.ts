import {noticeMatchesSchedule} from './noticeSchedule';
import type {AppState, Notice, Staff} from './types';
import {updateServiceInfo} from './model';
import {validateNoticeBinding} from './memorialModel';
import {validateNoticePublication} from './serviceAutomation';

// Publication confirmation includes the date shown in the notice. Drafts do not
// change the service schedule; existing appointments retain their review flag.
export function prepareNoticePublication(state:AppState, staff:Staff, notice:Notice):AppState {
  if(!notice.familyConfirmedAt||!notice.familyConfirmedBy)throw Error('请先与家属确认本次讣告内容');
  validateNoticeBinding(state,staff,notice);
  let next=updateServiceInfo(state,notice.customerId!,staff,{dates:{farewell:notice.ceremonyDate.slice(0,10)}},notice.deceasedId!);
  next={...next,customers:next.customers.map(c=>c.id===notice.customerId&&c.agencyId===notice.agencyId?{...c,deceased:c.deceased?.map(d=>d.id===notice.deceasedId&&d.service?{...d,service:{...d.service,tasks:d.service.tasks.map(t=>t.flowStageId==='farewell'&&t.status!=='已取消'&&t.scheduledAt?.slice(0,16)!==notice.ceremonyDate.slice(0,16)?{...t,scheduledAt:notice.ceremonyDate.slice(0,16),remindAt:notice.ceremonyDate.slice(0,16),date:notice.ceremonyDate.slice(0,10),needsReview:'家属确认的讣告告别时间已同步，请复核人员、场地及原安排。',updatedAt:new Date().toISOString()}:t)}}:d)}:c)};
  validateNoticePublication(next,notice);
  return next;
}

// A pending schedule review must never keep serving the old ceremony details.
export function isPublicNotice(state:AppState,notice:Notice):boolean {
 if(notice.status!=='已发布'||!notice.familyConfirmedAt||!notice.familyConfirmedBy||notice.scheduleReview)return false;
 const customer=state.customers.find(c=>c.id===notice.customerId&&c.agencyId===notice.agencyId),person=customer?.deceased?.find(d=>d.id===notice.deceasedId);
 if(!person||state.agencies.find(a=>a.id===notice.agencyId)?.access?.enabled===false)return false;
 if(person.service?.activeNoticeId&&person.service.activeNoticeId!==notice.id)return false;
 return !!person.service?.dates.farewell&&noticeMatchesSchedule(notice,person.service);
}
