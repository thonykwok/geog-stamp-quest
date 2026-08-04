/**
 * Per-location intro media (image / YouTube) for admin. v3
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
    if (window.currentData && Array.isArray(window.currentData)) return window.currentData;
    try {
      if (typeof currentData !== 'undefined' && Array.isArray(currentData)) {
        window.currentData = currentData;
        return currentData;
      }
    } catch (e) {}
    return null;
  }

  function introBlockHtml(loc, i) {
    var items = (loc.introMedia || []).map(function (m, mi) {
      return (
        '<div class="flex flex-wrap gap-2 items-center bg-white rounded-lg p-2 border border-amber-200 mb-1" data-mi="' + mi + '">' +
        '<select data-intro-type class="border border-slate-200 rounded-lg px-2 py-1.5 text-sm">' +
        '<option value="image"' + (m.type === 'image' ? ' selected' : '') + '>圖片</option>' +
        '<option value="youtube"' + (m.type === 'youtube' ? ' selected' : '') + '>YouTube</option>' +
        '</select>' +
        '<input data-intro-url class="flex-1 min-w-[10rem] border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm" placeholder="圖片 URL 或 YouTube 連結" value="' + esc(m.url || '') + '">' +
        '<button type="button" class="text-red-500 text-sm px-2 py-1" onclick="window.removeIntro(' + i + ',' + mi + ')" title="刪除"><i class="fas fa-trash"></i></button>' +
        '</div>'
      );
    }).join('');

    return (
      '<div class="border border-amber-300 pt-3 mb-3 intro-section bg-amber-50 rounded-xl p-3" data-intro-for="' + i + '">' +
      '<div class="flex justify-between items-center mb-2">' +
      '<span class="text-sm font-semibold text-amber-900">🖼️ 前導媒體（答題前）</span>' +
      '<button type="button" class="bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg" onclick="window.addIntro(' + i + ')">' +
      '<i class="fas fa-plus mr-1"></i>新增</button>' +
      '</div>' +
      '<p class="text-xs text-slate-600 mb-2">可加 0 或多個圖片／YouTube。無則直接入街景。</p>' +
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
      if (!insertBefore || !insertBefore.parentNode) {
        var wrap2 = document.createElement('div');
        wrap2.innerHTML = introBlockHtml(d[i], i);
        card.appendChild(wrap2.firstChild);
        return;
      }

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
    console.log('[admin-intro] addIntro', i);
    harvestIntroFromDom();
    var d = getData();
    if (!d) {
      alert('資料尚未載入，請稍候再試');
      return;
    }
    if (!d[i]) {
      alert('找不到景點 #' + (i + 1));
      return;
    }
    if (!d[i].introMedia) d[i].introMedia = [];
    d[i].introMedia.push({ type: 'image', url: '' });
    injectIntroBlocks();
  };

  window.removeIntro = function (i, mi) {
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
    window.collectFromDom = collectFromDom = wrapped;
  }

  function patchRender() {
    if (typeof renderList !== 'function') return;
    if (renderList.__introPatched) return;
    var orig = renderList;
    var wrapped = function () {
      orig();
      try { window.currentData = currentData; } catch (e) {}
      setTimeout(injectIntroBlocks, 50);
    };
    wrapped.__introPatched = true;
    window.renderList = renderList = wrapped;
  }

  function patchSave() {
    var btn = document.getElementById('btn-save-all');
    if (!btn || btn.__introPatched) return;
    btn.__introPatched = true;
    btn.onclick = async function () {
      try { if (typeof collectFromDom === 'function') collectFromDom(); } catch (err) {}
      harvestIntroFromDom();
      var d = getData();
      if (!d) {
        alert('找不到景點資料');
        return;
      }
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
        console.error(err);
      }
    };
  }

  function tryInit() {
    try { if (typeof currentData !== 'undefined') window.currentData = currentData; } catch (e) {}
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
      console.log('[admin-intro v3] ready cards=', cards);
      return;
    }
    if (tries < 100) setTimeout(loop, 200);
    else console.warn('[admin-intro v3] timeout cards=', cards, 'dataLen=', d && d.length);
  }

  setTimeout(loop, 200);

  setTimeout(function () {
    var list = document.getElementById('locations-list');
    if (list) {
      new MutationObserver(function () {
        setTimeout(injectIntroBlocks, 60);
      }).observe(list, { childList: true, subtree: true });
    }
  }, 400);
})();
