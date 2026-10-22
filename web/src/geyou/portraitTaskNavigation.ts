import type {Customer} from './types';

// Continue this person's latest photo task; never create another upload just to view it.
export function portraitTaskEntry(customer:Customer,deceasedId:string|undefined,taskId:string){
 const person=customer.deceased?.find(d=>d.id===deceasedId);
 if(!person)return {route:`/customers?customer=${encodeURIComponent(customer.id)}&tab=basic`,label:'关联服务对象'};
 const params=new URLSearchParams({customer:customer.id,deceased:person.id,workflow:'1',returnTask:taskId});
 const record=person.portraits.at(-1);
 if(!record){params.set('new','1');return {route:`/restoration?${params}`,label:'上传遗照'};}
 params.set('portrait',record.id);
 const label=record.confirmedAt?'查看已采用照片':record.status==='处理中'?'查看修复进度':record.status==='已完成'&&record.result?'查看修复结果':record.status==='失败'?'重试照片修复':'继续照片修复';
 return {route:`/restoration?${params}`,label};
}
