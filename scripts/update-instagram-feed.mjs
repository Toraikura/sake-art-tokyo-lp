import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
const userId = process.env.INSTAGRAM_USER_ID;
const apiVersion = process.env.INSTAGRAM_API_VERSION || 'v25.0';
const itemLimit = Number(process.env.INSTAGRAM_ITEM_LIMIT || 3);

if (!accessToken || !userId) {
  console.log('Instagram secrets are not configured; keeping the current feed.');
  process.exit(0);
}

const root = new URL('../', import.meta.url);
const imageDir = new URL('../assets/images/instagram/', import.meta.url);
const dataFile = new URL('../assets/data/instagram-feed.json', import.meta.url);
const fields = [
  'id',
  'caption',
  'media_type',
  'media_url',
  'thumbnail_url',
  'permalink',
  'timestamp'
].join(',');
const endpoint = new URL(`https://graph.instagram.com/${apiVersion}/${userId}/media`);
endpoint.searchParams.set('fields', fields);
endpoint.searchParams.set('limit', String(Math.max(itemLimit * 3, 12)));
endpoint.searchParams.set('access_token', accessToken);

const response = await fetch(endpoint);
const payload = await response.json();

if (!response.ok || payload.error) {
  const message = payload.error?.message || `HTTP ${response.status}`;
  throw new Error(`Instagram API request failed: ${message}`);
}

const media = (payload.data || [])
  .filter((item) => item.permalink && (item.media_url || item.thumbnail_url))
  .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  .slice(0, itemLimit);

if (!media.length) {
  throw new Error('Instagram API returned no displayable media.');
}

await mkdir(imageDir, { recursive: true });
const oldFiles = await readdir(imageDir).catch(() => []);
await Promise.all(oldFiles.map((file) => rm(new URL(file, imageDir), { force: true })));

const extensionFor = (contentType, sourceUrl) => {
  if (contentType.includes('webp')) return '.webp';
  if (contentType.includes('png')) return '.png';
  if (contentType.includes('gif')) return '.gif';
  const sourceExtension = extname(new URL(sourceUrl).pathname).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(sourceExtension)
    ? sourceExtension
    : '.jpg';
};

const items = [];
for (const [index, item] of media.entries()) {
  const sourceUrl = item.media_type === 'VIDEO'
    ? item.thumbnail_url || item.media_url
    : item.media_url || item.thumbnail_url;
  const imageResponse = await fetch(sourceUrl);
  if (!imageResponse.ok) {
    throw new Error(`Instagram image download failed: HTTP ${imageResponse.status}`);
  }

  const extension = extensionFor(imageResponse.headers.get('content-type') || '', sourceUrl);
  const filename = `post-${index + 1}-${item.id}${extension}`;
  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  await writeFile(new URL(filename, imageDir), buffer);

  items.push({
    id: item.id,
    caption: (item.caption || '').replace(/\s+/g, ' ').trim().slice(0, 120),
    media_type: item.media_type,
    image: `assets/images/instagram/${filename}`,
    permalink: item.permalink,
    timestamp: item.timestamp
  });
}

const feed = {
  updated_at: new Date().toISOString(),
  account: 'chilllabotokyo',
  items
};

await mkdir(new URL('../assets/data/', import.meta.url), { recursive: true });
await writeFile(dataFile, `${JSON.stringify(feed, null, 2)}\n`);
console.log(`Updated ${items.length} Instagram posts in ${join(root.pathname, 'assets')}.`);
