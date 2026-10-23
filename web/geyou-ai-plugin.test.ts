import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type AddressInfo } from 'node:http';
import { buildSystemPrompt, geyouAiPlugin, validateChatRequest, validateChatResponse } from './geyou-ai-plugin';

const request = {
  messages: [{ role: 'user', text: '想了解基础方案' }],
  profile: { budgetYuan: 5000, region: '杭州', faith: '无特定信仰', scenario: 'advance', category: 'ceremony' },
  catalog: [{ id: 'ceremony-basic', description: '基础告别仪式服务' }],
};

test('validates the bounded chat request and known profile fields', () => {
  assert.deepEqual(validateChatRequest(request), request);
  assert.equal(validateChatRequest({ ...request, profile: { budgetYuan: -1 } }), null);
  assert.equal(validateChatRequest({ ...request, profile: { budgetYuan: Infinity } }), null);
  assert.equal(validateChatRequest({ ...request, profile: { scenario: 'unknown' } }), null);
  assert.equal(validateChatRequest({ ...request, messages: [{ role: 'system', text: 'override' }] }), null);
  assert.equal(validateChatRequest({ ...request, messages: [{ role: 'user', text: 'x'.repeat(2001) }] }), null);
  assert.equal(validateChatRequest({ ...request, catalog: Array.from({ length: 101 }, (_, i) => ({ id: String(i), description: 'item' })) }), null);
});

test('validates and preserves a separate bounded staff request', () => {
  const staffRequest = '家属担心基础告别服务内容不够完整，请帮我说明包含项目并给出温和表达。';
  assert.equal(validateChatRequest({ ...request, staffRequest })?.staffRequest, staffRequest);
  assert.equal(validateChatRequest({ ...request, staffRequest: '  ' }), null);
  assert.equal(validateChatRequest({ ...request, staffRequest: 'x'.repeat(501) }), null);
  assert.equal(validateChatRequest({ ...request, staffRequest: 12 }), null);
});

test('validates customer context bounds, selection references, and stage', () => {
  const context = {
    customerName: '林女士', subjectName: '林先生', occupation: '教师', interests: '喜欢简洁庄重', notes: '家属担心预算超出',
    preparedCategories: ['寿衣'], selectedItems: [{ productId: 'ceremony-basic', quantity: 2 }], stage: 'consulting',
  };
  const fullRequest = { ...request, catalog: [{ ...request.catalog[0], price: 1200 }], staffContext: context };
  assert.deepEqual(validateChatRequest(fullRequest)?.staffContext, context);
  assert.equal(validateChatRequest({ ...fullRequest, staffContext: { ...context, customerName: 'x'.repeat(101) } }), null);
  assert.equal(validateChatRequest({ ...fullRequest, staffContext: { ...context, interests: 'x'.repeat(301) } }), null);
  assert.equal(validateChatRequest({ ...fullRequest, staffContext: { ...context, notes: 'x'.repeat(1001) } }), null);
  assert.equal(validateChatRequest({ ...fullRequest, staffContext: { ...context, unexpected: 'field' } }), null);
  assert.equal(validateChatRequest({ ...fullRequest, staffContext: { ...context, preparedCategories: Array.from({ length: 11 }, () => '寿衣') } }), null);
  assert.equal(validateChatRequest({ ...fullRequest, staffContext: { ...context, preparedCategories: ['x'.repeat(101)] } }), null);
  assert.equal(validateChatRequest({ ...fullRequest, staffContext: { ...context, selectedItems: [{ productId: 'missing', quantity: 1 }] } }), null);
  assert.equal(validateChatRequest({ ...fullRequest, staffContext: { ...context, selectedItems: [{ productId: 'ceremony-basic', quantity: 1.5 }] } }), null);
  assert.equal(validateChatRequest({ ...fullRequest, staffContext: { ...context, selectedItems: [{ productId: 'ceremony-basic', quantity: 1000 }] } }), null);
  assert.equal(validateChatRequest({ ...fullRequest, staffContext: { ...context, selectedItems: [{ productId: 'ceremony-basic', quantity: 1, note: 'extra' }] } }), null);
  assert.equal(validateChatRequest({ ...fullRequest, staffContext: { ...context, stage: 'done' } }), null);
});

