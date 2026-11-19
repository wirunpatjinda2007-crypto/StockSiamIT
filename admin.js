// P=สินค้า S=ผู้ใช้ F=ความเห็น tab=แท็บที่เปิดอยู่
let P = [], S = [], F = [], tab = 'short';
(async () => {
  const me = await guard('admin'); if (!me) return;
  $('#who').textContent = 'สวัสดี ' + me.name;
  await load();
  sb.channel('live').on('postgres_changes', { event: '*', schema: 'public' }, load).subscribe();
})();
async function load() {
  const [a, b, d] = await Promise.all([
    sb.from('products').select('*').order('name'),
    sb.from('profiles').select('*').order('name'),
    sb.from('feedback').select('*').order('created_at', { ascending: false })]);
  P = a.data || []; S = b.data || []; F = d.data || [];
  if (tab === 'hist') await loadHist();
  render();
}
function go(t) {
  tab = t; document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  if (t === 'hist') { H = null; RP = null; SN = null; SF = null; render(); loadHist().then(render); } else render();
}
const pct = p => isSt(p) ? ({ out: 0, low: 0.5, ok: 1 }[p.status] ?? 1) : (+p.min_qty > 0 ? +p.qty / +p.min_qty : 0);
const low = () => P.filter(p => stOf(p) !== 'ok').sort((x, y) => pct(x) - pct(y) || x.qty - y.qty);
const who = id => (S.find(x => x.id === id) || {}).name || '-';
function render() {
  const n = low().length; $('#n').hidden = !n; $('#n').textContent = n;
  const u = F.filter(x => x.status === 'todo').length; $('#fbn').hidden = !u; $('#fbn').textContent = u;
  ({ short: renderShort, prod: renderProd, hist: renderHist, fb: renderFb, users: renderUsers })[tab]();
}
const lvl = p => stOf(p);
const st = p => stOf(p);
const LV = { out: 'หมด', crit: 'เหลือน้อยมาก', low: 'ใกล้หมด', ok: 'ปกติ' };
const VIEWS = { low: 'ต้องเติม', all: 'สินค้าทั้งหมด', ok: 'ปกติ' };
// หมวดหมู่ในฟอร์มสินค้า: อยากเพิ่มหมวดใหม่ ให้เพิ่มชื่อในลิสต์นี้
const CATS = ['ขนม', 'ของกิน', 'เครื่องดื่ม', 'ของใช้', 'ของจิปาถะ'];
const NOCAT = 'ไม่ระบุหมวด';
const catOf = p => String(p.category || '').trim() || NOCAT;
const sub = p => isSt(p) ? 'สถานะ: ' + STL[p.status || 'ok'] : `เหลือ ${fmtQ(p)} · ขั้นต่ำ ${p.min_qty} ${esc(p.unit)}`;
let view = 'low', fl = '', cat = '', catList = [];
const scrollList = () => { const e = $('#lst'); if (e) e.scrollIntoView({ behavior: 'smooth' }); };
const setView = v => { view = v; fl = ''; render(); scrollList(); };
const setFl = k => { view = 'low'; fl = fl === k ? '' : k; render(); scrollList(); };
const setCat = i => { const k = catList[i]; cat = cat === k ? '' : k; render(); scrollList(); };
const clearFilter = () => { view = 'low'; fl = ''; cat = ''; render(); };
const IC = {
  box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/></svg>',
  ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 16.5h.01"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>'
};
function donut(c, total) {
  const R = 54, C = 2 * Math.PI * R; let off = 0;
  const on = k => k === 'ok' ? view === 'ok' : view === 'low' && fl === k;
  const arcs = ['out', 'crit', 'low', 'ok'].filter(k => c[k]).map(k => {
    const len = c[k] / total * C, gap = c[k] < total ? 2 : 0;
    const el = `<circle class="dn k-${k} ${on(k) ? 'on' : ''}" cx="70" cy="70" r="${R}" stroke-dasharray="${Math.max(0, len - gap)} ${C}" stroke-dashoffset="${-off}" onclick="${k === 'ok' ? "setView('ok')" : "setFl('" + k + "')"}"/>`;
    off += len; return el;
  }).join('');
  const f = (fl && view === 'low') || view === 'ok';
  return `<svg class="donut ${f ? 'f' : ''}" viewBox="0 0 140 140" role="img" aria-label="สัดส่วนสถานะสต๊อก"><g transform="rotate(-90 70 70)">${arcs}</g><text class="dpct" x="70" y="72" text-anchor="middle">${Math.round(c.ok / total * 100)}%</text><text class="dsub" x="70" y="90" text-anchor="middle">ปกติ</text></svg>`;
}
function dash() {
  if (!P.length) return '<p class="mut">ยังไม่มีสินค้า ไปที่แท็บ “สินค้า” เพื่อเพิ่ม</p>';
  const sc = cat ? P.filter(p => catOf(p) === cat) : P, total = sc.length;
  const c = { out: 0, crit: 0, low: 0, ok: 0 }; sc.forEach(p => c[st(p)]++);
  const n = c.out + c.crit + c.low;
  const stat = (cls, key, ic, num, label) => `<button class="stat ${cls} ${view === key ? 'on' : ''}" onclick="setView('${key}')"><span class="sic">${ic}</span><b>${num}</b><span>${label}</span></button>`;
  const stats = `<div class="stats">${stat('blue', 'all', IC.box, total, 'สินค้าทั้งหมด')}${stat('grn', 'ok', IC.ok, c.ok, 'ปกติ')}${stat(n ? 'red' : 'grn', 'low', n ? IC.warn : IC.ok, n, 'ต้องเติม')}</div>`;
  const leg = ['ok', 'low', 'crit', 'out'].map(k => `<button class="dl l-${k} ${(k === 'ok' ? view === 'ok' : view === 'low' && fl === k) ? 'on' : ''}" onclick="${k === 'ok' ? "setView('ok')" : "setFl('" + k + "')"}">${LV[k]}<b>${c[k]}</b></button>`).join('');
  const donutCard = `<section class="card chart"><h3>สถานะสต๊อก${cat ? ' · ' + esc(cat) : ''}</h3><div class="dwrap">${donut(c, total)}<div class="dleg">${leg}</div></div><p class="mut hint">แตะส่วนของโดนัทหรือรายการด้านข้างเพื่อกรองรายการด้านล่าง</p></section>`;
  const cs = {}; P.forEach(p => { const k = catOf(p); const o = cs[k] || (cs[k] = { n: 0, ok: 0 }); o.n++; if (st(p) === 'ok') o.ok++; });
  catList = Object.keys(cs).sort((a, b) => (cs[b].n - cs[b].ok) - (cs[a].n - cs[a].ok) || a.localeCompare(b, 'th'));
  const showCat = !(catList.length === 1 && catList[0] === NOCAT);
  const catCard = showCat ? `<section class="card chart"><h3>สรุปตามหมวดหมู่</h3>${catList.map((k, i) => { const o = cs[k], bad = o.n - o.ok, pc = Math.round(o.ok / o.n * 100);
    return `<button class="ccat ${cat === k ? 'on' : ''}" onclick="setCat(${i})"><div class="top"><span>${esc(k)}</span><em>${o.ok}/${o.n} (${pc}%)${bad ? `<i>ต้องเติม ${bad}</i>` : ''}</em></div><div class="ctr ${bad ? 'bad' : ''}"><i style="width:${pc}%"></i></div></button>`; }).join('')}<p class="mut hint">แตะหมวดเพื่อดูเฉพาะหมวดนั้น (แตะซ้ำเพื่อดูทุกหมวด)</p></section>` : '';
  return stats + donutCard + catCard;
}
function detail(id) {
  const p = P.find(x => x.id === id); if (!p) return;
  const S_ = isSt(p), k = st(p), mn = +p.min_qty;
  const r = S_ ? Math.round(pct(p) * 100) : (mn > 0 ? Math.round(+p.qty / mn * 100) : (+p.qty > 0 ? 100 : 0));
  const need = S_ ? 0 : +(mn - +p.qty).toFixed(2);
  const d = $('#sheet');
  const boxes = S_
    ? `<div><span class="mut">สถานะ</span><b class="v-${k}">${STL[p.status || 'ok']}</b></div><div><span class="mut">วิธีนับ</span><b>ตามสถานะ</b></div>`
    : `<div><span class="mut">คงเหลือ</span><b class="v-${k}">${isPk(p) ? Math.floor(+p.qty / +p.pack_size) + ' ' + pkUnitOf(p) : p.qty + ' ' + esc(p.unit)}</b></div><div><span class="mut">ขั้นต่ำที่ต้องมี</span><b>${p.min_qty} ${esc(p.unit)}</b></div>`;
  const msg = S_ ? (k === 'out' ? 'หมดแล้ว' : k === 'ok' ? 'มีพอ' : 'ใกล้หมด')
    : (k === 'out' ? 'หมดแล้ว' : k === 'ok' ? 'ปกติ · ' + r + '% ของขั้นต่ำ' : 'เหลือ ' + r + '% ของขั้นต่ำ');
  d.innerHTML = `<h2>${esc(p.name)}</h2>
  <div class="two dstat">${boxes}</div>
  <div class="ctrack big"><i class="s-${k}" style="width:${Math.max(0, Math.min(100, r))}%"></i></div>
  <p class="mut" style="margin:8px 0 4px"><b class="v-${k}">${msg}</b>${need > 0 ? ' · ต้องเติมอย่างน้อย ' + need + ' ' + esc(p.unit) : ''}${catOf(p) !== NOCAT ? ' · หมวด ' + esc(catOf(p)) : ''}</p>
  ${isPk(p) ? `<p class="mut">${fmtQ(p)}</p>` : ''}
  <div class="acts" style="margin-top:14px"><button type="button" class="btn ghost" onclick="$('#sheet').close()">ปิด</button>
  <button type="button" class="btn" onclick="$('#sheet').close();openProd('${id}')">แก้ไขสินค้า</button></div>`;
  d.showModal();
}
function renderShort() {
  if (cat && !P.some(p => catOf(p) === cat)) cat = '';
  const sc = cat ? P.filter(p => catOf(p) === cat) : P;
  if (fl && !sc.some(p => st(p) !== 'ok' && lvl(p) === fl)) fl = '';
  const isLow = p => st(p) !== 'ok';
  const inView = p => view === 'all' || (view === 'ok' ? !isLow(p) : isLow(p));
  const rank = p => isLow(p) ? pct(p) : 99;
  const lf = sc.filter(p => inView(p) && (!fl || lvl(p) === fl)).sort((a, b) => rank(a) - rank(b) || (rank(a) < 99 ? a.qty - b.qty : 0));
  const dflt = view === 'low' && !fl && !cat;
  const f = [VIEWS[view], fl && view === 'low' && LV[fl], cat].filter(Boolean).join(' · ');
  const head = P.length ? `<div class="row" style="margin:4px 4px 12px"><p class="mut">${esc(f)} · ${lf.length} รายการ${dflt && lf.length ? ' · เรียงจากเหลือน้อยที่สุดขึ้นก่อน' : ''}</p>${dflt ? '' : '<button class="link" style="color:var(--acc);padding:0" onclick="clearFilter()">ล้างตัวกรอง</button>'}</div>` : '';
  const empty = !lf.length && P.length ? `<p class="mut" style="text-align:center;margin:16px 0">${dflt ? '✓ สต๊อกครบทุกรายการ' : 'ไม่มีรายการในตัวกรองนี้'}</p>` : '';
  $('#main').innerHTML = dash() + '<div id="lst"></div>' + head + empty +
    lf.map(p => {
      const cn = catOf(p) !== NOCAT ? ' · ' + esc(catOf(p)) : '';
      if (!isLow(p)) { const w = isSt(p) ? 100 : (+p.min_qty > 0 ? Math.min(100, Math.round(+p.qty / +p.min_qty * 100)) : 100);
        return `<article class="card tap okc lv-ok" onclick="detail('${p.id}')"><div class="row"><div><h3>${esc(p.name)}</h3><p class="mut">${sub(p)}${cn}</p></div><div class="rt"><span class="tag grn">ปกติ</span></div></div><div class="bar"><i style="width:${w}%"></i></div></article>`; }
      const k = st(p), r = pct(p);
      return `<article class="card tap lv-${k}" onclick="detail('${p.id}')"><div class="row"><div><h3>${esc(p.name)}</h3><p class="mut">${sub(p)}${cn}</p></div><div class="rt"><span class="tag ${TAGC[k]}">${LV[k]}</span></div></div><div class="bar"><i style="width:${Math.min(100, Math.round(r * 100))}%"></i></div></article>`;
    }).join('');
}
// ===== แท็บประวัติ =====
let H = null, hw = 0, hq = '', hk = 'all', hv = 'log', RP = null, SN = null, SF = null, snDays = 30, snCat = 'ขนม', sfDays = 7, sfUser = '';
const HK = { all: 'ทั้งหมด', cnt: 'นับสต๊อก', mng: 'จัดการสินค้า' };
const HACT = { qty: 'ปรับยอด', status: 'เปลี่ยนสถานะ', add: 'เพิ่มสินค้า', edit: 'แก้ข้อมูล', delete: 'ลบสินค้า' };
const wStart = off => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7 + off * 7); return d; };
async function loadHist() {
  if (hv === 'rep') {
    const q = await sb.from('weekly_reports').select('*').order('week_start', { ascending: false }).limit(52);
    if (q.error) { toast(q.error.message); RP = []; return; }
    RP = q.data || []; return;
  }
  if (hv === 'snack') { await loadSnackInsights(); return; }
  if (hv === 'staff') {
    const s = new Date(); s.setDate(s.getDate() - 30);
    const r = await sb.from('stock_logs').select('*').gte('created_at', s.toISOString()).order('created_at', { ascending: false }).limit(3000);
    if (r.error) { toast(r.error.message); SF = []; return; }
    SF = r.data || []; return;
  }
  const s = wStart(hw), e = new Date(s); e.setDate(e.getDate() + 7);
  const r = await sb.from('stock_logs').select('*').gte('created_at', s.toISOString()).lt('created_at', e.toISOString()).order('created_at', { ascending: false }).limit(1000);
  if (r.error) { toast(r.error.message); H = []; return; }
  H = r.data || [];
}
function hwk(n) { hw = Math.min(0, hw + n); H = null; renderHist(); loadHist().then(render); }
async function delWeekLogs() {
  const s = wStart(hw), e = new Date(s); e.setDate(e.getDate() + 7);
  const f = d => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  const last = new Date(e); last.setDate(last.getDate() - 1);
  if (!confirm(`ลบประวัติทั้งหมดของสัปดาห์ ${f(s)} – ${f(last)} ?\n(${H.length} รายการ) ลบแล้วกู้คืนไม่ได้`)) return;
  if (!ok(await sb.from('stock_logs').delete().gte('created_at', s.toISOString()).lt('created_at', e.toISOString()))) return;
  toast('ลบประวัติสัปดาห์นี้แล้ว'); H = null; await loadHist(); render();
}
async function genWeekReport() {
  const s = wStart(hw), e = new Date(s); e.setDate(e.getDate() + 6);
  const f = d => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  if (!confirm(`สร้างรายงานของสัปดาห์ ${f(s)} – ${f(e)} ?\n(ถ้าสัปดาห์นี้เคยมีรายงานแล้ว จะถูกอัปเดตทับ)`)) return;
  const ymd = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`;
  if (!ok(await sb.rpc('generate_weekly_report', { p_week: ymd }))) return;
  toast('สร้างรายงานแล้ว'); hv = 'rep'; H = null; RP = null; renderHist(); await loadHist(); render();
}
const stTxt = v => `<b class="v-${esc(v)}">${esc(STL[v] || v)}</b>`;
function hDesc(x) {
  const u = esc(x.unit || '');
  const pr = P.find(p => p.id === x.product_id || p.name === x.product_name);
  const ps = +(x.pack_size || (pr && pr.pack_size) || 0);
  const pu = (pr && pkUnitOf(pr)) || x.pack_unit || 'แพ็ค';
  if (x.action === 'qty') {
    const a = +x.old_value, b = +x.new_value, d = +(b - a).toFixed(2);
    let pkInfo = '';
    if (ps > 0) {
      const bPk = fmtPack(b, ps, u, pu);
      const aPk = fmtPack(a, ps, u, pu);
      pkInfo = `<span class="mut" style="display:block;font-size:13px;margin-top:2px">📦 รวมเป็น <b>${bPk}</b> <span style="opacity:.8">(จาก ${aPk} · ${pu}ละ ${ps} ${u})</span></span>`;
    }
    return `${a} → <b>${b}</b> ${u}<span class="dlt ${d > 0 ? 'up' : 'dn'}">${d > 0 ? '+' : ''}${d}</span>${pkInfo}`;
  }
  if (x.action === 'status') return `${stTxt(x.old_value)} → ${stTxt(x.new_value)}`;
  if (x.action === 'add') {
    let addPk = '';
    if (ps > 0 && x.new_value && x.track_mode !== 'status') {
      addPk = ` · รวม ${fmtPack(+x.new_value, ps, u, pu)}`;
    }
    return 'เพิ่มสินค้าใหม่' + (x.new_value ? ' · เริ่มที่ ' + (x.track_mode === 'status' ? esc(STL[x.new_value] || x.new_value) : (+x.new_value) + ' ' + u + addPk) : '');
  }
  if (x.action === 'edit') return x.detail ? esc(x.detail).replace(/\n/g, '<br>') : 'แก้ไขข้อมูลสินค้า';
  return 'ลบสินค้าออกจากระบบ';
}
// จัดกลุ่มรายการตามวัน (showWho = แสดงชื่อผู้ทำรายการ)
function dayGroups(L, showWho) {
  const days = {};
  L.forEach(x => { const k = new Date(x.created_at).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short' }); (days[k] = days[k] || []).push(x); });
  return Object.keys(days).map(k => `<section class="card hday"><h3>${k} · ${days[k].length} รายการ</h3>${days[k].map(x => `<div class="hrow"><i class="hdot a-${esc(x.action)}"></i><div class="hbody"><div class="row"><h4>${esc(x.product_name)}</h4><span class="mut">${new Date(x.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</span></div><p class="hd">${hDesc(x)}</p><p class="mut">${esc(HACT[x.action] || x.action)}${showWho ? ' · โดย ' + esc(who(x.user_id)) : ''}</p></div></div>`).join('')}</section>`).join('');
}
function renderHist() {
  if (tab !== 'hist') return;
  if (hv === 'rep') return renderRep();
  if (hv === 'snack') return renderSnack();
  if (hv === 'staff') return renderStaffHist();
  const s = wStart(hw), e = new Date(s); e.setDate(e.getDate() + 6);
  const f = d => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  const label = `${f(s)} – ${f(e)} ${e.toLocaleDateString('th-TH', { year: 'numeric' })}`;
  const title = hw === 0 ? 'สัปดาห์นี้' : hw === -1 ? 'สัปดาห์ที่แล้ว' : 'ย้อนหลัง ' + (-hw) + ' สัปดาห์';
  const wk = `<div class="wk"><button onclick="hwk(-1)" aria-label="สัปดาห์ก่อนหน้า">‹</button><div><b>${title}</b><span>${label}</span></div><button onclick="hwk(1)" ${hw >= 0 ? 'disabled' : ''} aria-label="สัปดาห์ถัดไป">›</button></div>`;
  if (H === null) { $('#main').innerHTML = hvTabs() + wk + '<p class="mut" style="text-align:center;margin:24px 0">กำลังโหลด...</p>'; return; }
  const box = (ic, n, t) => `<div class="stat blue inert"><span class="sic">${ic}</span><b>${n}</b><span>${t}</span></div>`;
  const stats = `<div class="stats">${box(IC.list, H.length, 'รายการ')}${box(IC.box, new Set(H.map(x => x.product_name)).size, 'สินค้า')}${box(IC.user, new Set(H.map(x => x.user_id).filter(Boolean)).size, 'ผู้ทำรายการ')}</div>`;
  const chips = `<div class="chips">${Object.keys(HK).map(k => `<button class="chip ${hk === k ? 'on' : ''}" onclick="hk='${k}';renderHist()">${HK[k]}</button>`).join('')}</div>`;
  $('#main').innerHTML = hvTabs() + wk + `<button class="btn ghost add" onclick="genWeekReport()">สร้างรายงานของสัปดาห์นี้</button>` + stats + `<div class="tools"><input type="search" placeholder="ค้นหาชื่อสินค้า" value="${esc(hq)}" oninput="hq=this.value;histList()"></div>` + chips + '<div id="hl"></div>'
    + (H.length ? `<button class="link red" style="display:block;margin:6px auto 0" onclick="delWeekLogs()">ลบประวัติสัปดาห์นี้ (${H.length} รายการ)</button>` : '');
  histList();
}
function histList() {
  const el = $('#hl'); if (!el) return;
  const s = hq.trim().toLowerCase();
  const L = H.filter(x => (hk === 'all' || (hk === 'cnt' ? ['qty', 'status'].includes(x.action) : ['add', 'edit', 'delete'].includes(x.action))) && (!s || String(x.product_name || '').toLowerCase().includes(s)));
  if (!L.length) { el.innerHTML = `<p class="mut" style="text-align:center;margin:20px 0">${H.length ? 'ไม่พบรายการที่ตรงกับตัวกรอง' : 'ยังไม่มีรายการในสัปดาห์นี้'}</p>`; return; }
  el.innerHTML = dayGroups(L, true);
}
const hvTabs = () => `<div class="chips"><button class="chip ${hv === 'log' ? 'on' : ''}" onclick="setHv('log')">การเปลี่ยนแปลง</button><button class="chip ${hv === 'staff' ? 'on' : ''}" onclick="setHv('staff')">ประวัติพนักงาน</button><button class="chip ${hv === 'rep' ? 'on' : ''}" onclick="setHv('rep')">รายงานสัปดาห์</button><button class="chip ${hv === 'snack' ? 'on' : ''}" onclick="setHv('snack')">วิเคราะห์ความนิยม 🍿</button></div>`;
function setHv(v) { hv = v; H = null; RP = null; SN = null; SF = null; renderHist(); loadHist().then(render); }
// ----- ประวัติการทำงานของพนักงานแต่ละคน -----
function setSf(k, v) { if (k === 'd') sfDays = v; else sfUser = v; renderHist(); }
function renderStaffHist() {
  const top = hvTabs();
  if (SF === null) { $('#main').innerHTML = top + '<p class="mut" style="text-align:center;margin:24px 0">กำลังโหลด...</p>'; return; }
  const cut = Date.now() - sfDays * 864e5, L = SF.filter(x => Date.parse(x.created_at) >= cut);
  const cnt = {}; L.forEach(x => { cnt[x.user_id] = (cnt[x.user_id] || 0) + 1; });
  const users = S.slice().sort((a, b) => (cnt[b.id] || 0) - (cnt[a.id] || 0) || String(a.name).localeCompare(String(b.name), 'th'));
  if (!users.some(u => u.id === sfUser)) sfUser = users.length ? users[0].id : '';
  const mine = L.filter(x => x.user_id === sfUser);
  const last = mine.length ? new Date(mine[0].created_at).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' น.' : '-';
  const days = `<div style="display:flex;align-items:center;justify-content:space-between;margin:4px 2px 12px"><span class="mut" style="font-size:13px">ย้อนหลัง:</span><div style="display:flex;gap:6px">${[7, 14, 30].map(d => `<button class="chip ${sfDays === d ? 'on' : ''}" style="padding:4px 10px;font-size:12px" onclick="setSf('d',${d})">${d} วัน</button>`).join('')}</div></div>`;
  const chips = `<div class="chips">${users.map(u => `<button class="chip ${sfUser === u.id ? 'on' : ''}" onclick="setSf('u','${u.id}')">${esc(u.name)} ${cnt[u.id] || 0}</button>`).join('')}</div>`;
  const box = (ic, n, t) => `<div class="stat blue inert"><span class="sic">${ic}</span><b>${n}</b><span>${t}</span></div>`;
  const dayN = new Set(mine.map(x => new Date(x.created_at).toDateString())).size;
  const stats = `<div class="stats">${box(IC.list, mine.length, 'รายการ')}${box(IC.box, new Set(mine.map(x => x.product_name)).size, 'สินค้า')}${box(IC.ok, dayN, 'วันที่ทำงาน')}</div>`;
  $('#main').innerHTML = top + days + chips + stats + `<p class="mut" style="margin:0 4px 12px">ทำรายการล่าสุด: ${last}</p>` +
    (mine.length ? dayGroups(mine, false) : '<p class="mut" style="text-align:center;margin:20px 0">ไม่มีรายการของคนนี้ในช่วงที่เลือก</p>');
}
// ----- รายงานสัปดาห์ -----
const LVC = { out: 'red', crit: 'org', low: 'amb', ok: 'grn' };
let repSel = {};
function repPick(id, k) { repSel[id] = repSel[id] === k ? '' : k; renderRep(); }
async function genReport() {
  if (!ok(await sb.rpc('generate_weekly_report', { p_which: 'this' }))) return;
  toast('สร้างรายงานแล้ว'); RP = null; await loadHist(); render();
}
async function delReport(id) {
  if (!confirm('ลบรายงานสัปดาห์นี้? ลบแล้วกู้คืนไม่ได้')) return;
  if (!ok(await sb.from('weekly_reports').delete().eq('id', id))) return;
  toast('ลบรายงานแล้ว'); RP = null; await loadHist(); render();
}
function renderRep() {
  const top = hvTabs() + `<button class="btn ghost add" onclick="genReport()">สร้างรายงานสัปดาห์นี้ตอนนี้</button>`;
  if (RP === null) { $('#main').innerHTML = top + '<p class="mut" style="text-align:center;margin:24px 0">กำลังโหลด...</p>'; return; }
  const d = s => new Date(s + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  const y = s => new Date(s + 'T00:00:00').toLocaleDateString('th-TH', { year: 'numeric' });
  const item = i => `<div class="rit"><div>${esc(i.name)}<small>${i.mode === 'status' ? 'นับตามสถานะ' : (+i.qty) + ' / ขั้นต่ำ ' + (+i.min) + ' ' + esc(i.unit || '')}</small></div><span class="tag ${LVC[i.level] || 'amb'}">${LV[i.level] || i.level}</span></div>`;
  $('#main').innerHTML = top + (RP.length ? RP.map(x => {
    const its = x.items || [], bu = x.by_user || [], sel = repSel[x.id] || '';
    const cnt = { ok: x.n_ok, low: x.n_low, crit: x.n_crit, out: x.n_out };
    const shown = sel ? its.filter(i => i.level === sel) : [];
    return `<article class="card rep"><div class="row"><h3>${d(x.week_start)} – ${d(x.week_end)} ${y(x.week_end)}</h3><span class="mut">สร้างเมื่อ ${new Date(x.created_at).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} น.</span></div>
    <div class="rtags">${['ok', 'low', 'crit', 'out'].map(k => `<button class="tag ${LVC[k]} rtg ${sel === k ? 'on' : ''}" ${cnt[k] ? '' : 'disabled'} onclick="repPick('${x.id}','${k}')">${LV[k]} ${cnt[k]}</button>`).join('')}</div>
    <p class="mut" style="margin-top:8px">สินค้าทั้งหมด ${x.total} รายการ · ปรับสต๊อก ${x.n_changes} ครั้ง (${x.n_products} สินค้า, ${x.n_people} คน)</p>
    ${sel ? (shown.length ? `<div class="rlist">${shown.map(item).join('')}</div>` : `<p class="mut" style="margin-top:10px">${sel === 'ok' && cnt.ok ? 'รายงานฉบับนี้สร้างก่อนอัปเดต จึงไม่ได้เก็บรายการที่ปกติไว้ กดสร้างรายการของสัปดาห์นี้ใหม่เพื่ออัปเดต' : 'ไม่มีรายการในหมวดนี้'}</p>`) : '<p class="mut hint" style="margin-top:8px">แตะป้ายด้านบนเพื่อดูรายการสินค้าในแต่ละหมวด</p>'}
    ${bu.length ? `<p class="mut" style="margin-top:8px">ผู้ทำรายการ: ${bu.map(u => esc(u.name) + ' ' + u.n + ' ครั้ง').join(' · ')}</p>` : ''}
    <button class="link red" onclick="delReport('${x.id}')">ลบรายงานนี้</button></article>`;
  }).join('') : '<p class="mut" style="text-align:center;margin:20px 0">ยังไม่มีรายงาน ระบบจะสร้างให้อัตโนมัติทุกเช้าวันจันทร์ (หรือกดปุ่มด้านบนเพื่อสร้างทันที)</p>');
}
// ----- วิเคราะห์ความนิยม: อันดับจาก "จำนวนครั้งที่ลด + หมด" เทียบกับช่วงก่อนหน้า (▲▼ NEW) -----
async function loadSnackInsights() {
  const s = new Date(); s.setDate(s.getDate() - snDays * 2);
  const r = await sb.from('stock_logs').select('*').gte('created_at', s.toISOString()).order('created_at', { ascending: false }).limit(5000);
  if (r.error) { toast(r.error.message); SN = []; return; }
  SN = r.data || [];
}
function setSnDays(d) { snDays = d; SN = null; renderHist(); loadHist().then(render); }
function setSnCat(c) { snCat = c; renderHist(); }
const SR = { ok: 2, low: 1, out: 0 };
function snScore(logs) {
  let dec = 0, outs = 0;
  logs.forEach(l => {
    if (l.action === 'qty' && +l.old_value > +l.new_value) { dec++; if (+l.new_value <= 0) outs++; }
    else if (l.action === 'status' && SR[l.old_value] > SR[l.new_value]) { dec++; if (l.new_value === 'out') outs++; }
  });
  return { dec, outs, pts: dec + 2 * outs };
}
function snItems(list) {
  const cut = Date.now() - snDays * 864e5;
  const items = list.map(p => {
    const logs = SN.filter(l => l.product_id === p.id || l.product_name === p.name);
    const cur = snScore(logs.filter(l => Date.parse(l.created_at) >= cut)), prev = snScore(logs.filter(l => Date.parse(l.created_at) < cut));
    const lt = logs.length ? Date.parse(logs[0].created_at) : 0;
    const daysInactive = lt ? Math.max(0, Math.floor((Date.now() - lt) / 864e5)) : snDays;
    return { ...p, consumed: cur.dec, outs: cur.outs, pts: cur.pts, prevPts: prev.pts, daysInactive, logCount: logs.length };
  });
  const rk = key => { const o = {}; items.filter(x => x[key] > 0).sort((a, b) => b[key] - a[key]).forEach((x, i) => o[x.id] = i + 1); return o; };
  const now = rk('pts'), old = rk('prevPts');
  items.forEach(x => x.mv = !now[x.id] ? null : !old[x.id] ? 'new' : old[x.id] - now[x.id]);
  return { items, hot: items.filter(x => x.pts > 0).sort((a, b) => b.pts - a.pts || b.logCount - a.logCount) };
}
const mvTag = x => x.mv === 'new' ? '<span class="mv nw">NEW</span>' : x.mv > 0 ? `<span class="mv up">▲${x.mv}</span>` : x.mv < 0 ? `<span class="mv dn">▼${-x.mv}</span>` : '<span class="mv">–</span>';
function renderSnack() {
  const top = hvTabs();
  if (SN === null) { $('#main').innerHTML = top + '<p class="mut" style="text-align:center;margin:24px 0">กำลังวิเคราะห์ความนิยม...</p>'; return; }
  const catChoices = [...new Set(['ขนม', ...CATS, 'ทั้งหมด'])];
  const catChips = `<div class="chips" style="margin-top:6px">${catChoices.map(c => `<button class="chip ${snCat === c ? 'on' : ''}" onclick="setSnCat('${esc(c)}')">${esc(c)}</button>`).join('')}</div>`;
  const daysBar = `<div style="display:flex;align-items:center;justify-content:space-between;margin:4px 2px 14px"><span class="mut" style="font-size:13px">วิเคราะห์ย้อนหลัง:</span><div style="display:flex;gap:6px">${[7, 14, 30].map(d => `<button class="chip ${snDays === d ? 'on' : ''}" style="padding:4px 10px;font-size:12px" onclick="setSnDays(${d})">${d} วัน</button>`).join('')}</div></div>`;
  const list = P.filter(p => snCat === 'ทั้งหมด' || catOf(p) === snCat);
  if (!list.length) { $('#main').innerHTML = top + catChips + daysBar + `<article class="card"><p class="mut" style="text-align:center;margin:16px 0">ไม่พบสินค้าในหมวด “${esc(snCat)}”</p></article>`; return; }
  const { items, hot } = snItems(list);
  const slow = items.filter(x => (isSt(x) ? x.status !== 'out' : +x.qty > 0) && (x.consumed === 0 || x.daysInactive >= 5)).sort((a, b) => b.daysInactive - a.daysInactive || a.consumed - b.consumed);
  const total = items.reduce((s, x) => s + x.consumed, 0), topItem = hot.length ? hot[0].name : '-';
  const stats = `<div class="stats"><div class="stat blue inert"><span class="sic">${IC.box}</span><b>${items.length}</b><span>ในหมวดนี้</span></div><div class="stat red inert"><span class="sic">${IC.warn}</span><b>${total}</b><span>ครั้งที่ลดรวม</span></div><div class="stat grn inert"><span class="sic">${IC.ok}</span><b style="font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">${esc(topItem)}</b><span>ฮิตอันดับ 1 🔥</span></div></div>`;
  const hotHtml = hot.length ? hot.map((x, idx) => {
    const rc = idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : 'rank-n';
    const ri = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : (idx + 1);
    const avg = (x.consumed / snDays).toFixed(1), isShort = stOf(x) !== 'ok';
    const info = isSt(x) ? 'สถานะ: ' + STL[x.status || 'ok'] : `คงเหลือ ${fmtQ(x)} / ขั้นต่ำ ${x.min_qty}`;
    return `<article class="card sn-card is-hot"><div class="row"><div style="display:flex;align-items:center;gap:10px"><span class="rank-badge ${rc}">${ri}</span><div><h3>${esc(x.name)}</h3><p class="mut">${info}</p></div></div><div class="rt"><span class="sn-tag hot">ลด ${x.consumed} ครั้ง · หมด ${x.outs} ครั้ง</span>${mvTag(x)}</div></div>
    <p class="mut" style="font-size:13px;margin-top:6px">เฉลี่ย ~${avg} ครั้ง/วัน ${isShort ? ' · <b class="v-out">ของใกล้หมด รีบเติม!</b>' : ' · <span style="color:var(--grn)">ออกไว แนะนำตุนเพิ่ม</span>'}</p></article>`;
  }).join('') : `<article class="card"><p class="mut" style="text-align:center;padding:12px 0">ยังไม่พบรายการที่ลดลงในรอบ ${snDays} วันนี้</p></article>`;
  const slowHtml = slow.length ? slow.map(x => {
    const info = isSt(x) ? 'สถานะ: ' + STL[x.status || 'ok'] : `คงเหลือ ${fmtQ(x)}`;
    const dt = x.daysInactive >= snDays ? `${snDays}+ วัน` : `${x.daysInactive} วัน`;
    return `<article class="card sn-card is-cold"><div class="row"><div><h3>${esc(x.name)}</h3><p class="mut">${info} · ${esc(catOf(x))}</p></div><div class="rt"><span class="sn-tag cold">ยอดนิ่ง ${dt}</span></div></div><p class="mut" style="font-size:13px;margin-top:6px">❄️ ลดน้อย (${x.consumed} ครั้ง) · <b>ชะลอการสั่งซื้อ</b> หรือนำมาจัดโปร/ย้ายตำแหน่งวาง</p></article>`;
  }).join('') : `<article class="card"><p class="mut" style="text-align:center;padding:12px 0">ทุกรายการมีการเคลื่อนไหวสม่ำเสมอ ไม่มีของค้างสต๊อก 👍</p></article>`;
  $('#main').innerHTML = top + catChips + daysBar + stats +
    `<div class="sn-sec"><h3>🔥 อันดับยอดฮิต (ลดบ่อย / หมดบ่อย)</h3><span class="mut" style="font-size:13px">${hot.length} รายการ</span></div>` + hotHtml +
    `<div class="sn-sec" style="margin-top:22px"><h3>❄️ รายการค้างสต๊อก</h3><span class="mut" style="font-size:13px">${slow.length} รายการ</span></div>` + slowHtml;
}
// ===== ความเห็น =====
function renderFb() {
  $('#main').innerHTML = F.length ? F.map(x => `<article class="card"><div class="row"><h3>${esc(who(x.user_id))}</h3><span class="tag ${x.status === 'done' ? 'grn' : 'amb'}">${x.status === 'done' ? 'อ่านแล้ว' : 'ใหม่'}</span></div><p style="margin:6px 0">${esc(x.message)}</p><p class="mut">${new Date(x.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</p><div class="row">${x.status === 'todo' ? `<button class="link" style="color:var(--acc)" onclick="seenFb('${x.id}')">ทำเครื่องหมายว่าอ่านแล้ว</button>` : '<span></span>'}<button class="link red" onclick="delFb('${x.id}')">ลบ</button></div></article>`).join('') : '<p class="mut">ยังไม่มีความเห็นจากพนักงาน</p>';
}
async function seenFb(id) { if (ok(await sb.from('feedback').update({ status: 'done' }).eq('id', id))) load(); }
async function delFb(id) { if (confirm('ลบความเห็นนี้?') && ok(await sb.from('feedback').delete().eq('id', id))) load(); }
// ===== สินค้า (แสดงหมวด + กรองตามหมวด) =====
let pcat = '', pkeys = [];
const setPcat = i => { pcat = i < 0 ? '' : pkeys[i]; renderProd(); };
function renderProd() {
  pkeys = [...new Set(P.map(catOf))].sort((a, b) => a === NOCAT ? 1 : b === NOCAT ? -1 : a.localeCompare(b, 'th'));
  if (pcat && !pkeys.includes(pcat)) pcat = '';
  const chips = `<div class="chips"><button class="chip ${pcat ? '' : 'on'}" onclick="setPcat(-1)">ทั้งหมด ${P.length}</button>${pkeys.map((k, i) => `<button class="chip ${pcat === k ? 'on' : ''}" onclick="setPcat(${i})">${esc(k)} ${P.filter(p => catOf(p) === k).length}</button>`).join('')}</div>`;
  const card = p => `<article class="card" onclick="openProd('${p.id}')"><div class="row"><div><h3>${esc(p.name)}</h3><p class="mut">${esc(catOf(p))} · ${isSt(p) ? 'นับตามสถานะ' : (isPk(p) ? `${pkUnitOf(p)}ละ ${p.pack_size} ${esc(p.unit)} · ` : '') + 'ขั้นต่ำ ' + p.min_qty}</p></div><div class="rt"><span class="tag ${TAGC[st(p)]}">${isSt(p) ? STL[p.status || 'ok'] : (isPk(p) ? Math.floor(+p.qty / +p.pack_size) + ' ' + pkUnitOf(p) : p.qty + ' ' + esc(p.unit))}</span></div></div></article>`;
  const groups = pcat ? [pcat] : pkeys;
  $('#main').innerHTML = `<button class="btn add" onclick="openProd()">เพิ่มสินค้า</button>` + (P.length ? chips +
    groups.map(k => `<div class="sn-sec"><h3>${esc(k)}</h3></div>` + P.filter(p => catOf(p) === k).map(card).join('')).join('') : '<p class="mut">ยังไม่มีสินค้า กด “เพิ่มสินค้า” เพื่อเริ่ม</p>');
}
// ===== ผู้ใช้ =====
function renderUsers() {
  $('#main').innerHTML = `<button class="btn add" onclick="openUser()">เพิ่มผู้ใช้</button>` +
    S.map(u => `<article class="card"><div class="row"><h3>${esc(u.name)}</h3><span class="tag ${u.role === 'admin' ? 'amb' : 'grn'}">${u.role === 'admin' ? 'แอดมิน' : 'พนักงาน'}</span></div><div class="row"><button class="link" style="color:var(--acc)" onclick="setPw('${u.id}')">เปลี่ยนรหัสผ่าน</button><button class="link red" onclick="delUser('${u.id}')">ลบผู้ใช้</button></div></article>`).join('');
}
function openUser() {
  sheet(`<h2>เพิ่มผู้ใช้</h2>
  <label>ชื่อที่แสดง<input name="name" required></label>
  <label>อีเมล (ใช้ล็อกอิน)<input name="email" type="email" required autocomplete="off"></label>
  <label>รหัสผ่าน (อย่างน้อย 6 ตัว)<input name="password" type="text" minlength="6" required autocomplete="off"></label>
  <label>สิทธิ์<select name="role"><option value="staff">พนักงาน</option><option value="admin">แอดมิน</option></select></label>`,
    async v => ok(await sb.rpc('admin_create_user', { p_email: v.email, p_password: v.password, p_name: v.name, p_role: v.role })));
}
async function delUser(id) { if (confirm('ลบผู้ใช้นี้?') && ok(await sb.rpc('admin_delete_user', { p_id: id }))) { toast('ลบแล้ว'); load(); } }
async function setPw(id) { const w = prompt('รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)'); if (w && ok(await sb.rpc('admin_set_password', { p_id: id, p_password: w }))) toast('เปลี่ยนรหัสผ่านแล้ว'); }
// ===== ฟอร์ม =====
function sheet(h, fn) {
  const d = $('#sheet');
  d.innerHTML = `<form id="f">${h}<div class="acts"><button type="button" class="btn ghost" onclick="$('#sheet').close()">ยกเลิก</button><button class="btn">บันทึก</button></div></form>`;
  $('#f').onsubmit = async e => { e.preventDefault(); if (await fn(Object.fromEntries(new FormData(e.target)))) { d.close(); toast('บันทึกแล้ว'); load(); } };
  d.showModal();
}
const modeUi = m => { $('#mq').hidden = m === 'status'; $('#ms').hidden = m !== 'status'; };
function openProd(id) {
  const p = P.find(x => x.id === id) || { name: '', unit: 'ชิ้น', qty: 0, min_qty: 0, track_mode: 'qty', status: 'ok' };
  const S_ = isSt(p), other = !!p.unit && !UNITS.includes(p.unit);
  const pu = pkUnitOf(p);
  const otherPu = !PACK_UNITS.includes(pu);
  sheet(`<h2>${id ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า'}</h2>
  <label>ชื่อสินค้า<input name="name" required value="${esc(p.name)}"></label>
  <label>วิธีนับสินค้า<select name="track_mode" onchange="modeUi(this.value)">
    <option value="qty" ${S_ ? '' : 'selected'}>นับเป็นจำนวน (เทียบกับขั้นต่ำ)</option>
    <option value="status" ${S_ ? 'selected' : ''}>นับเป็นสถานะ (มีพอ / ใกล้หมด / หมด)</option></select></label>
  <div id="mq" ${S_ ? 'hidden' : ''}><div class="two"><label>คงเหลือ (นับเป็นชิ้น)<input name="qty" type="number" step="any" inputmode="decimal" value="${p.qty}"></label>
  <label>ขั้นต่ำที่ต้องมี<input name="min_qty" type="number" step="any" inputmode="decimal" value="${p.min_qty}"></label></div>
  <div class="two"><label>จำนวนต่อ 1 หน่วยบรรจุ<input name="pack_size" type="number" step="any" min="0" inputmode="decimal" value="${p.pack_size || ''}" placeholder="เว้นว่างถ้าไม่นับรวม"></label>
  <label>หน่วยบรรจุภัณฑ์<select name="pack_unit_sel" onchange="$('#puo').hidden=this.value!=='__other'">
    ${PACK_UNITS.map(u => `<option ${pu === u ? 'selected' : ''}>${u}</option>`).join('')}
    <option value="__other" ${otherPu ? 'selected' : ''}>อื่นๆ (พิมพ์เอง)</option>
  </select></label></div>
  <label id="puo" ${otherPu ? '' : 'hidden'}>ระบุชื่อหน่วยบรรจุภัณฑ์<input name="pack_unit_other" value="${otherPu ? esc(pu) : ''}" placeholder="เช่น แผง, ลัง, ถาด, โหล"></label></div>
  <label id="ms" ${S_ ? '' : 'hidden'}>สถานะปัจจุบัน<select name="status">${['ok', 'low', 'out'].map(s => `<option value="${s}" ${(p.status || 'ok') === s ? 'selected' : ''}>${STL[s]}</option>`).join('')}</select></label>
  <label>หน่วยของสินค้า (หน่วยย่อย)<select name="unit" onchange="$('#uo').hidden=this.value!=='__other'">${UNITS.map(u => `<option ${p.unit === u ? 'selected' : ''}>${u}</option>`).join('')}<option value="__other" ${other ? 'selected' : ''}>อื่นๆ</option></select></label>
  <label id="uo" ${other ? '' : 'hidden'}>ระบุหน่วย<input name="unit_other" value="${other ? esc(p.unit) : ''}" placeholder="เช่น ขวด, ฟอง, กระป๋อง"></label>
  <label>หมวดหมู่<select name="category"><option value="">ไม่ระบุ</option>${[...new Set([...CATS, ...P.map(catOf).filter(k => k !== NOCAT)])].map(k => `<option value="${esc(k)}" ${k === (p.category || '') ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select></label>
  ${id ? `<button type="button" class="link red" onclick="delProd('${id}')">ลบสินค้านี้</button>` : ''}`,
    async v => {
      v.unit = v.unit === '__other' ? ((v.unit_other || '').trim() || 'ชิ้น') : v.unit;
      delete v.unit_other;
      v.pack_size = v.track_mode === 'qty' && v.pack_size ? +v.pack_size : null;
      const pUnit = v.pack_unit_sel === '__other' ? ((v.pack_unit_other || '').trim() || 'แพ็ค') : (v.pack_unit_sel || 'แพ็ค');
      delete v.pack_unit_sel;
      delete v.pack_unit_other;
      if (v.pack_size) v.pack_unit = pUnit; else delete v.pack_unit;
      if (v.track_mode === 'status') { delete v.qty; delete v.min_qty; delete v.pack_size; delete v.pack_unit; } else { v.status = 'ok'; }

      let r = id ? await sb.from('products').update(v).eq('id', id) : await sb.from('products').insert(v);
      if (r.error && String(r.error.message || '').includes('pack_unit')) {
        const puVal = v.pack_unit;
        delete v.pack_unit;
        r = id ? await sb.from('products').update(v).eq('id', id) : await sb.from('products').insert(v);
        if (!r.error && puVal) {
          const savedId = id || (r.data && r.data[0] && r.data[0].id);
          if (savedId) { try { localStorage.setItem('pu_' + savedId, puVal); } catch(e){} }
        }
      } else if (!r.error && (id || (r.data && r.data[0])) && v.pack_unit) {
        const savedId = id || (r.data && r.data[0] && r.data[0].id);
        if (savedId) { try { localStorage.setItem('pu_' + savedId, v.pack_unit); } catch(e){} }
      }
      return ok(r);
    });
}
async function delProd(id) { if (confirm('ลบสินค้านี้?') && ok(await sb.from('products').delete().eq('id', id))) { $('#sheet').close(); load(); } }
