/**
 * Adds per-location intro media (image / YouTube) to admin UI.
 */
(function () {
  function waitReady(cb) {
    if (typeof renderList === 'function' && typeof collectFromDom === 'function' && typeof currentData !== 'undefined') {
      cb();
    } else {
      setTimeout(function () { waitReady(cb); }, 150);
    }
  }

  function esc(str) {
    return String(str || '').replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"');
  }

  waitReady(function () {
    const dataRef = function () { return currentData || []; };

    window.addIntro = function (i) {
      if (typeof collectFromDom === 'function') collectFromDom();
      const d = dataRef();
      if (!d[i]) return;
      if (!d[i].introMedia) d[i].introMedia = [];
      d[i].introMedia.push({ type: 'image', url: '' });
      if (typeof renderList === 'function') renderList();
      setTimeout(injectIntroBlocks, 50);
    };
    window.removeIntro = function (i, mi) {
      if (typeof collectFromDom === 'function') collectFromDom();
      const d = dataRef();
      if (!d[i] || !d[i].introMedia) return;
      d[i].introMedia.splice(mi, 1);
      if (typeof renderList === 'function') renderList();
      setTimeout(injectIntroBlocks, 50);
    };

    function introBlockHtml(loc, i) {
      const items = (loc.introMedia || []).map(function (m, mi) {
        return '<div class="flex flex-wrap gap-2 items-center bg-slate-50 rounded-lg p-2 border border-slate-100" data-mi="' + mi + '">' +
          '<select data-intro-type class="border border-slate-200 rounded-lg px-2 py-1.5 text-sm">' +
          '<option value="image"' + (m.type === 'image' ? ' selected' : '') + '>圖片</option>' +
          '<option value="youtube"' + (m.type === 'youtube' ? ' selected' : '') + '>YouTube</option>' +
          '</select>' +
          '<input data-intro-url class="flex-1 min-w-[12rem] border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm" placeholder="圖片 URL 或 YouTube 連結" value="' + esc(m.url || '') + '">' +
          '<button type="button" class="text-red-400 text-xs" onclick="removeIntro(' + i + ',' + mi + ')"><i class="fas fa-trash"></i></button>' +
          '</div>';
      }).join('');
      return '<div class="border-t border-slate-100 pt-3 mb-3 intro-section" data-intro-for="' + i + '">' +
        '<div class="flex justify-between items-center mb-2">' +
        '<span class="text-sm font-medium text-slate-600">前導媒體（答題前，可 0 或多個）</span>' +
        '<button type="button" class="text-sky-500 hover:text-sky-600 text-sm font-medium" onclick="addIntro(' + i + ')"><i class="fas fa-plus mr-1"></i>新增</button>' +
        '</div>' +
        '<p class="text-xs text-slate-400 mb-2">圖片填網址；影片填 YouTube 連結。無媒體則直接入街景。</p>' +
        '<div class="intro-container space-y-2">' +
        (items || '<p class="text-sm text-slate-300 py-1">無前導媒體</p>') +
        '</div></div>';
    }

    function injectIntroBlocks() {
      const d = dataRef();
      document.querySelectorAll('#locations-list > div[data-index]').forEach(function (card) {
        const i = parseInt(card.getAttribute('data-index'), 10);
        if (isNaN(i) || !d[i]) return;
        const old = card.querySelector('.intro-section');
        if (old) old.remove();
        const quizBorder = card.querySelector('.border-t.border-slate-100.pt-3');
        if (!quizBorder) return;
        const wrap = document.createElement('div');
        wrap.innerHTML = introBlockHtml(d[i], i);
        const section = wrap.firstChild;
        quizBorder.parentNode.insertBefore(section, quizBorder);
      });
    }

    if (typeof collectFromDom === 'function') {
      const origCollect = collectFromDom;
      collectFromDom = function () {
        origCollect();
        const d = dataRef();
        document.querySelectorAll('#locations-list > div[data-index]').forEach(function (card) {
          const i = parseInt(card.getAttribute('data-index'), 10);
          if (isNaN(i) || !d[i]) return;
          d[i].introMedia = [];
          card.querySelectorAll('.intro-container > div[data-mi]').forEach(function (block) {
            const t = block.querySelector('[data-intro-type]');
            const u = block.querySelector('[data-intro-url]');
            const url = u ? u.value.trim() : '';
            if (url) {
              d[i].introMedia.push({ type: t ? t.value : 'image', url: url });
            }
          });
        });
      };
    }

    const btnSave = document.getElementById('btn-save-all');
    if (btnSave) {
      btnSave.onclick = async function () {
        if (typeof collectFromDom === 'function') collectFromDom();
        const d = dataRef();
        const status = document.getElementById('status');
        if (status) status.textContent = '儲存中...';
        try {
          const db = firebase.firestore();
          const old = await db.collection('locations').get();
          const batch = db.batch();
          old.docs.forEach(function (doc) { batch.delete(doc.ref); });
          d.forEach(function (loc, i) {
            batch.set(db.collection('locations').doc('loc' + i), {
              order: i,
              name: loc.name,
              sub: loc.sub || '',
              desc: loc.desc,
              lat: loc.lat, lng: loc.lng,
              heading: loc.heading, pitch: loc.pitch,
              zoom: loc.zoom ?? 1,
              stampEmoji: loc.stampEmoji, stampName: loc.stampName,
              introMedia: loc.introMedia || [],
              quizzes: loc.quizzes || []
            });
          });
          await batch.commit();
          if (status) status.innerHTML = '<span class="text-emerald-600">✅ 已儲存 ' + d.length + ' 個景點（含前導媒體）</span>';
          if (typeof loadData === 'function') loadData();
          setTimeout(injectIntroBlocks, 400);
        } catch (e) {
          if (status) status.textContent = '儲存失敗：' + e.message;
        }
      };
    }

    if (typeof renderList === 'function') {
      const origRender = renderList;
      renderList = function () {
        origRender();
        setTimeout(injectIntroBlocks, 30);
      };
    }

    setTimeout(injectIntroBlocks, 800);
    setTimeout(injectIntroBlocks, 2000);

    const list = document.getElementById('locations-list');
    if (list) {
      new MutationObserver(function () {
        setTimeout(injectIntroBlocks, 50);
      }).observe(list, { childList: true });
    }

    console.log('[admin-intro] ready');
  });
})();
