import type { GuidedSale, MasterProduct, Product } from './types';

type Profile=Pick<GuidedSale,'occupation'|'faith'>;
export const FAITH_OPTIONS=['佛教','道教','基督教','天主教','伊斯兰教','其他宗教'];
const faiths=FAITH_OPTIONS;
export function knownProfile(value?:string){return !!value?.trim()&&!/待确认|待了解|未知|按家属意愿|其他$/.test(value);}
export function profileMatch(product:Product,profile:Partial<Profile>,master?:MasterProduct){
 const content=[product.name,product.spec,product.description,product.included,master?.spec,master?.description].filter(Boolean).join(' ');
 const faith=faiths.find(f=>profile.faith?.includes(f));
 const declared=product.religion?[product.religion]:faiths.filter(f=>content.includes(f));
 const conflict=(!!faith&&declared.length>0&&!declared.includes(faith))||(!!product.religion&&/无特定信仰|无宗教信仰/.test(profile.faith||''));
 const reasons:string[]=[];let score=conflict?-20:0;
 if(faith&&declared.includes(faith)){score+=8;reasons.push(`适合${faith}需求`);}
 if(knownProfile(profile.occupation)&&product.category==='礼仪服务'&&/经历|生平|致辞|回忆/.test(content)){score+=2;reasons.push(`可结合${profile.occupation}经历沟通追思内容`);}
 if(conflict)reasons.push('此项说明中的信仰安排与已填信息不同，需要先核对');
 return {score,reasons,conflict};
}
