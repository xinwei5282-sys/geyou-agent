const MAX_INPUT=10*1024*1024;
const MAX_STORED=700*1024;
type ImageOptions={allowLargeInput?:boolean;portrait?:boolean};
export async function readProfileImage(file:File,options:ImageOptions={}):Promise<string>{
 const format=file.type.toLowerCase();
 if(!['image/png','image/jpeg','image/webp'].includes(format)&&!(format===''&&/\.(png|jpe?g|webp)$/i.test(file.name)))throw Error('请选择 PNG、JPG 或 WebP 图片；其他格式请先转换。');
 if(file.size>MAX_INPUT&&!options.allowLargeInput)throw Error('图片超过10MB，请选择较小的图片。');
 if(!file.size)throw Error('图片为空，请重新选择。');
 const url=URL.createObjectURL(file);
 try{
  const img=await new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('无法读取这张图片，请更换有效图片。'));image.src=url});
  const canvas=document.createElement('canvas');
  let ratio=Math.min(1,1600/img.naturalWidth,1600/img.naturalHeight);
  for(let attempt=0;attempt<5;attempt++){
   canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));
   const ctx=canvas.getContext('2d');if(!ctx)throw Error('浏览器暂不支持图片处理，请更换浏览器重试。');
   ctx.drawImage(img,0,0,canvas.width,canvas.height);
   // Portraits use JPEG to keep photo data within local storage limits; other assets
   // retain PNG so logos and QR codes keep sharp edges and transparency.
   const data=options.portrait?canvas.toDataURL('image/jpeg',Math.max(0.68,0.9-attempt*0.055)):canvas.toDataURL('image/png');
   if(data.length*0.75<=MAX_STORED)return data;
   ratio*=0.72;
  }
  throw Error('图片内容过大，压缩后仍无法保存，请裁剪图片后重试。');
 }finally{URL.revokeObjectURL(url);}
}
