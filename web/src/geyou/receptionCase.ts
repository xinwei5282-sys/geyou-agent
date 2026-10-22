import type { AppState, Consultation, GuidedSale, Product, Staff } from './types';
import { isProductAvailable, now } from './model';
import { profileMatch, knownProfile, FAITH_OPTIONS } from './profileMatching';
import { recommendSingleCategory } from './singleCategoryRecommendation';
import { referenceReceptionScripts } from './receptionScripts';

export const CASE_INITIAL_TEXT = '父亲在医院，想先准备寿衣，其他安排还没想好。';
export const CASE_REPLIES = [
  '预算大概1500元，喜欢棉质、素雅款，没有宗教要求，骨灰盒已经备好。',
  '我觉得费用偏高，想再省一些。',
  '我选基础棉质款，下一步需要核对什么？',
] as const;

const defaultGuided = (): GuidedSale => ({
  scenario: 'hospital', subjectName: '', occupation: '', interests: '', faith: '待确认', region: '',
  budget: 0, notes: '', step: 0, selectedProductIds: [],
});

function parseBudget(text: string): number | undefined {
  const match = text.match(/预算\s*(?:(?:大概|大约|约|是|在|控制在)\s*)?(\d+(?:\.\d+)?)\s*(元|块)/);
  if (!match) return undefined;
  const yuan = Number(match[1]);
  const cents = Math.round(yuan * 100);
  return Number.isFinite(yuan) && yuan >= 0 && yuan <= 100_000_000 && Number.isSafeInteger(cents) ? cents : undefined;
}

function updateGuided(previous: GuidedSale, text: string): GuidedSale {
  const guided: GuidedSale = { ...previous };
  if (/医院|住院/.test(text)) guided.scenario = 'hospital';
  else if (/在家办理|居家安排|家中治丧|家里办理|回家安置/.test(text)) guided.scenario = 'home';
  else if (/提前咨询|提前准备/.test(text)) guided.scenario = 'advance';

  const budget = parseBudget(text);
  if (budget !== undefined) guided.budget = budget;

  if (/无宗教|没有宗教|没有信仰|不信教|无特定信仰/.test(text)) guided.faith = '无特定信仰';
  else {
    const explicitFaith = FAITH_OPTIONS.find(faith => text.includes(faith));
    if (explicitFaith) guided.faith = explicitFaith;
  }

  const preferences: string[] = [];
  if (/棉质|棉料|棉/.test(text) && !/不喜欢.{0,6}棉|不要.{0,6}棉|不想要.{0,6}棉/.test(text)) preferences.push('棉质');
  if (/素雅|简约|简洁/.test(text) && !/不喜欢.{0,6}(素雅|简约|简洁)|不要.{0,6}(素雅|简约|简洁)/.test(text)) preferences.push('素雅');
  if (preferences.length) guided.interests = [...new Set([guided.interests, ...preferences].filter(Boolean))].join('、');

  const preparedUrn = /(?:骨灰盒.{0,10}(?:已备|已备好|备好了|准备好了|已经备好|已经准备|家里有)|(?:已备|已备好|备好了|准备好了|已经备好|已经准备).{0,10}骨灰盒)/.test(text);
  const notes = [guided.notes, text].filter(Boolean).join('；');
  guided.notes = notes.slice(-2000);
  if (preparedUrn) {
    const plan = guided.plan || {
      phase: 'scope' as const,
      processPosition: guided.scenario === 'advance' ? 'advance' as const : guided.scenario === 'home' ? 'farewell' as const : 'immediate' as const,
      needs: {}, scopeConfirmed: false, packages: [], continuation: 'undecided' as const,
    };
    guided.plan = { ...plan, needs: { ...plan.needs, urn: 'prepared' } };
  }
  return guided;
}

function currentReply(text: string, guided: GuidedSale, products: Product[]): string {
  const preparedUrn = guided.plan?.needs.urn === 'prepared';
  if (/费用偏高|太贵|再省|超预算/.test(text)) {
    return `我会先按您已说明的预算和偏好比较本店可售的寿衣款式${preparedUrn ? '，骨灰盒已备，不会重复列入' : ''}；是否调整项目由您确认后再操作。`;
  }
  if (/我选|下一步|核对/.test(text)) {
    return '收到，您倾向这款。我先保留这个意向；加入清单前请核对规格、数量和价格，确认后再由您决定是否加入。';
  }
  if (parseBudget(text) !== undefined || /宗教要求|宗教信仰|骨灰盒.{0,8}(已备|备好|准备好)/.test(text)) {
    const budget = guided.budget > 0 ? `已记录参考预算${(guided.budget / 100).toLocaleString('zh-CN')}元` : '预算尚未明确';
    return `谢谢补充，${budget}${guided.interests ? `，也记录了${guided.interests}偏好` : ''}${preparedUrn ? '，骨灰盒已备，不会重复推荐' : ''}。${products.length ? '我先按这些信息展示可售寿衣供您比较。' : '我会先保留已有资料，业务员可继续补充确认。'}`;
  }
  if (text === CASE_INITIAL_TEXT || /医院|住院/.test(text)) {
    return '我们先聚焦眼前需要准备的寿衣，其他安排可以稍后再谈。您方便说一下大致预算范围吗？信仰和其他安排可以之后再按您的意愿确认。';
  }
  return '收到。我会结合目前明确的信息继续，尚未确认的内容先保留；您可以补充预算、习俗或偏好，业务员也可按现场沟通补记。';
}

