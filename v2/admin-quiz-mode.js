(function () {
  var EXTRA = [
    { id: 's-txtCorrect', label: '答對', key: 'txtCorrect', def: '答對了！' },
    { id: 's-txtWrong', label: '答錯（一次過）', key: 'txtWrong', def: '答錯了' },
    { id: 's-txtWrongRetry', label: '答錯（可重試）', key: 'txtWrongRetry', def: '答錯了，再試一次', span: 2 },
    { id: 's-txtAllCorrect', label: '全對蓋印', key: 'txtAllCorrect', def: '全部答對！印章已收集！', span: 2 },
    { id: 's-txtStationPartial', label: '部分答對（{c}/{t}）', key: 'txtStationPartial', def: '本站完成（答對 {c} / {t}），未獲印章', span: 2 },
    { id: 's-txtNoQuiz', label: '無問題提示', key: 'txtNoQuiz', def: '此站未設定問題', span: 2 },
    { id: 's-txtSvLoading', label: '載入街景', key: 'txtSvLoading', def: '載入街景中…' },
    { id: 's-txtSvLoadingSub', label: '載入副說明', key: 'txtSvLoadingSub', def: '首次載入可能需要幾秒' },
    { id: 's-txtSvNearby', label: '附近街景', key: 'txtSvNearby', def: '載入附近街景…' },
    { id: 's-txtSvNearbySub', label: '附近街景說明', key: 'txtSvNearbySub', def: '此座標附近無精確街景，已改用最接近位置' },
    { id: 's-txtSvNone', label: '無街景', key: 'txtSvNone', def: '此位置暫無 Google 街景', span: 2 },
    { id: 's-txtSvNoneSub', label: '無街景說明', key: 'txtSvNoneSub', def: '偏遠郊野／離島可能未有覆蓋。仍可答題；或於後台改用有街景的座標。', span: 2 },
    { id: 's-txtIntroPrev', label: '前導：前', key: 'txtIntroPrev', def: '前' },
    { id: 's-txtIntroNext', label: '前導：後', key: 'txtIntroNext', def: '後' },
    { id: 's-txtIntroEnter', label: '前導：進入景點', key: 'txtIntroEnter', def: '進入景點', span: 2 },
    { id: 's-endingDescPartial', label: '通關說明（未全對 {c}/{n}）', key: 'endingDescPartial', def: '你已完成所有站點。全對的景點已蓋印（{c} / {n}）。', span: 2 }
  ];

  function inject() {
    var anchor = document.getElementById('s-txtReplay');
    if (!anchor) { setTimeout(inject, 200); return; }
    var grid = anchor.closest('.grid');
    if (!grid) return;

    if (!document.getElementById('s-quizMode')) {
      var qm = document.createElement('div');
      qm.className = 'sm:col-span-2 border-t pt-3 mt-1';
      qm.innerHTML = '<label class="text-xs text-slate-500 font-medium">答題模式</label>' +
        '<select id="s-quizMode" class="w-full border rounded-lg px-2.5 py-1.5 text-sm mt-1">' +
        '<option value="retry">可重試：答錯可再揀，全對先蓋印</option>' +
        '<option value="oneshot">一次過：答錯即下一題，不可重選；全對先蓋印</option></select>';
      grid.appendChild(qm);
    }

    if (!document.getElementById('s-txtCorrect')) {
      var head = document.createElement('div');
      head.className = 'sm:col-span-2 border-t pt-3 mt-1';
      head.innerHTML = '<p class="text-sm font-semibold text-slate-700">答題／街景／前導文字（前台會跟住改）</p>';
      grid.appendChild(head);
      EXTRA.forEach(function (f) {
        var div = document.createElement('div');
        if (f.span === 2) div.className = 'sm:col-span-2';
        div.innerHTML = '<label class="text-xs text-slate-500">' + f.label + '</label>' +
          '<input id="' + f.id + '" class="w-full border rounded-lg px-2.5 py-1.5 text-sm" value="">';
        grid.appendChild(div);
      });
    }

    setTimeout(fillExtra, 600);
  }

  function fillExtra() {
    var s = (window.programMeta && programMeta.settings) || {};
    EXTRA.forEach(function (f) {
      var el = document.getElementById(f.id);
      if (el) el.value = (s[f.key] != null && s[f.key] !== '') ? s[f.key] : f.def;
    });
    var qm = document.getElementById('s-quizMode');
    if (qm) qm.value = s.quizMode || 'retry';
  }

  function wrapRead() {
    if (typeof window.readSettingsForm !== 'function') { setTimeout(wrapRead, 300); return; }
    if (window.readSettingsForm._extraWrapped) return;
    var _r = window.readSettingsForm;
    window.readSettingsForm = function () {
      var o = _r();
      EXTRA.forEach(function (f) {
        var el = document.getElementById(f.id);
        o[f.key] = el ? el.value : f.def;
      });
      var qm = document.getElementById('s-quizMode');
      o.quizMode = qm ? qm.value : 'retry';
      return o;
    };
    window.readSettingsForm._extraWrapped = true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { inject(); wrapRead(); });
  else { inject(); wrapRead(); }
})();
