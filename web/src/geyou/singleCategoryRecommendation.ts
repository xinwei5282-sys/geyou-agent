import type { AppState, Product, Staff, GuidedSale } from './types';
import type { NeedKey } from './packageTypes';
import { hasStaffModule, isProductAvailable, visibleCustomers } from './model';
import { NEED_OPTIONS } from './packageModel';
import { knownProfile, profileMatch } from './profileMatching';

const TERMS: Record<string, string[]> = {
  简约: ['简约', '素雅', '简洁'], 传统: ['传统', '经典'],
  棉质: ['棉质', '棉'], 提花: ['提花'], 米色: ['米色', '米白'], 藏青: ['藏青', '深蓝'],
  木质: ['木质', '实木', '木纹'], 陶瓷: ['陶瓷', '瓷'],
};
const NEGATION = /(不喜欢|不想要|不要|不考虑|排除|避免|不需要)\s*([^，。；,;\n]{1,16})/g;

function textOf(p: Product, state: AppState): string {
  const master = p.masterId ? state.masterProducts.find(m => m.id === p.masterId) : undefined;
  return [p.name, p.spec, p.description, p.included, master?.spec, master?.description].filter(Boolean).join(' ');
}
function money(cents: number) { return `¥${(cents / 100).toLocaleString('zh-CN', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`; }

export function recommendSingleCategory(state: AppState, staff: Staff, guided: GuidedSale, needKey: NeedKey) {
  if (!hasStaffModule(state, staff, 'talk')) throw new Error('当前账号未开通谈单权限');
  const option = NEED_OPTIONS.find(x => x.key === needKey);
  if (!option) throw new Error('请选择有效的商品类别');
  const candidates = state.products.filter(p => p.agencyId === staff.agencyId && option.categories.includes(p.category) && isProductAvailable(state, p));
  const profile = [guided.interests, guided.notes].filter(Boolean).join(' ');
  const deniedTerms = new Set<string>();
  for (const match of profile.matchAll(NEGATION)) {
    const negativeClause=match[2].split(/但是|但|不过|而是|想要|喜欢|只要|偏好/)[0];
    for (const [term, words] of Object.entries(TERMS)) if (words.some(word => negativeClause.includes(word))) deniedTerms.add(term);
  }
  const positiveTerms = Object.entries(TERMS).filter(([term, words]) => !deniedTerms.has(term) && words.some(word => profile.includes(word))).map(([term]) => term);
  const hasBudget = guided.budget > 0;
  const ranked = candidates.map(product => {
    const source = textOf(product, state);
    const matched = positiveTerms.filter(term => TERMS[term].some(word => source.includes(word)));
    const profileFit=profileMatch(product,guided,state.masterProducts.find(m=>m.id===product.masterId));
    const denied = profileFit.conflict || [...deniedTerms].some(term => TERMS[term].some(word => source.includes(word)));
    const overBudget = hasBudget ? Math.max(0, product.price - guided.budget) : 0;
    const within = hasBudget && overBudget === 0;
    const preferenceScore = denied ? -100 : matched.length+profileFit.score;
    return { product, matched, denied, overBudget, within, preferenceScore, profileFit };
  }).sort((a, b) => Number(b.within) - Number(a.within) || b.preferenceScore - a.preferenceScore || a.product.price - b.product.price || a.product.id.localeCompare(b.product.id));
  const items = ranked.map((r, index) => {
    const label = r.denied ? '偏好需确认' : r.overBudget ? '超预算备选' : hasBudget ? (index === 0 ? '优先推荐' : '其他预算内备选') : ((r.matched.length||r.profileFit.score>0) ? (index === 0 ? '优先推荐' : '偏好相符的备选') : (index === 0 ? '先看这款' : '款式备选'));
    const reasons: string[] = [...r.profileFit.reasons];
    if (r.matched.length) reasons.push(`符合您明确提到的${r.matched.join('、')}`);
    if (hasBudget && !r.overBudget) reasons.push(`参考预算内（${money(r.product.price)}）`);
    if (r.overBudget) reasons.push(`高于参考预算${money(r.overBudget)}`);
    if (r.denied) reasons.push('包含您提到的待确认款式，请先核对');
    if (!reasons.length) reasons.push(index === 0 ? '先看这款，再按商品规格和内容确认' : '款式备选，可与家属比较');
    return { product: r.product, label, reasons: reasons.slice(0, 3), overBudget: r.overBudget };
  });
  const missingProfile = !hasBudget && positiveTerms.length === 0 && deniedTerms.size === 0 && !knownProfile(guided.occupation) && !knownProfile(guided.faith);
  const context=[knownProfile(guided.occupation)?`职业：${guided.occupation}`:'',knownProfile(guided.faith)?`信仰：${guided.faith}`:''].filter(Boolean).join('；');
  const scenario = guided.scenario === 'hospital' && needKey === 'clothes' ? '医院场景先满足穿衣需要' : `${guided.scenario === 'home' ? '居家场景' : guided.scenario === 'advance' ? '提前咨询' : '当前场景'}先看${option.label}`;
  const summary = `${context?context+'。':''}${scenario}，本次仅展示${option.label}的实际可售商品${hasBudget ? `，按参考预算${money(guided.budget)}排序` : ''}。${missingProfile ? '预算和明确偏好待确认，可以先看款式，再补充资料。' : '按已知预算、偏好与商品服务说明推荐，具体细节需家属确认。'}${guided.scenario === 'hospital' && needKey === 'clothes' ? '买完寿衣后可结束本次沟通，也可以稍后继续其他安排。' : ''}`;
  return { items, summary, missingProfile };
}
