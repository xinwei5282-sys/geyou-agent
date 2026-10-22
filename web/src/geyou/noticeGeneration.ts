import type {Notice} from './types';

export function noticeGenerationKey(notice:Notice){return JSON.stringify([notice.id,notice.customerId,notice.deceasedId,notice.name,notice.age,notice.date,notice.ceremonyDate,notice.location,notice.text]);}

type NoticeFacts=Pick<Notice,'name'|'age'|'date'|'ceremonyDate'|'location'>;
function dateLabel(value:string){return value.replace(/^(\d{4})-(\d{2})-(\d{2})/,(_,y,m,d)=>`${y}年${Number(m)}月${Number(d)}日`).replace('T',' ');}
export function defaultNoticeText(notice:NoticeFacts){
 const name=notice.name.trim()||'【姓名待家属确认】';
 const date=notice.date.trim()?dateLabel(notice.date):'【离世日期待家属确认】';
 const age=notice.age.trim()?`享年${notice.age.trim()}岁`:'【享年待家属确认】';
 const ceremony=notice.ceremonyDate.trim()?dateLabel(notice.ceremonyDate):'【告别时间待家属确认】';
 const location=notice.location.trim()||'【告别地点待家属确认】';
 return `${name}于${date}逝世，${age}。\n\n谨定于${ceremony}在${location}举行告别仪式，敬请亲友前来送别。\n\n感谢各位亲友的关怀与慰问。谨此讣告。`;
}
export function syncDefaultNoticeText(previous:Notice,current:Notice):Notice{
 return !current.text.trim()||current.text===defaultNoticeText(previous)?{...current,text:defaultNoticeText(current)}:current;
}
