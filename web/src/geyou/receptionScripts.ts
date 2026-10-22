import type {GuidedSale,Line,Product} from './types';
import {money} from './model';
import {knownProfile} from './profileMatching';
import {NEED_OPTIONS} from './packageModel';
export type ReceptionScript={title:string;advice?:string;text:string};
export function referenceReceptionScripts(guided:GuidedSale,products:Product[],lines:Line[]):ReceptionScript[]{
 const latest=guided.notes.split('；').at(-1)||'';
 if(/不想聊|先不聊|先不谈|不想说|暂停/.test(latest)&&!/不是.{0,6}不想聊|不用暂停/.test(latest))return [{title:'先让家属缓一缓',advice:'暂停询问预算、信仰和选品，不催促回复；等家属愿意再继续。',text:'好，我们先不谈这些，您不用勉强自己现在做决定。等您愿意再说的时候，咱们再把需要处理的事情一件一件理清楚。'}];
 if(/寿衣/.test(guided.notes)&&guided.plan?.outcome!=='confirmed'){
  const opening='可以的，衣服的款式我们可以慢慢看，您暂时不用决定选哪一套。';
  if(!guided.subjectGender)return [{title:'先了解家人的情况',advice:'本轮只了解服务对象性别，不同时问年龄、职业、信仰和预算，也不提前报价。',text:`${opening}我先了解一点家人的情况，这样介绍时更贴近家人，也省得让您看一堆不合适的款式。您是为一位男士，还是一位女士了解呢？`}];
  if(!guided.subjectAge)return [{title:'了解家人的年龄',advice:'性别已了解，本轮只问年龄或年龄段；不清楚可跳过。',text:'好的，咱们先按家人平时会喜欢的样子来考虑，不必急着选款式。不同年纪的家人，穿衣习惯也可能不一样，了解一下会更方便介绍。家人大概是什么年龄呢？如果暂时不方便说，我们也可以先跳过。'}];
  if(!knownProfile(guided.faith))return [{title:'尊重家里的习惯',advice:'本轮只了解信仰或穿衣习俗，不从职业或地区推断。',text:'衣服除了看款式，也要照顾家里一贯的习惯。如果有讲究，咱们先说清楚，后面就省得反复挑选。家里在信仰或穿衣习俗上，有没有希望特别留意的地方？暂时不清楚也没关系。'}];
  if(!guided.occupation&&!guided.interests)return [{title:'顺着家人原来的喜好',advice:'本轮了解平时穿衣风格，职业不作为消费能力判断。',text:'家里的习惯我了解了。接下来咱们尽量顺着家人平时的喜好看，熟悉的样子往往比一味选贵的更贴近家人。家人平时是喜欢简单素雅一些，还是比较传统的款式呢？如果暂时想不起来，可以先不定。'}];
 }
 const first=products[0],total=lines.reduce((sum,line)=>sum+line.price*line.quantity,0);
 const prepared=NEED_OPTIONS.filter(n=>guided.plan?.needs[n.key]==='prepared').map(n=>n.label);
 const info=[guided.interests&&`家属偏好“${guided.interests}”`,prepared.length&&`已准备${prepared.join('、')}`].filter(Boolean).join('；');
 const budget=guided.budget>0?`您提到大概考虑${money(guided.budget)}，我会先按您能接受的范围介绍，不让您因为选东西再添压力。合适的咱们再细看，不合适也不用勉强。`:'为了不让您看一堆超出考虑范围的东西，我先了解一下，您方便说一下这项的大致预算吗？还没定也没关系，先了解需要什么，再慢慢考虑。';
 const start:ReceptionScript={title:guided.scenario==='hospital'?'先处理眼前需要':guided.scenario==='advance'?'先了解意愿':'核对已准备物品',advice:`${guided.scenario==='hospital'?'先确认眼前急需的用品和已准备情况，其他安排待家属愿意时再沟通。':guided.scenario==='advance'?'先讲清流程和可选范围，让家属按自己的节奏决定。':'先核对家中已有用品和当前安排。'}${guided.budget?'预算已知，选货时逐项核对总费用。':'预算尚未明确，先询问可接受范围。'}${info?info+'，后续选货据此核对。':''}`,text:`${guided.scenario==='hospital'?'可以，我们先把眼前需要的用品看明白，其他安排暂时拿不准的，可以放一放。':guided.scenario==='advance'?'可以的，您先了解，暂时不用决定具体项目。我会把每一项是做什么的、需要时怎么安排说清楚，您听完再考虑。':'家里已经准备好的东西，就不用再添了。剩下需要帮忙的部分，我们一件一件说清楚，暂时拿不准也没关系。'}${budget}`};
 if(guided.plan?.outcome==='confirmed')return [{title:'核对已确认安排',advice:'本次清单已经确认，先核对后续安排。出现新增需求时新建补充沟通，保留原报价。',text:'好，之前咱们商量过的用品和安排，就先按原来的约定保留，您不用重新做一遍决定。后面有变化，咱们再把涉及的部分说清楚，不急着添别的项目。眼下还有哪件事，是您希望我们帮着理一理的？'}];
 const result=[start];
 if(!knownProfile(guided.faith))result.push({title:'确认习俗要求',advice:'信仰习俗尚未确认。推荐专属宗教商品或仪式前先询问，暂时展示通用项目。',text:'每个家庭的习惯可能不一样，有讲究的地方，咱们先说清楚，免得后面再费心调整。家里有没有需要遵循的信仰或习俗？暂时不了解也没关系，我们先把这部分留着，不替您做决定。'});
 else if(first)result.push({title:'按家属偏好讲解商品',advice:`先解释${first.name}的实际规格和${money(first.price)}/${first.unit}价格。${guided.interests?`结合已记录的“${guided.interests}”偏好，请家属核对是否适合。`:''}${guided.faith==='无特定信仰'?'采用通用安排。':`有关${guided.faith}的具体安排需再次核对。`}`,text:`${guided.interests?`您提到喜欢${guided.interests}，咱们就先顺着这个喜好看。`:'选东西还是以家里觉得合适、用得上为主，不必一味选贵的。'}这款${first.name}是${money(first.price)}/${first.unit}。${first.spec?`资料里写的规格是${first.spec}。`:first.description?`${first.description}。`:''}您可以先看看样子和具体内容，觉得合适咱们再细说；不合适也不用勉强。`});
 if(guided.budget>0&&total>guided.budget||/太贵|费用偏高|预算不够|超预算|再省一些/.test(guided.notes))result.push({title:'先回应费用顾虑',advice:`${total>guided.budget&&guided.budget>0?`当前清单合计${money(total)}，超出参考预算${money(total-guided.budget)}。`:''}先确认客户希望保留的必要项目，再比较可售的其他款式；调整内容和价格须逐项确认。`,text:`费用让您有压力，这个顾虑咱们先认真看，不用勉强自己多花钱。${total>guided.budget&&guided.budget>0?`目前选的这些比参考预算多${money(total-guided.budget)}，我先把差额说明白。`:''}我们可以先保留确实需要的部分，再比较其他款式，合适和能承受更重要。您更希望调整哪一项？`});
 else if(/不满意|不喜欢|换一款|其他款/.test(guided.notes))result.push({title:'明确不满意的原因',advice:'先询问不满意的是款式、材质还是服务内容，再进入商城按条件筛选其他商品，保留已有清单。',text:'这款看着不合适，咱们就先放下，不用急着定。您在意的地方说清楚，我再按这些条件介绍，免得让您反复挑。您主要想调整款式、材质，还是服务内容呢？'});
 else result.push({title:lines.length?'核对当前清单':'确认下一步',advice:lines.length?`当前已选${lines.length}类项目，总费用${money(total)}。请家属核对项目、数量和金额，确认后保存报价。`:'尚未选择商品。先确认家属想比较的项目，家属明确选择后再加入清单。',text:lines.length?`咱们刚才看的是${lines.length}类项目，合计${money(total)}。我先把每一项的内容和数量跟您说清楚，免得后面有不明白的费用。您看完觉得合适，咱们再往下商量，暂时拿不准的也可以先留着。`:'需要安排的事情可能比较多，咱们先从您眼下最想弄明白的一件开始。我把用途和大致怎么安排讲清楚，您听完再考虑，暂时不用决定。您想先比较哪一类用品或服务呢？'});
 return result.slice(0,3);
}
