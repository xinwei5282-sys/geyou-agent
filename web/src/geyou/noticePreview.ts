import type {Notice} from './types';
export const NOTICE_PREVIEW_PREFIX='geyou-notice-preview:';
export const NOTICE_PREVIEW_TTL=7*24*60*60*1000;
export type NoticePreview={notice:Notice;phone:string;createdAt:number};
export function readNoticePreview(storage:Pick<Storage,'getItem'>,id:string,now=Date.now()):NoticePreview|undefined{
 if(!/^[a-f0-9-]{36}$/.test(id))return;
 try{const value=JSON.parse(storage.getItem(NOTICE_PREVIEW_PREFIX+id)||'null');if(value&&now-value.createdAt<NOTICE_PREVIEW_TTL&&typeof value.createdAt==='number'&&typeof value.phone==='string'&&value.notice&&['id','name','age','text','ceremonyDate','location'].every(key=>typeof value.notice[key]==='string'))return value;}catch{}
}
export function saveNoticePreview(storage:Pick<Storage,'setItem'>,id:string,notice:Notice,phone:string){storage.setItem(NOTICE_PREVIEW_PREFIX+id,JSON.stringify({notice,phone,createdAt:Date.now()}));}
