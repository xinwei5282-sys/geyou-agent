import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type AddressInfo } from 'node:http';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { geyouFlowSharePlugin } from './geyou-flow-share-plugin';

const payload = {
  title: '本次丧事流程', steps: [{ title: '核实手续', detail: '按机构要求办理。' }],
  pending: ['确认时间'], familyPrepared: [], agencyPrepared: ['寿衣'],
  agencyName: '格优服务', servicePhone: '0571-12345678',
};

async function setup(t: import('node:test').TestContext, now: () => number = () => Date.parse('2026-10-14T00:00:00Z')) {
  const storagePath = await mkdtemp(path.join(os.tmpdir(), 'geyou-flow-share-'));
  const plugin = geyouFlowSharePlugin({ storagePath, now });
  let middleware: Parameters<Parameters<NonNullable<typeof plugin.configureServer>>[0]['middlewares']['use']>[0] | undefined;
  plugin.configureServer?.({ middlewares: { use(handler: typeof middleware) { middleware = handler; } } } as never);
  assert.ok(middleware);
  const server = createServer((req, res) => middleware!(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(storagePath, { recursive: true, force: true });
  });
  return { base, storagePath };
}

test('share endpoint creates an unguessable snapshot, persists privately, expires and revokes', async t => {
  let now = Date.parse('2026-10-14T00:00:00Z');
  const { base, storagePath } = await setup(t, () => now);
  const created = await fetch(`${base}/api/geyou/flow-shares`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  assert.equal(created.status, 201);
  const credentials = await created.json() as { token: string; revokeKey: string; expiresAt: string };
  assert.match(credentials.token, /^[a-f0-9]{64}$/);
  assert.equal(Date.parse(credentials.expiresAt) - now, 7 * 24 * 60 * 60 * 1000);
  const result = await fetch(`${base}/api/geyou/flow-shares/${credentials.token}`);
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { ...payload, expiresAt: credentials.expiresAt });
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.equal(await fetch(`${base}/api/geyou/flow-shares`).then(r => r.status), 404);

  const files = await readdir(storagePath);
  assert.equal(files.length, 1);
  const filePath = path.join(storagePath, files[0]);
  const info = await stat(filePath);
  assert.equal(info.mode & 0o777, 0o600);
  const saved = await readFile(filePath, 'utf8');
  assert.doesNotMatch(saved, new RegExp(credentials.token));
  assert.doesNotMatch(saved, new RegExp(credentials.revokeKey));

  const denied = await fetch(`${base}/api/geyou/flow-shares/${credentials.token}`, { method: 'DELETE', headers: { 'X-Revoke-Key': 'wrong' } });
  assert.equal(denied.status, 403);
  const revoked = await fetch(`${base}/api/geyou/flow-shares/${credentials.token}`, { method: 'DELETE', headers: { 'X-Revoke-Key': credentials.revokeKey } });
  assert.equal(revoked.status, 204);
  assert.equal((await fetch(`${base}/api/geyou/flow-shares/${credentials.token}`)).status, 404);

  const expiring = await fetch(`${base}/api/geyou/flow-shares`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }).then(r => r.json()) as typeof credentials;
  now += 7 * 24 * 60 * 60 * 1000;
  assert.equal((await fetch(`${base}/api/geyou/flow-shares/${expiring.token}`)).status, 404);
});

test('share API rejects malformed and oversized schemas without storage', async t => {
  const { base, storagePath } = await setup(t);
  for (const body of [{ ...payload, rawState: { customer: 'private' } }, { ...payload, steps: [{ title: ' ', detail: 'bad' }] }]) {
    const response = await fetch(`${base}/api/geyou/flow-shares`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(response.status, 400);
  }
  assert.equal((await fetch(`${base}/api/geyou/flow-shares`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'x'.repeat(70_000) })).status, 413);
  assert.deepEqual(await readdir(storagePath), []);
});
