import {test} from 'node:test';
import assert from 'node:assert/strict';
import {receptionWithPending} from './receptionPending';
import type {Consultation} from './types';
test('发出的消息在保存或切换地址延迟时立即显示，回复后不重复、不串客户',()=>{
 const saved={id:'a',messages:[]} as unknown as Consultation;
 const pending={...saved,messages:[{role:'user' as const,text:'刚发出的信息'}]};
 assert.equal(receptionWithPending(undefined,pending,null),pending);
 assert.equal(receptionWithPending(saved,pending,'a'),pending);
 const replied={...pending,messages:[...pending.messages,{role:'assistant' as const,text:'回复'}]};
 assert.equal(receptionWithPending(replied,pending,'a'),replied);
 assert.equal(receptionWithPending(undefined,pending,'b'),undefined);
});
