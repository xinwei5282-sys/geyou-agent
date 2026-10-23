import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateCemeteryAdvice} from './cemeteryAdvice';
import {CEMETERIES,defaultCemeteryNeeds,recommendCemeteries} from './cemeteryModel';
import {buildCemeteryPrompt,CEMETERY_PROMPT_VERSION} from '../../geyou-cemetery-prompt';
import {cemeteryAdviceSchema} from '../../geyou-cemetery-plugin';
import {calculateAgentBazi,emptyAgentProfile} from './agentModel';
const ids=CEMETERIES.map(c=>c.id),valid={analysis:'根据系统四柱分析，墓穴朝向缺失，应先作公墓考察候选。',recommendations:[{cemeteryId:ids[0],reason:'位于意向城市，具体墓穴朝向尚未核实。',missing:['墓穴坐向'],evidence:{chartBasis:'引用系统四柱',ruleBasis:'传统规则需要坐向资料',siteBasis:'公墓在杭州',conclusion:'资料不足，无法证明相符'}}],promptVersion:CEMETERY_PROMPT_VERSION};
valid.recommendations.push({...valid.recommendations[0],cemeteryId:ids[1]});
test('two recommendations are required when available, with one only when the catalog has one',()=>{
 assert.equal(validateCemeteryAdvice(valid,ids),true);
 const one={...valid,recommendations:valid.recommendations.slice(0,1)};
 assert.equal(validateCemeteryAdvice(one,ids),false);
 assert.equal(validateCemeteryAdvice(one,[ids[0]]),true);
 assert.equal(cemeteryAdviceSchema(ids).properties.recommendations.maxItems,2);
 assert.equal(cemeteryAdviceSchema([ids[0]]).properties.recommendations.maxItems,1);
});
test('AI recommendations reject invented cemeteries, duplicate IDs and malformed responses',()=>{
 assert.equal(validateCemeteryAdvice(valid,ids),true);
 assert.equal(validateCemeteryAdvice({...valid,recommendations:[{...valid.recommendations[0],cemeteryId:'invented'}]},ids),false);
 assert.equal(validateCemeteryAdvice({...valid,recommendations:[...valid.recommendations,...valid.recommendations]},ids),false);
 assert.equal(validateCemeteryAdvice({...valid,recommendations:[]},ids),false);
 assert.equal(validateCemeteryAdvice({...valid,analysis:''},ids),false);
 assert.equal(validateCemeteryAdvice({...valid,recommendations:[{...valid.recommendations[0],missing:['x'.repeat(121)]}]},ids),false);
});
test('runtime prompt binds calculated chart and real catalog, separate from reception; schema constrains IDs',()=>{
 const chart=calculateAgentBazi({...emptyAgentProfile(),birthDate:'1944-05-16',birthTime:'08:30',birthplace:'北京时间'}),needs=defaultCemeteryNeeds();
 const prompt=buildCemeteryPrompt(chart,needs,recommendCemeteries(needs));
 assert.ok(chart.ready);if(chart.ready)assert.ok(prompt.includes(chart.pillars[0]));
 assert.ok(prompt.includes('没有墓穴坐向'));assert.ok(prompt.includes('不创建客户、报价、订单或预约'));assert.ok(prompt.includes(CEMETERY_PROMPT_VERSION));
 assert.deepEqual(cemeteryAdviceSchema(ids).properties.recommendations.items.properties.cemeteryId.enum,ids);
});
