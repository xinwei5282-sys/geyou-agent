export type FuneralPlanShareStep = { title: string; detail: string };
export type FuneralPlanSharePayload = {
  title: string;
  steps: FuneralPlanShareStep[];
  pending: string[];
  familyPrepared: string[];
  agencyPrepared: string[];
  agencyName: string;
  servicePhone: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const cleanText = (value: unknown, max: number, allowEmpty = false): value is string =>
  typeof value === 'string' && value.length <= max && (allowEmpty || !!value.trim()) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);
const boundedStringList = (value: unknown, maxCount: number, maxLength: number): value is string[] =>
  Array.isArray(value) && value.length <= maxCount && value.every(item => cleanText(item, maxLength));

export function validateFuneralPlanShare(value: unknown): FuneralPlanSharePayload | null {
  if (!isRecord(value) || Object.keys(value).some(key => !['title', 'steps', 'pending', 'familyPrepared', 'agencyPrepared', 'agencyName', 'servicePhone'].includes(key))) return null;
  if (!cleanText(value.title, 100) || !Array.isArray(value.steps) || value.steps.length > 30 ||
      !boundedStringList(value.pending, 50, 300) || !boundedStringList(value.familyPrepared, 50, 300) ||
      !boundedStringList(value.agencyPrepared, 100, 200) || !cleanText(value.agencyName, 100) ||
      !cleanText(value.servicePhone, 30, true)) return null;
  const steps: FuneralPlanShareStep[] = [];
  for (const raw of value.steps) {
    if (!isRecord(raw) || Object.keys(raw).some(key => !['title', 'detail'].includes(key)) || !cleanText(raw.title, 100) || !cleanText(raw.detail, 1000)) return null;
    steps.push({ title: raw.title, detail: raw.detail });
  }
  const result: FuneralPlanSharePayload = {
    title: value.title,
    steps,
    pending: [...value.pending],
    familyPrepared: [...value.familyPrepared],
    agencyPrepared: [...value.agencyPrepared],
    agencyName: value.agencyName,
    servicePhone: value.servicePhone,
  };
  if (JSON.stringify(result).length > 64 * 1024) return null;
  return result;
}

const publicSteps: Record<string, FuneralPlanShareStep> = {
  scene: { title: '当前情况与手续核实', detail: '按当前场景核实办理流程和所需材料；具体要求以相关办理机构说明为准。' },
  clothes: { title: '衣物准备', detail: '按家属已说明的准备情况或已确认项目核对衣物与交接。' },
  venue: { title: '告别地点与场地安排', detail: '根据家属意愿确认告别地点及场地安排；未确认前不视为已安排。' },
  notice: { title: '讣告与亲友通知', detail: '如家属需要发布讣告，先核对内容，经家属确认后再发布。' },
  farewell: { title: '告别与仪式安排', detail: '仪式、布置和主持安排由家属确认后再衔接，不作预设。' },
  cremation: { title: '火化与骨灰交接', detail: '预约、办理材料及骨灰交接按殡仪馆实际流程核实。' },
  'later-rites': { title: '后续项目单独确认', detail: '后续项目的日期和内容按家属意愿另行核对，不自动加入本次安排。' },
};
const publicPending = new Set([
  '确认服务地址', '确认家属与联系人', '核对预订项目清单', '记录已付定金及支付方式',
  '确认治丧或告别时间', '确认家属的信仰与仪式意愿', '确认告别地点及场地安排',
]);
const publicFamilyPrep = new Set([
  '寿衣或衣物已由家属准备，按实际使用核对',
  '仅在家中设灵堂时核对门板、方凳、靠背椅、供桌、供品及家属自备衣物与洗漱用品；以家属选择和当地实际为准',
]);

/** Builds a customer-safe projection; free-form private notes and reservation facts never cross this boundary. */
export function buildPublicFuneralPlan(
  plan: { title?: string; steps?: { id?: string }[]; pending?: string[]; familyPrepared?: string[]; agencyPrepared?: string[] },
  agency: { name?: string; phone?: string },
): FuneralPlanSharePayload {
  const steps = (plan.steps || []).flatMap(step => step.id && publicSteps[step.id] ? [{ ...publicSteps[step.id] }] : []);
  const pending = [...new Set((plan.pending || []).filter(item => publicPending.has(item)))];
  const familyPrepared = [...new Set((plan.familyPrepared || []).filter(item => publicFamilyPrep.has(item)))];
  const agencyPrepared = [...new Set((plan.agencyPrepared || []).flatMap(item => {
    const prefix = '按已确认报价准备或衔接：';
    if (!item.startsWith(prefix)) return [];
    const name = item.slice(prefix.length).trim();
    return name && name.length <= 200 ? [name] : [];
  }))];
  const candidate = validateFuneralPlanShare({
    title: '本次丧事流程', steps, pending, familyPrepared, agencyPrepared,
    agencyName: cleanText(agency.name, 100) ? agency.name : '服务机构',
    servicePhone: cleanText(agency.phone, 30, true) ? agency.phone : '',
  });
  if (!candidate) throw new Error('流程分享内容超出安全范围');
  return candidate;
}
