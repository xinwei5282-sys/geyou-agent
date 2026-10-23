export type SelectionMode = 'burial' | 'cemetery' | 'both';
export const selectionModeLabel = (mode:SelectionMode = 'burial') => ({burial:'择时',cemetery:'择位',both:'择时 · 择位'}[mode]);
export type CemeteryNeeds = {city:string;district:string;burialType:string;maxBudget:string};
export const defaultCemeteryNeeds = ():CemeteryNeeds => ({city:'杭州',district:'',burialType:'',maxBudget:''});
export type Cemetery = {id:string;name:string;city:string;district:string;location:string;source:string;sourceTitle:string;sourceDate:string;phone?:string;phoneNote?:string;description?:string;extraSources?:{title:string;url:string}[];burialTypesComplete?:boolean;burialTypes?:string[];priceFrom?:number};
const source='https://zfgb.hangzhou.gov.cn/140/106220253/t111220253064/529021.shtml';
// Public directory data only. No inferred inventory, prices, travel times or feng-shui scores.
const ecologicalSource='https://zfgb.hangzhou.gov.cn/upload/default/bigfile/2025/06/11/20250611_9c847fc6e8036a13983d8d976690a186.pdf';
const ecology={title:'市政府公报（2025年）· 生态葬实施单位',url:ecologicalSource};
export const CEMETERIES:Cemetery[] = [
 {id:'hz-nanshan',name:'杭州南山陵园',city:'杭州',district:'上城区',location:'杭州市上城区白云路66号',phone:'0571-86084943',phoneNote:'政府名录电话（2020年），拨打前核实',description:'玉皇山南麓的陵园，已列入杭州市生态葬实施单位。',burialTypes:['生态安葬'],source,sourceTitle:'杭州市政府公报 · 公墓名单（2020年）',sourceDate:'2020-03-30',extraSources:[{title:'浙江大学 · 南山陵园地址',url:'https://pi.zju.edu.cn/2023/0421/c67017a2747919/page.htm'},ecology]},
 {id:'hz-banshan',name:'杭州半山公墓',city:'杭州',district:'拱墅区',location:'杭州市拱墅区半山街道半山路298号',phone:'0571-88135057',phoneNote:'政府名录电话（2020年）；网络号码存在冲突，需复核',description:'位于半山片区，已列入杭州市生态葬实施单位。',burialTypes:['生态安葬'],source,sourceTitle:'杭州市政府公报 · 公墓名单（2020年）',sourceDate:'2020-03-30',extraSources:[{title:'高德地图 · 半山公墓地址',url:'https://www.amap.com/place/B023B13Z6M'},ecology]},
 {id:'hz-qianjiang',name:'杭州钱江陵园',city:'杭州',district:'西湖区',location:'杭州市西湖区双浦镇周富村3号',phone:'0571-85058045',phoneNote:'园方网站公开咨询电话，未电话核验',description:'园方介绍园区坐北朝南，并提供树葬、花坛葬、壁葬、生命晶石葬等节地安葬形式；园区整体朝向不等于具体墓穴坐向。',burialTypes:['生态安葬'],source:'https://www.hzqjly.com/index/mobile/contact.html',sourceTitle:'钱江陵园 · 联系钱江',sourceDate:'网页未标日期',extraSources:[{title:'钱江陵园 · 园区介绍与安葬形式',url:'https://www.hzqjly.com/index/mobile/about.html'},ecology]},
 {id:'hz-second',name:'杭州第二公墓',city:'杭州',district:'西湖区',location:'杭州市西湖区留下街道石马村一带（具体入口待核实）',phone:'0571-85229856',phoneNote:'政府名录电话（2020年），拨打前核实',description:'位于城西石马片区，已列入杭州市生态葬实施单位。',burialTypes:['生态安葬'],source,sourceTitle:'杭州市政府公报 · 公墓名单（2020年）',sourceDate:'2020-03-30',extraSources:[{title:'杭州本地宝 · 殡葬服务单位地址',url:'https://hz.bendibao.com/live/2014527/42891.shtm'},ecology]},
 {id:'hz-anxian',name:'浙江安贤园',city:'杭州',district:'临平区',location:'杭州市临平区崇贤街道水洪庙村2-1',phone:'0571-88141111',phoneNote:'园方网站公开咨询电话，未电话核验',description:'位于杭州北部崇贤片区的人文纪念园，已列入杭州市生态葬实施单位。',burialTypes:['生态安葬'],source:'https://www.anxianyuan.com/',sourceTitle:'浙江安贤园 · 园方公开资料',sourceDate:'网页未标日期',extraSources:[{title:'杭州网 · 安贤园场馆地址',url:'https://edu.hangzhou.com.cn/2024rdzt/zdagzyjd/content/content_8766266.html?k=5'},ecology]},
];
export type CemeteryMatch = {baziEvidence?:import('./cemeteryAdvice').BaziCemeteryEvidence;baziReason?:string;baziPending?:string[];cemetery:Cemetery;reasons:string[];pending:string[]};
export function recommendCemeteries(needs:CemeteryNeeds,catalog:Cemetery[]=CEMETERIES):CemeteryMatch[]{
 const city=needs.city.trim().replace(/市$/,'');
 if(!city)throw Error('请填写意向城市');
 const budget=needs.maxBudget.trim()===''?undefined:Number(needs.maxBudget);
 if(budget!==undefined&&(!Number.isFinite(budget)||budget<=0))throw Error('请填写大于0的预算上限，或留空不限');
 return catalog.filter(c=>c.city===city&&(!needs.district||c.district===needs.district))
  .filter(c=>!needs.burialType||!c.burialTypesComplete||c.burialTypes?.includes(needs.burialType))
  .filter(c=>budget===undefined||c.priceFrom===undefined||c.priceFrom<=budget)
  .map(c=>({cemetery:c,reasons:[`位于意向${needs.district?'区县':'城市'}：${needs.district||city}`,...(needs.burialType&&c.burialTypes?.includes(needs.burialType)?[`提供${needs.burialType}`]:[]),...(budget!==undefined&&c.priceFrom!==undefined?['起步价格在预算上限内，实际总价另行核实']:[])],pending:[...(c.priceFrom===undefined?['价格'+(budget!==undefined?'是否符合预算':'')+'待核实']:[]),...(needs.burialType&&!c.burialTypes?.includes(needs.burialType)?[needs.burialType+'是否提供待核实']:[]),'可售情况与办理条件待核实']}))
  .sort((a,b)=>a.pending.length-b.pending.length||a.cemetery.id.localeCompare(b.cemetery.id));
}
export function canFinishSelection(mode:SelectionMode,time?:string,cemeteryId?:string){return (mode==='cemetery'||!!time)&&(mode==='burial'||!!cemeteryId);}

export function toggleSelectionMode(mode:SelectionMode,item:'burial'|'cemetery'):SelectionMode{return mode==='both'?(item==='burial'?'cemetery':'burial'):mode===item?item:'both';}
