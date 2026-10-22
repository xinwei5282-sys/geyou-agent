import test from 'node:test';
import assert from 'node:assert/strict';
import {referenceReceptionScripts} from './receptionScripts';
import {seedState} from './model';
import type {GuidedSale} from './types';
const guided:GuidedSale={scenario:'advance',subjectName:'',occupation:'',interests:'',faith:'待确认',region:'',budget:100000,notes:'',step:0,selectedProductIds:[]};
test('接待话术按场景区分提前了解与医院当下需要，不替客户做决定',()=>{
 assert.match(referenceReceptionScripts(guided,[],[])[0].text,/暂时不用决定/);
 assert.match(referenceReceptionScripts({...guided,scenario:'hospital'},[],[])[0].text,/眼前需要/);
 assert.match(referenceReceptionScripts({...guided,budget:0},[],[])[0].text,/大致预算/);
 assert.match(referenceReceptionScripts(guided,[],[]).at(-1)!.advice!,/尚未选择商品/);
});
test('商品讲解和清单确认使用实际价格、数量及预算差额',()=>{
 const p={...seedState().products[0],name:'实际商品',price:68000,unit:'套'};
 const result=referenceReceptionScripts({...guided,faith:'无特定信仰'},[p],[{productId:p.id,name:p.name,price:p.price,quantity:2,unit:p.unit,kind:p.kind}]);
 assert.match(result[1].text,/实际商品/);assert.match(result[1].text,/680/);
 assert.match(result[2].advice!,/1,360/);assert.match(result[2].text,/360/);assert.match(result[2].text,/更希望调整哪一项/);
});

test('已备用品、偏好与最新顾虑形成具体业务员建议',()=>{
 const g={...guided,faith:'基督教',interests:'素雅',notes:'客户对款式不满意',plan:{phase:'packages' as const,processPosition:'advance' as const,needs:{clothes:'prepared' as const},scopeConfirmed:true,packages:[],continuation:'undecided' as const}};
 const result=referenceReceptionScripts(g,[],[]);assert.match(result[0].advice!,/已准备寿衣/);assert.match(result[0].advice!,/素雅/);assert.match(result.at(-1)!.advice!,/不满意/);
 const confirmed=referenceReceptionScripts({...g,plan:{...g.plan,outcome:'confirmed'}},[],[]);assert.equal(confirmed.length,1);assert.match(confirmed[0].advice!,/保留原报价/);
});
test('寿衣信息不足时给完整承接话术，只问一个缺口，不先报价',()=>{
 const scripts=referenceReceptionScripts({...guided,notes:'客户说我想看看寿衣'},seedState().products.filter(p=>p.category==='寿衣'),[]);
 assert.equal(scripts.length,1);assert.match(scripts[0].text,/男士.*女士/);assert.match(scripts[0].text,/不用.*决定|暂时不用决定/);assert.doesNotMatch(scripts[0].text,/980|去世|辛苦/);assert.equal((scripts[0].text.match(/？/g)||[]).length,1);
 const age=referenceReceptionScripts({...guided,notes:'想看寿衣',subjectGender:'男士'},[],[]);assert.match(age[0].text,/年龄|年纪/);assert.doesNotMatch(age[0].text,/男士.*女士|预算/);
});
test('家属明确暂停时备用话术停止询问和选品',()=>{
 const scripts=referenceReceptionScripts({...guided,notes:'家属哭着说不想聊了'},seedState().products,[]);
 assert.equal(scripts.length,1);assert.match(scripts[0].text,/先不谈|先不聊/);assert.doesNotMatch(scripts[0].text,/？|预算|商品|坚强|想开点/);
});
