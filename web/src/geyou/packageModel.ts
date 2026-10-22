import type { AppState, Product, Staff } from './types';
import { hasStaffModule, isProductAvailable, visibleCustomers } from './model';
import type { ConsultationPlan, NeedDecision, NeedKey, SalePackage } from './packageTypes';
import type { Line } from './types';
import { profileMatch } from './profileMatching';

export const NEED_OPTIONS: { key: NeedKey; label: string; categories: string[] }[] = [
  { key: 'clothes', label: '寿衣', categories: ['寿衣'] },
  { key: 'urn', label: '骨灰盒', categories: ['骨灰盒'] },
  { key: 'ceremony', label: '告别仪式', categories: ['礼仪服务'] },
  { key: 'decoration', label: '灵堂布置', categories: ['灵堂布置'] },
  { key: 'flowers', label: '花圈', categories: ['花圈'] },
  { key: 'burial', label: '安葬安置', categories: ['安葬用品', '安葬服务'] },
];

const optionFor = (key: NeedKey) => NEED_OPTIONS.find(x => x.key === key)!;
const isNeeded = (d: NeedDecision | undefined) => d === 'needed';

function line(product: Product): Line {
  return { productId: product.id, name: product.name, unit: product.unit, price: product.price, quantity: 1, kind: product.kind };
}

export function generatePackages(
  state: AppState,
  staff: Staff,
  input: { needs: ConsultationPlan['needs']; budget: number; faith?: string; occupation?: string; interests?: string; excludeProductIds?: string[] },
): { packages: SalePackage[]; warnings: string[]; missingNeeds: NeedKey[] } {
  if (!hasStaffModule(state, staff, 'talk')) throw new Error('当前账号未开通谈单权限');
  if (!Number.isFinite(input.budget) || input.budget < 0) throw new Error('预算必须是有效的非负金额');
  const agencyId = staff.agencyId;
  const excluded = new Set(input.excludeProductIds || []);
  const catalog = state.products.filter(p => p.agencyId === agencyId && !excluded.has(p.id) && isProductAvailable(state, p));
  const requested = NEED_OPTIONS.filter(o => isNeeded(input.needs[o.key]));
  const missingNeeds: NeedKey[] = [];
  const candidates = requested.map(o => {
    const found = catalog.filter(p => o.categories.includes(p.category)).sort((a, b) => a.price - b.price || a.id.localeCompare(b.id));
    if (!found.length) missingNeeds.push(o.key);
    return { option: o, found };
  });
  const warnings: string[] = [];
  missingNeeds.forEach(k => warnings.push(`缺少「${optionFor(k).label}」可售商品，套餐暂不包含该项。`));
  if (!requested.length) return { packages: [], warnings: ['请至少选择一项本次需要。'], missingNeeds: [] };

  const available = candidates.filter(x => x.found.length > 0);
  if (!available.length) return { packages: [], warnings, missingNeeds };

  // Keep every option in the same need scope. Vary only real catalog choices;
  // this avoids inventing services or combinations across unrelated categories.
  const ranks = [0, 1, 2];
  const combos: Product[][] = [];
  for (const rank of ranks) {
    const chosen = available.map(x => x.found[Math.min(rank, x.found.length - 1)]);
    if (chosen.length !== available.length) continue;
    const ids = chosen.map(p => p.id).join('|');
    if (!combos.some(c => c.map(p => p.id).join('|') === ids)) combos.push(chosen);
  }
  // Include an explicitly matching service option without adding categories or changing quantities.
  const fit=(p:Product)=>profileMatch(p,input,state.masterProducts.find(m=>m.id===p.masterId));
  if(available.some(x=>x.found.some(p=>fit(p).score>0))){
    const preferred=available.map(x=>[...x.found].sort((a,b)=>fit(b).score-fit(a).score||a.price-b.price)[0]);
    const signature=preferred.map(p=>p.id).join('|');
    if(!combos.some(c=>c.map(p=>p.id).join('|')===signature)){if(combos.length>=3)combos[1]=preferred;else combos.push(preferred);}
  }
  combos.sort((a,b)=>a.reduce((n,p)=>n+p.price,0)-b.reduce((n,p)=>n+p.price,0));
  const packages: SalePackage[] = combos.map((products, index) => {
    const lines = products.map(line);
    const total = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
    const differences = products.map(p => `${p.name}${p.spec ? `（${p.spec}）` : ''}`).join('、');
    const overBudget = input.budget > 0 ? Math.max(0, total - input.budget) : 0;
    return {
      id: `package-${index + 1}`,
      title: ['方案一', '方案二', '方案三'][index] || `可选组合${index + 1}`,
      lines,
      total,
      profileReasons: [...new Set(products.flatMap(p=>fit(p).reasons))],
      reasons: [`包含本次已确认的${available.map(x => x.option.label).join('、')}`, `实际商品：${differences}`, ...(overBudget ? [`超出预算¥${overBudget / 100}`] : [])],
      overBudget,
      recommended: false,
    };
  });
  const within = packages.filter(p => p.overBudget === 0);
  const score=(pkg:SalePackage)=>pkg.lines.reduce((n,l)=>n+fit(catalog.find(p=>p.id===l.productId)!).score,0);
  const pool=within.length?within:packages;
  const recommended=[...pool].sort((a,b)=>score(b)-score(a)||(within.length?Math.abs(a.total-input.budget)-Math.abs(b.total-input.budget):a.total-b.total))[0];
  if (recommended) recommended.recommended = true;
  if (packages.some(p => p.overBudget > 0)) warnings.push('部分套餐超出参考预算，请与客户确认取舍。');
  if (available.length < requested.length) warnings.push('部分需求暂缺可售商品，套餐范围不完整，请补充商品或人工确认。');
  return { packages, warnings, missingNeeds };
}
