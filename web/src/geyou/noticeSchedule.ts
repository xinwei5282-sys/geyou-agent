import type {Notice,ServiceRecord} from './types';
export function noticeMatchesSchedule(notice:Notice,service:ServiceRecord){
 if(service.dates.farewell&&service.dates.farewell!==notice.ceremonyDate.slice(0,10))return false;
 const appointment=service.tasks.find(t=>t.flowStageId==='farewell'&&t.status!=='已取消')?.scheduledAt;
 return !appointment||appointment.slice(0,16)===notice.ceremonyDate.slice(0,16);
}
