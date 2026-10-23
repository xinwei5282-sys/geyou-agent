// Manually transcribed from the user's original paper photos; never a live price feed.
export const PAPER_PACKAGE={name:'简朴套餐',price:458000,source:'简朴套餐原图 · 0e36f65e7ab4ce3218e2ca4c6f449769.jpg',included:['普通寿衣全套','佛经10包','12寸遗像1套','简易灵堂1套','雨棚1只','净身穿衣打包服务','骨灰盒（原图注明约1000元左右，已在套餐内）'],ownClothes:['棉毛衫、棉毛裤、衬衣、外套','布鞋、袜子、枕头、大被、小被','纸钱、糕点（不带芝麻）'],fullClothes:['衬衣、衬裤、棉袄、棉裤、罩衣、罩裤、披风、帽儿','枕头、鞋子、袜子、招魂袋、镜子、木梳、扇子','大毛巾、小毛巾、大被、小被、纸钱、千斤带、糕点（不带芝麻）'],contactOnly:['念佛','点树灯','豆腐饭预订','水晶棺材租用','打防腐针'],documents:['逝者身份证','逝者户口本','经办人身份证（直系亲属）','医院出具的死亡证明']};
export const PAPER_EXTRAS=[
 {id:'accompany',name:'办手续、陪同、下葬全程服务',price:100000,unit:'项',group:'陪同服务',note:'原图注明特殊需求另议；先核对是否与已选服务重复'},
 {id:'wreath100',name:'花圈 · 100元档',price:10000,unit:'个',group:'花圈',note:'款式及材质原图未注明，选用前核对'},
 {id:'wreath200',name:'花圈 · 200元档',price:20000,unit:'个',group:'花圈',note:'款式及材质原图未注明，选用前核对'},
 {id:'bus18return',name:'18座中巴 · 殡仪馆来回',price:60000,unit:'项',group:'车辆',note:'按实际人数、路线及承办方报价确认'},
 {id:'bus18hill',name:'18座中巴 · 上山',price:80000,unit:'项',group:'车辆',note:'与同车型其他路线先核对是否同一次用车'},
 {id:'bus52return',name:'35–52座大客车 · 殡仪馆来回',price:80000,unit:'项',group:'车辆',note:'按实际人数、路线及承办方报价确认'},
 {id:'bus52hill',name:'35–52座大客车 · 上山',price:100000,unit:'项',group:'车辆',note:'与其他车辆方案择需选择'},
] as const;
export type PaperAdjustment={productSpec?:string;productImage?:string;included:string;productId:string;name:string;need:string;delta:number;priceChecked:boolean};
export type PaperPlan={adjustments?:PaperAdjustment[];omitted?:string[];basePrice:number;extras:{id:string;quantity:number}[];pricesChecked:boolean;confirmedAt?:string;updatedAt:string};
export function paperPlanLines(plan:PaperPlan){return [{name:PAPER_PACKAGE.name,quantity:1,unit:'套',price:plan.basePrice},...plan.extras.map(item=>{const extra=PAPER_EXTRAS.find(x=>x.id===item.id);if(!extra||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>100)throw Error('请核对增项数量');return {name:extra.name,quantity:item.quantity,unit:extra.unit,price:extra.price};}),...(plan.adjustments||[]).map(x=>{if(!Number.isSafeInteger(x.delta))throw Error('请核对更换补差');return {name:x.included+' → '+x.name+'（更换补差）',quantity:1,unit:'项',price:x.delta};})];}
export function paperPlanTotal(plan:PaperPlan){return paperPlanLines(plan).reduce((n,x)=>n+x.price*x.quantity,0);}
export function paperPlanText(plan:PaperPlan,name:string){return `${name} · 服务清单\n${paperPlanLines(plan).map(x=>`${x.name} ×${x.quantity}${x.unit}：¥${x.price*x.quantity/100}`).join('\n')}\n合计：¥${paperPlanTotal(plan)/100}\n套餐包含：${PAPER_PACKAGE.included.filter(x=>!plan.omitted?.includes(x)).map(x=>plan.adjustments?.find(a=>a.included===x)?.name||x).join('、')+(plan.omitted?.length?'；本次不包含：'+plan.omitted.join('、'):'')}\n代联系事项另行核实，不默认包含费用；家属自备及已备物品另列。\n${plan.confirmedAt?'已记录家属确认；此清单不代表付款。':'待核对与家属确认；图片参考价不代表当前报价。'}`;}
