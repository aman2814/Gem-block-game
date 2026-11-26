(function (global) {
  'use strict';

  // Centralized AdMob configuration: switch USE_TEST_ADS to false for Play Store release.
  const AD_CONFIG = {
    USE_TEST_ADS: true,
    APP_ID: 'ca-app-pub-2930271930886740~2608291854',
    NATIVE_INLINE_AD_UNIT_ID: 'ca-app-pub-2930271930886740/4409613632',
    TEST_NATIVE_ID: 'ca-app-pub-3940256099942544/2247696110',
    BANNER_AD_UNIT_ID: 'YOUR_BANNER_AD_UNIT_ID',
    TEST_BANNER_ID: 'ca-app-pub-3940256099942544/6300978111',
    REWARDED_AD_UNIT_ID: 'YOUR_REWARDED_AD_UNIT_ID',
    TEST_REWARDED_ID: 'ca-app-pub-3940256099942544/5224354917',
  };

  function resolveActiveIds(cfg) {
    const useTest = Boolean(cfg.USE_TEST_ADS);
    return {
      useTestAds: useTest,
      appId: cfg.APP_ID,
      nativeUnitId: useTest ? cfg.TEST_NATIVE_ID : cfg.NATIVE_INLINE_AD_UNIT_ID,
      bannerUnitId: useTest ? cfg.TEST_BANNER_ID : cfg.BANNER_AD_UNIT_ID,
      rewardedUnitId: useTest ? cfg.TEST_REWARDED_ID : cfg.REWARDED_AD_UNIT_ID,
    };
  }

  let activeConfig = AD_CONFIG;
  let activeIds = resolveActiveIds(AD_CONFIG);
  let bannerDesired = false;
  let nativeBannerLoaded = false;
  let activeRewardCallbacks = null;
  let simRewardTimer = null;

  function hasNativeBridge() {
    return typeof global.AndroidAds === 'object' && global.AndroidAds !== null;
  }

  function isCalmScreenActive() {
    if (typeof global.__isAdCalmScreen === 'function') {
      return Boolean(global.__isAdCalmScreen());
    }
    return true;
  }

  function syncDomBannerVisibility() {
    const slot = document.getElementById('ad-banner-slot');
    const shell = document.getElementById('game-shell');
    if (!slot) return;

    // When native Android AdView is active, keep the WebView placeholder collapsed
    // so there are never duplicate banners or an empty unloaded box.
    let showDomBanner = false;
    if (hasNativeBridge()) {
      showDomBanner = false;
    } else {
      showDomBanner = bannerDesired && activeIds.useTestAds;
    }

    slot.classList.toggle('ad-hidden', !showDomBanner);
    if (shell) {
      const reserveBottom = showDomBanner || (hasNativeBridge() && bannerDesired && nativeBannerLoaded);
      shell.classList.toggle('no-banner', !reserveBottom);
    }
    if (typeof global.__onAdLayoutChanged === 'function') {
      global.__onAdLayoutChanged();
    }
  }

  function sanitizeIconUrl(rawUrl) {
    if (typeof rawUrl !== 'string' || !rawUrl) return '';
    try {
      const parsed = new URL(rawUrl, global.location.href);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'data:') {
        return parsed.href;
      }
    } catch (_) {}
    return '';
  }

  function parseNativePayload(raw) {
    if (!raw) return null;
    try {
      const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!obj || typeof obj !== 'object') return null;
      const headline = typeof obj.headline === 'string' ? obj.headline.trim() : '';
      if (!headline) return null;
      return {
        headline,
        body: typeof obj.body === 'string' ? obj.body.trim() : '',
        callToAction: typeof obj.callToAction === 'string' && obj.callToAction.trim()
          ? obj.callToAction.trim()
          : 'Learn More',
        iconUrl: sanitizeIconUrl(obj.iconUrl),
        advertiser: typeof obj.advertiser === 'string' ? obj.advertiser.trim() : '',
      };
    } catch (_) {
      return null;
    }
  }

  function renderNativeCard(container, adData, containerId) {
    container.textContent = '';

    const card = document.createElement('div');
    card.className = 'native-ad-card';

    const topRow = document.createElement('div');
    topRow.className = 'native-ad-row';

    if (adData.iconUrl) {
      const iconImg = document.createElement('img');
      iconImg.className = 'native-ad-icon';
      iconImg.src = adData.iconUrl;
      iconImg.alt = adData.advertiser || 'Sponsored icon';
      iconImg.loading = 'lazy';
      topRow.appendChild(iconImg);
    } else {
      const iconFallback = document.createElement('div');
      iconFallback.className = 'native-ad-icon-fallback';
      iconFallback.setAttribute('aria-hidden', 'true');
      iconFallback.textContent = 'AD';
      topRow.appendChild(iconFallback);
    }

    const meta = document.createElement('div');
    meta.className = 'native-ad-meta';

    const headlineRow = document.createElement('div');
    headlineRow.className = 'native-ad-headline-row';

    const adBadge = document.createElement('span');
    adBadge.className = 'native-ad-badge';
    adBadge.textContent = 'Ad';
    headlineRow.appendChild(adBadge);

    const headlineEl = document.createElement('span');
    headlineEl.className = 'native-ad-headline';
    headlineEl.textContent = adData.headline;
    headlineRow.appendChild(headlineEl);

    meta.appendChild(headlineRow);

    const subText = adData.body || adData.advertiser;
    if (subText) {
      const bodyEl = document.createElement('div');
      bodyEl.className = 'native-ad-body';
      bodyEl.textContent = subText;
      meta.appendChild(bodyEl);
    }

    topRow.appendChild(meta);

    const ctaBtn = document.createElement('button');
    ctaBtn.type = 'button';
    ctaBtn.className = 'native-ad-cta';
    ctaBtn.textContent = adData.callToAction;
    ctaBtn.addEventListener('click', () => {
      if (hasNativeBridge() && typeof global.AndroidAds.onNativeAdClicked === 'function') {
        try {
          global.AndroidAds.onNativeAdClicked(containerId);
        } catch (_) {}
      }
    });
    topRow.appendChild(ctaBtn);

    card.appendChild(topRow);
    container.appendChild(card);
    container.classList.remove('hidden');
  }

  function runBrowserSimulatedRewarded(onRewardEarned, onAdClosed) {
    const overlay = document.getElementById('rewarded-ad-overlay');
    const countdownText = document.getElementById('ad-countdown-text');
    const ringNum = document.getElementById('ad-ring-num');
    const ringProgress = document.getElementById('ad-ring-progress');
    const progressBar = document.getElementById('ad-progress-bar');

    if (!overlay) {
      if (typeof onRewardEarned === 'function') onRewardEarned();
      if (typeof onAdClosed === 'function') onAdClosed();
      return;
    }

    if (simRewardTimer) {
      clearInterval(simRewardTimer);
      simRewardTimer = null;
    }

    const durationSec = 5;
    let remaining = durationSec;
    const circumference = 264;

    const updateVisuals = (secLeft) => {
      const clamped = Math.max(0, secLeft);
      if (countdownText) countdownText.textContent = `${clamped}s`;
      if (ringNum) ringNum.textContent = String(clamped);
      const elapsedRatio = (durationSec - clamped) / durationSec;
      if (ringProgress) ringProgress.style.strokeDashoffset = String(circumference * elapsedRatio);
      if (progressBar) progressBar.style.width = `${Math.round(elapsedRatio * 100)}%`;
    };

    updateVisuals(remaining);
    overlay.classList.remove('hidden');

    simRewardTimer = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        updateVisuals(remaining);
      } else {
        clearInterval(simRewardTimer);
        simRewardTimer = null;
        updateVisuals(0);
        setTimeout(() => {
          overlay.classList.add('hidden');
          if (typeof onRewardEarned === 'function') onRewardEarned();
          if (typeof onAdClosed === 'function') onAdClosed();
        }, 220);
      }
    }, 1000);
  }

  const AdManager = {
    init(config) {
      activeConfig = config || AD_CONFIG;
      activeIds = resolveActiveIds(activeConfig);

      if (hasNativeBridge() && typeof global.AndroidAds.initAds === 'function') {
        try {
          global.AndroidAds.initAds(
            JSON.stringify({
              useTestAds: activeIds.useTestAds,
              appId: activeIds.appId,
              bannerAdUnitId: activeIds.bannerUnitId,
              nativeInlineAdUnitId: activeIds.nativeUnitId,
              rewardedAdUnitId: activeIds.rewardedUnitId,
            })
          );
        } catch (_) {}
      }

      syncDomBannerVisibility();
    },

    showBanner() {
      bannerDesired = true;
      if (hasNativeBridge() && typeof global.AndroidAds.showBanner === 'function') {
        try {
          global.AndroidAds.showBanner();
        } catch (_) {}
      }
      syncDomBannerVisibility();
    },

    hideBanner() {
      bannerDesired = false;
      if (hasNativeBridge() && typeof global.AndroidAds.hideBanner === 'function') {
        try {
          global.AndroidAds.hideBanner();
        } catch (_) {}
      }
      syncDomBannerVisibility();
    },

    mountNativeInline(containerId) {
      const container = document.getElementById(containerId);
      if (!container) return;

      // Never render or refresh native inline ads during active gameplay/dragging.
      if (!isCalmScreenActive()) {
        container.classList.add('hidden');
        container.textContent = '';
        return;
      }

      if (!hasNativeBridge() || typeof global.AndroidAds.loadNativeAd !== 'function') {
        container.classList.add('hidden');
        container.textContent = '';
        return;
      }

      try {
        const raw = global.AndroidAds.loadNativeAd(activeIds.nativeUnitId, containerId);
        const adData = parseNativePayload(raw);
        if (adData && isCalmScreenActive()) {
          renderNativeCard(container, adData, containerId);
        } else {
          container.classList.add('hidden');
          container.textContent = '';
        }
      } catch (_) {
        container.classList.add('hidden');
        container.textContent = '';
      }
    },

    unmountNativeInline(containerId) {
      const container = document.getElementById(containerId);
      if (!container) return;
      container.classList.add('hidden');
      container.textContent = '';
    },

    showRewarded(onRewardEarned, onAdClosed) {
      activeRewardCallbacks = {
        earned: false,
        onRewardEarned: typeof onRewardEarned === 'function' ? onRewardEarned : null,
        onAdClosed: typeof onAdClosed === 'function' ? onAdClosed : null,
      };

      if (hasNativeBridge() && typeof global.AndroidAds.showRewardedAd === 'function') {
        try {
          const started = global.AndroidAds.showRewardedAd(activeIds.rewardedUnitId);
          if (started !== false) {
            return;
          }
        } catch (_) {}
      }

      // Browser fallback (or if native rewarded ad could not load offline)
      activeRewardCallbacks = null;
      runBrowserSimulatedRewarded(onRewardEarned, onAdClosed);
    },
  };

  // Native Android bridge callbacks
  global.__onAdMobBannerState = function (loaded, visible) {
    nativeBannerLoaded = Boolean(loaded);
    if (typeof visible === 'boolean') {
      bannerDesired = visible;
    }
    syncDomBannerVisibility();
  };

  global.__onAdMobNativeLoaded = function (containerId, rawJson) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!isCalmScreenActive()) {
      container.classList.add('hidden');
      return;
    }
    const adData = parseNativePayload(rawJson);
    if (adData) {
      renderNativeCard(container, adData, containerId);
    } else {
      container.classList.add('hidden');
    }
  };

  global.__onAdMobRewardEarned = function () {
    if (!activeRewardCallbacks || activeRewardCallbacks.earned) return;
    activeRewardCallbacks.earned = true;
    if (activeRewardCallbacks.onRewardEarned) {
      activeRewardCallbacks.onRewardEarned();
    }
  };

  global.__onAdMobRewardClosed = function () {
    if (!activeRewardCallbacks) return;
    const cb = activeRewardCallbacks.onAdClosed;
    activeRewardCallbacks = null;
    if (cb) cb();
  };

  global.AD_CONFIG = AD_CONFIG;
  global.AdManager = AdManager;
})(window);
