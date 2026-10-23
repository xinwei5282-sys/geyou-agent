import type {AppState,Staff,Consultation} from './types';
import {serviceRecordFor} from './model';
import {agentData,agentRecord,putAgentData} from './agentModel';
import {PAPER_PACKAGE} from './agentPackageSource';
import type {FuneralPlanSharePayload} from './funeralPlanShare';
export type FamilyFormSettings={customs:'pending'|'yes'|'no'};
export type FormSection={title:string;hint?:string;tone?:'optional';items:{title:string;detail?:string;quantity?:string}[]};
export type FamilyForm={id:string;title:string;timing:string;source:string[];lines:string[];sections?:FormSection[];info?:{name:string;age:string;gender:string;relationship:string;birthDate:string;deathDate:string;contactName:string;contactPhone:string;agency:string;staff:string;phone:string}};
export function familyFormSettings(s:AppState,c:Consultation){
 const customer=s.customers.find(x=>x.id===c.customerId),service=customer&&c.deceasedId?serviceRecordFor(customer,c.deceasedId):undefined;
 const task=(id:string)=>service?.tasks.find(t=>t.flowStageId===id&&t.status!=='已取消'&&!t.needsReview);
 const active=(id:string)=>{const t=task(id);return !!t&&(t.status==='已完成'||t.progress==='进行中'||t.progress==='已完成'||!!t.scheduledAt)};
 const phase:'preparation'|'burial'|'aftercare'=service?.phase==='后续关怀'||service?.phase==='服务结束'||active('aftercare')||task('burial')?.status==='已完成'||task('burial')?.progress==='已完成'?'aftercare':service?.phase==='安葬安置'||active('burial')||!!service?.dates.burial?'burial':'preparation';
 const funeralCompleted=service?.phase==='服务结束'||task('burial')?.status==='已完成'||task('burial')?.progress==='已完成';
 return {phase,funeralCompleted,customs:c.agent?.familyForms?.customs||'pending'};
}
export function setFamilyFormSettings(s:AppState,staff:Staff,sid:string,settings:FamilyFormSettings){
 if(!['pending','yes','no'].includes(settings.customs)||Object.keys(settings).some(k=>k!=='customs'))throw Error('请重新确认家属习俗意愿');
 const c=agentRecord(s,staff,sid),d=agentData(s,c);
 return putAgentData(s,staff,sid,{...d,familyForms:settings});
}
export function agentFamilyForms(s:AppState,staff:Staff,current:Consultation):FamilyForm[]{
 const c=agentRecord(s,staff,current.id),d=agentData(s,c),p=d.profile,settings=familyFormSettings(s,c);
 const agency=s.agencies.find(x=>x.id===staff.agencyId),customer=s.customers.find(x=>x.id===c.customerId),person=customer?.deceased?.find(x=>x.id===c.deceasedId);
 const rawName=customer?.name||c.contact?.name;const contactName=rawName&&rawName!=='新客户接待'?rawName:'待确认',phone=customer?.phone||c.contact?.phone||'待确认';
 const common=['服务机构：'+(agency?.name||'待确认')+'；代理：'+staff.name+'；代理电话：'+(staff.phone||'待补充'),
 '家属／经办人：'+contactName+'；家属联系电话：'+phone,
 '逝者：'+(p.name||'待确认')+'；性别：'+(p.gender||'待确认')+'；享年：'+(p.age||'待确认')+'；与家属关系：'+(p.relationship||'待确认'),
 '出生日期：'+(p.birthDate||'待确认')+'；逝世日期：'+(p.deathDate||'待确认')+'；告别时间：'+(p.farewell?.replace('T',' ')||'待确认')+'；告别地点：'+(p.location||'待确认')];
 const make=(id:string,title:string,timing:string,source:string[],lines:string[]):FamilyForm=>({id,title,timing,source,info:{name:p.name||'待确认',age:p.age,gender:p.gender,relationship:p.relationship,birthDate:p.birthDate,deathDate:p.deathDate,contactName,contactPhone:phone,agency:agency?.name||'服务机构',staff:staff.name,phone:staff.phone||'待补充'},lines:[...common.map((line,i)=>i===3&&['documents','family-preparation'].includes(id)?'出生日期：'+(p.birthDate||'待确认')+'；逝世日期：'+(p.deathDate||'待确认'):line),...lines]});
 const result:FamilyForm[]=[make('documents','办理材料核对单','接待及办理手续前',['0e36f65e7ab4ce3218e2ca4c6f449769.jpg'],[
 '身份资料状态：'+(p.confirmedAt?'当前填写内容已经人工核对':'尚待人工核对')+'。文件上传或识别不等于办理手续已完成。',
 '材料核对：逝者身份证、户口本、死亡证明、经办人身份证；具体所需材料、经办人资格及原件要求请向办理机构核实。',
 '请妥善保管原件；线上整理不记录证件号码。缺少的材料请先联系代理核实。']),
 make('family-preparation','丧家需提前准备的物品','人工确认资料后、开始治丧准备前',['0e36f65e7ab4ce3218e2ca4c6f449769.jpg','5582cd87b9349c072850a2c3a8c0332f.jpg','bee9632a7379a316ce63648069120f1a.jpg'],[
 '先确认使用自己的衣服还是套餐寿衣，不重复准备或收费。穿自己的衣服时可核对：'+PAPER_PACKAGE.ownClothes.join('；')+'。',
 '在家设置传统灵堂且家属愿意采用时：门板1块、方凳4张、靠背椅1张、供桌1张。请先核对场地和已备情况。',
 '个人衣物：衣、裤、鞋、袜、帽；洗漱用品：脸盆、毛巾、牙刷、牙膏、牙杯；按实际需要准备，不重复购买套餐已含用品。',
 '供品参考：三种水果、两种糕饼；原表注明不选梨、桃及含芝麻糕饼，仅作当地礼俗参考，由家属自行决定。',
 '按家属选择另行核对香、蜡烛、雨伞、牌位、镜、梳。未选择相关仪式时不要求准备这些用品。',
 '供品、香烛、牌位等按家属信仰和意愿另行确认，不将地方习俗当作必备要求。'])];
 result[0].sections=[{title:'办理前请核对这些材料',hint:'文件识别已核对，不等于原件已备齐或手续已办结。具体要求以办理机构为准。',items:[{title:'逝者身份证',detail:'核对身份信息，按办理机构要求携带原件。'},{title:'逝者户口本',detail:'提前核对逝者所在页及户籍资料。'},{title:'死亡证明',detail:'核对姓名及死亡日期，按实际要求准备相应联次。'},{title:'经办人身份证',detail:'确认由哪位家属经办，核实经办资格及携带要求。'}]},{title:'原件保管',tone:'optional',items:[{title:'原件妥善保管',detail:'线上整理不保存证件号码。缺少材料时先联系代理核实。'}]}];
 result[1].sections=[{title:'先确认衣物怎么准备',hint:'按实际选择准备，套餐已含或家属已备的物品不重复购买。',items:[{title:'使用自己的衣服',detail:PAPER_PACKAGE.ownClothes.join('；')+'。'},{title:'使用套餐寿衣',detail:'按本次报价核对包含范围，向代理确认需要家属另备的物品。'}]},{title:'居家传统灵堂的准备',hint:'仅在家属选择该安排时准备，先核对场地及已备情况。',items:[{title:'门板',quantity:'1块'},{title:'方凳',quantity:'4张'},{title:'靠背椅',quantity:'1张'},{title:'供桌',quantity:'1张'}]},{title:'个人用品',items:[{title:'衣物',detail:'衣、裤、鞋、袜、帽，按实际使用核对。'},{title:'洗漱用品',detail:'脸盆、毛巾、牙刷、牙膏、牙杯。'}]},{title:'供品与礼俗用品',tone:'optional',hint:'按家属意愿选用，不属于人人必须准备的用品。',items:[{title:'供品参考',detail:'三种水果、两种糕饼。原表注明不选梨、桃及含芝麻糕饼，仅作当地礼俗参考，由家属决定。'},{title:'其他可选用品',detail:'香、蜡烛、雨伞、牌位、镜、梳，向代理确认实际需要后再准备。'}]}];
 for(const form of result){if(form.sections)form.lines=[...form.lines.slice(0,4),...form.sections.flatMap(section=>[section.title,...(section.hint?[section.hint]:[]),...section.items.map(item=>item.title+(item.quantity?' '+item.quantity:'')+(item.detail?'：'+item.detail:''))])];}
 if(!p.confirmedAt||!d.paperPlan)return result.slice(0,1);
 const plan=d.paperPlan;
 if(!plan.confirmedAt)return result;
 if(settings.customs!=='yes'&&!settings.funeralCompleted)return result;
 if(settings.phase==='burial')result.push(make('burial','落土准备与现场核对单','家属确认传统安葬安排后、出发前',['c072f772abf1d9c561d5f18b61827487.jpg'],[
 '安葬日期：'+(person?.service?.dates.burial||'待确认')+'；墓园、墓位与到场联系人：待确认。',
 '先与墓园确认墓位、开盖和现场交接，核对墓穴周边卫生、所需毛巾及家属选择的供品。',
 '原表所列香烛、纸钱、供品及鞠躬等属于地方礼俗，只保留家属愿意采用的环节。',
 '原表含焚烧酒精等做法，不作为客户操作步骤；现场按墓园管理要求办理，火源和用品由承办方核对。']));
 if(settings.phase==='aftercare'){
 const date=(offset:number)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(p.deathDate))return '待确认';const t=new Date(p.deathDate+'T00:00:00Z');if(Number.isNaN(t.valueOf())||t.toISOString().slice(0,10)!==p.deathDate)return '待确认';t.setUTCDate(t.getUTCDate()+offset);return t.toISOString().slice(0,10)};
 if(settings.customs==='yes')result.push(make('seven','排七日期核对表','家属选择相关习俗后、后续关怀时',['a09c2288e7bdfa2ff05f9701e5aeaed4.jpg'],[
 '以下按逝世当日为第1天计算参考日期；不是正式法事预约，特殊排法及正五七由当地承办方核对。',
 ...['首七','二七','三七','四七','五七','六七','七七'].map((name,i)=>name+'参考日期：'+date((i+1)*7-1)),
 '原表对供品种类、数量和时段的要求仅为地方习俗参考，按家属意愿另行确认，不按性别强制安排。']));
 result.push(make('five-seven','五七材料准备清单','家属确认办理五七后、采买或预订前',['afdcd89a44a93d1a600cbae127a6bce1.jpg','5f0fdab7115baab1c70d70249aa3c912.jpg'],[
 '丧事办理已登记完成，以下为按需提供的五七准备参考，不代表已预订。五七参考日期：'+date(34)+'；正式时间、地点、参与人数：待确认。',
 settings.customs==='yes'?'可选项目：棚子、搭台、念佛及用品、陪烧、纸制家电、红箱、树灯。逐项由家属选择，不默认全选。':'先核对家属是否需要五七纪念安排、参加人员与场地；宗教、焚烧及纸制用品不默认安排或购买。',
 '家属准备可核对门板、方凳、靠背椅、供桌及自愿采用的供品、衣物和洗漱用品。',
 '原表不同页存在红箱规格、家电件数与价格口径差异；全部费用须重新核价并独立确认，不自动并入本次已确认报价。']));
 if(settings.customs==='yes')for(const count of [21,33])result.push(make('paper-goods-'+count,'冥具'+count+'件可选清单','家属明确需要纸制祭祀用品后、选购前',[count===21?'bee9632a7379a316ce63648069120f1a.jpg':'5582cd87b9349c072850a2c3a8c0332f.jpg'],[
 '这是地方礼俗的可选用品参考，不属于必需用品，也不代表套餐已包含。',
 count===21?'原表列举：纸制房屋、彩电、冰箱、空调、洗衣机、饮水机、叫车、首饰、收音机、电话机、麻将或藤椅、电饭煲、高压锅、煤气灶、煤气瓶、热水瓶、茶壶、莲莲（原表用语，待核对）、碗筷、暖手炉、菜锅及饭勺。':'原表列举：纸制房屋、彩电、冰箱、空调、洗衣机、饮水机、微波炉、家庭影院、电脑、轿车、聚宝盆、金银山、首饰、收音机、电风扇、电话机、麻将、床、衣柜、沙衣（原表用语，待核对）、桌凳、藤椅、电饭煲、高压锅、煤气灶、煤气瓶、热水瓶、茶壶、脸盆、碗筷、暖手炉、菜锅饭勺、火冲（原表用语，待核对）。',
 '21件与33件属于替代选择，先核对家属实际需要及原表不清楚的名称，再逐项报价；不默认两份同时购买。']));
 }
 return result;
}
export function currentFamilyForms(s:AppState,staff:Staff,c:Consultation):FamilyForm[]{
 const forms=agentFamilyForms(s,staff,c),d=agentData(s,c),settings=familyFormSettings(s,c);
 if(!d.profile.confirmedAt)return [];
 if(!d.paperPlan?.confirmedAt)return forms.filter(f=>f.id==='documents'||f.id==='family-preparation');
 if(settings.phase==='preparation')return forms.filter(f=>f.id==='documents'||f.id==='reservation'||f.id==='family-preparation');
 const base=forms.find(f=>f.id==='reservation')!;
 if(settings.phase==='burial')return settings.customs==='yes'?forms.filter(f=>f.id==='burial'):[{...base,id:'burial-arrangement',title:'安葬安排核对卡',timing:'当前准备安葬',lines:[...base.lines.slice(0,4),'请核对安葬或寄存地点、时间、到场家属及现场联系人；安排以已登记信息和承办方回执为准。','骨灰盒、随行物品及交接手续逐项核对，已备物品不重复购买。']}];
 if(!settings.funeralCompleted)return [{...base,id:'aftercare',title:'后续关怀核对卡',timing:'当前后续关怀',lines:[...base.lines.slice(0,4),'请说明是否还需要协助，以及希望联系的时间或事项；暂无后续需求也可直接告知代理。','后续祭祀等项目仅按家属需要另行确认，不自动加入本次已确认报价。']}];
 const wantsPaperGoods=c.messages.some(m=>m.role==='user'&&/需要|了解|选|买/.test(m.text)&&/冥具|纸制家电/.test(m.text)&&!/不需要|不用|不买|取消/.test(m.text));
 return forms.filter(f=>f.id==='five-seven'||(settings.customs==='yes'&&f.id==='seven')||(settings.customs==='yes'&&wantsPaperGoods&&f.id.startsWith('paper-goods-')));
}
export function familyFormSharePayload(form:FamilyForm,agency:string,phone:string):FuneralPlanSharePayload{
 return {title:form.title,steps:form.lines.map((detail,i)=>({title:'核对事项 '+(i+1),detail})),pending:['请按家属意愿和当地实际要求核对；待确认内容不代表已办理。'],familyPrepared:[],agencyPrepared:[],agencyName:agency,servicePhone:phone};
}
