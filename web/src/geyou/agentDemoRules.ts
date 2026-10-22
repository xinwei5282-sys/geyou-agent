import type {AgentProfile} from './agentTypes';
// Illustrative mappings approved for prototype data only. Never query as real stock or price.
const examples=[
 {element:'木',name:'自然木纹样式',material:'模拟样品采用木材，保留木纹；具体木种、工艺和环保检测以实物资料为准。'},
 {element:'金',name:'简洁金属饰面样式',material:'模拟样品使用金属饰面；不等于整件金属材质，需核对基材和工艺。'},
 {element:'水',name:'素雅深色样式',material:'模拟样品采用深色外观；颜色不代表具体材质或特殊功效。'},
 {element:'火',name:'暖色纹饰样式',material:'模拟样品采用少量暖色纹饰；先核对家属接受程度，不作固定礼俗要求。'},
 {element:'土',name:'素净陶瓷样式',material:'模拟样品采用陶瓷材质；需核对工艺、规格与实际场所要求。'},
];
export function demoMaterialAdvice(p:AgentProfile,isDemo:boolean){
 if(!isDemo||!p.confirmedAt||!p.preferredElement)return [];
 return examples.filter(x=>x.element===p.preferredElement).map(x=>({...x,source:'原型模拟规则 · 非机构正式规则',note:'此样品不代表真实商品、库存或套餐内材质，未定价，不计入报价。',script:`您已明确希望参考“${x.element}”方向，我们可以先看看${x.name}的实际样品。${x.material}这是偏好参考，不是必须购买的理由。先核对预算与原套餐差别，您觉得合适再选择；不承诺转运或家运效果。`}));
}
