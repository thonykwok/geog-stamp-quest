/* media helpers for geog-stamp-quest */
(function () {
  function youtubeId(url) {
    if (!url) return null;
    const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtube-nocookie\.com\/embed\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }
  function mediaHtml(type, url) {
    if (!url) return '';
    if (type === 'youtube') {
      const id = youtubeId(url);
      if (!id) return '<p class="text-slate-400 text-sm p-4">無效的 YouTube 連結</p>';
      return '<iframe src="https://www.youtube.com/embed/' + id + '?rel=0&modestbranding=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
    }
    if (type === 'image') {
      return '<img src="' + String(url).replace(/"/g, '"') + '" alt="media" />';
    }
    return '';
  }
  function fillMediaContainer(el, type, url) {
    if (!el) return;
    if (!type || type === 'none' || !url) {
      el.classList.add('hidden');
      el.innerHTML = '';
      return;
    }
    el.innerHTML = mediaHtml(type, url);
    el.classList.remove('hidden');
  }

  let introList = [];
  let introIndex = 0;
  let introPendingLocation = 0;

  window.__media = { youtubeId: youtubeId, mediaHtml: mediaHtml, fillMediaContainer: fillMediaContainer };

  window.openIntro = function (locIndex, media) {
    introPendingLocation = locIndex;
    introList = media;
    introIndex = 0;
    const modal = document.getElementById('intro-modal');
    if (!modal) {
      if (typeof loadLocation === 'function') loadLocation(locIndex);
      return;
    }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    renderIntroSlide();
  };
  function closeIntro() {
    const stage = document.getElementById('media-stage');
    if (stage) stage.innerHTML = '';
    const modal = document.getElementById('intro-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }
  function renderIntroSlide() {
    const item = introList[introIndex];
    const stage = document.getElementById('media-stage');
    const counter = document.getElementById('intro-counter');
    if (counter) counter.textContent = (introIndex + 1) + ' / ' + introList.length;
    if (stage && item) stage.innerHTML = mediaHtml(item.type, item.url);
    const prev = document.getElementById('btn-intro-prev');
    const next = document.getElementById('btn-intro-next');
    if (prev) prev.disabled = introIndex <= 0;
    if (next) next.disabled = introIndex >= introList.length - 1;
  }
  window.introPrev = function () {
    if (introIndex > 0) { introIndex--; renderIntroSlide(); }
  };
  window.introNext = function () {
    if (introIndex < introList.length - 1) { introIndex++; renderIntroSlide(); }
  };
  window.introEnter = function () {
    closeIntro();
    if (typeof loadLocation === 'function') loadLocation(introPendingLocation);
  };

  window.goToLocation = function (i) {
    if (typeof locations === 'undefined' || i < 0 || i >= locations.length) return;
    const loc = locations[i];
    const media = (loc.introMedia || []).filter(function (m) { return m && m.url; });
    if (media.length > 0) openIntro(i, media);
    else if (typeof loadLocation === 'function') loadLocation(i);
  };

  document.addEventListener('DOMContentLoaded', function () {
    const p = document.getElementById('btn-intro-prev');
    const n = document.getElementById('btn-intro-next');
    const e = document.getElementById('btn-intro-enter');
    if (p) p.addEventListener('click', window.introPrev);
    if (n) n.addEventListener('click', window.introNext);
    if (e) e.addEventListener('click', window.introEnter);
  });

  function tryPatch() {
    if (typeof applySettings !== 'function' || typeof startGame !== 'function') {
      setTimeout(tryPatch, 100);
      return;
    }
    const origApply = applySettings;
    applySettings = function () {
      origApply();
      if (typeof settings !== 'undefined') {
        fillMediaContainer(
          document.getElementById('landing-media-wrap'),
          settings.landingMediaType,
          settings.landingMediaUrl
        );
      }
    };
    startGame = function () {
      document.getElementById('landing').classList.add('hidden');
      document.getElementById('game').classList.remove('hidden');
      if (typeof ensureCollectedArray === 'function') ensureCollectedArray();
      if (typeof rebuildProgressDots === 'function') rebuildProgressDots();
      if (typeof rebuildPostcard === 'function') rebuildPostcard();
      if (typeof updateStamps === 'function') updateStamps();
      setTimeout(function () { goToLocation(0); }, 100);
    };
    window.prevLocation = function () {
      if (typeof current !== 'undefined' && current > 0) goToLocation(current - 1);
    };
    window.nextLocation = function () {
      if (typeof current !== 'undefined' && typeof locations !== 'undefined' && current < locations.length - 1)
        goToLocation(current + 1);
    };
    if (typeof showEnding === 'function') {
      const origEnding = showEnding;
      window.showEnding = function () {
        if (typeof settings !== 'undefined') {
          fillMediaContainer(
            document.getElementById('ending-media-wrap'),
            settings.endingMediaType,
            settings.endingMediaUrl
          );
        }
        origEnding();
      };
    }
    if (typeof showMap === 'function') {
      window.showMap = function () {
        const list = document.getElementById('map-list');
        if (!list || typeof locations === 'undefined') return;
        list.innerHTML = locations.map(function (loc, i) {
          return '<button onclick="goToLocation(' + i + '); document.getElementById(\'map-modal\').classList.add(\'hidden\'); document.getElementById(\'map-modal\').classList.remove(\'flex\');" class="w-full text-left px-3 py-2 rounded-lg ' +
            (i === current ? 'bg-amber-600' : 'bg-slate-700 hover:bg-slate-600') +
            ' flex justify-between items-center"><span>' + (i + 1) + '. ' + loc.name + '</span>' +
            (collected[i] ? '<i class="fas fa-check text-emerald-400"></i>' : '') + '</button>';
        }).join('');
        const modal = document.getElementById('map-modal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
      };
    }
    console.log('[media] patches applied');
  }
  tryPatch();
})();

(async function reloadIntroMedia() {
  function wait() {
    return new Promise(function (resolve) {
      function check() {
        if (typeof firebase !== 'undefined' && typeof locations !== 'undefined') resolve();
        else setTimeout(check, 200);
      }
      check();
    });
  }
  await wait();
  try {
    const db = firebase.firestore();
    const snap = await db.collection('locations').orderBy('order').get();
    if (!snap.empty && typeof locations !== 'undefined') {
      const docs = snap.docs;
      for (let i = 0; i < docs.length && i < locations.length; i++) {
        const data = docs[i].data();
        locations[i].introMedia = Array.isArray(data.introMedia) ? data.introMedia.filter(function (m) {
          return m && m.url && (m.type === 'image' || m.type === 'youtube');
        }) : [];
      }
    }
    const settingsDoc = await db.collection('config').doc('settings').get();
    if (settingsDoc.exists && typeof settings !== 'undefined') {
      const s = settingsDoc.data();
      settings.landingMediaType = s.landingMediaType || 'none';
      settings.landingMediaUrl = s.landingMediaUrl || '';
      settings.endingMediaType = s.endingMediaType || 'none';
      settings.endingMediaUrl = s.endingMediaUrl || '';
      if (window.__media) {
        window.__media.fillMediaContainer(
          document.getElementById('landing-media-wrap'),
          settings.landingMediaType,
          settings.landingMediaUrl
        );
      }
    }
  } catch (e) {
    console.warn('intro media reload failed', e);
  }
})();
