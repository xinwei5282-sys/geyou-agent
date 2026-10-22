import type {NeedKey} from './packageTypes';
export type ServiceStageId='contact'|'dressing'|'certificate'|'setting'|'booking'|'notice'|'visiting'|'departure'|'farewell'|'cremation'|'burial'|'aftercare';
export const serviceStages:{id:ServiceStageId;title:string;brief:string;family:string;team:string;note:string}[]=[
 {id:'contact',title:'业务接洽',brief:'了解情况、意愿与眼前需求',family:'说明当前在医院或家中、已准备的事项、主要联系人，以及预算和信仰习俗；不清楚的信息可以后补。',team:'介绍整体流程，再按本次需求讲解商品与服务，核对所选项目和后续联系安排。',note:'提前咨询可逐步了解全程；医院急需时先解决寿衣等眼前事项，后续可另行续谈。'},
 {id:'dressing',title:'净身穿衣',brief:'核对衣被与现场服务安排',family:'告知已有衣物、尺码和款式偏好，确认希望由谁协助及服务地点。',team:'按约定协助净身、穿衣，核对寿衣、寿被与配套用品的实际准备情况。',note:'已准备的衣物不重复购买。只需要寿衣时，本次选择可以在此结束。'},
 {id:'certificate',title:'死亡证明开具',brief:'核实办理渠道与所需材料',family:'按实际办理机构要求准备身份等相关材料，并明确家属办理人。',team:'协助核实相应办理渠道、材料和对接人员，向家属说明后续交接。',note:'医院和居家场景的办理方式可能不同，具体机构、材料与手续以当地实际要求核实为准。'},
 {id:'setting',title:'灵堂布置／送殡仪馆',brief:'根据地点与家属意愿分支安排',family:'确认居家守灵或送往殡仪馆的安排、场地条件及已有物品；如需遗像，提供清晰照片。',team:'本店按家属意愿沟通灵堂布置，确认场地和所需物品。送往殡仪馆的接运由殡仪馆办理。',note:'设灵堂时需提前确认并备好遗像。接运不属于本店销售项目，不加入推荐或清单。'},
 {id:'booking',title:'火化预约',brief:'协调时间、场地与后续衔接',family:'核对家属可配合的时间和承办方要求准备的材料。',team:'协同确认殡仪馆、火化及告别安排，明确时间、地点和联系人。',note:'会议提到灵堂准备与预约可同步推进；时间地点未确认时，不提前对外发布确定安排。'},
 {id:'notice',title:'讣告发布',brief:'信息准确、家属确认后通知亲友',family:'核对姓名、享年、照片、日期、告别时间地点及正文，确认可对外发布的版本。',team:'准备讣告草稿，复用已确认的遗像，核对联系业务员电话；经家属确认后发布与分享。',note:'讣告只留服务联系电话，不放收款码或其他二维码。安排变化后重新核对并更新内容。'},
 {id:'visiting',title:'吊唁接待',brief:'说明现场接待与家属准备事项',family:'沟通预计到访情况、现场联系人与家庭意愿；如采用家祭供饭，按事先沟通准备饭、素菜及酒或茶。',team:'按所选方案准备场地、花圈鲜花及配套物料，说明吊唁接待和守灵期间的配合事项。',note:'家祭供饭是会议介绍的可选习俗，先核对信仰与意愿。香纸等物料不足时另行确认补充并记录，不默认增购。'},
 {id:'departure',title:'出殡',brief:'复核集合、随行物品与交接',family:'核对集合时间、参加人员和需要带走的物品，明确家属对接人。',team:'衔接出殡及殡仪馆现场安排，复核人员、物品和时间。',note:'不设灵堂时，按会议所述在殡仪馆出殡环节交付遗像；用照须先经家属确认。'},
 {id:'farewell',title:'告别会',brief:'按约定举行告别仪式',family:'确认告别形式、参加人员及信仰习俗；宗教仪式由家属对接相关主持人员。',team:'按已选方案落实仪式布置和现场协助，核对遗像、鲜花、场地与时间。',note:'有信仰需求时单独确认布置与仪式细节；团队提供约定的布置和协助，不默认承接宗教仪式组织。'},
 {id:'cremation',title:'火化',brief:'按预约衔接办理与骨灰接收',family:'根据殡仪馆要求配合办理与确认，明确对接家属。',team:'协同核对预约安排及相关交接，确认骨灰盒是否已准备、后续下葬或寄存安排。',note:'火化与骨灰交接按殡仪馆实际流程执行；已购买的骨灰盒不重复计入本次清单。'},
 {id:'burial',title:'下葬',brief:'按意愿安排安葬礼仪或骨灰寄存',family:'确认墓地或寄存安排、时间、参加人员与所需协助。',team:'讲解基础陪同指导与其他礼仪方案的实际差异，通过实拍图说明人员、布置和包含内容，按选择落实。',note:'没有即时下葬安排时可先沟通寄存。服务结束后核对原清单与已确认增补，费用按实际约定线下结算。'},
 {id:'aftercare',title:'后续关怀',brief:'按家属需要决定后续联系',family:'说明是否还需要协助，以及希望联系的时间或事项，也可选择暂无后续需求。',team:'保留服务与沟通记录，有约定再添加跟进待办；客户回来时从原记录开始续谈。',note:'五七等纪念服务在会议中作为后续另行商议的内容，不默认纳入本次套餐；范围与费用单独确认。'},
];
export const stageOffers:Record<ServiceStageId,{needs:NeedKey[]}>= {
 contact:{needs:[]},dressing:{needs:['clothes']},certificate:{needs:[]},
 setting:{needs:['decoration','flowers']},booking:{needs:[]},notice:{needs:[]},
 visiting:{needs:['flowers']},departure:{needs:[]},farewell:{needs:['ceremony']},
 cremation:{needs:['urn']},burial:{needs:['burial']},aftercare:{needs:[]},
};
