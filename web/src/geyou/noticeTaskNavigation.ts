import {noticeMatchesSchedule} from './noticeSchedule';
import type {AppState,Customer,ServiceTask} from './types';
export function noticeTaskEntry(state:Pick<AppState,'notices'>,customer:Customer,deceasedId:string|undefined,task:ServiceTask){
 const person=customer.deceased?.find(d=>d.id===deceasedId);
 if(!person)return {route:`/customers?customer=${encodeURIComponent(customer.id)}&tab=basic`,label:'关联服务对象'};
 const params=new URLSearchParams({customer:customer.id,deceased:person.id,workflow:'1',returnTask:task.id});
 const related=state.notices.filter(n=>n.agencyId===customer.agencyId&&n.customerId===customer.id&&n.deceasedId===person.id);
 const activeId=person.service?.activeNoticeId;
 const notice=activeId?related.find(n=>n.id===activeId):related.find(n=>n.id===task.noticeId)||related.at(-1);
 if(!notice){params.set('new','1');return {route:`/content?${params}`,label:'制作讣告'};}
 params.set('notice',notice.id);
 const ready=[notice.name,notice.age,notice.date,notice.ceremonyDate,notice.location,notice.text].every(v=>v.trim());
 const needsReview=!!notice.scheduleReview||notice.status==='已发布'&&!!person.service&&!noticeMatchesSchedule(notice,person.service);
 if(notice.status==='已发布'&&ready&&notice.familyConfirmedAt&&notice.familyConfirmedBy&&!needsReview){params.set('view','detail');return {route:`/content?${params}`,label:'查看已发布讣告'};}
 const label=needsReview?'重新核对讣告':notice.status==='已撤回'?'修改后重新发布':ready?'核对并发布讣告':'继续制作讣告';
 return {route:`/content?${params}`,label};
}
