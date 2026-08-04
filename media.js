/* media helpers for geog-stamp-quest v2 */
(function () {
  function youtubeId(url) {
    if (!url) return null;
    var m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtube-nocookie\.com\/embed\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  function mediaHtml(type, url) {
    if (!url) return '';
    if (type === 'youtube') {
      var id = youtubeId(url);
      if (!id) return '<p class="text-slate-400 text-sm p-4">無效的 YouTube 連結</p>';
      return '<iframe src="https://www.youtube.com/embed/' + id + '?rel=0&modestbranding=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
    }
    if (type === 'image') {
      var safe = String(url).replace(/&/g, '&').replace(/"/g, '"').replace(/</g, '<');
      return '<img src="' + safe + '" alt="前導圖片" style="width:100%;height:100%;object-fit:contain;background:#000" onerror="this.parentNode.innerHTML=\'<p class=\'text-red-300 text-sm p-4\'>圖片載入失敗，請檢查網址或網站是否禁止外連</p>\'" />';
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

  var introList = [];
  var introIndex = 0;
  var introPendingLocation = 0;
  var introMediaReady = false;

  window.__media = { youtubeId: youtubeId, mediaHtml: mediaHtml, fillMediaContainer: fillMediaContainer };

  window.openIntro = function (locIndex, media) {
    introPendingLocation = locIndex;
    introList = media || [];
    introIndex = 0;
    var modal = document.getElementById('intro-modal');
    if (!modal) {
      if (typeof loadLocation === 'function') loadLocation(locIndex);
      return;
    }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    renderIntroSlide();
  };

  function closeIntro() {
    var stage = document.getElementById('media-stage');
    if (stage) stage.innerHTML = '';
    var modal = document.getElementById('intro-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  function renderIntroSlide() {
    var item = introList[introIndex];
    var stage = document.getElementById('media-stage');
    var counter = document.getElementById('intro-counter');
    if (counter) counter.textContent = (introIndex + 1) + ' / ' + introList.length;
    if (stage && item) stage.innerHTML = mediaHtml(item.type, item.url);
    var prev = document.getElementById('btn-intro-prev');
    var next = document.getElementById('btn-intro-next');
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
    var loc = locations[i];
    var media = (loc.introMedia || []).filter(function (m) { return m && m.url && String(m.url).trim(); });
    console.log('[media] goToLocation', i, 'intro count', media.length, media);
    if (media.length > 0) openIntro(i, media);
    else if (typeof loadLocation === 'function') loadLocation(i);
  };

  document.addEventListener('DOMContentLoaded', function () {
    var p = document.getElementById('btn-intro-prev');
    var n = document.getElementById('btn-intro-next');
    var e = document.getElementById('btn-intro-enter');
    if (p) p.addEventListener('click', window.introPrev);
    if (n) n.addEventListener('click', window.introNext);
    if (e) e.addEventListener('click', window.introEnter);
  });

  function tryPatch() {
    if (typeof applySettings !== 'function' || typeof startGame !== 'function') {
      setTimeout(tryPatch, 100);
      return;
    }

    var origApply = applySettings;
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
      function go() { goToLocation(0); }
      if (introMediaReady) setTimeout(go, 50);
      else {
        var w = 0;
        var t = setInterval(function () {
          w++;
          if (introMediaReady || w > 30) {
            clearInterval(t);
            go();
          }
        }, 100);
      }
    };

    window.prevLocation = function () {
      if (typeof current !== 'undefined' && current > 0) goToLocation(current - 1);
    };
    window.nextLocation = function () {
      if (typeof current !== 'undefined' && typeof locations !== 'undefined' && current < locations.length - 1)
        goToLocation(current + 1);
    };

    if (typeof showEnding === 'function') {
      var origEnding = showEnding;
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
        var list = document.getElementById('map-list');
        if (!list || typeof locations === 'undefined') return;
        list.innerHTML = locations.map(function (loc, i) {
          return '<button onclick="goToLocation(' + i + '); document.getElementById(\'map-modal\').classList.add(\'hidden\'); document.getElementById(\'map-modal\').classList.remove(\'flex\');" class="w-full text-left px-3 py-2 rounded-lg ' +
            (i === current ? 'bg-amber-600' : 'bg-slate-700 hover:bg-slate-600') +
            ' flex justify-between items-center"><span>' + (i + 1) + '. ' + loc.name + '</span>' +
            (collected[i] ? '<i class="fas fa-check text-emerald-400"></i>' : '') + '</button>';
        }).join('');
        var modal = document.getElementById('map-modal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
      };
    }

    console.log('[media] patches applied');
  }
  tryPatch();

  (async function reloadIntroMedia() {
    function wait() {
      return new Promise(function (resolve) {
        function check() {
          if (typeof firebase !== 'undefined' && typeof locations !== 'undefined' && locations.length) resolve();
          else setTimeout(check, 150);
        }
        check();
      });
    }
    await wait();
    try {
      var db = firebase.firestore();
      var snap = await db.collection('locations').orderBy('order').get();
      if (!snap.empty) {
        var docs = snap.docs;
        for (var i = 0; i < docs.length && i < locations.length; i++) {
          var data = docs[i].data();
          var list = Array.isArray(data.introMedia) ? data.introMedia : [];
          locations[i].introMedia = list.filter(function (m) {
            return m && m.url && String(m.url).trim() && (m.type === 'image' || m.type === 'youtube' || !m.type);
          }).map(function (m) {
            return { type: m.type || 'image', url: String(m.url).trim() };
          });
          if (locations[i].introMedia.length) {
            console.log('[media] loc', i, locations[i].name, 'introMedia', locations[i].introMedia.length);
          }
        }
      }
      var settingsDoc = await db.collection('config').doc('settings').get();
      if (settingsDoc.exists && typeof settings !== 'undefined') {
        var s = settingsDoc.data();
        settings.landingMediaType = s.landingMediaType || 'none';
        settings.landingMediaUrl = s.landingMediaUrl || '';
        settings.endingMediaType = s.endingMediaType || 'none';
        settings.endingMediaUrl = s.endingMediaUrl || '';
        fillMediaContainer(
          document.getElementById('landing-media-wrap'),
          settings.landingMediaType,
          settings.landingMediaUrl
        );
      }
    } catch (e) {
      console.warn('[media] intro reload failed', e);
    }
    introMediaReady = true;
    console.log('[media] introMedia ready');
  })();
})();