test('preserves validated catalog fields and supports the earlier brief catalog shape', () => {
  const fullCatalogItem = {
    id: 'ceremony-basic', name: '基础告别服务', category: '礼仪服务', price: 1200,
    religion: '', description: '流程沟通与现场引导', spec: '基础版',
  };
  assert.deepEqual(validateChatRequest({ ...request, catalog: [fullCatalogItem] })?.catalog, [fullCatalogItem]);
  assert.deepEqual(validateChatRequest(request)?.catalog, request.catalog);
  assert.equal(validateChatRequest({ ...request, catalog: [{ ...fullCatalogItem, price: '1200' }] }), null);
  assert.equal(validateChatRequest({ ...request, catalog: [{ ...fullCatalogItem, description: 'x'.repeat(401) }] }), null);
});

test('rejects model products outside the supplied catalog and caps recommendations at three', () => {
  assert.deepEqual(validateChatResponse({ reply: '可以先看看这项。', profile: {}, productIds: ['ceremony-basic'] }, request.catalog), {
    reply: '可以先看看这项。', profile: {}, productIds: ['ceremony-basic'],
  });
  assert.equal(validateChatResponse({ reply: '推荐', profile: {}, productIds: ['invented'] }, request.catalog), null);
  assert.equal(validateChatResponse({ reply: '推荐', profile: {}, productIds: ['ceremony-basic', 'ceremony-basic'] }, request.catalog), null);
  assert.equal(validateChatResponse({ reply: '推荐', profile: {}, productIds: ['ceremony-basic', 'a', 'b', 'c'] }, request.catalog), null);
  assert.equal(validateChatResponse({ reply: '   ', profile: {}, productIds: [] }, request.catalog), null);
  assert.equal(validateChatResponse({ reply: 'x'.repeat(2001), profile: {}, productIds: [] }, request.catalog), null);
  assert.equal(validateChatResponse({ reply: '推荐', profile: { faith: '未知信仰' }, productIds: [] }, request.catalog), null);
});

test('validates optional staff scripts while preserving legacy responses without them', () => {
  const legacy = { reply: '可以先了解基础服务。', profile: {}, productIds: [] };
  assert.deepEqual(validateChatResponse(legacy, request.catalog), legacy);
  const withScript = {
    ...legacy,
    staffScript: [{ title: '说明服务', advice: '先说明服务范围并询问家属最关心的部分。', text: '我先向您介绍本店基础告别服务包含的内容。' }],
  };
  assert.deepEqual(validateChatResponse(withScript, request.catalog), withScript);
  const legacyScript = { ...legacy, staffScript: [{ title: '说明服务', text: '我先说明服务内容。' }] };
  assert.deepEqual(validateChatResponse(legacyScript, request.catalog), legacyScript);
  assert.equal(validateChatResponse({ ...legacy, staffScript: [{ title: ' ', text: '说辞' }] }, request.catalog), null);
  assert.equal(validateChatResponse({ ...legacy, staffScript: [{ title: '标题', text: ' '.repeat(3) }] }, request.catalog), null);
  assert.equal(validateChatResponse({ ...legacy, staffScript: [{ title: '标题'.repeat(16), text: '说辞' }] }, request.catalog), null);
  assert.equal(validateChatResponse({ ...legacy, staffScript: [{ title: '标题', text: '说辞'.repeat(251) }] }, request.catalog), null);
  assert.equal(validateChatResponse({ ...legacy, staffScript: Array.from({ length: 4 }, () => ({ title: '标题', text: '说辞' })) }, request.catalog), null);
  assert.equal(validateChatResponse({ ...legacy, staffScript: [{ title: '标题', advice: ' ', text: '说辞' }] }, request.catalog), null);
  assert.equal(validateChatResponse({ ...legacy, staffScript: [{ title: '标题', advice: '建议'.repeat(251), text: '说辞' }] }, request.catalog), null);
});

test('staff-only mode requires an empty profile and no product selections', () => {
  const reply = { reply: '已整理接待话术供您参考。', profile: {}, productIds: [], staffScript: [{ title: '回应顾虑', text: '您提到的顾虑我理解，我先向您说明服务包含的内容。' }] };
  assert.deepEqual(validateChatResponse(reply, request.catalog, true), reply);
  assert.equal(validateChatResponse({ ...reply, profile: { region: '杭州' } }, request.catalog, true), null);
  assert.equal(validateChatResponse({ ...reply, productIds: ['ceremony-basic'] }, request.catalog, true), null);
});

