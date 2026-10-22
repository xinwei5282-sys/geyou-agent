import test from 'node:test';
import assert from 'node:assert/strict';
import { seedState } from './model';
import { generatePackages } from './packageModel';
import { recommendSingleCategory } from './singleCategoryRecommendation';
import type { GuidedSale } from './types';
import { withConsultationDemo } from './consultationDemo';

const staff = () => seedState().staff.find(s => s.id === 'boss-a')!;
test('医院只需要寿衣时不加入后续服务', () => {
  const s = seedState(); const r = generatePackages(s, staff(), { needs: { clothes: 'needed', ceremony: 'undecided', urn: 'not-needed' }, budget: 120000 });
  assert.ok(r.packages.length); assert.ok(r.packages.every(p => p.lines.every(l => l.name.includes('寿衣'))));
});
test('多个实际寿衣价位生成不同方案', () => {
  const s = seedState(); s.products.push({ ...s.products.find(p => p.id === 'p2')!, id: 'p2b', name: '素朴寿衣基础套装', price: 68000 });
  const r = generatePackages(s, staff(), { needs: { clothes: 'needed' }, budget: 200000 });
  assert.equal(r.packages.length, 2); assert.notEqual(r.packages[0].total, r.packages[1].total);
});
test('单候选只生成一套', () => { const r = generatePackages(seedState(), staff(), { needs: { clothes: 'needed' }, budget: 200000 }); assert.equal(r.packages.length, 1); });
test('缺品返回缺项并提示', () => { const s = seedState(); const r = generatePackages(s, staff(), { needs: { burial: 'needed' }, budget: 200000 }); assert.deepEqual(r.missingNeeds, ['burial']); assert.equal(r.packages.length, 0); });
test('预算推荐尽量在预算内，超出明确提示', () => { const s = seedState(); const r = generatePackages(s, staff(), { needs: { clothes: 'needed' }, budget: 50000 }); assert.ok(r.packages[0].overBudget > 0); assert.ok(r.warnings.some(w => w.includes('超出'))); });
test('隔离下架和排除商品', () => { const s = seedState(); const r = generatePackages(s, staff(), { needs: { urn: 'needed' }, budget: 500000, excludeProductIds: ['p1'] }); assert.equal(r.packages.length, 0); const other = generatePackages(s, staff(), { needs: { urn: 'needed' }, budget: 500000 }); assert.ok(other.packages[0].lines.every(l => !l.name.includes('典藏'))); });
test('无明确需求不生成套餐', () => { const r = generatePackages(seedState(), staff(), { needs: { clothes: 'prepared', ceremony: 'undecided' }, budget: 100000 }); assert.equal(r.packages.length, 0); });
test('非法预算拒绝', () => { assert.throws(() => generatePackages(seedState(), staff(), { needs: { clothes: 'needed' }, budget: -1 }), /预算/); });
test('未设预算时不提示超支；已准备项目不会混入多需求套餐',()=>{
 const r=generatePackages(seedState(),staff(),{needs:{clothes:'needed',urn:'prepared',ceremony:'undecided',flowers:'not-needed'},budget:0});
 assert.ok(r.packages.length);assert.ok(r.packages.every(p=>p.overBudget===0));assert.ok(r.packages.every(p=>p.lines.every(l=>l.productId==='p2')));assert.equal(r.warnings.some(w=>w.includes('超出')),false);
});

