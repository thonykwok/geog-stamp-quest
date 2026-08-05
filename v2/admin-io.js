/* Export / Import – binds to existing btn-export & import-file */
(function () {
  function ready() {
    return typeof locations !== 'undefined' &&
      typeof readSettingsForm === 'function' &&
      typeof fillSettingsForm === 'function' &&
      typeof render === 'function';
  }

  function bind() {
    if (!ready()) {
      setTimeout(bind, 200);
      return;
    }

    var btnExport = document.getElementById('btn-export');
    var inputImport = document.getElementById('import-file');
    if (!btnExport || !inputImport) {
      setTimeout(bind, 200);
      return;
    }
    if (btnExport.dataset.ioBound === '1') return;
    btnExport.dataset.ioBound = '1';

    btnExport.onclick = function () {
      try {
        var payload = {
          format: 'geog-stamp-quest-v2',
          version: 1,
          exportedAt: new Date().toISOString(),
          programName: (typeof programMeta !== 'undefined' && programMeta && programMeta.name) || '',
          settings: readSettingsForm(),
          locations: (locations || []).map(function (x, idx) {
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
              order: idx,
              introMedia: Array.isArray(x.introMedia) ? x.introMedia : [],
              quizzes: Array.isArray(x.quizzes) ? x.quizzes : []
            };
          })
        };
        var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
        var a = document.createElement('a');
        var name = (payload.programName || 'program').replace(/[^\w\u4e00-\u9fff\-]+/g, '_');
        a.href = URL.createObjectURL(blob);
        a.download = name + '-export.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
          URL.revokeObjectURL(a.href);
          a.remove();
        }, 500);
        var st = document.getElementById('status');
        if (st) st.textContent = '已匯出 JSON（' + payload.locations.length + ' 景點）';
      } catch (e) {
        alert('匯出失敗：' + e.message);
      }
    };

    inputImport.onchange = function (ev) {
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
          if (!confirm('匯入會取代畫面上的設定同景點（尚未寫入資料庫）。\n共 ' + locs.length + ' 個景點。確定？')) return;

          var mapped = locs.map(function (x, idx) {
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
              order: idx,
              introMedia: Array.isArray(x.introMedia) ? x.introMedia : [],
              quizzes: Array.isArray(x.quizzes) ? x.quizzes : []
            };
          });

          locations.length = 0;
          mapped.forEach(function (item) { locations.push(item); });

          if (st) fillSettingsForm(st);
          render();
          var status = document.getElementById('status');
          if (status) status.innerHTML = '<span class="text-amber-600">已匯入 ' + mapped.length + ' 個景點，請撳「儲存全部」寫入資料庫</span>';
        } catch (e) {
          alert('匯入失敗：' + e.message);
        }
      };
      reader.readAsText(file, 'UTF-8');
    };

    console.log('[admin-io] bound to btn-export / import-file');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
