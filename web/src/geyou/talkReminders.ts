import type { AppState, Consultation, ServiceTask, Staff } from './types';
import { canAccessSalesRecord, consultationLabel, hasStaffModule, now } from './model';

export type TalkReminderEntry = { session: Consultation; task: ServiceTask; label: string };

export function talkReminderEntries(state: AppState, staff: Staff): TalkReminderEntry[] {
  if (!hasStaffModule(state, staff, 'talk')) return [];
  return (state.consultations || []).filter(session => canAccessSalesRecord(state, staff, session)).flatMap(session => {
    const task = session.guided?.plan?.followupTask;
    return task && !session.customerId ? [{ session, task, label: consultationLabel(state, session) }] : [];
  });
}

export function setTalkReminderStatus(state: AppState, staff: Staff, sessionId: string, status: '已完成' | '已取消'): AppState {
  const session = (state.consultations || []).find(item => item.id === sessionId);
  if (!session || !canAccessSalesRecord(state, staff, session)) throw Error('无权访问此谈单待办');
  const task = session.guided?.plan?.followupTask;
  if (!task) throw Error('未找到谈单待办');
  if (task.status === '已完成' || task.status === '已取消') return state;
  const stamp = now();
  const updated: ServiceTask = { ...task, status, updatedAt: stamp, ...(status === '已完成' ? { completedAt: stamp } : {}) };
  return { ...state, consultations: (state.consultations || []).map(item => item.id === sessionId
    ? { ...item, guided: item.guided && { ...item.guided, plan: item.guided.plan && { ...item.guided.plan, followupTask: updated } } } : item) };
}
