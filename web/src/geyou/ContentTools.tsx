import {AgentEmptyState} from './AgentEmptyState';
import {noticeServicePhone} from './noticeContact';
import {NoticeWreathProducts} from './NoticeWreathProducts';
import {NoticeWreathContact} from './NoticeWreathContact';
import { syncNoticeWorkflow } from './serviceAutomation';
import { LinkedRestorationPage } from './MemorialPages';
import { bindNotice, canAccessNotice, validateNoticeBinding, archiveNoticePortrait, selectNoticeCustomer, ensureNoticeSubject, selectedPortrait } from './memorialModel';
import { visibleCustomers, hasStaffModule } from './model';
import { NoticePortrait } from './NoticePortrait';
import { persistPrototype } from './auth';
import { readProfileImage } from './profileImage';
import { hasModule } from './model';
import React, { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Building2, FileText, FileClock, Phone, WalletCards, Search, Plus, ChevronRight, CalendarDays, MapPin, UserRound, Eye, Share2, Pencil, Clock3, ArrowLeft, Camera } from 'lucide-react';
import type { AppState, Notice, PageProps, Product } from './types';
import './content.css';
import './content-phase-one.css';
import './notice-reference.css';
import './notice-editor-reference.css';
import { ActionBar, PageHeader, BottomSheet } from './MobileUI';
import { NoticeTemplate, NoticeScreen } from './NoticeTemplate';
import {buildAmapSearchUrl} from './noticeNavigation';
import {saveNoticePreview} from './noticePreview';
import { noticeGenerationKey, syncDefaultNoticeText } from './noticeGeneration';
import {prepareNoticePublication,isPublicNotice} from './noticePublication';

const money = (cents: number) => `¥${(cents / 100).toFixed(2)}`;
function bannerSourceKey(a:Pick<AppState['agencies'][number],'name'|'introduction'|'region'|'logo'>){const source=`${a.name.trim()}\u0000${a.introduction?.trim()||''}\u0000${a.region.trim()}\u0000${a.logo||''}`;let hash=2166136261;for(let i=0;i<source.length;i++)hash=Math.imul(hash^source.charCodeAt(i),16777619);return(hash>>>0).toString(36)}
const newNotice = (agencyId: string): Notice => ({ id: `notice-${Date.now()}`, agencyId, name: '', age: '', date: '', ceremonyDate: '', location: '', text: '', status: '草稿', createdAt: new Date().toISOString() });

