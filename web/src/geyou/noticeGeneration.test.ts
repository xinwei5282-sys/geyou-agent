import test from 'node:test';
import assert from 'node:assert/strict';
import {noticeGenerationKey,defaultNoticeText,syncDefaultNoticeText} from './noticeGeneration';
import type {Notice} from './types';
const notice:Notice={id:'test',agencyId:'a',name:'测试',age:'82',date:'2026-10-09',ceremonyDate:'2026-10-12T09:00',location:'测试厅',text:'原正文',status:'草稿',createdAt:'2026-10-09'};
test('template and portrait changes allow generated text to merge',()=>{assert.equal(noticeGenerationKey({...notice,template:'flower',portrait:'image'}),noticeGenerationKey(notice));});
test('changed identity, facts or manual text preserve the current draft',()=>{for(const key of ['id','customerId','deceasedId','name','age','date','ceremonyDate','location','text'] as const)assert.notEqual(noticeGenerationKey({...notice,[key]:'changed'}),noticeGenerationKey(notice));});

test('default notice inserts provided facts and explicitly marks missing facts',()=>{const text=defaultNoticeText(notice);assert.match(text,/测试于2026年10月9日逝世，享年82岁/);assert.match(text,/2026年10月12日 09:00在测试厅/);const missing=defaultNoticeText({...notice,name:'',age:'',date:'',ceremonyDate:'',location:''});for(const field of ['姓名','享年','离世日期','告别时间','告别地点'])assert.ok(missing.includes(field+'待家属确认'));});
test('default tracks form facts while preserving manually edited and AI text',()=>{const original={...notice,text:defaultNoticeText(notice)};const changed={...original,name:'新姓名'};assert.match(syncDefaultNoticeText(original,changed).text,/新姓名于/);assert.equal(syncDefaultNoticeText(original,{...changed,text:'自定义正文'}).text,'自定义正文');assert.equal(syncDefaultNoticeText(notice,{...notice,text:''}).text,defaultNoticeText(notice));});
