const firebaseConfig = {
  apiKey: "AIzaSyBgoiufpYsPF4EsqOCqVQWbg9RWLRhCltc",
  authDomain: "cheung-chau-quest.firebaseapp.com",
  projectId: "cheung-chau-quest",
  storageBucket: "cheung-chau-quest.firebasestorage.app",
  messagingSenderId: "1093724794704",
  appId: "1:1093724794704:web:5aae4cdf6921644a9ac655"
};

const defaultSettings = {
  title: "地理明信片",
  subtitle: "Geog Stamp Quest",
  description: "第一身視角探索，完成任務，集齊明信片上的印章！",
  emoji: "🏝️"
};

const defaultLocations = [
  {
    name: "示例景點 1", sub: "第 1 站",
    desc: "請在後台修改此景點資料。",
    lat: 22.2086, lng: 114.0284, heading: 90, pitch: 0,
    stampEmoji: "📍", stampName: "景點1",
    quizzes: [{ title: "任務", q: "這是示例問題？", options: ["選項A", "選項B", "選項C", "選項D"], answer: 0 }]
  }
];

let settings = { ...defaultSettings };
let locations = defaultLocations;
let current = 0;
let collected = [];
let currentQuizIndex = 0;
let panorama = null;
let miniMap = null;
let miniMarker = null;

function initPano() { console.log("Google Maps API loaded"); }

function ensureCollectedArray() {
  while (collected.length < locations.length) collected.push(false);
  if (collected.length > locations.length) collected = collected.slice(0, locations.length);
}

function applySettings() {
  document.getElementById('page-title').textContent = settings.title + ' | ' + settings.subtitle;
  document.getElementById('landing-title').textContent = settings.title;
  document.getElementById('landing-subtitle').textContent = settings.subtitle;
  document.getElementById('landing-emoji').textContent = settings.emoji || '🏝️';
  const n = locations.length;
  document.getElementById('landing-desc').textContent =
    settings.description || `第一身視角探索，完成 ${n} 個任務，集齊明信片上的印章！`;
  document.getElementById('postcard-title').textContent = settings.title;
  document.getElementById('postcard-sub').textContent = settings.subtitle;
  document.getElementById('ending-title').textContent = `恭喜集齊 ${n} 個印！`;
}

function updateMiniMap(loc) {
  if (typeof google === 'undefined' || !google.maps) return;
  const el = document.getElementById('mini-map');
  if (!el) return;
  const pos = { lat: Number(loc.lat), lng: Number(loc.lng) };
  if (isNaN(pos.lat) || isNaN(pos.lng)) return;

  if (!miniMap) {
    miniMap = new google.maps.Map(el, {
      center: pos, zoom: 15, mapTypeId: 'roadmap',
      disableDefaultUI: true, gestureHandling: 'none', keyboardShortcuts: false,
      clickableIcons: false, draggable: false, zoomControl: false,
      mapTypeControl: false, streetViewControl: false, fullscreenControl: false
    });
    miniMarker = new google.maps.Marker({ position: pos, map: miniMap, title: loc.name });
    setTimeout(() => { google.maps.event.trigger(miniMap, 'resize'); miniMap.setCenter(pos); }, 300);
  } else {
    miniMap.setCenter(pos);
    miniMarker.setPosition(pos);
    miniMarker.setTitle(loc.name);
    google.maps.event.trigger(miniMap, 'resize');
  }
}

async function loadFromFirestore() {
  try {
    if (typeof firebase === 'undefined') return;
    const db = firebase.firestore();

    // Load settings
    const settingsDoc = await db.collection('config').doc('settings').get();
    if (settingsDoc.exists) {
      settings = { ...defaultSettings, ...settingsDoc.data() };
    }

    // Load locations
    const snap = await db.collection('locations').orderBy('order').get();
    if (!snap.empty) {
      locations = snap.docs.map(d => {
        const data = d.data();
        let quizzes = data.quizzes;
        if (!quizzes && data.quizQ) {
          quizzes = [{ title: data.quizTitle || '任務', q: data.quizQ, options: data.options || [], answer: data.answer ?? 0 }];
        }
        if (!quizzes) quizzes = [];
        return {
          name: data.name, sub: data.sub || '', desc: data.desc || '',
          lat: data.lat, lng: data.lng, heading: data.heading || 0, pitch: data.pitch || 0,
          stampEmoji: data.stampEmoji || '📍', stampName: data.stampName || '',
          quizzes
        };
      });
    }
  } catch (e) {
    console.warn("Firestore load failed:", e);
  }
  ensureCollectedArray();
  applySettings();
  rebuildProgressDots();
  rebuildPostcard();
}

