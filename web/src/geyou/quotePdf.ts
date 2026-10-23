import type {Quote} from './types';
export type QuotePdfInput={agentName?:string;number:string;customer:string;subject:string;agency:string;phone?:string;date:string;status:string;lines:{name:string;quantity:number;unit:string;price:number;adjustment?:boolean;image?:{src:string;x:number;y:number;width:number;height:number};spec?:string}[];notes?:string[]};
const encoder=new TextEncoder();
const bytes=(v:string)=>encoder.encode(v);
function join(parts:Uint8Array[]){const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let i=0;for(const p of parts){out.set(p,i);i+=p.length}return out;}
export function quotePdfInput(q:Quote):QuotePdfInput{return {number:q.number+' · V'+q.version,customer:q.customerName,subject:q.deceasedName||q.subjectName||'未指定',agency:q.agencyName,phone:q.phone,date:q.createdAt.slice(0,10),status:q.dealConfirmedAt?'已确认成交 · 不代表付款':'报价已确认 · 不代表付款',lines:q.lines,notes:[q.note,'订金及尾款以人工核实的实际收款记录为准。']};}
export async function quotationPdf(input:QuotePdfInput):Promise<Blob>{
 if(input.lines.reduce((n,l)=>n+l.price*l.quantity,0)<0)throw Error('报价总额异常，请先核对');
 await document.fonts.ready;
 const pages:HTMLCanvasElement[]=[];let canvas:HTMLCanvasElement,ctx:CanvasRenderingContext2D,y=0;
 const font=(size:number,weight=400)=>{ctx.font=weight+' '+size+'px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif'};
 const wrap=(value:string,max:number,size=15)=>{font(size);const lines:string[]=[];for(const paragraph of value.split('\n')){let line='';for(const ch of Array.from(paragraph)){if(ctx.measureText(line+ch).width>max&&line){lines.push(line);line=ch}else line+=ch}lines.push(line)}return lines;};
 const text=(value:string,x:number,top:number,size=15,color='#46372b',align:CanvasTextAlign='left',weight=400)=>{font(size,weight);ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(value,x,top)};
 const rule=(top:number)=>{ctx.strokeStyle='#e7dfd2';ctx.beginPath();ctx.moveTo(48,top);ctx.lineTo(746,top);ctx.stroke()};
 const add=()=>{canvas=document.createElement('canvas');canvas.width=1588;canvas.height=2246;ctx=canvas.getContext('2d')!;ctx.scale(2,2);ctx.fillStyle='#ffffff';ctx.fillRect(0,0,794,1123);pages.push(canvas);text('服务报价单',48,78,29,'#493727','left',600);text(input.agency||'服务机构',746,74,15,'#8b7659','right');rule(100);text('报价编号：'+input.number,48,131,13);text('日期：'+input.date,746,131,13,'#8b7659','right');text('客户：'+input.customer,48,164,15);text('服务对象：'+input.subject,48,193,15);if(input.agentName)text('代理：'+input.agentName,746,193,13,'#8b7659','right');text(input.status,48,225,13,'#9c7649');ctx.fillStyle='#f5f0e8';ctx.fillRect(48,247,698,40);text('商品 / 服务项目',60,273,13);text('数量',501,273,13,'#46372b','right');text('单价（元）',615,273,13,'#46372b','right');text('金额（元）',734,273,13,'#46372b','right');y=307};
 const thumbnails=new Map<string,HTMLImageElement>();
 await Promise.all([...new Set(input.lines.flatMap(line=>line.image?[line.image.src]:[]))].map(async src=>{try{const image=new Image();image.src=src;await image.decode();thumbnails.set(src,image)}catch{/* Keep the quote readable if a thumbnail is unavailable. */}}));
 add();
 let total=0;
 for(const [lineIndex,line] of input.lines.entries()){if(!Number.isSafeInteger(line.price)||(line.price<0&&!line.adjustment)||!Number.isFinite(line.quantity)||line.quantity<=0)throw Error('报价金额异常，请先核对');const image=line.image?thumbnails.get(line.image.src):undefined;const names=wrap(line.name+(line.spec?'\n'+line.spec:''),image?309:385,15),height=Math.max(image?84:52,names.length*23+22);if(y+height+(lineIndex===input.lines.length-1?220:0)>1010)add();if(image&&line.image){const r=line.image;const scale=Math.min(62/r.width,62/r.height),w=r.width*scale,h=r.height*scale;ctx.drawImage(image,r.x,r.y,r.width,r.height,60+(62-w)/2,y-14+(62-h)/2,w,h);text('示意',91,y+61,9,'#8b7b67','center')}names.forEach((v,i)=>text(v,image?136:60,y+i*23,15,i?'#8b7b67':'#46372b'));text(String(line.quantity)+' '+line.unit,501,y,13,'#74634e','right');text((line.price/100).toLocaleString('zh-CN'),615,y,14,'#46372b','right');const amount=line.price*line.quantity;total+=amount;text((amount/100).toLocaleString('zh-CN'),734,y,14,'#46372b','right');y+=height;rule(y-16);}
 if(y>880)add();text('报价合计',48,y+20,18);text('¥'+(total/100).toLocaleString('zh-CN'),746,y+20,28,'#9c7649','right',600);y+=65;
 const notes=[...(input.notes||[]),...(input.phone?['服务联系电话：'+input.phone]:[])];
 for(const note of notes){for(const line of wrap(note,698,12)){if(y>1010)add();text(line,48,y,12,'#8d7d69');y+=21}y+=7;}
 for(let i=0;i<pages.length;i++){ctx=pages[i].getContext('2d')!;text((i+1)+' / '+pages.length,746,1085,11,'#9f927f','right');text('服务清单与费用说明 · 请核对后留存',48,1085,11,'#9f927f');}
 return canvasPdf(pages);
}
export function canvasPdf(pages:HTMLCanvasElement[]):Blob{
 const images=pages.map(p=>Uint8Array.from(atob(p.toDataURL('image/jpeg',.94).split(',')[1]),c=>c.charCodeAt(0))),objects:Uint8Array[]=[];
 const count=2+images.length*3,pageIds=images.map((_,i)=>3+i*3);
 objects.push(bytes('<< /Type /Catalog /Pages 2 0 R >>'),bytes('<< /Type /Pages /Kids ['+pageIds.map(n=>n+' 0 R').join(' ')+'] /Count '+images.length+' >>'));
 images.forEach((img,i)=>{const p=3+i*3;objects.push(bytes('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Img '+(p+1)+' 0 R >> >> /Contents '+(p+2)+' 0 R >>'));objects.push(join([bytes('<< /Type /XObject /Subtype /Image /Width 1588 /Height 2246 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+img.length+' >>\nstream\n'),img,bytes('\nendstream')]));const commands='q 595.28 0 0 841.89 0 0 cm /Img Do Q';objects.push(bytes('<< /Length '+commands.length+' >>\nstream\n'+commands+'\nendstream'));});
 const parts:Uint8Array[]=[bytes('%PDF-1.4\n')],offsets=[0];let offset=parts[0].length;
 objects.forEach((obj,i)=>{offsets.push(offset);const part=join([bytes((i+1)+' 0 obj\n'),obj,bytes('\nendobj\n')]);parts.push(part);offset+=part.length});
 const xref=offset;parts.push(bytes('xref\n0 '+(count+1)+'\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+(count+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF'));
 return new Blob([join(parts)],{type:'application/pdf'});
}
export async function downloadQuotationPdf(input:QuotePdfInput){const blob=await quotationPdf(input),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=('报价单-'+input.subject+'-'+input.date).replace(/[\\/:*?"<>|]/g,'-')+'.pdf';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
export async function downloadQuotePdf(quote:Quote){return downloadQuotationPdf(quotePdfInput(quote));}
