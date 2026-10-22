import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, chmod, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { validateFuneralPlanShare, type FuneralPlanSharePayload } from './src/geyou/funeralPlanShare';

const MAX_BODY_BYTES = 64 * 1024;
const SHARE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
type ShareRecord = { payload: FuneralPlanSharePayload; expiresAt: string; tokenHash: string; revokeHash: string };
type ShareStore = Record<string, ShareRecord>;

export type GeyouFlowShareOptions = { storagePath?: string; now?: () => number };

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

function send(res: ServerResponse, status: number, body?: unknown) {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (body === undefined) { res.end(); return; }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += data.length;
    if (size > MAX_BODY_BYTES) throw new RangeError('body too large');
    chunks.push(data);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown; } catch { return null; }
}

export function geyouFlowSharePlugin(options: GeyouFlowShareOptions = {}): Plugin {
  const storagePath = options.storagePath || path.join(import.meta.dirname, '.geyou-flow-shares');
  const dataPath = path.join(storagePath, 'shares.json');
  const now = options.now || Date.now;
  let storePromise: Promise<ShareStore> | undefined;
  let writes = Promise.resolve();

  const loadStore = () => storePromise ||= (async () => {
    await mkdir(storagePath, { recursive: true, mode: 0o700 });
    await chmod(storagePath, 0o700).catch(() => undefined);
    try {
      const raw = JSON.parse(await readFile(dataPath, 'utf8')) as unknown;
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
      const result: ShareStore = {};
      for (const [key, value] of Object.entries(raw)) {
        if (!/^[a-f0-9]{64}$/.test(key) || typeof value !== 'object' || value === null) continue;
        const record = value as Partial<ShareRecord>;
        const payload = validateFuneralPlanShare(record.payload);
        if (payload && typeof record.expiresAt === 'string' && Number.isFinite(Date.parse(record.expiresAt)) &&
            typeof record.tokenHash === 'string' && /^[a-f0-9]{64}$/.test(record.tokenHash) &&
            typeof record.revokeHash === 'string' && /^[a-f0-9]{64}$/.test(record.revokeHash)) {
          result[key] = { payload, expiresAt: record.expiresAt, tokenHash: record.tokenHash, revokeHash: record.revokeHash };
        }
      }
      await chmod(dataPath, 0o600).catch(() => undefined);
      return result;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
      return {};
    }
  })();

  const persist = async (store: ShareStore) => {
    const operation = writes.then(async () => {
      await mkdir(storagePath, { recursive: true, mode: 0o700 });
      await chmod(storagePath, 0o700);
      const tempPath = path.join(storagePath, `.shares-${randomBytes(8).toString('hex')}.tmp`);
      await writeFile(tempPath, JSON.stringify(store), { mode: 0o600, flag: 'wx' });
      await chmod(tempPath, 0o600);
      await rename(tempPath, dataPath);
      await chmod(dataPath, 0o600);
    });
    writes = operation.catch(() => undefined);
    await operation;
  };

  const middleware = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    let url: URL;
    try { url = new URL(req.url || '/', 'http://localhost'); } catch { next(); return; }
    const pathname = url.pathname;
    const collection = '/api/geyou/flow-shares';
    if (pathname !== collection && !pathname.startsWith(`${collection}/`)) { next(); return; }
    if (['POST','DELETE'].includes(req.method || '') && req.headers.origin) {
      try { if (new URL(req.headers.origin).host !== req.headers.host) { send(res,403,{error:'请求来源不正确'}); return; } } catch { send(res,403,{error:'请求来源不正确'}); return; }
    }
    if (pathname === collection && req.method === 'POST') {
      try {
        const raw = await readJson(req);
        const payload = validateFuneralPlanShare(raw);
        if (!payload) { send(res, 400, { error: '分享内容格式不正确' }); return; }
        const token = randomBytes(32).toString('hex');
        const revokeKey = randomBytes(32).toString('hex');
        const expiresAt = new Date(now() + SHARE_TTL_MS).toISOString();
        const store = await loadStore();
        for (const [key, record] of Object.entries(store)) if (Date.parse(record.expiresAt) <= now()) delete store[key];
        store[digest(token)] = { payload, expiresAt, tokenHash: digest(token), revokeHash: digest(revokeKey) };
        await persist(store);
        send(res, 201, { token, expiresAt, revokeKey });
      } catch (error) {
        send(res, error instanceof RangeError ? 413 : 500, { error: error instanceof RangeError ? '请求内容过大' : '暂时无法创建分享' });
      }
      return;
    }
    const match = pathname.match(/^\/api\/geyou\/flow-shares\/([a-f0-9]{64})$/);
    if (!match) { send(res, 404, { error: '分享不存在或已失效' }); return; }
    if (req.method !== 'GET' && req.method !== 'DELETE') { res.setHeader('Allow', 'GET, DELETE'); send(res, 405, { error: '不支持此请求' }); return; }
    const token = match[1];
    const store = await loadStore();
    const record = store[digest(token)];
    if (!record || !safeEqual(record.tokenHash, digest(token)) || Date.parse(record.expiresAt) <= now()) {
      if (record) { delete store[digest(token)]; await persist(store).catch(() => undefined); }
      send(res, 404, { error: '分享不存在或已失效' }); return;
    }
    if (req.method === 'GET') { send(res, 200, { ...record.payload, expiresAt: record.expiresAt }); return; }
    let revokeKey = typeof req.headers['x-revoke-key'] === 'string' ? req.headers['x-revoke-key'] : '';
    if (!revokeKey && req.method === 'DELETE') {
      try {
        const body = await readJson(req);
        if (typeof body === 'object' && body !== null && !Array.isArray(body) &&
            Object.keys(body).length === 1 && 'revokeKey' in body && typeof (body as { revokeKey?: unknown }).revokeKey === 'string') {
          revokeKey = (body as { revokeKey: string }).revokeKey;
        }
      } catch { send(res, 413, { error: '请求内容过大' }); return; }
    }
    if (!revokeKey || !safeEqual(record.revokeHash, digest(revokeKey))) { send(res, 403, { error: '撤销密钥不正确' }); return; }
    delete store[digest(token)];
    try { await persist(store); send(res, 204); } catch { send(res, 500, { error: '暂时无法撤销分享' }); }
  };

  return {
    name: 'geyou-flow-share-local',
    configureServer(server) { server.middlewares.use((req, res, next) => { void middleware(req, res, next).catch(() => send(res,500,{error:'暂时无法处理分享'})); }); },
  };
}
