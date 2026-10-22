export function buildAmapSearchUrl(location: string, region = ''): string {
  const params = new URLSearchParams({
    keyword: location.trim(),
    view: 'map',
    src: 'geyou-notice',
    callnative: '1',
  });
  if (region.trim()) params.set('city', region.trim());
  return `https://uri.amap.com/search?${params.toString()}`;
}
