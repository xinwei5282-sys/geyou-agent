import {canvasPdf} from './quotePdf';
export type AgentNotesInput={sections?:{title:string;hint?:string;items:{title:string;detail?:string;quantity?:string}[]}[];agentName?:string;title?:string;customer:string;subject:string;agency:string;phone?:string;notes:string[]};
export async function agentNotesPdf(input:AgentNotesInput):Promise<Blob>{
 await document.fonts.ready;
 const pages:HTMLCanvasElement[]=[];let ctx:CanvasRenderingContext2D,y=0;
 const draw=(value:string,x:number,top:number,size=16,color='#46372b')=>{ctx.font=`${size}px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif`;ctx.fillStyle=color;ctx.fillText(value,x,top)};
 const add=()=>{const canvas=document.createElement('canvas');canvas.width=1588;canvas.height=2246;ctx=canvas.getContext('2d')!;ctx.scale(2,2);ctx.fillStyle='#fff';ctx.fillRect(0,0,794,1123);pages.push(canvas);draw(input.title||'客户注意事项',48,78,29);draw(input.agency||'服务机构',48,112,14,'#8b7659');y=154;};
 const paragraph=(value:string,size=16)=>{ctx.font=`${size}px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif`;let line='';for(const ch of value){if(ch==='\n'||ctx.measureText(line+ch).width>690){if(y>1010)add();draw(line,48,y,size);y+=27;line=ch==='\n'?'':ch;}else line+=ch;}if(line){if(y>1010)add();draw(line,48,y,size);y+=27;}y+=13;};
 add();paragraph('客户：'+input.customer+'    服务对象：'+input.subject);if(input.agentName)paragraph('服务代理：'+input.agentName,14);paragraph('整理日期：'+new Date().toISOString().slice(0,10),13);
 if(input.sections){input.notes.slice(0,4).forEach(note=>paragraph(note,13));for(const section of input.sections){if(y>910)add();y+=10;draw(section.title,48,y,19,'#79582f');y+=31;if(section.hint)paragraph(section.hint,12);for(const item of section.items){paragraph('• '+item.title+(item.quantity?'  '+item.quantity:''),15);if(item.detail)paragraph(item.detail,13);}}}else input.notes.forEach((note,i)=>paragraph(`${i+1}. ${note}`));if(input.phone)paragraph('服务联系电话：'+input.phone,14);
 for(let i=0;i<pages.length;i++){ctx=pages[i].getContext('2d')!;draw('请结合家属意愿及当地实际要求核对后留存',48,1085,11,'#8b7659');draw(`${i+1} / ${pages.length}`,710,1085,11,'#8b7659');}
 return canvasPdf(pages);
}
export async function downloadAgentNotesPdf(input:AgentNotesInput){
 const blob=await agentNotesPdf(input),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=((input.title||'注意事项')+'-'+input.subject+'-'+new Date().toISOString().slice(0,10)).replace(/[\\/:*?"<>|]/g,'-')+'.pdf';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
