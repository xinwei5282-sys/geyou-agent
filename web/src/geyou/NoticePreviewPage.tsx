import {NoticeWreathProducts} from './NoticeWreathProducts';
import {selectedPortrait} from './memorialModel';
import {useState} from 'react';
import type {AppState} from './types';
import {BottomSheet} from './MobileUI';
import {NoticeWreathContact} from './NoticeWreathContact';
import {NoticeScreen,NoticeTemplate} from './NoticeTemplate';
import {readNoticePreview} from './noticePreview';
export function NoticePreviewPage({previewId,state:providedState}:{previewId:string;state?:AppState}){
 const [wreathOpen,setWreathOpen]=useState(false),[wreathName,setWreathName]=useState('');
 const preview=readNoticePreview(localStorage,previewId);
 if(!preview)return <section className="notice-preview-page"><h1>预览已失效</h1><p>请回到编辑页面重新点击「预览效果」。</p></section>;
 let state:AppState|undefined=providedState;try{if(!providedState)state=JSON.parse(localStorage.getItem('geyou-prototype-v1')||'null')||undefined}catch{}
 const agency=state?.agencies.find(a=>a.id===preview.notice.agencyId);
 const customer=state?.customers.find(c=>c.id===preview.notice.customerId);
 const deceased=customer?.deceased?.find(d=>d.id===preview.notice.deceasedId);
 const portrait=preview.notice.portrait||(deceased?selectedPortrait(deceased)?.image:undefined);
 const shownNotice={...preview.notice,portrait:portrait||'/reference-art/notice-demo-portrait.png'};
 const phone=state?.staff.find(st=>st.id===customer?.ownerId&&st.agencyId===preview.notice.agencyId&&st.enabled)?.phone||agency?.phone||preview.phone;
 return <section className="notice-preview-page notice-preview-fit"><div className="notice-preview-label">效果预览 · 尚未发布{!portrait&&' · 遗照示例'}</div><NoticeScreen footer={<NoticeWreathProducts state={state} agencyId={preview.notice.agencyId} onBuy={product=>{setWreathName(product.name);setWreathOpen(true)}}/>}><NoticeTemplate notice={shownNotice} phone={preview.phone} region={agency?.region}/></NoticeScreen>{wreathOpen&&<BottomSheet title="购买花圈" onClose={()=>setWreathOpen(false)} className="notice-wreath-sheet"><NoticeWreathContact productName={wreathName} qr={agency?.qr} phone={phone}/></BottomSheet>}</section>;
}
