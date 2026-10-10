// w2: наноблогер, бар от живых цифр ютуба (или демо без ключа)
const KEY = 'w2-subs';   // демо-счетчик
const CFG = 'w2-yt';     // {channel, key}, только в localStorage
const GOALS = [100, 500, 1000];

function nextGoal(subs) {
  // ближайшая невзятая ступень
  for (const g of GOALS) if (subs < g) return g;
  return GOALS[GOALS.length - 1];
}

function pct(subs) {
  // процент до текущей цели
  const g = nextGoal(subs);
  return Math.min(100, Math.round(subs / g * 100));
}

function doneCount(subs) {
  // сколько ачивок уже взято
  return GOALS.filter(g => subs >= g).length;
}

function fmt(n) {
  // 1234567 -> 1.2M, 1500 -> 1.5K
  n = +n || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

function parseChannel(s) {
  // вход: @handle | ID | ссылка — иначе null
  s = (s || '').trim();
  let m = s.match(/youtube\.com\/@([\w.-]+)/i);
  if (m) return { kind: 'handle', v: m[1] };
  m = s.match(/youtube\.com\/channel\/(UC[\w-]{20,})/);
  if (m) return { kind: 'id', v: m[1] };
  if (/^UC[\w-]{20,}/.test(s)) return { kind: 'id', v: s };
  if (/^@?[\w.-]{2,}$/.test(s)) return { kind: 'handle', v: s.replace(/^@/, '') };
  return null;
}

async function yt(path, key) {
  const r = await fetch('https://www.googleapis.com/youtube/v3/' + path +
    (path.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(key));
  if (!r.ok) throw new Error('http ' + r.status + ': проверь ключ');
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || 'api error');
  return j;
}

async function pullStats(channel, key) {
  // канал -> статистика + свежее видео, ~3 юнита квоты
  const p = parseChannel(channel);
  if (!p) throw new Error('не понял канал: нужен @handle, ID или ссылка');
  const q = p.kind === 'id' ? 'id=' + p.v : 'forHandle=' + encodeURIComponent(p.v);
  const ch = await yt(`channels?part=statistics,snippet,contentDetails&${q}`, key);
  if (!ch.pageInfo.totalResults) throw new Error('канал не найден');
  const c = ch.items[0], st = c.statistics;
  const out = {
    title: c.snippet.title,
    subs: st.hiddenSubscriberCount ? null : +st.subscriberCount,
    views: +st.viewCount, videos: +st.videoCount,
  };
  const pl = c.contentDetails.relatedPlaylists.uploads;
  const li = await yt(`playlistItems?part=contentDetails&maxResults=1&playlistId=${pl}`, key);
  if (li.items.length) {
    const vid = li.items[0].contentDetails.videoId;
    const v = await yt(`videos?part=statistics,snippet&id=${vid}`, key);
    if (v.items.length) out.latest = {
      title: v.items[0].snippet.title,
      views: +v.items[0].statistics.viewCount,
      likes: +(v.items[0].statistics.likeCount || 0), id: vid,
    };
  }
  return out;
}

function smiley(kind) {
  // кастомные морды: y — взята, n — закрыта
  if (kind === 'y') return `<svg class="face" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#238636"/><circle cx="9" cy="10" r="1.6" fill="#fff"/><circle cx="15" cy="10" r="1.6" fill="#fff"/><path d="M8 14 Q12 17.5 16 14" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`;
  return `<svg class="face" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#21262d" stroke="#30363d"/><path d="M8 10 h3 M13 10 h3" stroke="#8b949e" stroke-width="1.8" stroke-linecap="round"/><path d="M9 15 Q12 13.5 15 15" stroke="#8b949e" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`;
}

function lizard() {
  // ящерка догоняет курсор на канвасе
  const cv = document.getElementById('liz');
  if (!cv || !cv.getContext || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = cv.getContext('2d');
  const fit = () => { cv.width = innerWidth; cv.height = innerHeight; };
  fit();
  addEventListener('resize', fit);
  let mx = innerWidth * .7, my = innerHeight * .28;
  addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; });
  const segs = Array.from({ length: 10 }, () => ({ x: mx, y: my }));
  (function frame() {
    // голова к курсору, хвост цепочкой
    let tx = mx, ty = my;
    ctx.clearRect(0, 0, cv.width, cv.height);
    segs.forEach((s, i) => {
      const k = i === 0 ? .16 : .32;
      s.x += (tx - s.x) * k;
      s.y += (ty - s.y) * k;
      ctx.beginPath();
      ctx.arc(s.x, s.y, Math.max(9 - i * .7, 2.5), 0, 7);
      ctx.fillStyle = i === 0 ? '#7ee787' : '#238636';
      ctx.fill();
      tx = s.x; ty = s.y;
    });
    // глаза смотрят на курсор
    const h = segs[0], a = Math.atan2(my - h.y, mx - h.x);
    const ex = Math.cos(a + 1.57) * 5, ey = Math.sin(a + 1.57) * 5;
    const px = Math.cos(a) * 1.6, py = Math.sin(a) * 1.6;
    [[h.x + ex, h.y + ey], [h.x - ex, h.y - ey]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.arc(x, y, 3.4, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.beginPath(); ctx.arc(x + px, y + py, 1.6, 0, 7); ctx.fillStyle = '#0d1117'; ctx.fill();
    });
    requestAnimationFrame(frame);
  })();
}