export function ContentPage({ state, update, context, notify, navigate,routeBase='/content',previewBase,localPersistence }: PageProps) {
  const [tab, setTab] = useState<'list' | 'edit' | 'detail'>('list');
  const [editing, setEditing] = useState<Notice | null>(null);
  const [viewing, setViewing] = useState<Notice | null>(null);
  const [queryText, setQueryText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'全部'|'草稿'|'已发布'|'已撤回'>('全部');
  const notices = state.notices.filter(n => canAccessNotice(state, context.staff, n));
  const filteredNotices = notices.filter(n => (statusFilter==='全部'||n.status===statusFilter) && (!queryText.trim() || `${n.name}${state.customers.find(c=>c.id===n.customerId)?.name||''}${n.location}`.includes(queryText.trim())));
  const query = location.hash.split('?')[1] || '';
  const workflowParams=new URLSearchParams(query);
  const workflowSource=workflowParams.get('workflow')==='1';
  const returnSession=workflowParams.get('returnSession');
  const returnTask=workflowParams.get('returnTask');
  const workflowSuffix=workflowSource?`&workflow=1${returnSession?`&returnSession=${encodeURIComponent(returnSession)}`:''}${returnTask?`&returnTask=${encodeURIComponent(returnTask)}`:''}`:'';
  const workflowBack=(notice?:Notice)=>workflowSource?(returnTask?`/home?view=todo&task=${encodeURIComponent(returnTask)}`:returnSession?`/talk?session=${encodeURIComponent(returnSession)}`:`/customers?customer=${encodeURIComponent(notice?.customerId||workflowParams.get('customer')||'')}&deceased=${encodeURIComponent(notice?.deceasedId||workflowParams.get('deceased')||'')}&tab=service&flowStage=notice`):'/content';
  useEffect(() => {
    const params = new URLSearchParams(query);
    if (params.get('notice')) {
      const existing=state.notices.find(n=>n.id===params.get('notice')&&canAccessNotice(state,context.staff,n));
      if(existing&&params.get('view')==='detail'){setViewing({...existing});setTab('detail');}
      else if(existing){const person=state.customers.find(c=>c.id===existing.customerId)?.deceased?.find(d=>d.id===existing.deceasedId);const adopted=person&&selectedPortrait(person);const draft=existing.status==='草稿'&&!existing.portrait&&adopted?{...existing,portrait:adopted.image,portraitRecordId:adopted.recordId}:existing;setEditing({...draft});setTab('edit');}
      else{notify('讣告不存在或无权访问');setEditing(null);setViewing(null);setTab('list');}
      return;
    }
    if (params.get('new') !== '1') {setViewing(null);setEditing(null);setTab('list');return;}
    try {
      const customerId=params.get('customer')||'';
      let draft=customerId?selectNoticeCustomer(state,context.staff,newNotice(context.agency.id),customerId):newNotice(context.agency.id);
      if(customerId&&params.get('deceased'))draft=bindNotice(state,context.staff,draft,customerId,params.get('deceased')!);
      setEditing(draft); setTab('edit');
    } catch (error) { notify((error as Error).message); setTab('list'); setEditing(null); }
  }, [query]);
  const open = (n?: Notice) => { setEditing(n ? { ...n } : newNotice(context.agency.id)); setTab('edit'); };
  const save = (publish = false, repair = false, familyConfirmed = false, makeCurrent = false) => {
    if (!editing) return;
    if(publish&&!familyConfirmed){notify('请先与家属确认本次讣告内容');return;}
    const required = [editing.name, editing.age, editing.date, editing.ceremonyDate, editing.location, editing.text];
    if (publish && (required.some(v => !v.trim()) || !noticeServicePhone(state,{...editing,...(previewBase?{serviceStaffId:context.staff.id}:{})},previewBase?context.staff:undefined))) { notify('发布前请补齐讣告必填项和服务电话，可到设置补录'); return; }
    const nextStatus = publish ? '已发布' : '草稿';
    let saved: Notice = { ...editing,...(previewBase?{serviceStaffId:context.staff.id}:{}), status: nextStatus, familyConfirmedAt:publish&&familyConfirmed?new Date().toISOString():undefined, familyConfirmedBy:publish&&familyConfirmed?context.staff.id:undefined, scheduleReview:publish?undefined:editing.scheduleReview };
    let source = state;
    try {
      const prepared=ensureNoticeSubject(source,context.staff,saved);source=prepared.state;saved=prepared.notice;
      if (!canAccessNotice(source, context.staff, saved)) throw Error('无权编辑此讣告');
      if (publish || editing.customerId || editing.deceasedId || !state.notices.some(n => n.id === editing.id)) {
        validateNoticeBinding(source, context.staff, saved);
        const archived = archiveNoticePortrait(source, context.staff, saved);
        source = archived.state; saved = archived.notice;
        if(publish)source=prepareNoticePublication(source,context.staff,saved);
        if (repair) {
          if (!saved.portraitRecordId) throw Error('请先上传遗照');

        }
      }
    } catch (error) { notify((error as Error).message); return; }
    let next = { ...source, notices: source.notices.some(n => n.id === editing.id) ? source.notices.map(n => n.id === editing.id ? saved : n) : [...source.notices, saved] };
    const previous = state.notices.find(n=>n.id===saved.id);
    if(previous&&(previous.customerId!==saved.customerId||previous.deceasedId!==saved.deceasedId))next=syncNoticeWorkflow(next,previous);
    next=syncNoticeWorkflow(next,saved,!previous);
    try { if(localPersistence!==false)persistPrototype(next); } catch (error) { notify((error as Error).message); return; }
    setEditing(saved);
    update(() => next);
    if (repair) { navigate(`/restoration?customer=${saved.customerId}&deceased=${saved.deceasedId}&workflow=1${returnSession?`&returnSession=${encodeURIComponent(returnSession)}`:''}${returnTask?`&returnTask=${encodeURIComponent(returnTask)}`:''}`); notify('照片已归档，可开始AI修复'); }
    else if (publish) navigate(returnTask?`/content?notice=${encodeURIComponent(saved.id)}&view=detail${workflowSuffix}`:`/notice/${editing.id}`); else { navigate(`/content?notice=${saved.id}${workflowSource?'&view=detail'+workflowSuffix:''}`); notify(editing.status === '已发布' ? '已公开讣告修改为草稿，公开页暂时不可见' : '草稿已保存'); }
  };
  return <div className={`ct-page notice-ref-page ${tab==='edit'?'content-editing notice-ref-editor':tab==='detail'?'notice-ref-detail':'content-list-page notice-ref-list'}`}>
    {tab==='list'&&<PageHeader title="电子讣告" subtitle="用心告别，让思念有归处" action={<button className="btn btn-primary" onClick={()=>routeBase==='/content'?open():navigate('/content?new=1')}><Plus size={17}/>新建</button>}/>}
    {tab === 'list' ? <div className="ct-list"><div className="notice-ref-banner" aria-hidden="true"><strong>用心告别，<br/>让思念有归处</strong><span>留存一份思念，传递一份温暖</span></div><div className="content-list-tools"><label className="search"><Search size={18}/><input aria-label="搜索客户或逝者姓名" placeholder="搜索客户或逝者姓名" value={queryText} onChange={e=>setQueryText(e.target.value)}/></label><div className="content-filters">{(['全部','草稿','已发布','已撤回'] as const).map(filter=><button key={filter} className={statusFilter===filter?'active':''} onClick={()=>setStatusFilter(filter)}>{filter}</button>)}</div></div><div className="notice-record-list">{filteredNotices.length ? filteredNotices.map(n => {const customer=state.customers.find(c=>c.id===n.customerId);return <a className="panel ct-notice-row notice-ref-card notice-record-link" key={n.id} href={`#${routeBase}?notice=${encodeURIComponent(n.id)}&view=detail`} aria-label={`查看${n.name||'未命名讣告'}`}><span className="notice-cover notice-ref-cover waterfall-preview-link"><img src={`/reference-art/notice-draft/template-${n.template==='flower'?'flower':'simple'}.png`} alt="讣告模板预览"/></span><div className="notice-card-copy"><div className="record-heading"><h2><span className="waterfall-title-link">{n.name||'未命名讣告'}</span></h2><span className={`tag ${n.status==='已发布'?'tag-green':''}`}>{n.status}</span></div><p><UserRound size={15}/>关联客户：{customer?.name||'待关联'}</p><p className="notice-secondary-date"><CalendarDays size={15}/>告别日期：<time dateTime={n.ceremonyDate||undefined}>{n.ceremonyDate?n.ceremonyDate.slice(0,10):'待填写'}</time></p></div></a>}) : previewBase?<AgentEmptyState icon={<FileText/>} title={queryText.trim()||statusFilter!=='全部'?'没有符合条件的讣告':'还没有电子讣告'} description={queryText.trim()||statusFilter!=='全部'?'试试其他关键词，或查看全部讣告':'创建后的讣告草稿和发布记录会展示在这里'} actionLabel={queryText.trim()||statusFilter!=='全部'?'查看全部讣告':undefined} onAction={()=>{setQueryText('');setStatusFilter('全部')}}/>:<div className="panel empty">没有匹配的讣告。</div>}</div></div> : tab==='detail'&&viewing ? <NoticeDetail agent={!!previewBase} notice={viewing} customer={state.customers.find(c=>c.id===viewing.customerId)?.name} agency={{...context.agency,phone:noticeServicePhone(state,viewing,previewBase?context.staff:undefined)}} onBack={()=>navigate(workflowBack(viewing))} onEdit={()=>navigate(`/content?notice=${encodeURIComponent(viewing.id)}${workflowSuffix}`)}/> : editing && (!state.notices.some(n=>n.id===editing.id) || canAccessNotice(state, context.staff, state.notices.find(n=>n.id===editing.id)!)) && <NoticeEditor state={state} update={update} context={context} notify={notify} navigate={navigate} previewBase={previewBase} notice={editing} setNotice={setEditing} save={save} back={() => query ? navigate(workflowBack(editing)) : setTab('list')} />}
  </div>;
}

function NoticeDetail({notice,customer,agency,onBack,onEdit,agent}:{agent?:boolean;notice:Notice;customer?:string;agency:PageProps['context']['agency'];onBack:()=>void;onEdit:()=>void}) {
  const ceremony=notice.ceremonyDate?new Date(notice.ceremonyDate):null;
  const ceremonyText=ceremony&&!Number.isNaN(ceremony.getTime())?new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(ceremony):'待填写';
  const dateText=notice.date?new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'long',day:'numeric'}).format(new Date(`${notice.date}T00:00:00`)):'待填写';
  return <><header className="app-page-header notice-ref-detail-heading"><button className="app-back" aria-label="返回讣告列表" onClick={onBack}><ArrowLeft size={22}/></button><div className="notice-ref-detail-title"><div><h1>讣告详情</h1><span className={`notice-ref-header-status status-${notice.status==='已发布'?'published':notice.status==='已撤回'?'withdrawn':'draft'}`}>{notice.status}</span></div><p>愿思念长存，让爱继续</p></div><button className="text-btn notice-ref-edit-link" onClick={onEdit}><Pencil size={18}/>编辑</button></header><div className="notice-ref-detail-body"><section className={`notice-ref-hero ${notice.portrait?'has-portrait':''}`}><div className="notice-ref-hero-art" aria-hidden="true"/>{notice.portrait&&<img className="notice-ref-portrait" src={notice.portrait} alt={`${notice.name||'逝者'}遗照`}/>}<div className="notice-ref-title-block"><strong>讣告</strong><i/><p>斯人已逝　风范长存<br/>永怀于心　思念常在</p></div><div className="notice-ref-name"><h2>{notice.name||'姓名待填写'}</h2><span>享年 {notice.age||'待填写'}{notice.age?' 岁':''}</span></div><p className="notice-ref-copy">{notice.text||'讣告正文待填写。'}</p></section><section className="notice-ref-info-card"><h2>告别仪式信息</h2><div className="notice-ref-info-row"><CalendarDays/><span>告别时间</span><strong>{ceremonyText}</strong></div><div className="notice-ref-info-row"><MapPin/><span>告别地点</span><strong className="notice-location-inline"><span>{notice.location||'待填写'}</span>{notice.location.trim()&&<a className="notice-navigation-link" href={buildAmapSearchUrl(notice.location,agency.region)} target="_blank" rel="noopener noreferrer">导航前往</a>}</strong></div><div className="notice-ref-info-row"><Clock3/><span>离世日期</span><strong>{dateText}</strong></div><div className="notice-ref-info-row"><Phone/><span>服务电话</span><strong>{agency.phone||'待填写'}</strong></div></section><section className="notice-ref-info-card notice-ref-related"><h2>相关信息</h2><div className="notice-ref-info-row"><UserRound/><span>关联客户</span><strong>{customer||'待关联'}</strong></div><div className="notice-ref-info-row"><FileClock/><span>发布状态</span><strong>{notice.status}</strong></div></section>{agent&&<div className="agent-notice-detail-actions"><button className="btn btn-outline" onClick={()=>{const id=crypto.randomUUID();saveNoticePreview(localStorage,id,notice,agency.phone||'');window.open(`${location.pathname}#/agent/notice-preview/${id}`,'_blank','noopener')}}>预览效果</button><button className="btn btn-primary" onClick={onEdit}>编辑讣告</button></div>}</div></>;
}