const guided = (patch: Partial<GuidedSale> = {}): GuidedSale => ({ scenario:'hospital', subjectName:'', occupation:'', interests:'', faith:'', region:'', budget:0, notes:'', step:0, selectedProductIds:[], ...patch });
test('单类别推荐保留当前代理全部可售商品并给出完整标签', () => {
 const s=seedState(); s.products.push({...s.products.find(p=>p.id==='p2')!,id:'p2b',name:'素雅提花寿衣',price:76000,description:'提花面料，素雅款式'});
 const r=recommendSingleCategory(s,staff(),guided({budget:100000}), 'clothes');
 assert.equal(r.items.length,2); assert.equal(r.items[0].product.id,'p2b'); assert.equal(r.items[0].label,'优先推荐');
});
test('单类别推荐读取明确偏好和否定，不从职业宗教推断', () => {
 const s=seedState(); s.products.push({...s.products.find(p=>p.id==='p2')!,id:'p2b',name:'素雅提花寿衣',price:76000,description:'提花面料'});
 const r=recommendSingleCategory(s,staff(),guided({budget:100000,interests:'偏好提花，但不要传统款式',occupation:'教师',faith:'佛教'}),'clothes');
 assert.equal(r.items[0].product.id,'p2b'); assert.ok(r.items[0].reasons.some(x=>x.includes('提花')));
});
test('单类别推荐无资料时不捏造偏好，跨代理和下架商品不进入', () => {
 const s=seedState(); s.products.push({...s.products.find(p=>p.id==='p2')!,id:'b-clothes',agencyId:'agency-b',enabled:true});
 const r=recommendSingleCategory(s,staff(),guided(),'clothes');
 assert.equal(r.missingProfile,true); assert.equal(r.items.length,1); assert.ok(r.items[0].reasons[0].includes('先看这款'));
});
test('真实演示三款随预算和偏好变化，否定转折不奖励被排除款式',()=>{
 const s=withConsultationDemo(seedState());
 const ranked=(budget:number,interests:string)=>recommendSingleCategory(s,staff(),guided({budget,interests}),'clothes');
 assert.equal(ranked(80000,'喜欢提花').items[0].product.id,'demo-product-clothes-basic');
 assert.equal(ranked(200000,'喜欢藏青提花').items[0].product.id,'demo-product-clothes-jacquard');
 const declined=ranked(200000,'不喜欢提花款但喜欢棉质');
 assert.equal(declined.items.length,3);assert.ok(declined.items[0].reasons.some(r=>r.includes('棉质')));
 const item=declined.items.find(x=>x.product.id==='demo-product-clothes-jacquard')!;
 assert.equal(item.label,'偏好需确认');assert.ok(!item.reasons.some(r=>r.includes('符合您明确提到的提花')));
 const unknown=ranked(0,'');assert.equal(unknown.items[0].label,'先看这款');assert.ok(unknown.items.every(x=>!x.label.includes('预算内')));
 const negativesOnly=ranked(0,'不要提花');assert.equal(negativesOnly.missingProfile,false);
});
test('职业用于追思内容，信仰只匹配明确说明支持的服务，不替用户决定用品',()=>{
 const s=withConsultationDemo(seedState());
 const christian=recommendSingleCategory(s,staff(),guided({faith:'基督教',occupation:'教师',budget:500000}),'ceremony');
 assert.equal(christian.items[0].product.id,'demo-product-ceremony-christian');
 assert.ok(christian.items[0].reasons.some(r=>r.includes('基督教')));
 assert.equal(christian.items.find(x=>x.product.id==='demo-product-ceremony-buddhist')!.label,'偏好需确认');
 const teacher=recommendSingleCategory(s,staff(),guided({occupation:'教师',faith:'待确认',budget:500000}),'ceremony');
 assert.equal(teacher.items[0].product.id,'demo-product-ceremony-personal');assert.ok(teacher.items[0].reasons.some(r=>r.includes('教师经历')));
 const clothes=recommendSingleCategory(s,staff(),guided({faith:'基督教',occupation:'教师',budget:200000}),'clothes');
 assert.equal(clothes.items.length,3);assert.ok(clothes.items.every(x=>!x.reasons.some(r=>r.includes('基督教'))));
});
test('多项目套餐纳入信仰匹配的备选，但只包含本次选定的范围',()=>{
 const s=withConsultationDemo(seedState());
 const result=generatePackages(s,staff(),{needs:{ceremony:'needed',flowers:'needed'},budget:500000,faith:'佛教',occupation:'教师'});
 const recommended=result.packages.find(p=>p.recommended)!;
 assert.ok(recommended.lines.some(l=>l.productId==='demo-product-ceremony-buddhist'));
 assert.equal(recommended.lines.length,2);assert.ok(recommended.profileReasons!.some(r=>r.includes('佛教')));
});
