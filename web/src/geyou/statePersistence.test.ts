import {test} from 'node:test';
import assert from 'node:assert/strict';
import {persistStateUpdate} from './statePersistence';
test('建档、发送、更新接待位置按顺序保存，不因页面延迟渲染覆盖消息',()=>{
 let raw:string|null=null,writes=0;
 const storage={getItem:()=>raw,setItem:(_key:string,value:string)=>{raw=value;writes++}};
 const initial={messages:[] as string[],view:''};let calls=0;
 const created=persistStateUpdate(storage,'test',initial,s=>({...s,view:'new'}));
 const sent=persistStateUpdate(storage,'test',initial,s=>{calls++;return {...s,messages:[...s.messages,'先了解流程']}});
 const positioned=persistStateUpdate(storage,'test',initial,s=>({...s,view:'ai'}));
 assert.equal(created.messages.length,0);assert.deepEqual(sent.messages,['先了解流程']);assert.deepEqual(positioned.messages,sent.messages);assert.equal(calls,1);assert.equal(writes,3);
 assert.deepEqual(JSON.parse(raw!),positioned);
});
test('本地存储失败不返回未保存状态，已有记录保持原样',()=>{
 const original=JSON.stringify({messages:['之前的信息']});let raw=original;
 const storage={getItem:()=>raw,setItem:()=>{throw Error('quota')}};
 assert.throws(()=>persistStateUpdate(storage,'test',{messages:[]},s=>({...s,messages:[...s.messages,'新信息']})),/quota/);
 assert.equal(raw,original);
});
