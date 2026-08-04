/* Export / Import program data for v2 admin */
(function () {
  function waitReady(cb) {
    if (typeof currentData !== 'undefined' && typeof readSettingsForm === 'function' && typeof fillSettingsForm === 'function' && typeof renderList === 'function') {
      cb();
    } else {
      setTimeout(function () { waitReady(cb); }, 150);
    }
  }

  waitReady(function () {
    var main = document.querySelector('main');
    if (!main || document.getElementById('io-panel')) return;

    var panel = document.createElement('div');
    panel.id = 'io-panel';
    panel.className = 'bg-white rounded-2xl border border-slate-200 p-5 shadow-sm mb-6';
    panel.innerHTML =
      '<h2 class="font-bold text-lg mb-1 flex items-center gap-2"><i class="fas fa-file-export text-slate-500"></i> 資料匯出／匯入</h2>' +
      '<p class="text-xs text-slate-400 mb-4">可備份整個程式（設定 + 所有景點），或匯入到另一個程式。匯入後請再撳「儲存全部」寫入資料庫。</p>' +
      '<div class="flex flex-wrap gap-3 items-center">' +
      '<button type="button" id="btn-export" class="bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium px-4 py-2 rounded-xl">' +
      '<i class="fas fa-download mr-1"></i> 匯出 JSON</button>' +
      '<label class="bg-sky-50 hover:bg-sky-100 text-sky-800 text-sm font-medium px-4 py-2 rounded-xl cursor-pointer border border-sky-200">' +
      '<i class="fas fa-upload mr-1"></i> 匯入 JSON' +
      '<input type="file" id="input-import" accept=".json,application/json" class="hidden"></label>' +
      '<span id="io-status" class="text-sm text-slate-500"></span>' +
      '</div>';

    var addBtn = document.getElementById('btn-add');
    if (addBtn && addBtn.parentElement) {
      main.insertBefore(panel, addBtn.parentElement);
    } else {
      main.appendChild(panel);
    }

    document.getElementById('btn-export').onclick = function () {
      try {
        if (typeof collectFromDom === 'function') collectFromDom();
        var dataRef = (window.currentData && window.currentData.length) ? window.currentData : currentData;
        var payload = {
          format: 'geog-stamp-quest-v2',
          version: 1,
          exportedAt: new Date().toISOString(),
          programName: (window.programMeta && window.programMeta.name) || (typeof programMeta !== 'undefined' && programMeta && programMeta.name) || '',
          settings: typeof readSettingsForm === 'function' ? readSettingsForm() : {},
          locations: dataRef || []
        };
        var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        var name = (payload.programName || 'program').replace(/[\\/:*?"<>|]/g, '_');
        a.href = URL.createObjectURL(blob);
        a.download = name + '-backup-' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
        URL.revokeObjectURL(a.href);
        document.getElementById('io-status').innerHTML = '<span class="text-emerald-600">已下載備份檔</span>';
      } catch (e) {
        document.getElementById('io-status').textContent = '匯出失敗：' + e.message;
      }
    };

    document.getElementById('input-import').onchange = function (ev) {
      var file = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);
          if (!data || (!Array.isArray(data.locations) && !Array.isArray(data))) {
            throw new Error('檔案格式不正確');
          }
          var locs = Array.isArray(data.locations) ? data.locations : data;
          var st = data.settings || null;
          if (!confirm('匯入會取代而家畫面上的設定同景點（尚未寫入資料庫）。\n共 ' + locs.length + ' 個景點。確定？')) return;

          var mapped = locs.map(function (x) {
            return {
              name: x.name || '',
              sub: x.sub || '',
              desc: x.desc || '',
              lat: x.lat,
              lng: x.lng,
              heading: x.heading || 0,
              pitch: x.pitch || 0,
              zoom: x.zoom != null ? x.zoom : 1,
              stampEmoji: x.stampEmoji || '📍',
              stampName: x.stampName || '',
              introMedia: Array.isArray(x.introMedia) ? x.introMedia : [],
              quizzes: Array.isArray(x.quizzes) ? x.quizzes : []
            };
          });

          // Replace contents of currentData array in-place so all refs stay valid
          if (typeof currentData !== 'undefined' && Array.isArray(currentData)) {
            currentData.length = 0;
            mapped.forEach(function (item) { currentData.push(item); });
            window.currentData = currentData;
          } else {
            window.currentData = mapped;
            currentData = mapped;
          }

          if (st && typeof fillSettingsForm === 'function') fillSettingsForm(st);
          if (typeof renderList === 'function') renderList();
          document.getElementById('io-status').innerHTML =
            '<span class="text-amber-600">已載入 ' + mapped.length + ' 個景點到畫面，請撳「儲存全部」寫入資料庫</span>';
          var status = document.getElementById('status');
          if (status) status.innerHTML = '<span class="text-amber-600">匯入完成，記得儲存全部</span>';
        } catch (e) {
          document.getElementById('io-status').textContent = '匯入失敗：' + e.message;
          alert('匯入失敗：' + e.message);
        }
      };
      reader.readAsText(file, 'UTF-8');
    };

    console.log('[admin-io] ready');
  });
})();