function NoticeEditor({ state, update, context, notify, navigate, notice, setNotice, save, back,previewBase }: Pick<PageProps, 'state'|'update'|'context'|'notify'|'navigate'|'previewBase'> & { notice: Notice; setNotice: (n: Notice) => void; save: (publish?: boolean, repair?: boolean, familyConfirmed?:boolean) => void; back: () => void }) {
  const servicePhone=noticeServicePhone(state,notice,previewBase?context.staff:undefined);
  const taskSubjectLocked=!!new URLSearchParams(location.hash.split('?')[1]||'').get('returnTask');
  const [portraitBusy, setPortraitBusy] = useState(false);
  const [agentReview,setAgentReview]=useState(()=>!!previewBase&&state.notices.some(n=>n.id===notice.id));
  const [noticeAiBusy, setNoticeAiBusy] = useState(false);
  const [generatedNoticeText,setGeneratedNoticeText]=useState('');
  const defaultNoticeRef=useRef(notice);
  useEffect(()=>{const next=syncDefaultNoticeText(defaultNoticeRef.current,notice);defaultNoticeRef.current=next;if(next.text!==notice.text)setNotice(next);},[notice]);
  const noticeRef = useRef(notice);
  const noticeRequest = useRef<AbortController | null>(null);
  noticeRef.current = notice;
  useEffect(() => () => noticeRequest.current?.abort(), []);
  const saveWhileReady = (...args: Parameters<typeof save>) => {
    if (noticeAiBusy) { notify('讣告文案生成中，请稍候再保存或发布'); return; }
    save(...args);
  };
  const generateNotice = async () => {
    if (noticeAiBusy) return;
    if (!notice.name.trim()) { notify('请先填写逝者姓名'); return; }
    const snapshot = noticeGenerationKey(notice);
    const requestedNotice = notice;
    const controller = new AbortController();
    noticeRequest.current = controller;
    setGeneratedNoticeText('');
    setNoticeAiBusy(true);
    try {
      const response = await fetch('/api/geyou/notice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          name: requestedNotice.name,
          age: requestedNotice.age,
          date: requestedNotice.date,
          ceremonyDate: requestedNotice.ceremonyDate,
          location: requestedNotice.location,
          text: requestedNotice.text,
          phone: servicePhone,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || '讣告文案生成失败，请稍后重试');
      if (typeof data.text !== 'string' || !data.text.trim()) throw new Error('未收到有效讣告文案，请重试');
      if (controller.signal.aborted) return;
      if (noticeGenerationKey(noticeRef.current) !== snapshot) { setGeneratedNoticeText(data.text.trim()); notify('文案已生成；你修改了资料或正文，请查看生成结果后决定是否使用'); return; }
      setNotice({ ...noticeRef.current, text: data.text.trim() });
      const missing = Array.isArray(data.missingFields) ? data.missingFields.filter((value: unknown): value is string => typeof value === 'string' && !!value.trim()) : [];
      notify(missing.length ? `文案已生成，以下信息尚未确认，请核实后补充：${missing.join('、')}` : '讣告文案已生成，请核对后保存');
    } catch (error) {
      if (controller.signal.aborted) return;
      notify((error as Error).message || '讣告文案生成失败，请检查网络后重试');
    } finally {
      if (noticeRequest.current === controller) {
        noticeRequest.current = null;
        setNoticeAiBusy(false);
      }
    }
  };
  const openPreview=()=>{try{const id=crypto.randomUUID();saveNoticePreview(localStorage,id,noticeRef.current,servicePhone||'');window.open(`${location.pathname}#${previewBase||'/notice-preview/'}${id}`,'_blank','noopener');}catch{notify('预览暂时无法打开，请检查浏览器存储空间');}};
  const [confirmedContent,setConfirmedContent]=useState('');
  const confirmationContent=JSON.stringify([servicePhone,notice.id,notice.customerId,notice.deceasedId,notice.name,notice.age,notice.date,notice.ceremonyDate,notice.location,notice.text,notice.portrait,notice.template]);
  const familyConfirmed=confirmedContent===confirmationContent;
  const customers = visibleCustomers(state, context.staff);
  const selectedCustomer = customers.find(c => c.id === notice.customerId);
  const selectedDeceased = selectedCustomer?.deceased?.find(d => d.id === notice.deceasedId);
  const selectPerson = (id: string) => {
    if (!id) { setNotice({...notice, deceasedId: undefined, portrait: undefined, portraitRecordId: undefined, name: '', age: ''}); return; }
    if ((notice.portrait || notice.name) && !confirm('切换逝者将带入对应姓名和已确认遗照，请核对讣告正文。继续？')) return;
    try { setNotice(bindNotice(state, context.staff, notice, notice.customerId || '', id)); } catch(error) { notify((error as Error).message); }
  };
  const field = (key: keyof Notice, label: string, type = 'text') => { const value=String(notice[key]||''); const hint=key==='date'?(value?`已选：${value.split('-').map((v,i)=>i===1?String(Number(v))+'月':i===2?String(Number(v))+'日':v+'年').join('')}`:''):key==='ceremonyDate'?(value?`已选：${value.slice(0,10).split('-').map((v,i)=>i===1?String(Number(v))+'月':i===2?String(Number(v))+'日':v+'年').join('')} ${value.slice(11,16)}（24小时制）`:''):''; return <label className="field" data-notice-field={key}><span>{label}</span><input lang="zh-CN" aria-label={label} type={type} value={value} onChange={e => setNotice({ ...notice, [key]: e.target.value })} />{hint&&<small className="date-format-hint">{hint}</small>}</label>; };
  return <div className="panel ct-editor task-editor">
    <header className="app-page-header notice-ref-editor-heading">
      <button className="app-back" aria-label="返回上一页" onClick={()=>{if(confirm('离开编辑？未保存内容将丢失。'))back()}}><ArrowLeft size={22}/></button>
      <div className="notice-ref-editor-title"><h1>{state.notices.some(item=>item.id===notice.id)?'编辑电子讣告':'新建电子讣告'}</h1><p>核对资料，让思念有归处</p></div>
      <button className="btn btn-outline" disabled={portraitBusy||noticeAiBusy} onClick={()=>saveWhileReady()}>保存草稿</button>
    </header>
    {notice.status === '已发布' && <p className="warning">保存为草稿会撤下当前公开页，重新发布后恢复展示。</p>}
    <div className="agent-notice-entry" hidden={!!previewBase&&agentReview}><section className="panel notice-ref-editor-card notice-binding notice-customer-binding">
      <h2 className="notice-ref-section-title">关联客户</h2>
      <label className="field"><span>关联客户 *</span><select aria-label="关联客户" disabled={portraitBusy||noticeAiBusy||taskSubjectLocked} value={notice.customerId||''} onChange={e=>{if(notice.customerId&&notice.customerId!==e.target.value&&(notice.name||notice.portrait)&&!confirm('切换客户会更换本次逝者资料和照片，继续？'))return;try{setNotice(selectNoticeCustomer(state,context.staff,notice,e.target.value));}catch(error){notify((error as Error).message);}}}><option value="">请选择客户</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}{c.phone?` · ${c.phone}`:''}</option>)}</select></label>
      {selectedCustomer&&(selectedDeceased?<div className="notice-subject-summary"><strong>{selectedDeceased.name}</strong><span>{selectedDeceased.age?`享年 ${selectedDeceased.age} 岁`:'享年待填写'}{selectedDeceased.relationship?` · ${selectedDeceased.relationship}`:''}</span><small>已带入逝者资料，请在下方核对。</small>{(selectedCustomer.deceased?.length||0)>1&&<label className="field"><span>更换服务对象</span><select aria-label="关联逝者" disabled={portraitBusy||noticeAiBusy||taskSubjectLocked} value={notice.deceasedId||''} onChange={e=>selectPerson(e.target.value)}>{[...(selectedCustomer.deceased||[])].reverse().map(d=><option key={d.id} value={d.id}>{d.name}{d.relationship?` · ${d.relationship}`:''}</option>)}</select></label>}</div>:<p className="muted">该客户暂无逝者记录，请在下方填写。保存时将关联到该客户。</p>)}
    </section>
    <section className="panel notice-ref-editor-card notice-ref-subject-card">
      <h2 className="notice-ref-section-title">逝者资料</h2>
      {selectedCustomer?<NoticePortrait compact value={notice.portrait} onChange={portrait => setNotice({ ...notice, portrait, portraitRecordId:undefined })} onBusyChange={setPortraitBusy} onAI={()=>{if(!hasStaffModule(state,context.staff,'restoration'))return notify('请联系本店主账号开通照片修复权限');if(noticeAiBusy)return notify('讣告文案生成中，请稍候再保存或发布');if(confirm('保存当前讣告为草稿并前往照片修复？已发布讣告会撤下。'))saveWhileReady(false,true);}}/>:<div className="notice-ref-portrait-empty"><Camera size={26}/><span>上传照片</span><small>选择客户后可上传<br/>遗照选填</small></div>}
      <div className="form-grid">{field('name', '逝者姓名 *')}{field('age', '享年 *')}{field('date', '离世日期 *', 'date')}{field('ceremonyDate', '告别时间 *', 'datetime-local')}{field('location', '告别地点 *')}</div>{previewBase&&<p className="agent-notice-photo-hint">{selectedCustomer?'遗照选填，建议使用清晰、庄重的生活照。':'请先关联客户，再上传遗照（选填）。'}</p>}
    </section>
    <section className="panel notice-ref-editor-card notice-ref-body-card">
      <div className="field notice-body-field"><div className="notice-body-label-row"><span>讣告正文 *</span><button type="button" className="btn btn-outline notice-ai-generate" disabled={noticeAiBusy} onClick={generateNotice}>{noticeAiBusy?'正在生成…':'✦ AI生成讣告'}</button></div><textarea maxLength={500} aria-label="讣告正文 *" rows={7} value={notice.text} onChange={e => setNotice({ ...notice, text: e.target.value })} placeholder="谨定于……举行告别仪式，敬请亲友……" /><small className="notice-ref-counter">{notice.text.length}/500</small>{noticeAiBusy&&<small className="notice-ai-status" role="status">正在生成讣告文案，可继续编辑正文。</small>}{generatedNoticeText&&<div className="notice-ai-result"><strong>生成结果（尚未替换正文）</strong><p>请核对姓名、日期和地点与当前资料一致。</p><textarea aria-label="生成的讣告文案" readOnly rows={7} value={generatedNoticeText}/><button type="button" className="btn btn-outline" onClick={()=>{setNotice({...noticeRef.current,text:generatedNoticeText});setGeneratedNoticeText('');notify('已使用生成文案，请核对后保存');}}>使用这份文案</button></div>}</div>
    </section>
    </div><div className="agent-notice-review-stage" hidden={!!previewBase&&!agentReview}>{previewBase&&<button className="text-btn agent-review-edit" onClick={()=>setAgentReview(false)}><Pencil size={16}/>修改资料与正文</button>}<section className="panel notice-ref-editor-card notice-ref-template-card"><h2 className="notice-ref-section-title">选择模板</h2><div className="notice-template-picker">{(['simple','flower'] as const).map(t=><button aria-label={t==='simple'?'雅致素笺':'素白花语'} className={(notice.template||'simple')===t?'active':''} key={t} onClick={()=>setNotice({...notice,template:t})}><span className={`template-preview ${t}`} aria-hidden="true"/><small>{t==='simple'?'雅致素笺':'素白花语'}</small></button>)}</div><div className="notice-phone"><Phone size={17}/><strong>服务电话</strong>{servicePhone?<p>{servicePhone}</p>:<><p>发布前请补充服务电话。</p><button className="text-btn" onClick={()=>{if(confirm('请先保存草稿，以免未保存内容丢失。现在前往企业资料？'))navigate('/settings')}}>前往企业资料填写</button></>}</div></section>
    {previewBase&&<section className="notice-ref-editor-card agent-notice-copy-review"><h2 className="notice-ref-section-title">文案预览</h2><p>{notice.text||'正文待填写'}</p></section>}
    {previewBase&&<section className="notice-ref-editor-card agent-notice-review"><h2 className="notice-ref-section-title">关键信息核对</h2>{[['姓名',notice.name],['享年',notice.age?notice.age+'岁':''],['告别时间',notice.ceremonyDate.replace('T',' ')],['告别地点',notice.location],['服务电话',servicePhone]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value||'待填写'}</strong></div>)}</section>}
    <label className="notice-family-confirm"><input type="checkbox" checked={familyConfirmed} onChange={e=>setConfirmedContent(e.target.checked?confirmationContent:'')}/>已与家属确认以上信息，发布时同步告别日期与时间到服务安排<span>请仔细核对资料后发布</span></label>
    </div><ActionBar><div className="ct-actions"><button className="btn btn-outline" disabled={portraitBusy} onClick={openPreview}>预览效果</button><button className="btn btn-primary" disabled={portraitBusy||noticeAiBusy||(!!previewBase&& !agentReview?false:!familyConfirmed)} onClick={() => previewBase&&!agentReview?setAgentReview(true):saveWhileReady(true,false,familyConfirmed)}>{previewBase&&!agentReview?'核对并继续':'发布讣告'}</button></div></ActionBar>
  </div>;
}