function tilt() {
  // 3д-наклон карточек за мышью
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  addEventListener('pointermove', e => {
    const rx = (e.clientY / innerHeight - .5) * -7, ry = (e.clientX / innerWidth - .5) * 7;
    document.querySelectorAll('.card').forEach(c => {
      c.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    });
  });
}
function loadCfg() {
  try { return JSON.parse(typeof localStorage === 'undefined' ? null : localStorage.getItem(CFG)) || {}; }
  catch (e) { return {}; }
}

function loadSubs() {
  try {
    const v = parseInt(typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY), 10);
    return Number.isFinite(v) && v >= 0 ? v : 742;
  } catch (e) { return 742; }
}

if (typeof document !== 'undefined') {
  let demo = loadSubs();   // ручной счетчик
  let live = null;         // живые цифры с api
  const $ = id => document.getElementById(id);

  function subsNow() {
    return live && live.subs !== null ? live.subs : demo;
  }

  function render() {
    const s = subsNow(), g = nextGoal(s), maxed = s >= GOALS[GOALS.length - 1];
    $('mode').textContent = live ? 'режим: live с ютуба' : 'режим: демо (вставь ключ ниже)';
    $('subs').textContent = fmt(s);
    $('goal').textContent = maxed ? 'максимум!' : '/ ' + fmt(g);
    $('fill').style.width = pct(s) + '%';
    $('pct').textContent = pct(s) + '%';
    const medals = doneCount(s);
    $('medal').textContent = maxed ? 'все ачивки взяты!' :
      (medals ? `ачивок: ${medals}, следующая — ${fmt(g)}` : `до первой ачивки: ${fmt(g - s)}`);
    $('goals').innerHTML = GOALS.map(x =>
      `<div class="g"><span>${fmt(x)} подписчиков</span><span>${s >= x ? smiley('y') + ' взята' : smiley('n')}</span></div>`).join('');
    // карточки статистики
    const st = $('stats');
    if (live) st.innerHTML = `
      <div class="stat"><b>${fmt(live.views)}</b><span>просмотры</span></div>
      <div class="stat"><b>${fmt(live.videos)}</b><span>видео</span></div>
      <div class="stat"><b>${live.latest ? fmt(live.latest.likes) : '—'}</b><span>лайки на свежем</span></div>`;
    else st.innerHTML = '';
    $('latest').innerHTML = live && live.latest ?
      `<b>${esc(live.latest.title)}</b><span>просмотры ${fmt(live.latest.views)} · лайки ${fmt(live.latest.likes)}</span>` : '';
    $('ctitle').textContent = live ? live.title : 'наноблогер';
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  async function refresh(showErr) {
    // подтянуть цифры, тихо для автообновления
    const cfg = loadCfg();
    if (!cfg.channel || !cfg.key) return;
    try {
      live = await pullStats(cfg.channel, cfg.key);
      $('err').textContent = live.subs === null ? 'подписчики скрыты автором, бар от демо-счетчика' : '';
      render();
    } catch (e) { if (showErr) $('err').textContent = e.message; }
  }

  document.addEventListener('DOMContentLoaded', () => {
    lizard();
    tilt();
    const cfg = loadCfg();
    $('channel').value = cfg.channel || '';
    $('apikey').value = cfg.key || '';
    render();
    refresh(false);
    setInterval(() => refresh(false), 60000);  // опрос раз в минуту

    $('plus').addEventListener('click', () => {
      // ручной режим: +1 к демо
      live = null; demo++;
      try { localStorage.setItem(KEY, String(demo)); } catch (e) {}
      render();
    });
    $('reset').addEventListener('click', () => {
      live = null; demo = 0;
      try { localStorage.setItem(KEY, '0'); } catch (e) {}
      render();
    });
    $('save').addEventListener('click', async () => {
      const cfg = { channel: $('channel').value.trim(), key: $('apikey').value.trim() };
      try { localStorage.setItem(CFG, JSON.stringify(cfg)); } catch (e) {}
      $('err').textContent = '';
      await refresh(true);
    });
  });
}
