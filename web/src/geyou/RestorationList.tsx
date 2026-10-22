import {AgentEmptyState} from './AgentEmptyState';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, ImageIcon, Search, CalendarDays, CheckCircle2, Clock3, CircleAlert } from 'lucide-react';
import type { Customer, PageProps } from './types';
import {failPortraitRepair, failUnlinkedPortraitRepair, finishPortraitRepair, finishUnlinkedPortraitRepair, visibleUnlinkedPortraits} from './memorialModel';
import { PageHeader } from './MobileUI';
import { imageResult, pendingPortraitPosts, pollPortraitJob, updatePersistedState } from './portraitJobs';
import './restoration-refresh.css';

type Filter = '全部' | '处理中' | '已完成' | '失败';
const filters: Filter[] = ['全部', '处理中', '已完成', '失败'];

function dateText(value: string) {
  return new Date(value).toLocaleString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function RestorationList({ customers, ...props }: PageProps & { customers: Customer[] }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('全部');
  const latest=useRef(props);latest.current={...props};
  const rows = useMemo(() => customers.flatMap(customer => (customer.deceased || []).flatMap(deceased =>
    deceased.portraits.map(record => ({ customer, deceased, record }))))
    .sort((a, b) => Date.parse(b.record.createdAt) - Date.parse(a.record.createdAt)), [customers]);
  const visible = rows.filter(({ customer, deceased, record }) => {
    const matchesText = !query.trim() || `${deceased.name}${customer.name}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesText && (filter === '全部' || record.status === filter);
  });
  const unlinked=[...visibleUnlinkedPortraits(props.state,props.context.staff)].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
  const visibleUnlinked=unlinked.filter(record=>(filter==='全部'||record.status===filter)&&(!query.trim()||'未关联照片'.includes(query.trim())));
  const pollingJobs=[...visible.filter(row=>row.record.status==='处理中').map(row=>({kind:'linked' as const,customerId:row.customer.id,deceasedId:row.deceased.id,recordId:row.record.id,jobId:row.record.jobId})),...visibleUnlinked.filter(record=>record.status==='处理中').map(record=>({kind:'unlinked' as const,recordId:record.id,jobId:record.jobId}))];
  const pollingKey=pollingJobs.map(job=>`${job.kind}:${job.recordId}:${job.jobId||''}`).join('|');
  useEffect(()=>{const controllers:AbortController[]=[];for(const job of pollingJobs){if(!job.jobId){if(pendingPortraitPosts.has(job.recordId))continue;if(job.kind==='unlinked')void updatePersistedState(latest,current=>failUnlinkedPortraitRepair(current,latest.current.context.staff,job.recordId,'旧任务缺少任务编号，请重试')).catch(()=>{});else void updatePersistedState(latest,current=>failPortraitRepair(current,latest.current.context.staff,job.customerId,job.deceasedId,job.recordId,'旧任务缺少任务编号，请重试')).catch(()=>{});continue;}const controller=new AbortController();controllers.push(controller);void pollPortraitJob(job.jobId,controller.signal).then(async result=>{const image=await imageResult(result.image,controller.signal);if(controller.signal.aborted)return;await updatePersistedState(latest,current=>job.kind==='unlinked'?(()=>{const record=current.unlinkedPortraits?.find(item=>item.id===job.recordId);return record?.status==='处理中'&&record.jobId===job.jobId?finishUnlinkedPortraitRepair(current,latest.current.context.staff,job.recordId,image,result.promptVersion):current;})():(()=>{const record=current.customers.find(c=>c.id===job.customerId)?.deceased?.find(d=>d.id===job.deceasedId)?.portraits.find(item=>item.id===job.recordId);return record?.status==='处理中'&&record.jobId===job.jobId?finishPortraitRepair(current,latest.current.context.staff,job.customerId,job.deceasedId,job.recordId,image,result.promptVersion):current;})());}).catch(error=>{if(controller.signal.aborted)return;void updatePersistedState(latest,current=>job.kind==='unlinked'?(()=>{const record=current.unlinkedPortraits?.find(item=>item.id===job.recordId);return record?.status==='处理中'&&record.jobId===job.jobId?failUnlinkedPortraitRepair(current,latest.current.context.staff,job.recordId,error instanceof Error?error.message:'照片修复失败'):current;})():(()=>{const record=current.customers.find(c=>c.id===job.customerId)?.deceased?.find(d=>d.id===job.deceasedId)?.portraits.find(item=>item.id===job.recordId);return record?.status==='处理中'&&record.jobId===job.jobId?failPortraitRepair(current,latest.current.context.staff,job.customerId,job.deceasedId,job.recordId,error instanceof Error?error.message:'照片修复失败'):current;})()).catch(()=>{});});}return()=>controllers.forEach(controller=>controller.abort());},[pollingKey]);
  const cards = [
    ...visible.map(({customer,deceased,record})=>({record,name:deceased.name,family:customer.name,url:`/restoration?customer=${encodeURIComponent(customer.id)}&deceased=${encodeURIComponent(deceased.id)}&portrait=${encodeURIComponent(record.id)}${record.confirmedAt?'':'&workflow=1'}`})),
    ...visibleUnlinked.map(record=>({record,name:'未关联照片',family:'尚未关联',url:`/restoration?unlinked=${record.id}`})),
  ].sort((a,b)=>Date.parse(b.record.createdAt)-Date.parse(a.record.createdAt));
  return <section className="memorial-panel restoration-list-page">
    <PageHeader title={props.serviceLabel||'照片修复'} subtitle="用专业与温度，留住珍贵的模样" action={<button className="btn btn-primary" onClick={() => props.navigate('/restoration?new=1')}><Plus size={22}/>{props.serviceLabel?'新建':'制作'}</button>} />
    <div className="restoration-list-banner"><h2>保留真实容貌，珍藏温暖记忆</h2><p>让思念，依然清晰可见</p></div>
    <label className="restoration-list-search"><Search size={21}/><input aria-label="搜索客户或任务名称" placeholder="搜索客户或任务名称" value={query} onChange={event => setQuery(event.target.value)}/></label>
    <div className="restoration-list-filters" aria-label="记录状态筛选">{filters.map(option => <button key={option} className={filter === option ? 'active' : ''} aria-pressed={filter === option} onClick={() => setFilter(option)}>{option}</button>)}</div>
    {cards.length ? <div className="restoration-list">{cards.map(({record,name,family,url})=>{
      const complete=record.status==='已完成';const running=record.status==='处理中';const failed=record.status==='失败';
      const status=complete?'已完成':running?'处理中':failed?'失败':record.confirmedAt?'已确认':'待修复';
      const StatusIcon=complete?CheckCircle2:running?Clock3:CircleAlert;
      return <a className="restoration-list-row restoration-list-card-link" key={record.id} href={`#${props.routeBase?url.replace('/restoration',props.routeBase):url}`} aria-label={`查看${name}${complete?'修复结果':'照片任务'}`}>
        <span className="waterfall-preview-link"><img className="restoration-list-thumb" src={complete&&record.result?record.result:record.original} alt={`${name}${complete?'修复结果':'原图'}`}/></span>
        <div className="restoration-list-copy"><div className="restoration-list-heading"><strong><span className="waterfall-title-link">{name}</span></strong><span className={`restoration-status restoration-status-inline ${complete?'complete':running?'processing':failed?'failed':'waiting'}`}><StatusIcon size={16}/>{status}</span></div><span>关联客户：{family}</span><time><CalendarDays size={15}/>创建时间：{dateText(record.createdAt).split(' ')[0]}</time></div>
        <span className={`restoration-status ${complete?'complete':running?'processing':failed?'failed':'waiting'}`}><StatusIcon size={18}/>{status}</span>
        {running&&<p className="restoration-list-note">正在生成肖像，完成后自动更新。</p>}

      </a>;
    })}</div>:props.serviceLabel?<AgentEmptyState icon={<ImageIcon/>} title={query.trim()||filter!=='全部'?'没有符合条件的记录':'还没有照片记录'} description={query.trim()||filter!=='全部'?'试试其他关键词，或查看全部记录':'上传的原照和制作结果会展示在这里'} actionLabel={query.trim()||filter!=='全部'?'查看全部记录':undefined} onAction={()=>{setQuery('');setFilter('全部')}}/>:<div className="restoration-list-empty"><Plus size={24}/><strong>{rows.length||unlinked.length?'没有符合条件的记录':'还没有照片记录'}</strong></div>}
  </section>;
}