function rebuildProgressDots() {
  const container = document.getElementById('progress-dots');
  if (!container) return;
  container.innerHTML = locations.map((_, i) =>
    `<div class="progress-dot w-3 h-3 rounded-full bg-slate-600 transition" data-i="${i}"></div>`
  ).join('');
}

function rebuildPostcard() {
  const grid = document.getElementById('stamp-grid');
  if (!grid) return;
  grid.innerHTML = locations.map((loc, i) => `
    <div class="stamp text-center p-2 rounded-lg bg-white/50 border-2 border-dashed border-amber-700" data-stamp="${i}">
      <div class="text-3xl mb-1 opacity-30">${loc.stampEmoji || '📍'}</div>
      <div class="text-xs text-amber-900">${loc.stampName || '景點'}</div>
    </div>`).join('');
  const remainEl = document.getElementById('remain');
  if (remainEl) remainEl.textContent = locations.length;
}

function startGame() {
  document.getElementById('landing').classList.add('hidden');
  document.getElementById('game').classList.remove('hidden');
  ensureCollectedArray();
  rebuildProgressDots();
  rebuildPostcard();
  updateStamps();
  setTimeout(() => loadLocation(0), 100);
}

function loadLocation(i) {
  if (i < 0 || i >= locations.length) return;
  current = i;
  currentQuizIndex = 0;
  const loc = locations[i];
  document.getElementById('loc-name').textContent = loc.name;
  document.getElementById('loc-sub').textContent = loc.sub || `第 ${i + 1} / ${locations.length} 站`;
  document.getElementById('loc-desc').textContent = loc.desc;

  if (typeof google !== 'undefined' && google.maps) {
    const panoEl = document.getElementById('pano');
    if (!panorama) {
      panorama = new google.maps.StreetViewPanorama(panoEl, {
        position: { lat: loc.lat, lng: loc.lng },
        pov: { heading: loc.heading, pitch: loc.pitch || 0 },
        zoom: 1, addressControl: false, linksControl: true, panControl: true,
        enableCloseButton: false, fullscreenControl: true
      });
    } else {
      panorama.setPosition({ lat: loc.lat, lng: loc.lng });
      panorama.setPov({ heading: loc.heading, pitch: loc.pitch || 0 });
    }
    updateMiniMap(loc);
  }

  document.querySelectorAll('.progress-dot').forEach((dot, idx) => {
    dot.classList.remove('active', 'done');
    if (idx < i) dot.classList.add('done');
    if (idx === i) dot.classList.add('active');
  });

  document.getElementById('btn-prev').disabled = i === 0;
  document.getElementById('btn-next').disabled = i === locations.length - 1;

  const quizBtn = document.getElementById('btn-quiz');
  if (collected[i]) {
    quizBtn.innerHTML = '<i class="fas fa-check"></i> 已完成';
    quizBtn.classList.remove('bg-amber-500', 'hover:bg-amber-400');
    quizBtn.classList.add('bg-emerald-600');
  } else {
    const qCount = (loc.quizzes || []).length;
    quizBtn.innerHTML = qCount > 1
      ? `<i class="fas fa-question-circle"></i> 開始任務 (${qCount}題)`
      : '<i class="fas fa-question-circle"></i> 開始任務';
    quizBtn.classList.add('bg-amber-500', 'hover:bg-amber-400');
    quizBtn.classList.remove('bg-emerald-600');
  }
}

function prevLocation() { if (current > 0) loadLocation(current - 1); }
function nextLocation() { if (current < locations.length - 1) loadLocation(current + 1); }

