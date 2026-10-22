import {useEffect,useRef} from 'react';
import {Camera,ImageIcon} from 'lucide-react';
export function PhotoSourcePicker({onClose,onAlbum,onCamera}:{onClose:()=>void;onAlbum:()=>void;onCamera:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{const dialog=ref.current!;dialog.showModal();return()=>dialog.close()},[]);
 return <dialog ref={ref} className="agent-photo-picker" aria-label="选择照片来源" onCancel={e=>{e.preventDefault();onClose()}}><h3>选择照片来源</h3><button type="button" onClick={onAlbum}><ImageIcon size={21}/>从相册选择</button><button type="button" onClick={onCamera}><Camera size={21}/>拍照</button><button type="button" className="agent-photo-picker-cancel" onClick={onClose}>取消</button></dialog>;
}
