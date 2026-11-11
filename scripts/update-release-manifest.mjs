import { writeFile } from 'node:fs/promises';

const [outputPath] = process.argv.slice(2);
const repository = process.env.GITHUB_REPOSITORY;
const tag = process.env.GITHUB_REF_NAME;
const token = process.env.GITHUB_TOKEN;

if (!outputPath || !repository || !tag || !token) {
  throw new Error('Release manifest uchun output yo‘li, GitHub repository, tag va token kerak.');
}

const response = await fetch(`https://api.github.com/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`, {
  headers: {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28'
  }
});
if (!response.ok) throw new Error(`GitHub Release API xatosi: ${response.status}`);

const release = await response.json();
const assets = [
  { platform: 'windows', suffix: '-windows-x64.exe' },
  { platform: 'macos', suffix: '-macos-universal.dmg' },
  { platform: 'linux', suffix: '-linux-x64.AppImage' },
  { platform: 'android', suffix: '-android-universal.apk' }
].map(({ platform, suffix }) => {
  const asset = release.assets.find(item => item.name.endsWith(suffix));
  if (!asset) { console.warn(`Relizda ${platform} fayli yo‘q (${suffix}) — o‘tkazib yuborildi.`); return null; }
  return { platform, name: asset.name, url: asset.browser_download_url };
}).filter(Boolean);
if (!assets.length) throw new Error('Relizda birorta ham ilova fayli yo‘q.');

await writeFile(outputPath, `${JSON.stringify({
  version: release.tag_name,
  publishedAt: release.published_at,
  assets
}, null, 2)}\n`, 'utf8');
