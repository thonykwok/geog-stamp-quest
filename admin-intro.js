/**
 * Per-location intro media (image / YouTube) for admin. v2
 */
(function () {
  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"');
  }

  function getData() {
    try {
      if (typeof currentData !== 'undefined' && Array.isArray(currentData)) return currentData;
    } catch (e) {}
    return null;
  }

  function introBlockHtml(loc, i) {
    var items = (loc.introMedia || []).map(function (m, mi) {
      return (
        '<div class="flex flex-wrap gap-2 items-center bg-slate-50 rounded-lg p-2 border border-slate-100 mb-1" data-mi="' + mi + '">' +
        '<select data-intro-type class="border border-slate-200 rounded-lg px-2 py-1.5 text-sm">' +
        '<option value="image"' + (m.type === 'image' ? ' selected' : '') + '>圖片</option>' +
        '<option value="youtube"' + (m.type === 'youtube' ? ' selected' : '') + '>YouTube</option>' +
        '</select>' +
        '<input data-intro-url class="flex-1 min-w-[10rem] border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm" placeholder="圖片 URL 或 YouTube 連結" value="' + esc(m.url || '') + '">' +
        '<button type="button" class="text-red-400 text-xs px-1" onclick="window.removeIntro(' + i + ',' + mi + ')" title="刪除"><i class="fas fa-trash"></i></button>' +
        '</div>'
      );
    }).join('');

    return (
      '<div class="border-t border-amber-200 pt-3 mb-3 intro-section bg-amber-50/50 rounded-xl p-3" data-intro-for="' + i + '">' +
      '<div class="flex justify-between items-center mb-2">' +
      '<span class="text-sm font-semibold text-amber-800">🖼️ 前導媒體（答題前）</span>' +
      '<button type="button" class="text-sky-600 hover:text-sky-700 text-sm font-medium" onclick="window.addIntro(' + i + ')">' +
      '<i class="fas fa-plus mr-1"></i>新增</button>' +
      '</div>' +
      '<p class="text-xs text-slate-500 mb-2">可加 0 或多個圖片／YouTube。無則直接入街景。</p>' +
      '<div class="intro-container space-y-1">' +
      (items || '<p class="text-sm text-slate-400 py-1">尚未加入前導媒體</p>') +
      '</div></div>'
    );
  }

  function injectIntroBlocks() {
    var d = getData();
    if (!d || !d.length) return;

    document.querySelectorAll('#locations-list > div[data-index]').forEach(function (card) {
      var i = parseInt(card.getAttribute('data-index'), 10);
      if (isNaN(i) || !d[i]) return;
      if (!Array.isArray(d[i].introMedia)) d[i].introMedia = [];

      var old = card.querySelector('.intro-section');
      if (old) old.remove();

      var quizContainer = card.querySelector('.quizzes-container');
      var insertBefore = null;
      if (quizContainer && quizContainer.parentElement) {
        insertBefore = quizContainer.parentElement;
      } else {
        var borders = card.querySelectorAll('.border-t');
        if (borders.length) insertBefore = borders[borders.length - 1];
      }
      if (!insertBefore) return;

      var wrap = document.createElement('div');
      wrap.innerHTML = introBlockHtml(d[i], i);
      insertBefore.parentNode.insertBefore(wrap.firstChild, insertBefore);
    });
  }

  function harvestIntroFromDom() {
    var d = getData();
    if (!d) return;
    document.querySelectorAll('#locations-list > div[data-index]').forEach(function (card) {
      var i = parseInt(card.getAttribute('data-index'), 10);
      if (isNaN(i) || !d[i]) return;
      d[i].introMedia = [];
      card.querySelectorAll('.intro-container [data-mi]').forEach(function (block) {
        var t = block.querySelector('[data-intro-type]');
        var u = block.querySelector('[data-intro-url]');
        var url = u ? u.value.trim() : '';
        if (url) {
          d[i].introMedia.push({
            type: t ? t.value : 'image',
            url: url
          });
        }
      });
    });
  }

  window.addIntro = function (i) {
    try { if (typeof collectFromDom === 'function') collectFromDom(); } catch (e) {}
    harvestIntroFromDom();
    var d = getData();
    if (!d || !d[i]) return;
    if (!d[i].introMedia) d[i].introMedia = [];
    d[i].introMedia.push({ type: 'image', url: '' });
    injectIntroBlocks();
  };

  window.removeIntro = function (i, mi) {
    try { if (typeof collectFromDom === 'function') collectFromDom(); } catch (e) {}
    harvestIntroFromDom();
    var d = getData();
    if (!d || !d[i] || !d[i].introMedia) return;
    d[i].introMedia.splice(mi, 1);
    injectIntroBlocks();
  };

  function patchCollect() {
    if (typeof collectFromDom !== 'function') return;
    if (collectFromDom.__introPatched) return;
    var orig = collectFromDom;
    var wrapped = function () {
      orig();
      harvestIntroFromDom();
    };
    wrapped.__introPatched = true;
    collectFromDom = wrapped;
  }

  function patchRender() {
    if (typeof renderList !== 'function') return;
    if (renderList.__introPatched) return;
    var orig = renderList;
    var wrapped = function () {
      orig();
      setTimeout(injectIntroBlocks, 40);
    };
    wrapped.__introPatched = true;
    renderList = wrapped;
  }

  function patchSave() {
    var btn = document.getElementById('btn-save-all');
    if (!btn || btn.__introPatched) return;
    btn.__introPatched = true;
    btn.onclick = async function () {
      try { if (typeof collectFromDom === 'function') collectFromDom(); } catch (err) {}
      harvestIntroFromDom();
      var d = getData();
      if (!d) return;
      var status = document.getElementById('status');
      if (status) status.textContent = '儲存中...';
      try {
        var db = firebase.firestore();
        var old = await db.collection('locations').get();
        var batch = db.batch();
        old.docs.forEach(function (doc) { batch.delete(doc.ref); });
        d.forEach(function (loc, i) {
          batch.set(db.collection('locations').doc('loc' + i), {
            order: i,
            name: loc.name,
            sub: loc.sub || '',
            desc: loc.desc,
            lat: loc.lat,
            lng: loc.lng,
            heading: loc.heading,
            pitch: loc.pitch,
            zoom: loc.zoom != null ? loc.zoom : 1,
            stampEmoji: loc.stampEmoji,
            stampName: loc.stampName,
            introMedia: loc.introMedia || [],
            quizzes: loc.quizzes || []
          });
        });
        await batch.commit();
        if (status) status.innerHTML = '<span class="text-emerald-600">✅ 已儲存 ' + d.length + ' 個景點（含前導媒體）</span>';
        if (typeof loadData === 'function') await loadData();
        setTimeout(injectIntroBlocks, 500);
      } catch (err) {
        if (status) status.textContent = '儲存失敗：' + err.message;
      }
    };
  }

  function tryInit() {
    patchCollect();
    patchRender();
    patchSave();
    injectIntroBlocks();
  }

  var tries = 0;
  function loop() {
    tries++;
    tryInit();
    var d = getData();
    var cards = document.querySelectorAll('#locations-list > div[data-index]').length;
    var hasIntro = document.querySelectorAll('.intro-section').length;
    if (cards > 0 && hasIntro > 0) {
      console.log('[admin-intro v2] ready, cards=', cards);
      return;
    }
    if (tries < 80) setTimeout(loop, 250);
    else console.warn('[admin-intro v2] timeout, cards=', cards);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(loop, 300); });
  } else {
    setTimeout(loop, 300);
  }

  setTimeout(function () {
    var list = document.getElementById('locations-list');
    if (list) {
      new MutationObserver(function () {
        setTimeout(injectIntroBlocks, 80);
      }).observe(list, { childList: true, subtree: true });
    }
  }, 500);
})();