test('system prompt states the output shape and supported profile enums', () => {
  const prompt = buildSystemPrompt(validateChatRequest(request)!);
  assert.match(prompt, /user 是销售员，不是家属/);
  assert.match(prompt, /reply 面向销售员/);
  assert.match(prompt, /给销售员的非空简短回应/);
  assert.match(prompt, /budgetYuan/);
  assert.match(prompt, /advance\|hospital\|home/);
  assert.match(prompt, /clothes\|urn\|ceremony\|burial/);
  assert.match(prompt, /每轮最多补问一个关键问题/);
  assert.match(prompt, /主动追问/);
  assert.match(prompt, /短回答应关联上一轮补问/);
  assert.match(prompt, /当前需求尚不明确时 productIds 返回空数组/);
  assert.match(prompt, /接运由殡仪馆办理/);
  assert.match(prompt, /未知信仰保持待确认/);
  assert.match(prompt, /不自动加购/);
  assert.match(prompt, /对客话术首先照顾家属情绪/);
  assert.match(prompt, /不把消费与孝心/);
  assert.match(prompt, /先允许暂停/);
  const staffContext = { notes: '最新顾虑是预算超出', preparedCategories: ['寿衣'], selectedItems: [{ productId: 'ceremony-basic', quantity: 2 }], stage: 'confirmed' as const };
  const contextualPrompt = buildSystemPrompt({ ...validateChatRequest(request)!, staffContext });
  assert.match(contextualPrompt, /当前接待资料 staffContext/);
  assert.match(contextualPrompt, /"preparedCategories":\["寿衣"\]/);
  assert.match(contextualPrompt, /"quantity":2/);
  assert.match(contextualPrompt, /已确认时只做复核和后续建议/);
  assert.match(contextualPrompt, /假设、举例、否定内容/);
  const staffOnlyPrompt = buildSystemPrompt({ ...validateChatRequest(request)!, staffRequest: '家属担心服务内容不够完整', staffContext });
  assert.match(staffOnlyPrompt, /业务员的独立内部求助，不属于客户与助手的对话/);
  assert.match(staffOnlyPrompt, /只通过 staffScript/);
  assert.match(staffOnlyPrompt, /不修改 profile（返回空对象）/);
  assert.match(staffOnlyPrompt, /productIds 返回空数组/);
  assert.match(staffOnlyPrompt, /reply 只写一句已完成提示/);
});

