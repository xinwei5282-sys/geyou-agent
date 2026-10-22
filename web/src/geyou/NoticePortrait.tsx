import { useEffect, useRef, useState } from 'react';
import { UserRound, Upload, Sparkles, Camera } from 'lucide-react';
import { readProfileImage } from './profileImage';
import './notice-portrait.css';

export interface NoticePortraitProps {
  value?: string;
  compact?: boolean;
  onChange: (value: string | undefined) => void;
  onBusyChange?: (busy: boolean) => void;
  onAI?: () => void;
}

export function NoticePortrait({ value, compact, onChange, onBusyChange, onAI }: NoticePortraitProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [aiMessage, setAiMessage] = useState('');
  const mounted = useRef(true);

  const change = useRef(onChange);
  change.current = onChange;
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const setProcessing = (next: boolean) => {
    if (!mounted.current) return;
    setBusy(next);
    onBusyChange?.(next);
  };

  const choose = async (file?: File) => {
    if (!file || busy) return;
    setProcessing(true);
    setError('');
    setAiMessage('');
    try {
      const image = await readProfileImage(file);
      if (!mounted.current) return;
      change.current(image);
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : '图片处理失败，请重试。');
    } finally {
      setProcessing(false);
    }
  };

  const remove = () => {
    if (busy) return;
    setError('');
    setAiMessage('');
    onChange(undefined);
  };

  if(compact)return <section className="notice-portrait notice-portrait-compact" aria-label="遗照（选填）"><label className="notice-photo-target">{value?<img src={value} alt="讣告遗照预览"/>:<><Camera size={26}/><span>上传照片</span><small>建议使用清晰、<br/>庄重的生活照</small></>}<input hidden type="file" accept="image/png,image/jpeg,image/webp" aria-label={value?'更换讣告遗照':'上传讣告遗照'} disabled={busy} onChange={event=>{const file=event.target.files?.[0];event.target.value='';void choose(file);}}/>{busy&&<span role="status">正在处理…</span>}</label>{value&&<div className="notice-photo-links"><button type="button" disabled={busy} onClick={remove}>移除</button>{onAI&&<button type="button" disabled={busy} onClick={onAI}>修复照片</button>}</div>}{error&&<p role="alert">{error}</p>}</section>;
  return (
    <section className="notice-portrait" aria-labelledby="notice-portrait-title">
      <div className="notice-portrait-heading">
        <div>
          <h2 id="notice-portrait-title">遗照（选填）</h2>
          <p>上传后可在讣告中展示，也可以稍后更换。</p>
        </div>
        <span className="notice-portrait-optional">可选</span>
      </div>

      <div className="notice-portrait-preview" aria-live="polite">
        {value ? <img src={value} alt="讣告遗照预览" /> : <span><UserRound size={61}/><small>暂无遗照</small></span>}
      </div>

      <div className="notice-portrait-actions">
        <label className="notice-portrait-upload">
          <Upload size={15}/>{busy ? '正在处理…' : value ? '更换遗照' : '上传遗照'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label={value ? '更换讣告遗照' : '上传讣告遗照'}
            disabled={busy}
            onChange={event => {
              const file = event.target.files?.[0];
              event.target.value = '';
              void choose(file);
            }}
          />
        </label>
        {value && <button type="button" className="notice-portrait-remove" disabled={busy} onClick={remove}>移除</button>}
        <button
          type="button"
          className="notice-portrait-ai"
          disabled={!value || busy}
          onClick={() => { if (onAI) onAI(); else setAiMessage('AI 遗像处理服务尚未接入，当前可使用原图。'); }}
        >
          <Sparkles size={14}/>AI修复照片
        </button>
      </div>

      <p className="notice-portrait-hint">支持 PNG、JPG、WebP，单张图片最大 10MB，上传时会自动压缩。</p>
      {error && <p className="notice-portrait-error" role="alert">{error}</p>}
      {aiMessage && <p className="notice-portrait-info" role="status">{aiMessage}</p>}
    </section>
  );
}

export default NoticePortrait;
