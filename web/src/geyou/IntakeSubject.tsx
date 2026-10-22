import { useState } from 'react';
import type { Customer, PageProps } from './types';
import { saveDeceased } from './memorialModel';
import { persistPrototype } from './auth';

type Props = PageProps & { customer?: Customer; onReady: (customer: Customer, deceasedId: string, next: PageProps['state']) => void; compact?: boolean };

/** Phase one intake: keeps the operator inside portrait/notice work without opening CRM. */
export function IntakeSubject({ state, update, context, notify, onReady, compact, customer: existingCustomer }: Props) {
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [deceasedName, setDeceasedName] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = () => {
    if (!deceasedName.trim()) return notify('请填写逝者姓名');
    setBusy(true);
    try {
      const customer: Customer = existingCustomer || { id: `customer-${crypto.randomUUID()}`, agencyId: context.agency.id, ownerId: context.staff.id, name: nickname.trim() || `${deceasedName.trim()}家属`, phone: phone.trim(), region: context.agency.region, budget: 0, stage: '跟进中', note: '遗像与讣告服务登记', createdAt: new Date().toISOString(), followups: [] };
      const base = existingCustomer ? state : { ...state, customers: [...state.customers, customer] };
      const next = saveDeceased(base, context.staff, customer.id, { name: deceasedName.trim(), age: '', relationship: '' });
      persistPrototype(next);
      const saved = next.customers.find(c => c.id === customer.id)!;
      update(() => next);
      onReady(saved, saved.deceased!.at(-1)!.id, next);
    } catch (error) { notify(error instanceof Error ? error.message : '登记失败，请稍后重试'); } finally { setBusy(false); }
  };
  return <section className={`phase-one-intake ${compact ? 'phase-one-intake-compact' : ''}`} aria-label="登记服务对象">
    <div><strong>登记服务对象</strong></div>
    {!existingCustomer&&<><label>家属昵称（选填）<input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="例如：王先生" /></label>
    <label>联系电话（选填）<input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="可稍后补充" /></label>
    </>}<label>逝者姓名 *<input value={deceasedName} onChange={e => setDeceasedName(e.target.value)} placeholder="请输入逝者姓名" /></label>
    <button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? '登记中…' : '登记并开始'}</button>
  </section>;
}