function availableClothes(state: AppState, staff: Staff, guided: GuidedSale): Product[] {
  if (guided.budget <= 0 && !knownProfile(guided.faith)) return [];
  const ranked = recommendSingleCategory(state, staff, guided, 'clothes').items;
  const available = ranked
    .map(item => item.product)
    .filter(product => product.agencyId === staff.agencyId && isProductAvailable(state, product))
    .filter(product => !profileMatch(product, guided, state.masterProducts.find(master => master.id === product.masterId)).conflict)
    .filter(product => !product.religion || (guided.faith !== '无特定信仰' && knownProfile(guided.faith) && product.religion === guided.faith))
    .filter((product, _, all) => guided.budget <= 0 || !all.some(candidate => candidate.price <= guided.budget) || product.price <= guided.budget);
  const costConcern = /费用偏高|太贵|再省|预算不够|超预算/.test(guided.notes);
  if (costConcern) available.sort((a, b) => a.price - b.price || a.id.localeCompare(b.id));
  return available.slice(0, guided.budget > 0 && knownProfile(guided.faith) ? 3 : 1);
}

function caseScripts(guided: GuidedSale, products: Product[], record: Consultation): { title: string; advice: string; text: string }[] {
  const lines = guided.plan?.selectedLines || [];
  const reference = referenceReceptionScripts(guided, products, lines);
  const stage = reference[0];
  const itemProduct = products[0];
  const costConcern = /费用偏高|太贵|再省|预算不够|超预算/.test(guided.notes);
  const concern = costConcern
    ? reference.find(script => /费用/.test(script.title))
    : /我选|选择|下一步|核对/.test(guided.notes)
      ? reference.find(script => /清单|下一步/.test(script.title))
      : undefined;
  const lowestPrice = products[0];
  const missingBudgetAndFaith = guided.budget <= 0 && !knownProfile(guided.faith);
  return [
    {
      title: '需求阶段',
      advice: stage?.advice || '先确认目前最急需处理的事项，其他安排按家属节奏沟通。',
      text: stage?.text || '我们先按您眼前最需要处理的事项沟通，其他安排可以稍后再谈。',
    },
    itemProduct
      ? {
          title: '实际商品说明',
          advice: `本店可售商品「${itemProduct.name}」${itemProduct.spec ? `规格为${itemProduct.spec}，` : ''}售价${(itemProduct.price / 100).toLocaleString('zh-CN')}元/${itemProduct.unit}。先解释实际材质与规格，再由家属核对是否符合偏好。`,
          text: `本店目前有「${itemProduct.name}」，${itemProduct.spec ? `${itemProduct.spec}，` : ''}${(itemProduct.price / 100).toLocaleString('zh-CN')}元/${itemProduct.unit}。您可以先看商品资料，再决定是否适合。`,
        }
      : {
          title: '实际商品说明',
          advice: '当前预算或信仰信息尚未确认，先补问后再展示商品；目前没有向家属作具体商品承诺。',
          text: '在查看商品前，我先确认您大致可接受的预算范围。',
        },
    {
      title: '当前顾虑与下一步',
      advice: costConcern
        ? `先确认家属想保留的必要项目，并优先比较本店可售的低价款${lowestPrice ? `「${lowestPrice.name}」（${(lowestPrice.price / 100).toLocaleString('zh-CN')}元/${lowestPrice.unit}）` : ''}；商品由家属核对后再决定是否加入，不自动加购。`
        : concern?.advice || (record.guided?.plan?.outcome === 'confirmed'
        ? '清单已确认，只复核或记录补充事项，不修改已确认清单。'
        : missingBudgetAndFaith
          ? '当前预算和信仰均未确认，先只补问预算；其他资料按家属意愿稍后再沟通。'
          : '预算、信仰或已有安排未确认时先补问；客户明确选择后再由业务员核对商品、数量和价格。'),
      text: costConcern
        ? `我们可以先看${lowestPrice ? `「${lowestPrice.name}」，目前售价${(lowestPrice.price / 100).toLocaleString('zh-CN')}元/${lowestPrice.unit}` : '本店价格较低的可售款式'}，再逐项核对是否符合您的需要；您确认后才加入清单。`
        : concern?.text || (record.guided?.plan?.outcome === 'confirmed'
        ? '已确认的安排会保留不变；若要补充内容，我们可以另行记录并核对。'
        : '您希望先核对预算、习俗，还是商品规格？确认前我不会把商品加入清单。'),
    },
  ];
}

/** Applies one explicit, local reception-case turn without adding selections or changing other records. */
export function simulateReceptionCase(state: AppState, staff: Staff, record: Consultation, text: string): Consultation {
  const previous = record.guided || defaultGuided();
  const guided = updateGuided(previous, text);
  const products = availableClothes(state, staff, guided);
  const reply = currentReply(text, guided, products);
  const messages = [...record.messages, { role: 'user' as const, text }, { role: 'assistant' as const, text: reply }];
  return {
    ...record,
    messages,
    guided,
    ai: {
      ...(record.ai || { category: 'clothes' as const }),
      category: 'clothes',
      recommendedProductIds: products.map(product => product.id),
      staffScript: caseScripts(guided, products, record),
    },
    updatedAt: now(),
  };
}
