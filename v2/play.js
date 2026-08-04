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

  // Intro media
  let introList = [];
  let introIndex = 0;
  let introPending = 0;

  window.initPano = function () {
    mapsReady = true;
    tryStart();
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
    tryStart();
  }

  function tryStart() {
    // wait until user clicks start; just ensure maps+data
  }

  loadProgram().catch(e => {
    document.getElementById('boot-error').classList.remove('hidden');
    document.getElementById('boot-error').classList.add('flex');
    document.getElementById('boot-msg').textContent = e.message || String(e);
  });

  window.startGame = function () {
    if (!dataReady) { alert('資料仍在載入，請稍候'); return; }
    if (!mapsReady) { alert('地圖仍在載入，請稍候'); return; }
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

  window.loadLocation = function (i) {
    current = i;
    const loc = locations[i];
    document.getElementById('loc-name').textContent = loc.name;
    document.getElementById('loc-sub').textContent = loc.sub || ('第 ' + (i + 1) + ' / ' + locations.length + ' 站');
    document.getElementById('loc-desc').textContent = loc.desc || '';
    document.getElementById('btn-prev').disabled = i <= 0;
    document.getElementById('btn-next').disabled = i >= locations.length - 1;
    rebuildDots();

    const pos = { lat: loc.lat, lng: loc.lng };
    const pov = { heading: loc.heading || 0, pitch: loc.pitch || 0, zoom: loc.zoom != null ? loc.zoom : 1 };
    if (!panorama) {
      panorama = new google.maps.StreetViewPanorama(document.getElementById('pano'), {
        position: pos, pov: pov, zoom: pov.zoom, addressControl: false, showRoadLabels: false
      });
      panorama.addListener('position_changed', function () {
        if (miniMarker) miniMarker.setPosition(panorama.getPosition());
        if (miniMap) miniMap.setCenter(panorama.getPosition());
      });
    } else {
      panorama.setPosition(pos);
      panorama.setPov(pov);
    }
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
  };

  window.prevLocation = function () { if (current > 0) goToLocation(current - 1); };
  window.nextLocation = function () { if (current < locations.length - 1) goToLocation(current + 1); };

  window.startQuiz = function () {
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
              fb.innerHTML = '<span class="text-emerald-400">全部答對！印章已收集！</span>';
              setTimeout(function () {
                closeQuiz();
                if (collected.every(Boolean)) {
                  document.getElementById('ending').classList.remove('hidden');
                  document.getElementById('ending').classList.add('flex');
                }
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