export function PublicNoticePage({ state, noticeId, update, context, notify }: PageProps & { noticeId: string }) {
  const notice = state.notices.find(n => n.id === noticeId && isPublicNotice(state,n));
  const [wreathOpen,setWreathOpen]=useState(false);
  const [wreathName,setWreathName]=useState('');
  const agency = notice ? state.agencies.find(a => a.id === notice.agencyId) : undefined;
  useEffect(() => { if (!notice || state.visits.some(v => v.noticeId === notice.id && v.type === '浏览')) return; update(s => ({ ...s, visits: [...s.visits, { id: `visit-${Date.now()}`, agencyId: notice.agencyId, noticeId: notice.id, type: '浏览', at: new Date().toISOString() }] })); }, [notice?.id, state.visits, update]);
  const visit = () => { if (!notice) return; update(s => ({ ...s, visits: [...s.visits, { id: `visit-${Date.now()}`, agencyId: notice.agencyId, noticeId: notice.id, type: '拨号', at: new Date().toISOString() }] })); notify('这是示例联系入口，不会真实外呼；已记录联系意向'); };
  const share = async () => { if (!notice) return; try { await navigator.clipboard.writeText(`${location.origin}${location.pathname}#/notice/${noticeId}`); notify('公开链接已复制；仅当前浏览器示例数据可见'); } catch { notify('复制失败，请复制地址栏链接'); } };
  if (!notice || !agency) return <div className="ct-public invalid-public"><img className="invalid-illustration" src="/reference-art/invalid-illustration-source.png" alt="内容暂不可查看"/><h1>内容暂不可查看</h1><p>该内容可能已撤回或更新，<br/>请通过原分享渠道联系服务人员。</p></div>;
  return <div className={`ct-page ct-public notice-template-${notice.template || 'simple'}`}><div className="section-head"><button className="text-btn" onClick={share}>复制分享链接</button></div><NoticeScreen footer={<NoticeWreathProducts state={state} agencyId={agency.id} onBuy={product=>{setWreathName(product.name);setWreathOpen(true)}}/>}><NoticeTemplate notice={notice} phone={noticeServicePhone(state,notice)} region={agency.region} onContact={visit}/></NoticeScreen>{wreathOpen&&<BottomSheet title="购买花圈" onClose={()=>setWreathOpen(false)} className="notice-wreath-sheet"><NoticeWreathContact productName={wreathName} qr={agency.qr} phone={state.staff.find(st=>st.id===state.customers.find(c=>c.id===notice.customerId)?.ownerId&&st.agencyId===agency.id&&st.enabled)?.phone||agency.phone}/></BottomSheet>}</div>;
}
function ProductCard({ product }: { product: Product; key?: string }) { return <div className="ct-product"><div className="ct-product-icon">{product.name.slice(0, 1)}</div><div><strong>{product.name}</strong><div className="muted">{product.description || product.unit} · {money(product.price)}</div></div></div>; }

