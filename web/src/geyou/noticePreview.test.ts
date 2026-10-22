import test from 'node:test';
import assert from 'node:assert/strict';
import {readNoticePreview,saveNoticePreview,NOTICE_PREVIEW_PREFIX,NOTICE_PREVIEW_TTL} from './noticePreview';
import type {Notice} from './types';
const id='00000000-0000-0000-0000-000000000001';
const notice:Notice={id:'draft',agencyId:'a',name:'测试',age:'82',date:'2026-10-09',ceremonyDate:'2026-10-12T09:00',location:'测试厅',text:'未保存正文',status:'草稿',createdAt:'2026-10-09'};
test('preview captures unsaved draft without writing business records',()=>{const values=new Map<string,string>();const storage={getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>{values.set(key,value)}};saveNoticePreview(storage,id,notice,'123');notice.text='后续修改';assert.equal(readNoticePreview(storage,id)?.notice.text,'未保存正文');assert.deepEqual([...values.keys()],[NOTICE_PREVIEW_PREFIX+id]);});
test('expired, invalid and malformed previews fail gracefully',()=>{assert.equal(readNoticePreview({getItem:()=>'{bad'},id),undefined);assert.equal(readNoticePreview({getItem:()=>JSON.stringify({notice,phone:'',createdAt:0})},id,NOTICE_PREVIEW_TTL+1),undefined);assert.equal(readNoticePreview({getItem:()=>{throw Error()}},'bad'),undefined);});

test("saved preview remains available after two hours",()=>{const storage={getItem:()=>JSON.stringify({notice,phone:"123",createdAt:1000})};assert.equal(readNoticePreview(storage,id,7201001)?.notice.id,"draft");});
