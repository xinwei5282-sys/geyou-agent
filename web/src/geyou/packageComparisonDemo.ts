import type {Product} from './types';
import type {PackagePreference} from './packageExplanationModel';
/** Fictional comparison fixture; never persists into customer or catalog records. */
export function packageComparisonDemo(included:string,source:Product){
 const urn=included.includes('骨灰盒');
 const current:Product={...source,id:'comparison-demo-current',name:urn?'素色基础骨灰盒（演示）':'素色基础寿衣套装（演示）',price:urn?100000:68000,spec:urn?'标准方形 · 素色饰面 · 无雕花（演示规格）':'素色传统款 · 涤棉面料 · 基础配套（演示规格）',description:urn?'演示原款：简洁方形外观，素色饰面；不含木纹雕饰。':'演示原款：素色涤棉面料，传统版型，基础衣物配套。',elements:['土'],recommendationNote:'五行标注为模拟人工录入，仅用于界面测试，不代表材质天然属性或功效。'};
 const candidate:Product={...source,id:'comparison-demo-candidate',name:urn?'原木纹简雅骨灰盒（演示）':'素雅棉质寿衣套装（演示）',spec:urn?'标准方形 · 原木纹饰面 · 无宗教纹样（演示规格）':'素色传统款 · 棉质面料 · 衣物及配套用品（演示规格）',description:urn?'演示候选款：原木纹饰面，简洁方形外观，无宗教图案；内部尺寸需另行核实。':'演示候选款：棉质面料，素色传统版型；配套用品范围及尺码需另行核实。',elements:['木'],recommendationNote:'木方向为模拟顾问录入标注，仅用于偏好匹配测试，不宣称转运或补益。'};
 const preference:PackagePreference={isDemo:true,confirmedAt:'2026-10-23T00:00:00Z',birthDate:'1944-05-16',birthTime:'08:30',birthplace:'北京时间口径',calendar:'solar',leap:false,sect:2,preferredElement:'木',interests:urn?'简洁、木纹':'素色、棉质、简洁',faith:'无特定信仰',customs:'从简办理，不安排宗教仪式'};
 return {current,candidate,preference};
}