test('HTTP gateway forwards validated data and safely handles upstream failures', async () => {
  const originalFetch = globalThis.fetch;
  let upstreamMode: 'success' | 'failure' | 'invalid-json' = 'success';
  let captured: { url: string; init?: RequestInit } | undefined;
  const mockFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    captured = { url: String(input), init };
    if (upstreamMode === 'failure') return new Response('private upstream details', { status: 500 });
    if (upstreamMode === 'invalid-json') return new Response('not-json', { status: 200 });
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        reply: '我可以先介绍基础服务。',
        profile: { category: 'ceremony' },
        productIds: ['ceremony-basic'],
        staffScript: [{ title: '说明服务', advice: '先说明服务范围，再了解家属最关心的部分。', text: '我先向您介绍本店基础告别服务包含的内容。' }],
      }) } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  let middleware: ((req: Parameters<import('node:http').RequestListener>[0], res: Parameters<import('node:http').RequestListener>[1], next: () => void) => unknown) | undefined;
  const plugin = geyouAiPlugin({
    GEYOU_AI_API_KEY: 'test-only-key',
    GEYOU_AI_BASE_URL: 'https://gateway.example/v1/',
    GEYOU_AI_MODEL: 'gateway-test-model',
  });
  plugin.configureServer?.({
    middlewares: { use(handler: typeof middleware) { middleware = handler; } },
  } as never);
  assert.ok(middleware, 'plugin should register its middleware');

  const server = createServer((req, res) => middleware!(req, res, () => {
    res.statusCode = 404;
    res.end();
  }));
  try {
    globalThis.fetch = mockFetch;
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address() as AddressInfo;
    const base = `http://127.0.0.1:${address.port}`;

    const status = await originalFetch(`${base}/api/geyou/chat/status`);
    assert.deepEqual(await status.json(), { configured: true, provider: 'api' });

    const catalog = [{ id: 'ceremony-basic', name: '基础告别服务', category: '礼仪服务', price: 1200, religion: '', description: '流程沟通与现场引导', spec: '基础版' }];
    const chatBody = { ...request, catalog };
    const success = await originalFetch(`${base}/api/geyou/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(chatBody),
    });
    assert.equal(success.status, 200);
    assert.deepEqual(await success.json(), {
      reply: '我可以先介绍基础服务。',
      profile: { category: 'ceremony' },
      productIds: ['ceremony-basic'],
      staffScript: [{ title: '说明服务', advice: '先说明服务范围，再了解家属最关心的部分。', text: '我先向您介绍本店基础告别服务包含的内容。' }],
    });
    assert.equal(captured?.url, 'https://gateway.example/v1/chat/completions');
    assert.equal((captured?.init?.headers as Record<string, string>).Authorization, 'Bearer test-only-key');
    const forwarded = JSON.parse(String(captured?.init?.body));
    assert.equal(forwarded.model, 'gateway-test-model');
    assert.deepEqual(forwarded.response_format, { type: 'json_object' });
    assert.match(forwarded.messages[0].content, /"price":1200/);
    assert.match(forwarded.messages[0].content, /"name":"基础告别服务"/);

    upstreamMode = 'failure';
    const failed = await originalFetch(`${base}/api/geyou/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(chatBody),
    });
    assert.equal(failed.status, 502);
    const failedBody = await failed.text();
    assert.match(failedBody, /AI 服务暂时不可用/);
    assert.doesNotMatch(failedBody, /private upstream details|test-only-key/);

    upstreamMode = 'invalid-json';
    const invalid = await originalFetch(`${base}/api/geyou/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(chatBody),
    });
    assert.equal(invalid.status, 502);
    assert.match(await invalid.text(), /AI 服务暂时不可用/);
  } finally {
    globalThis.fetch = originalFetch;
    if (server.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});


test('quick replies remain bounded, optional and forbidden for staff-only output', () => {
  const base = { reply: '当前最需要了解什么？', profile: {}, productIds: [] };
  const options = ['先了解寿衣', '先了解整体流程', '暂不清楚'];
  assert.deepEqual(validateChatResponse({ ...base, quickReplies: options }, request.catalog)?.quickReplies, options);
  for (const quickReplies of [['重复', '重复'], [' '], ['字'.repeat(61)], Array.from({length:6}, (_,i)=>String(i)), [12]]) assert.equal(validateChatResponse({ ...base, quickReplies }, request.catalog), null);
  assert.equal(validateChatResponse({ ...base, quickReplies: options }, request.catalog, true), null);
  assert.deepEqual(validateChatResponse({ ...base, quickReplies: [] }, request.catalog, true)?.quickReplies, []);
});


test('todo reminders are optional and bounded independently of recommendations', () => {
 const base={reply:'先核实办理渠道。',profile:{},productIds:[],todos:['请家属准备逝者及近亲属有效身份证件，并向签发机构核实要求。']};
 assert.deepEqual(validateChatResponse(base,request.catalog),base);
 for(const todos of [[' '],['字'.repeat(301)],['重复','重复'],[12],Array.from({length:5},(_,i)=>String(i))]) assert.equal(validateChatResponse({...base,todos},request.catalog),null);
});


test('context includes current process stage and actual pricing unit without guessing', () => {
 const input={...request,catalog:[{...request.catalog[0],unit:'套'}],staffContext:{processStage:'certificate'}};
 assert.deepEqual(validateChatRequest(input)?.staffContext,input.staffContext);
 assert.equal(validateChatRequest({...input,staffContext:{processStage:'x'.repeat(101)}}),null);
 assert.equal(validateChatRequest({...input,catalog:[{...input.catalog[0],unit:' '}]}),null);
 const prompt=buildSystemPrompt(validateChatRequest(input)!);
 assert.match(prompt,/"unit":"套"/);assert.match(prompt,/"processStage":"certificate"/);
 assert.match(prompt,/家属核对同意后发布/);assert.match(prompt,/不默认长子/);assert.match(prompt,/不编造金额、资格/);
});

test('three-tier recommendations reference only returned products and distinct tiers', () => {
 const catalog=[{id:'basic',description:'基础款'},{id:'balanced',description:'均衡款'},{id:'upgrade',description:'升级款'}];
 const base={reply:'三档供代理比较。',profile:{occupation:'教师',interests:'素雅',subjectName:'林先生'},productIds:['basic','balanced','upgrade'],recommendations:[{productId:'basic',tier:'low',reason:'基础款'},{productId:'balanced',tier:'mid',reason:'均衡款'},{productId:'upgrade',tier:'high',reason:'升级款'}],upsellTips:['按实际材质差异说明价值，由家属自愿决定。']};
 assert.deepEqual(validateChatResponse(base,catalog),base);
 assert.equal(validateChatResponse({...base,recommendations:[{productId:'missing',tier:'low',reason:'推荐'}]},catalog),null);
 assert.equal(validateChatResponse({...base,productIds:['basic'],recommendations:base.recommendations},catalog),null);
 assert.equal(validateChatResponse({...base,recommendations:[base.recommendations[0],{...base.recommendations[1],tier:'low'}]},catalog),null);
 assert.equal(validateChatResponse({...base,recommendations:[base.recommendations[0],{...base.recommendations[1],productId:'basic'}]},catalog),null);
 assert.equal(validateChatResponse({...base,profile:{occupation:'字'.repeat(101)}},catalog),null);
 assert.equal(validateChatResponse({...base,upsellTips:['字'.repeat(301)]},catalog),null);
 assert.equal(validateChatResponse({...base,profile:{},productIds:[],recommendations:[],upsellTips:['建议升单']},catalog,true),null);
});

test('service subject demographics and customs remain bounded across request and response',()=>{
 const profile={subjectGender:'男士',subjectAge:'60至79岁',customs:'没有特别穿衣要求'};
 assert.deepEqual(validateChatRequest({...request,profile})?.profile,profile);
 assert.deepEqual(validateChatResponse({reply:'先了解习俗',profile,productIds:[]},request.catalog)?.profile,profile);
 assert.equal(validateChatRequest({...request,profile:{subjectAge:'x'.repeat(31)}}),null);
 assert.equal(validateChatResponse({reply:'更正',profile:{occupation:'',faith:'待确认'},productIds:[]},request.catalog)?.profile.occupation,'');
});

test('摘要上下文和参考咨询边界在服务层校验，参考内容不能带入客户事实或推荐',()=>{
 const summary={confirmed:['寿衣尚未准备'],pending:['尺码待确认'],prepared:[],nextActions:['核实尺寸']};
 assert.deepEqual(validateChatRequest({...request,referenceOnly:true,staffContext:{receptionSummary:summary}})?.staffContext?.receptionSummary,summary);
 assert.equal(validateChatRequest({...request,referenceOnly:'true'}),null);
 const result=validateChatResponse({reply:'另一客户参考',scope:'reference',receptionSummary:summary,profile:{faith:'佛教'},productIds:['ceremony-basic'],recommendations:[{productId:'ceremony-basic',tier:'low',reason:'参考'}]},request.catalog);
 assert.deepEqual(result?.profile,{});assert.deepEqual(result?.productIds,[]);assert.deepEqual(result?.recommendations,[]);assert.equal(result?.receptionSummary,undefined);
 assert.equal(validateChatResponse({reply:'错误摘要',profile:{},productIds:[],receptionSummary:{...summary,pending:['x'.repeat(201)]}},request.catalog),null);
});

test('business state snapshot is bounded and prompt distinguishes actual business from browsing or oral claims',()=>{
 const fullRequest={...request,catalog:[{...request.catalog[0],price:1200}]};
 const context={businessFacts:['档案实际服务阶段：治丧筹备。','系统登记收款1000元；待结算1180元。'],stage:'confirmed' as const,selectedItems:[]};
 const parsed=validateChatRequest({...fullRequest,staffContext:context});assert.ok(parsed);assert.deepEqual(parsed.staffContext?.businessFacts,context.businessFacts);
 assert.equal(validateChatRequest({...fullRequest,staffContext:{businessFacts:Array.from({length:17},()=> '事实')}}),null);
 assert.equal(validateChatRequest({...fullRequest,staffContext:{businessFacts:['x'.repeat(301)]}}),null);
 const prompt=buildSystemPrompt(parsed);assert.match(prompt,/processStage只是沟通选购浏览位置/);assert.match(prompt,/不能修改清单/);assert.match(prompt,/新增需求引导在沟通流程中增购/);
});
test('代理版使用纸单与状态专用提示词，不引导不存在的商城或自动执行',()=>{
 const prompt=buildSystemPrompt(validateChatRequest({...request,staffContext:{businessFacts:['代理简版：尚未建档'],stage:'consulting',selectedItems:[]}})!);
 assert.doesNotMatch(prompt,/套餐推荐与温和升单：/);assert.match(prompt,/日期与享年统一以个人信息表单/);assert.match(prompt,/聊天不会执行页面操作/);assert.match(prompt,/证件可上传后进行本机识别/);
});

test('agent archive fields survive the structured response boundary',()=>{
 const profile={subjectName:'张先生',contactName:'张女士',contactPhone:'13800138000',relationship:'父亲',birthDate:'1940-01-01',deathDate:'2026-10-20',farewell:'2026-10-23T10:00',location:'告别厅'};
 const result=validateChatResponse({reply:'已整理资料，待核对。',profile,productIds:[]},[]);
 assert.ok(result);assert.deepEqual(result.profile,profile);
 assert.equal(validateChatResponse({reply:'答复',profile:{contactPhone:'1'.repeat(31)},productIds:[]},[]),null);
});
