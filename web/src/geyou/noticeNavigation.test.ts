import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAmapSearchUrl } from './noticeNavigation';

test('creates a mobile map search link using the ceremony address and region', () => {
  const url = new URL(buildAmapSearchUrl('杭州市殡仪馆 2号门', '杭州市'));

  assert.equal(url.origin, 'https://uri.amap.com');
  assert.equal(url.pathname, '/search');
  assert.equal(url.searchParams.get('keyword'), '杭州市殡仪馆 2号门');
  assert.equal(url.searchParams.get('city'), '杭州市');
  assert.equal(url.searchParams.get('callnative'), '1');
});

test('creates a map search link without a region when none is provided', () => {
  const url = new URL(buildAmapSearchUrl('告别厅 A 区', ''));

  assert.equal(url.searchParams.get('keyword'), '告别厅 A 区');
  assert.equal(url.searchParams.has('city'), false);
});