function startQuiz() {
  if (collected[current]) return;
  const quizzes = locations[current].quizzes || [];
  if (quizzes.length === 0) {
    collected[current] = true;
    updateStamps();
    loadLocation(current);
    if (collected.every(Boolean)) setTimeout(showEnding, 600);
    return;
  }
  currentQuizIndex = 0;
  showCurrentQuiz();
}

function showCurrentQuiz() {
  const quizzes = locations[current].quizzes || [];
  const q = quizzes[currentQuizIndex];
  if (!q) return;
  const total = quizzes.length;
  document.getElementById('quiz-title').textContent =
    total > 1 ? `${q.title || '任務'} (${currentQuizIndex + 1}/${total})` : (q.title || '任務');
  document.getElementById('quiz-q').textContent = q.q;
  const opts = document.getElementById('quiz-options');
  opts.innerHTML = '';
  document.getElementById('quiz-feedback').classList.add('hidden');
  (q.options || []).forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'w-full text-left bg-slate-700 hover:bg-slate-600 px-4 py-3 rounded-xl transition';
    btn.textContent = opt;
    btn.onclick = () => checkAnswer(idx);
    opts.appendChild(btn);
  });
  const modal = document.getElementById('quiz-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function checkAnswer(idx) {
  const quizzes = locations[current].quizzes || [];
  const q = quizzes[currentQuizIndex];
  const feedback = document.getElementById('quiz-feedback');
  feedback.classList.remove('hidden');
  if (idx === q.answer) {
    feedback.textContent = '✅ 答對啦！';
    feedback.className = 'mt-4 text-center font-medium text-emerald-400';
    if (currentQuizIndex < quizzes.length - 1) {
      setTimeout(() => { currentQuizIndex++; showCurrentQuiz(); }, 900);
    } else {
      feedback.textContent = '✅ 全部答對！印章已收集！';
      collected[current] = true;
      updateStamps();
      setTimeout(() => {
        closeQuiz();
        loadLocation(current);
        if (collected.every(Boolean)) setTimeout(showEnding, 600);
      }, 1200);
    }
  } else {
    feedback.textContent = '❌ 不對嗎，再試試！';
    feedback.className = 'mt-4 text-center font-medium text-red-400';
  }
}

function closeQuiz() {
  const modal = document.getElementById('quiz-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function updateStamps() {
  ensureCollectedArray();
  const count = collected.filter(Boolean).length;
  document.getElementById('stamp-count').textContent = count;
  const remainEl = document.getElementById('remain');
  if (remainEl) remainEl.textContent = locations.length - count;
  collected.forEach((done, i) => {
    const el = document.querySelector(`[data-stamp="${i}"]`);
    if (!el || !done) return;
    el.classList.add('collected');
    el.classList.remove('border-dashed');
    el.classList.add('border-solid', 'bg-amber-200');
    const icon = el.querySelector('div');
    if (icon) { icon.classList.remove('opacity-30'); icon.textContent = locations[i]?.stampEmoji || '📍'; }
  });
}

function togglePostcard() {
  const modal = document.getElementById('postcard-modal');
  if (modal.classList.contains('hidden')) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
  else { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

function showEnding() {
  document.getElementById('ending-title').textContent = `恭喜集齊 ${locations.length} 個印！`;
  document.getElementById('ending').classList.remove('hidden');
  document.getElementById('ending').classList.add('flex');
}

function showMap() {
  const list = document.getElementById('map-list');
  list.innerHTML = locations.map((loc, i) => `
    <button onclick="loadLocation(${i}); document.getElementById('map-modal').classList.add('hidden'); document.getElementById('map-modal').classList.remove('flex');"
      class="w-full text-left px-3 py-2 rounded-lg ${i === current ? 'bg-amber-600' : 'bg-slate-700 hover:bg-slate-600'} flex justify-between items-center">
      <span>${i + 1}. ${loc.name}</span>
      ${collected[i] ? '<i class="fas fa-check text-emerald-400"></i>' : ''}
    </button>`).join('');
  const modal = document.getElementById('map-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

ensureCollectedArray();
applySettings();

(function waitFirebase() {
  if (typeof firebase !== 'undefined') {
    try { firebase.initializeApp(firebaseConfig); } catch (e) {}
    loadFromFirestore();
  } else {
    setTimeout(waitFirebase, 200);
  }
})();
