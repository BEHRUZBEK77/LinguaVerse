const status = document.getElementById('releaseStatus');
const installNote = document.getElementById('installNote');
const platformLabels = {
  windows: 'Windows uchun yuklab olish',
  macos: 'macOS uchun yuklab olish',
  linux: 'Linux uchun yuklab olish',
  android: 'Android APK yuklab olish'
};

async function loadDownloads() {
  try {
    const response = await fetch('./downloads/releases.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Release ro‘yxati yuklanmadi (${response.status})`);
    const release = await response.json();
    const assets = Array.isArray(release.assets) ? release.assets : [];
    for (const [platform, label] of Object.entries(platformLabels)) {
      const card = document.querySelector(`[data-platform="${platform}"]`);
      const button = card?.querySelector('.download');
      const asset = assets.find(item => item.platform === platform && typeof item.url === 'string');
      if (!button || !asset) continue;
      const url = new URL(asset.url);
      if (url.protocol !== 'https:' || url.hostname !== 'github.com') {
        throw new Error(`${platform} yuklab olish manzili ishonchli emas`);
      }
      button.href = url.href;
      button.removeAttribute('aria-disabled');
      button.innerHTML = `<i class="fa-solid fa-download" aria-hidden="true"></i>${label}`;
      button.setAttribute('aria-label', label);
    }

    if (release.version) {
      status.textContent = `So‘nggi versiya: ${release.version}${release.publishedAt ? ` · ${new Date(release.publishedAt).toLocaleDateString('uz-UZ')}` : ''}`;
      installNote.textContent = 'Yuklab olinadigan fayllar rasmiy relizdan olinadi.';
    } else {
      status.textContent = 'Ilovalarning birinchi relizi tayyorlanmoqda.';
    }
  } catch (error) {
    console.error('[downloads] Release ro‘yxati xatosi:', error);
    status.textContent = 'Yuklab olish ro‘yxatini hozir yuklab bo‘lmadi. Keyinroq qayta urinib ko‘ring.';
    installNote.textContent = 'Havolalar yuklanmadi; sayt va foydalanuvchi ma’lumotlari o‘zgarishsiz.';
  }
}

void loadDownloads();
