export const PORTRAIT_CLOTHES={original:'保留原衣',tang:'唐装',suit:'西服',plain:'素色正装'} as const;
export type PortraitClothing=keyof typeof PORTRAIT_CLOTHES;
export function recommendPortraitClothing(age:string):{style:PortraitClothing;reason:string}{
 const years=/^\d{1,3}$/.test(age.trim())?Number(age):NaN;
 if(!Number.isFinite(years)||years<18||years>130)return {style:'original',reason:'年龄未核对或不适用成人正装，建议先保留原衣。'};
 return years>=60?{style:'tang',reason:'参考已核对年龄，建议简洁唐装；家属意见优先。'}:{style:'suit',reason:'参考已核对年龄，建议简洁西服；家属意见优先。'};
}
export function portraitClothingPrompt(style:PortraitClothing){
 const instruction={original:'保留原图衣服的款式、颜色与纹样，仅整理褶皱及修复可见破损；不换装。',tang:'穿简洁庄重的深色现代唐装，立领、自然盘扣，不加帽子、寿字、龙纹或宗教符号。',suit:'穿简洁庄重的深色西服外套与素色衬衫，衣领自然，不加徽章、宗教符号或夸张装饰。',plain:'穿简洁庄重的素色正式上衣，避免鲜艳纹样及夸张装饰。'}[style];
 return `\n【本次已选择的服装：${PORTRAIT_CLOTHES[style]}】\n${instruction}\n本次服装选择优先于前文默认服装建议；只能改变衣服，不改变脸型、五官、发型、年龄或人物身份。不根据八字、姓名或宗教猜测服饰要求。若原图未展示衣服，保留原衣模式仅补全素净同色上衣，不凭空编造徽章或特殊服装。`;
}
