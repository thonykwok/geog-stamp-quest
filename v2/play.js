/* v2 play logic – program from ?p= */
(function () {
  const params = new URLSearchParams(location.search);
  const programId = params.get('p');
  if (!programId) {
    document.getElementById('boot-error').classList.remove('hidden');
    document.getElementById('boot-error').classList.add('flex');
    document.getElementById('boot-msg').textContent = '缺少程式編號（網址需要 ?p=程式ID）';
    return;
  }

  let locations = [];
  let settings = {};
  let current = 0;
  let collected = [];
  let quizIndex = 0;
  let panorama = null;
  let miniMap = null;
  let miniMarker = null;
  let mapsReady = false;
  let dataReady = false;
  let svService = null;

  let introList = [];
  let introIndex = 0;
  let introPending = 0;

  function showSvLoading(msg, sub, opts) {
    var el = document.getElementById('sv-loading');
    var t = document.getElementById('sv-loading-text');
    var s = document.getElementById('sv-loading-sub');
    var bar = document.getElementById('sv-bar-track');
    if (t) t.textContent = msg || '載入街景中…';
    if (s) s.textContent = sub != null ? sub : '首次載入可能需要幾秒';
    if (bar) bar.style.display = (opts && opts.hideBar) ? 'none' : '';
    if (el) el.classList.add('show');
  }
  function hideSvLoading() {
    var el = document.getElementById('sv-loading');
    var bar = document.getElementById('sv-bar-track');
    if (el) el.classList.remove('show');
    if (bar) bar.style.display = '';
  }

  function updateActionButtons() {
    var quizBtn = document.getElementById('btn-quiz');
    var quizLabel = document.getElementById('btn-quiz-label');
    var nextBtn = document.getElementById('btn-next');
    var prevBtn = document.getElementById('btn-prev');
    if (!quizBtn || !nextBtn) return;

    var done = !!collected[current];
    var atEnd = current >= locations.length - 1;
    var txtQuiz = (settings && settings.txtQuiz) || '開始任務';
    var txtDone = (settings && settings.txtDone) || '已完成';

    quizBtn.classList.remove('btn-glow', 'btn-glow-amber', 'btn-done', 'btn-idle');
    if (done) {
      quizBtn.classList.add('btn-done');
      if (quizLabel) quizLabel.textContent = txtDone;
      quizBtn.disabled = true;
    } else {
      quizBtn.classList.add('btn-glow', 'btn-glow-amber');
      if (quizLabel) quizLabel.textContent = txtQuiz;
      quizBtn.disabled = false;
    }

    nextBtn.classList.remove('btn-glow', 'btn-glow-sky', 'btn-idle', 'btn-done');
    nextBtn.disabled = atEnd;
    if (!atEnd && done) {
      nextBtn.classList.add('btn-glow', 'btn-glow-sky');
    } else {
      nextBtn.classList.add('btn-idle');
    }

    if (prevBtn) prevBtn.disabled = current <= 0;
  }

  function spawnConfetti() {
    var layer = document.getElementById('confetti-layer');
    if (!layer) return;
    layer.innerHTML = '';
    var colors = ['#f59e0b', '#fbbf24', '#34d399', '#38bdf8', '#f472b6', '#a78bfa', '#ffffff'];
    for (var i = 0; i < 48; i++) {
      var p = document.createElement('div');
      p.className = 'confetti-piece';
      p.style.left = Math.random() * 100 + '%';
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = (2.2 + Math.random() * 2.5) + 's';
      p.style.animationDelay = (Math.random() * 0.8) + 's';
      p.style.width = (6 + Math.random() * 8) + 'px';
      p.style.height = (8 + Math.random() * 10) + 'px';
      p.style.opacity = '0.9';
      layer.appendChild(p);
    }
  }

  function showEnding() {
    var n = locations.length;
    var titleTpl = (settings.endingTitle || '恭喜集齊 {n} 個印！').replace('{n}', String(n));
    var desc = settings.endingDesc || '你已經完成探索！明信片已經蓋滿印章。';
    var pTitle = settings.postcardTitle || settings.landingTitle || '地理明信片';
    var replay = settings.txtReplay || '再玩一次';

    var titleEl = document.getElementById('ending-title');
    var descEl = document.getElementById('ending-desc');
    var pTitleEl = document.getElementById('ending-postcard-title');
    var replayBtn = document.getElementById('btn-replay');
    if (titleEl) titleEl.textContent = titleTpl;
    if (descEl) descEl.textContent = desc;
    if (pTitleEl) pTitleEl.textContent = pTitle;
    if (replayBtn) replayBtn.textContent = replay;

    var grid = document.getElementById('ending-stamp-grid');
    if (grid) {
      grid.innerHTML = locations.map(function (loc) {
        return '<div class="ending-stamp stamp collected text-center p-2 rounded-lg bg-amber-100">' +
          '<div class="text-2xl">' + (loc.stampEmoji || '📍') + '</div>' +
          '<div class="text-xs text-amber-900 mt-1">' + (loc.stampName || loc.name) + '</div></div>';
      }).join('');
    }

    var ending = document.getElementById('ending');
    ending.classList.remove('hidden');
    ending.classList.add('flex');

    spawnConfetti();

    var stamps = grid ? grid.querySelectorAll('.ending-stamp') : [];
    stamps.forEach(function (el, i) {
      setTimeout(function () {
        el.classList.add('show');
      }, 400 + i * 180);
    });
  }

  window.initPano = function () {
    mapsReady = true;
    try {
      svService = new google.maps.StreetViewService();
    } catch (e) {}
  };

  async function loadProgram() {
    const db = firebase.firestore();
    const prog = await db.collection('programs').doc(programId).get();
    if (!prog.exists) throw new Error('找不到此程式');
    const pdata = prog.data();
    settings = pdata.settings || {};
    document.title = settings.siteTitle || pdata.name || '地理明信片';
    if (settings.landingTitle) document.getElementById('landing-title').textContent = settings.landingTitle;
    else document.getElementById('landing-title').textContent = pdata.name || '地理明信片';
    if (settings.landingSubtitle) document.getElementById('landing-subtitle').textContent = settings.landingSubtitle;
    if (settings.landingDesc) document.getElementById('landing-desc').textContent = settings.landingDesc;
    if (settings.postcardTitle) document.getElementById('postcard-title').textContent = settings.postcardTitle;
    if (settings.landingEmoji) {
      var em = document.getElementById('landing-emoji');
      if (em) em.textContent = settings.landingEmoji;
    }

    const snap = await db.collection('programs').doc(programId).collection('locations').orderBy('order').get();
    locations = snap.docs.map(d => {
      const x = d.data();
      return {
        name: x.name || '景點',
        sub: x.sub || '',
        desc: x.desc || '',
        lat: Number(x.lat) || 22.2086,
        lng: Number(x.lng) || 114.0284,
        heading: Number(x.heading) || 0,
        pitch: Number(x.pitch) || 0,
        zoom: x.zoom != null ? Number(x.zoom) : 1,
        stampEmoji: x.stampEmoji || '📍',
        stampName: x.stampName || x.name || '印章',
        introMedia: Array.isArray(x.introMedia) ? x.introMedia.filter(m => m && m.url) : [],
        quizzes: Array.isArray(x.quizzes) ? x.quizzes : []
      };
    });
    if (!locations.length) throw new Error('此程式尚未設定任何景點，請老師先在後台新增');
    collected = locations.map(() => false);
    dataReady = true;
  }

  loadProgram().catch(e => {
    document.getElementById('boot-error').classList.remove('hidden');
    document.getElementById('boot-error').classList.add('flex');
    document.getElementById('boot-msg').textContent = e.message || String(e);
  });

  window.startGame = function () {
    if (!dataReady) { alert('資料仍在載入，請稍候'); return; }
    if (!mapsReady) { alert('地圖仍在載入，請稍候再撳'); return; }
    document.getElementById('landing').classList.add('hidden');
    document.getElementById('game').classList.remove('hidden');
    rebuildDots();
    rebuildPostcard();
    goToLocation(0);
  };

  function rebuildDots() {
    const el = document.getElementById('progress-dots');
    el.innerHTML = locations.map((_, i) =>
      '<div class="progress-dot w-2.5 h-2.5 rounded-full bg-slate-600 ' +
      (collected[i] ? 'done' : '') + (i === current ? ' active' : '') + '"></div>'
    ).join('');
  }

  function rebuildPostcard() {
    const grid = document.getElementById('stamp-grid');
    grid.innerHTML = locations.map((loc, i) =>
      '<div class="stamp text-center p-2 rounded-lg ' + (collected[i] ? 'collected bg-amber-100' : 'bg-amber-50/50 opacity-40') + '">' +
      '<div class="text-2xl">' + (loc.stampEmoji || '📍') + '</div>' +
      '<div class="text-xs text-amber-900 mt-1">' + (loc.stampName || loc.name) + '</div></div>'
    ).join('');
    const n = collected.filter(Boolean).length;
    document.getElementById('stamp-count').textContent = n;
    document.getElementById('remain').textContent = Math.max(0, locations.length - n);
  }

  window.goToLocation = function (i) {
    if (i < 0 || i >= locations.length) return;
    const loc = locations[i];
    const media = (loc.introMedia || []).filter(m => m && m.url);
    if (media.length) openIntro(i, media);
    else loadLocation(i);
  };

  function openIntro(i, media) {
    introPending = i;
    introList = media;
    introIndex = 0;
    const modal = document.getElementById('intro-modal');
    modal.classList.remove('hidden');
    renderIntro();
  }
  function renderIntro() {
    const item = introList[introIndex];
    const stage = document.getElementById('media-stage');
    document.getElementById('intro-counter').textContent = (introIndex + 1) + ' / ' + introList.length;
    if (!item) return;
    if (item.type === 'youtube') {
      const m = String(item.url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
      const id = m ? m[1] : null;
      stage.innerHTML = id
        ? '<iframe src="https://www.youtube.com/embed/' + id + '?rel=0" allowfullscreen style="width:100%;height:100%;border:0"></iframe>'
        : '<p class="text-white p-4">無效 YouTube</p>';
    } else {
      stage.innerHTML = '<img src="' + String(item.url).split('"').join('%22') + '" alt="" style="width:100%;height:100%;object-fit:contain" />';
    }
    document.getElementById('btn-intro-prev').disabled = introIndex <= 0;
    document.getElementById('btn-intro-next').disabled = introIndex >= introList.length - 1;
  }
  document.getElementById('btn-intro-prev').onclick = function () {
    if (introIndex > 0) { introIndex--; renderIntro(); }
  };
  document.getElementById('btn-intro-next').onclick = function () {
    if (introIndex < introList.length - 1) { introIndex++; renderIntro(); }
  };
  document.getElementById('btn-intro-enter').onclick = function () {
    document.getElementById('intro-modal').classList.add('hidden');
    document.getElementById('media-stage').innerHTML = '';
    loadLocation(introPending);
  };

  function ensurePano() {
    if (panorama) return;
    panorama = new google.maps.StreetViewPanorama(document.getElementById('pano'), {
      addressControl: false,
      showRoadLabels: false,
      linksControl: true,
      panControl: true,
      enableCloseButton: false
    });
    panorama.addListener('position_changed', function () {
      var p = panorama.getPosition();
      if (!p) return;
      if (miniMarker) miniMarker.setPosition(p);
      if (miniMap) miniMap.setCenter(p);
    });
    panorama.addListener('status_changed', function () {
      var st = panorama.getStatus();
      if (st === 'OK') hideSvLoading();
    });
  }

  function ensureMiniMap(pos) {
    if (!miniMap) {
      miniMap = new google.maps.Map(document.getElementById('mini-map'), {
        center: pos, zoom: 16, disableDefaultUI: true, gestureHandling: 'greedy'
      });
      window.miniMap = miniMap;
      miniMarker = new google.maps.Marker({ map: miniMap, position: pos });
    } else {
      miniMap.setCenter(pos);
      if (miniMarker) miniMarker.setPosition(pos);
    }
  }

  window.loadLocation = function (i) {
    current = i;
    const loc = locations[i];
    document.getElementById('loc-name').textContent = loc.name;
    var fmt = (settings.progressFormat || '第 {i} / {total} 站')
      .replace('{i}', String(i + 1))
      .replace('{total}', String(locations.length));
    var thematic = String(loc.sub || '').replace(/第\s*\d+\s*\/\s*\d+\s*站\s*[·•\-–—]?\s*/g, '').trim();
    document.getElementById('loc-sub').textContent = thematic ? (fmt + ' · ' + thematic) : fmt;
    document.getElementById('loc-desc').textContent = loc.desc || '';
    rebuildDots();
    updateActionButtons();

    const target = { lat: loc.lat, lng: loc.lng };
    const pov = {
      heading: loc.heading || 0,
      pitch: loc.pitch || 0,
      zoom: loc.zoom != null ? loc.zoom : 1
    };

    showSvLoading('載入街景中…', loc.name);
    ensurePano();
    ensureMiniMap(target);

    function applyPano(latLng) {
      panorama.setPosition(latLng);
      panorama.setPov({ heading: pov.heading, pitch: pov.pitch });
      if (pov.zoom != null) panorama.setZoom(pov.zoom);
      setTimeout(hideSvLoading, 2500);
    }

    if (!svService) {
      applyPano(target);
      return;
    }

    svService.getPanorama({ location: target, radius: 150 }, function (data, status) {
      if (status === 'OK' && data && data.location) {
        applyPano(data.location.latLng);
        return;
      }
      svService.getPanorama({ location: target, radius: 500 }, function (data2, status2) {
        if (status2 === 'OK' && data2 && data2.location) {
          showSvLoading('載入附近街景…', '此座標附近無精確街景，已改用最接近位置');
          applyPano(data2.location.latLng);
          return;
        }
        showSvLoading(
          '此位置暫無 Google 街景',
          '偏遠郊野／離島可能未有覆蓋。仍可答題；或於後台改用有街景的座標。',
          { hideBar: true }
        );
        setTimeout(hideSvLoading, 4000);
        try { panorama.setPosition(target); } catch (e) {}
      });
    });
  };

  window.prevLocation = function () { if (current > 0) goToLocation(current - 1); };
  window.nextLocation = function () { if (current < locations.length - 1) goToLocation(current + 1); };

  window.startQuiz = function () {
    if (collected[current]) return;
    const loc = locations[current];
    if (!loc.quizzes || !loc.quizzes.length) {
      alert('此站未設定問題');
      return;
    }
    quizIndex = 0;
    showQuizQ();
    document.getElementById('quiz-modal').classList.remove('hidden');
    document.getElementById('quiz-modal').classList.add('flex');
  };

  function showQuizQ() {
    const loc = locations[current];
    const q = loc.quizzes[quizIndex];
    document.getElementById('quiz-title').textContent = q.title || ('問題 ' + (quizIndex + 1));
    document.getElementById('quiz-q').textContent = q.q || '';
    document.getElementById('quiz-feedback').classList.add('hidden');
    const opts = document.getElementById('quiz-options');
    opts.innerHTML = (q.options || []).map(function (opt, oi) {
      return '<button type="button" class="w-full text-left px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600" data-oi="' + oi + '">' +
        '<span class="text-amber-400 mr-2">' + oi + '.</span>' + opt + '</button>';
    }).join('');
    opts.querySelectorAll('button').forEach(function (btn) {
      btn.onclick = function () {
        const oi = Number(btn.getAttribute('data-oi'));
        const ans = Number(q.answer);
        opts.querySelectorAll('button').forEach(b => { b.disabled = true; b.classList.add('opacity-60'); });
        const fb = document.getElementById('quiz-feedback');
        fb.classList.remove('hidden');
        if (oi === ans) {
          btn.classList.add('bg-emerald-600');
          fb.innerHTML = '<span class="text-emerald-400">答對了！</span>';
          setTimeout(function () {
            if (quizIndex < loc.quizzes.length - 1) {
              quizIndex++;
              showQuizQ();
            } else {
              collected[current] = true;
              rebuildPostcard();
              rebuildDots();
              updateActionButtons();
              fb.innerHTML = '<span class="text-emerald-400">全部答對！印章已收集！</span>';
              setTimeout(function () {
                closeQuiz();
                if (collected.every(Boolean)) showEnding();
              }, 900);
            }
          }, 600);
        } else {
          btn.classList.add('bg-red-700');
          fb.innerHTML = '<span class="text-red-400">唔啱，再試一次</span>';
          setTimeout(function () {
            opts.querySelectorAll('button').forEach(b => {
              b.disabled = false;
              b.classList.remove('opacity-60', 'bg-red-700');
            });
            fb.classList.add('hidden');
          }, 800);
        }
      };
    });
  }

  window.closeQuiz = function () {
    document.getElementById('quiz-modal').classList.add('hidden');
    document.getElementById('quiz-modal').classList.remove('flex');
  };

  window.togglePostcard = function () {
    const m = document.getElementById('postcard-modal');
    if (m.classList.contains('hidden')) {
      rebuildPostcard();
      m.classList.remove('hidden');
      m.classList.add('flex');
    } else {
      m.classList.add('hidden');
      m.classList.remove('flex');
    }
  };

  document.getElementById('btn-mini-toggle').onclick = function () {
    const wrap = document.getElementById('mini-map-wrap');
    const icon = document.getElementById('mini-toggle-icon');
    wrap.classList.toggle('expanded');
    icon.className = wrap.classList.contains('expanded') ? 'fas fa-compress' : 'fas fa-expand';
    setTimeout(function () {
      if (window.miniMap) google.maps.event.trigger(window.miniMap, 'resize');
    }, 280);
  };
})();