export function RestorationPage(props: PageProps) { return <LinkedRestorationPage {...props}/>; }

export function SettingsPage({ state, update, context, notify, navigate }: PageProps) {
  const [agency, setAgency] = useState(context.agency); const canEdit = context.staff.role === '老板';
  const [qrError,setQrError]=useState('');const [paymentError,setPaymentError]=useState('');const [logoError,setLogoError]=useState('');
  const [bannerBusy,setBannerBusy]=useState(false);const [bannerError,setBannerError]=useState('');
  const [uploading,setUploading]=useState<Record<string,boolean>>({});const [selectedFiles,setSelectedFiles]=useState<Record<string,string>>({});
  const dirty=JSON.stringify(agency)!==JSON.stringify(context.agency); const [settingsGroup,setSettingsGroup]=useState<'summary'|'profile'|'contact'|'payment'>('summary');
  useEffect(()=>{const warn=(event:BeforeUnloadEvent)=>{if(dirty){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
  const latestState=()=>{const raw=localStorage.getItem('geyou-prototype-v1');return raw?JSON.parse(raw) as AppState:state};
  const generateBanner=async(source:typeof agency)=>{
   if(!canEdit||!source.name.trim())return notify('请先填写企业名称并保存资料');
   if(bannerBusy)return;
   const sourceKey=bannerSourceKey(source);setBannerBusy(true);setBannerError('');
   try{
    const response=await fetch('/api/geyou/banner',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:source.name,introduction:source.introduction||'',region:source.region||'',logo:source.logo})});
    if(!response.ok)throw new Error(response.status===503?'本地 Codex 暂不可用，请稍后重试。':'Banner生成暂不可用，请稍后重试。');
    const payload=await response.json() as {image?:unknown;promptVersion?:string};
    if(typeof payload.image!=='string'||!payload.image.startsWith('data:image/'))throw new Error('生成结果无效，请重试。');
    const imageBlob=await(await fetch(payload.image)).blob();
    const bannerImage=await readProfileImage(new File([imageBlob],`agency-banner.${imageBlob.type.split('/')[1]||'png'}`,{type:imageBlob.type}));
    const stored=localStorage.getItem('geyou-prototype-v1');if(!stored)throw new Error('当前企业资料已无法读取，请重试。');
    const current=JSON.parse(stored) as AppState;const currentAgency=current.agencies.find(a=>a.id===source.id);
    if(!currentAgency||bannerSourceKey(currentAgency)!==sourceKey){setBannerError('企业资料已更新，请重新生成首页Banner。');return}
    const generated={...currentAgency,bannerImage,bannerPromptVersion:payload.promptVersion,bannerSourceKey:sourceKey};const next={...current,agencies:current.agencies.map(a=>a.id===source.id?generated:a)};
    persistPrototype(next);update(()=>next);setAgency(generated);notify('首页Banner已生成并更新');
   }catch(error){const message=(error as Error).message||'首页Banner生成失败，请重试。';setBannerError(message);notify(message)}finally{setBannerBusy(false)}
  };
  const uploadImage=async(e:ChangeEvent<HTMLInputElement>,key:'logo'|'qr'|'paymentQr')=>{
   const file=e.target.files?.[0];e.target.value='';if(!file||!canEdit)return;
   const setError=key==='logo'?setLogoError:key==='qr'?setQrError:setPaymentError;
   setError('');setUploading(prev=>({...prev,[key]:true}));
   try{const data=await readProfileImage(file);const current=latestState();const next={...current,agencies:current.agencies.map(a=>a.id===agency.id?{...a,[key]:data}:a)};persistPrototype(next);update(()=>next);setAgency(prev=>({...prev,[key]:data}));setSelectedFiles(prev=>({...prev,[key]:file.name}));notify('图片已保存到本机');}
   catch(error){setError((error as Error).message);}finally{setUploading(prev=>({...prev,[key]:false}));}
  };
  const save=()=>{
   if(!canEdit)return notify('只有老板可以修改企业资料');
   if(Object.values(uploading).some(Boolean))return notify('图片处理中，请稍候再保存');
   const phone=agency.phone.trim();
   if(phone&&phone.replace(/[^0-9]/g,'').length<6)return notify('请输入有效的联系电话，或暂时留空');
   const current=latestState();const next={...current,agencies:current.agencies.map(a=>a.id===agency.id?{...a,logo:agency.logo,qr:agency.qr,paymentQr:agency.paymentQr,payeeName:agency.payeeName?.trim(),name:agency.name.trim(),region:agency.region.trim(),phone,contact:agency.contact.trim(),address:agency.address?.trim(),introduction:agency.introduction?.trim()}:a)};
   try{localStorage.setItem('geyou-prototype-v1',JSON.stringify(next));}catch{return notify('浏览器存储空间不足，资料未保存。请移除不需要的图片后重试');}
   update(()=>next);const savedAgency=next.agencies.find(a=>a.id===agency.id)!;setAgency(savedAgency);setSelectedFiles({});setSettingsGroup('summary');notify(agency.name.trim()&&phone?'企业资料已保存':'企业资料草稿已保存，可稍后补充名称和电话');
   if(settingsGroup==='profile'&&savedAgency.name.trim()&&(savedAgency.logo||savedAgency.introduction||savedAgency.region)&&savedAgency.bannerSourceKey!==bannerSourceKey(savedAgency))void generateBanner(savedAgency);
  };
  const autoSaveProfileInfo=()=>{
   if(!canEdit||settingsGroup!=='profile')return;
   const name=agency.name.trim(),introduction=agency.introduction?.trim()||'';
   if(name===context.agency.name&&introduction===(context.agency.introduction||''))return;
   const current=latestState();const next={...current,agencies:current.agencies.map(a=>a.id===agency.id?{...a,name,introduction}:a)};
   try{persistPrototype(next);}catch(error){notify((error as Error).message||'企业形象保存失败，请重试');return;}
   update(()=>next);setAgency(current=>({...current,name,introduction}));
  };
  const autoSaveField=(key:'region'|'address'|'contact'|'phone'|'payeeName')=>{
   if(!canEdit)return;
   const value=agency[key]?.trim()||'';
   if(key==='phone'&&value&&value.replace(/[^0-9]/g,'').length<6){notify('请输入有效的联系电话，或暂时留空');return;}
   try{const current=latestState();const saved=current.agencies.find(a=>a.id===agency.id);
    if(!saved||value===(saved[key]||''))return;
    const next={...current,agencies:current.agencies.map(a=>a.id===agency.id?{...a,[key]:value}:a)};
    persistPrototype(next);update(()=>next);setAgency(previous=>({...previous,[key]:value}));notify('已保存到本机');
   }catch(error){notify((error as Error).message||'资料保存失败，请重试');}
  };
  const field=(label:string,key:'name'|'introduction'|'region'|'address'|'contact'|'phone'|'payeeName',area:boolean=false,placeholder='')=>{
   const autoSave=key==='name'||key==='introduction'?autoSaveProfileInfo:()=>autoSaveField(key);
   return <label className="settings-field"><span>{label}</span>{area?<textarea aria-label={label} rows={3} maxLength={500} value={agency[key]||''} placeholder={placeholder} disabled={!canEdit} onChange={e=>setAgency({...agency,[key]:e.target.value})} onBlur={autoSave}/>:<input aria-label={label} value={agency[key]||''} placeholder={placeholder} disabled={!canEdit} onChange={e=>setAgency({...agency,[key]:e.target.value})} onBlur={autoSave}/>}</label>;
  };
  const uploadBox=(key:'logo'|'qr'|'paymentQr',title:string,wide=false)=><div className="settings-upload-wrap"><label className={`settings-upload ${wide?'wide':''}`}>{agency[key]?<img src={agency[key]} alt={title}/>:<><Plus size={34}/><span>{title}</span></>}<input aria-label={title} type="file" accept="image/png,image/jpeg,image/webp" disabled={!canEdit||uploading[key]} onChange={e=>uploadImage(e,key)}/></label>{uploading[key]&&<small role="status">正在处理图片…</small>}{selectedFiles[key]&&<small role="status">图片已保存到本机</small>}{(key==='logo'?logoError:key==='qr'?qrError:paymentError)&&<p className="error-text" role="alert">{key==='logo'?logoError:key==='qr'?qrError:paymentError}</p>}</div>;

  if(settingsGroup==='summary') return <div className="ct-page enterprise-page"><PageHeader title="企业资料" onBack={()=>navigate('/more')} /><div className="enterprise-summary-hero">{agency.logo?<img src={agency.logo} alt="企业 Logo"/>:<Building2 size={54}/>}<div><h2>{agency.name||'本店'}</h2><p>{agency.introduction||'请完善企业资料'}</p></div></div><section className="settings-banner-summary"><div className="section-head"><h2>首页 Banner</h2><button className="btn btn-outline" disabled={!canEdit||bannerBusy} onClick={()=>void generateBanner(agency)}>{bannerBusy?'正在生成…':agency.bannerImage?'重新生成':'生成Banner'}</button></div>{agency.bannerImage?<img className="settings-banner-preview" src={agency.bannerImage} alt="企业首页 Banner 预览"/>:<p>{bannerBusy?'正在根据企业名称、简介和地区生成首页 Banner，通常需要一两分钟。':'保存企业形象资料后将自动生成，也可在此重新生成。'}</p>}{bannerBusy&&agency.bannerImage&&<small role="status">正在生成新Banner，当前首页图片继续展示。</small>}{bannerError&&<p className="error-text" role="alert">{bannerError}</p>}</section><div className="settings-summary-list"><button className="settings-summary-row" onClick={()=>setSettingsGroup('profile')}><span className="summary-icon"><Building2/><strong>企业形象</strong><small>{agency.name||'名称未设置'}</small></span><b>›</b></button><button className="settings-summary-row" onClick={()=>setSettingsGroup('contact')}><span className="summary-icon"><Phone/><strong>服务与联系</strong><small>{agency.region||'地区未设置'}　{agency.phone||'联系电话未设置'}</small></span><b>›</b></button><button className="settings-summary-row" onClick={()=>setSettingsGroup('payment')}><span className="summary-icon"><WalletCards/><strong>报价收款</strong><small>{agency.paymentQr?'已上传收款码':'尚未上传收款码'}</small></span><b>›</b></button></div></div>;
  return <div className={`ct-page enterprise-page settings-${settingsGroup}`}><PageHeader title={settingsGroup==='profile'?'企业形象':settingsGroup==='contact'?'服务与联系':'报价收款设置'} action={<small className="settings-state" role="status">{!canEdit?'仅查看':Object.values(uploading).some(Boolean)?'上传中':dirty?'未保存':'已保存'}</small>} onBack={()=>{if(!dirty||confirm('放弃尚未保存的修改？')){setAgency(context.agency);setSelectedFiles({});setSettingsGroup('summary')}}}/><div className="settings-editor-body">{settingsGroup==='profile'?<><section className="settings-card profile-logo"><h2>企业Logo</h2>{uploadBox('logo','上传企业Logo')}<p>建议使用清晰方形图</p></section><section className="settings-card">{field('企业名称','name')}</section><section className="settings-card intro-card">{field('企业简介','introduction',true,'介绍企业与服务特色')}<small className="settings-count">{(agency.introduction||'').length}/500</small><p>企业名称和简介离开输入框后自动保存。</p></section></>:settingsGroup==='contact'?<><section className="settings-contact-fields">{field('地区','region')}{field('服务地址','address',false, '请填写服务地址')}{field('联系人','contact',false, '请填写联系人')}{field('联系电话','phone',false, '请输入联系电话')}</section><section className="settings-qr-card"><h2>微信联系二维码</h2>{uploadBox('qr','上传联系二维码',true)}<p>上传成功后自动保存，用于向家属展示联系方式。</p></section></>:<><section className="settings-payment-fields">{field('微信收款人名称','payeeName',false, '请输入收款人名称')}</section><section className="settings-payment-qr"><h2>上传微信收款码</h2>{uploadBox('paymentQr','上传收款码')}{agency.paymentQr&&canEdit&&<button className="text-btn danger" onClick={()=>{setAgency(prev=>({...prev,paymentQr:undefined}));setPaymentError('');setSelectedFiles(prev=>({...prev,paymentQr:''}));}}>移除收款码</button>}</section><section className="settings-payment-note">1. 此收款码为静态码，不会自动填写金额<br/>　　2. 家属按线下约定的订金或尾款金额付款<br/>　　3. 实际到账由服务人员在线下核实</section></>}</div><ActionBar><button className="settings-save-button" disabled={!canEdit||Object.values(uploading).some(Boolean)} onClick={save}>保存企业资料</button></ActionBar></div>;

}
// demo notice page intentionally uses browser-local sample state
