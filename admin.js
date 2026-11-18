// ตัวแปรเก็บข้อมูล: P=สินค้า S=ผู้ใช้ (พนักงานและแอดมิน) T=งาน F=ความเห็น tab=แท็บที่เปิดอยู่
let P = [], S = [], T = [], F = [], tab = 'short';
(async () => {
  const me = await guard('admin'); if (!me) return;
  $('#who').textContent = 'สวัสดี ' + me.name;
  await load();
  sb.channel('live').on('postgres_changes', { event: '*', schema: 'public' }, load).subscribe();
})();
// โหลดข้อมูลทั้งหมดจาก Supabase แล้ววาดหน้าใหม่ (เรียกซ้ำอัตโนมัติเมื่อข้อมูลเปลี่ยน)
async function load() {
  const [a, b, c, d] = await Promise.all([
    sb.from('products').select('*').order('name'),
    sb.from('profiles').select('*').order('name'),
    sb.from('tasks').select('*').order('created_at', { ascending: false }),
    sb.from('feedback').select('*').order('created_at', { ascending: false })]);
  P = a.data || []; S = b.data || []; T = c.data || []; F = d.data || [];
  if (tab === 'hist') await loadHist();
  render();
}
// สลับแท็บ
function go(t) {
  tab = t; document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  if (t === 'hist') { H = null; RP = null; render(); loadHist().then(render); } else render();
}
// สัดส่วนที่เหลือเทียบกับขั้นต่ำ (0 = หมด, 1 = ถึงขั้นต่ำ) ใช้จัดลำดับความเร่งด่วน
// สินค้านับแบบสถานะ: หมด=0, ใกล้หมด=0.5, มีพอ=1
const pct = p => isSt(p) ? ({ out: 0, low: 0.5, ok: 1 }[p.status] ?? 1) : (+p.min_qty > 0 ? +p.qty / +p.min_qty : 0);
// รายการที่ต้องเติม = สถานะไม่ใช่ ok เรียงจากเหลือน้อยที่สุดขึ้นก่อน
const low = () => P.filter(p => stOf(p) !== 'ok').sort((x, y) => pct(x) - pct(y) || x.qty - y.qty);
// แปลง id ผู้ใช้เป็นชื่อ (อ่านจากคอลัมน์ name ในตาราง profiles)
// ชื่อพนักงาน/แอดมินที่แสดงในแอปมาจากตรงนี้ - แก้ชื่อได้ที่ Supabase (ดูท้ายไฟล์ schema.sql)
const who = id => (S.find(x => x.id === id) || {}).name || '-';
// วาดหน้าตามแท็บ + อัปเดตเลขแจ้งบนเมนู
function render() {
  const n = low().length; $('#n').hidden = !n; $('#n').textContent = n;
  const u = F.filter(x => x.status === 'todo').length; $('#fbn').hidden = !u; $('#fbn').textContent = u;
  ({ short: renderShort, prod: renderProd, task: renderTask, hist: renderHist, fb: renderFb })[tab]();
}
// ระดับความขาดของสินค้า: out=หมด, crit=เหลือน้อยมาก (<=25% ของขั้นต่ำ), low=ใกล้หมด (คำนวณใน stOf ที่ common.js)
const lvl = p => stOf(p);
// สถานะรวม: ok (ปกติ) / low / crit / out
const st = p => stOf(p);
const LV = { out: 'หมด', crit: 'เหลือน้อยมาก', low: 'ใกล้หมด', ok: 'ปกติ' };
const VIEWS = { low: 'ต้องเติม', all: 'สินค้าทั้งหมด', ok: 'ปกติ' };
// ตัวเลือกหมวดหมู่ในฟอร์มเพิ่ม/แก้สินค้า - อยากเพิ่มหมวดใหม่ ให้เพิ่มชื่อในลิสต์นี้
// (หมวดที่เคยใส่ไว้ในสินค้าแล้วจะขึ้นในตัวเลือกให้เองด้วย)
const CATS = ['ขนม', 'ของใช้', 'ของจิปาถะ'];
const NOCAT = 'ไม่ระบุหมวด';
const catOf = p => String(p.category || '').trim() || NOCAT;
// ข้อความบรรทัดรองของสินค้า: นับจำนวน = เหลือ x จากขั้นต่ำ y / นับสถานะ = สถานะ: ...
const sub = p => isSt(p) ? 'สถานะ: ' + STL[p.status || 'ok'] : `เหลือ ${p.qty} จากขั้นต่ำ ${p.min_qty} ${esc(p.unit)}`;
// view = มุมมองรายการ (low=ต้องเติม, all=ทั้งหมด, ok=ปกติ), fl = ระดับที่กรอง, cat = หมวดที่กรอง ('' = ทุกหมวด)
// catList = รายชื่อหมวดที่แสดงอยู่ (ใช้อ้างด้วยเลขลำดับ)
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
// กราฟโดนัท: แต่ละส่วนกดเพื่อกรองรายการด้านล่าง (ส่วน 'ปกติ' = ดูเฉพาะของปกติ)
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
// แดชบอร์ดหน้าขาดสต๊อก: การ์ดตัวเลข 3 ใบ + โดนัทสถานะ + สรุปตามหมวดหมู่ (ทุกส่วนกดได้)
// เมื่อกดเลือกหมวด ตัวเลขและโดนัทจะนับเฉพาะหมวดนั้น (การ์ดหมวดยังแสดงครบทุกหมวดเพื่อสลับได้)
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
// หน้าต่างรายละเอียดสินค้า (เด้งขึ้นเมื่อกดการ์ดสินค้า)
function detail(id) {
  const p = P.find(x => x.id === id); if (!p) return;
  const S_ = isSt(p), k = st(p), mn = +p.min_qty;
  const r = S_ ? Math.round(pct(p) * 100) : (mn > 0 ? Math.round(+p.qty / mn * 100) : (+p.qty > 0 ? 100 : 0));
  const open = T.some(t => t.product_id === id && t.status === 'todo');
  const need = S_ ? 0 : +(mn - +p.qty).toFixed(2);
  const d = $('#sheet');
  const boxes = S_
    ? `<div><span class="mut">สถานะ</span><b class="v-${k}">${STL[p.status || 'ok']}</b></div><div><span class="mut">วิธีนับ</span><b>ตามสถานะ</b></div>`
    : `<div><span class="mut">คงเหลือ</span><b class="v-${k}">${p.qty} ${esc(p.unit)}</b></div><div><span class="mut">ขั้นต่ำที่ต้องมี</span><b>${p.min_qty} ${esc(p.unit)}</b></div>`;
  const msg = S_ ? (k === 'out' ? 'หมดแล้ว' : k === 'ok' ? 'มีพอ' : 'ใกล้หมด')
    : (k === 'out' ? 'หมดแล้ว' : k === 'ok' ? 'ปกติ · ' + r + '% ของขั้นต่ำ' : 'เหลือ ' + r + '% ของขั้นต่ำ');
  d.innerHTML = `<h2>${esc(p.name)}</h2>
  <div class="two dstat">${boxes}</div>
  <div class="ctrack big"><i class="s-${k}" style="width:${Math.max(0, Math.min(100, r))}%"></i></div>
  <p class="mut" style="margin:8px 0 4px"><b class="v-${k}">${msg}</b>${need > 0 ? ' · เติมอย่างน้อย ' + need + ' ' + esc(p.unit) + ' จึงจะถึงขั้นต่ำ' : ''}${catOf(p) !== NOCAT ? ' · หมวด ' + esc(catOf(p)) : ''}</p>
  ${open ? '<p class="mut">มีงานเติมของที่ยังไม่เสร็จ</p>' : ''}
  <div class="acts" style="margin-top:14px"><button type="button" class="btn ghost" onclick="$('#sheet').close()">ปิด</button>
  ${k === 'ok' || open ? `<button type="button" class="btn" onclick="$('#sheet').close();openProd('${id}')">แก้ไขสินค้า</button>` : `<button type="button" class="btn" onclick="$('#sheet').close();openTask('${id}')">สั่งงานเติมของ</button>`}</div>`;
  d.showModal();
}
// แท็บ 'ขาดสต๊อก' (หน้าแรกของแอดมิน): แดชบอร์ด + รายการสินค้าตามตัวกรอง (ค่าเริ่มต้น = ที่ต้องเติม เรียงตามความเร่งด่วน)
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
      const k = st(p), r = pct(p), open = T.some(t => t.product_id === p.id && t.status === 'todo');
      return `<article class="card tap lv-${k}" onclick="detail('${p.id}')"><div class="row"><div><h3>${esc(p.name)}</h3><p class="mut">${sub(p)}${cn}</p></div><div class="rt"><span class="tag ${TAGC[k]}">${LV[k]}</span></div></div><div class="bar"><i style="width:${Math.min(100, Math.round(r * 100))}%"></i></div>` +
        (open ? '<p class="mut" style="margin-top:8px">มีงานเติมของที่ยังไม่เสร็จ</p>' : `<button class="btn" onclick="event.stopPropagation();openTask('${p.id}')">สั่งงานเติมของ</button>`) + '</article>';
    }).join('');
}
// ===== แท็บ 'ประวัติ': ดูรายการเปลี่ยนแปลงสต๊อกทีละสัปดาห์ (สัปดาห์เริ่มวันจันทร์) =====
// H = รายการประวัติของสัปดาห์ที่เลือก (null = กำลังโหลด) hw = 0 สัปดาห์นี้ / -1 สัปดาห์ที่แล้ว ...
// hq = คำค้นหาชื่อสินค้า hk = ตัวกรองประเภท (all=ทั้งหมด, cnt=นับสต๊อก, mng=จัดการสินค้า)
// hv = มุมมองในแท็บประวัติ (log = การเปลี่ยนแปลงรายสัปดาห์ / rep = รายงานสรุปอัตโนมัติ) RP = รายการรายงานสัปดาห์ (null = กำลังโหลด)
let H = null, hw = 0, hq = '', hk = 'all', hv = 'log', RP = null;
const HK = { all: 'ทั้งหมด', cnt: 'นับสต๊อก', mng: 'จัดการสินค้า' };
const HACT = { qty: 'ปรับยอด', status: 'เปลี่ยนสถานะ', add: 'เพิ่มสินค้า', edit: 'แก้ข้อมูล', delete: 'ลบสินค้า' };
// วันจันทร์ 00:00 ของสัปดาห์ที่ off (0 = สัปดาห์นี้)
const wStart = off => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7 + off * 7); return d; };
// ดึงข้อมูลแท็บประวัติ: มุมมองรายงาน = ตาราง weekly_reports / มุมมองการเปลี่ยนแปลง = ตาราง stock_logs เฉพาะสัปดาห์ที่เลือก
async function loadHist() {
  if (hv === 'rep') {
    const q = await sb.from('weekly_reports').select('*').order('week_start', { ascending: false }).limit(52);
    if (q.error) { toast(q.error.message); RP = []; return; }
    RP = q.data || []; return;
  }
  const s = wStart(hw), e = new Date(s); e.setDate(e.getDate() + 7);
  const r = await sb.from('stock_logs').select('*').gte('created_at', s.toISOString()).lt('created_at', e.toISOString()).order('created_at', { ascending: false }).limit(1000);
  if (r.error) { toast(r.error.message); H = []; return; }
  H = r.data || [];
}
// เลื่อนสัปดาห์ (-1 = ก่อนหน้า, +1 = ถัดไป, ไม่เกินสัปดาห์นี้)
function hwk(n) { hw = Math.min(0, hw + n); H = null; renderHist(); loadHist().then(render); }
// ลบประวัติทั้งหมดของสัปดาห์ที่เลือก (ลบเฉพาะตาราง stock_logs ไม่กระทบสินค้า/ยอดสต๊อก และไม่กระทบรายงานสัปดาห์ที่สร้างไว้แล้ว)
async function delWeekLogs() {
  const s = wStart(hw), e = new Date(s); e.setDate(e.getDate() + 7);
  const f = d => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  const last = new Date(e); last.setDate(last.getDate() - 1);
  if (!confirm(`ลบประวัติทั้งหมดของสัปดาห์ ${f(s)} – ${f(last)} ?\n(${H.length} รายการ) ลบแล้วกู้คืนไม่ได้`)) return;
  if (!ok(await sb.from('stock_logs').delete().gte('created_at', s.toISOString()).lt('created_at', e.toISOString()))) return;
  toast('ลบประวัติสัปดาห์นี้แล้ว'); H = null; await loadHist(); render();
}
const stTxt = v => `<b class="v-${esc(v)}">${esc(STL[v] || v)}</b>`;
// คำอธิบายการเปลี่ยนแปลงของแต่ละรายการ
function hDesc(x) {
  const u = esc(x.unit || '');
  if (x.action === 'qty') { const a = +x.old_value, b = +x.new_value, d = +(b - a).toFixed(2);
    return `${a} → <b>${b}</b> ${u}<span class="dlt ${d > 0 ? 'up' : 'dn'}">${d > 0 ? '+' : ''}${d}</span>`; }
  if (x.action === 'status') return `${stTxt(x.old_value)} → ${stTxt(x.new_value)}`;
  if (x.action === 'add') return 'เพิ่มสินค้าใหม่' + (x.new_value ? ' · เริ่มที่ ' + (x.track_mode === 'status' ? esc(STL[x.new_value] || x.new_value) : (+x.new_value) + ' ' + u) : '');
  if (x.action === 'edit') return 'แก้ไขข้อมูลสินค้า (ชื่อ / ขั้นต่ำ / หน่วย / หมวด / วิธีนับ)';
  return 'ลบสินค้าออกจากระบบ';
}
// วาดหน้าประวัติ: ตัวเลื่อนสัปดาห์ + สรุป + ค้นหา/กรอง + รายการ
function renderHist() {
  if (tab !== 'hist') return;
  if (hv === 'rep') return renderRep();
  const s = wStart(hw), e = new Date(s); e.setDate(e.getDate() + 6);
  const f = d => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  const label = `${f(s)} – ${f(e)} ${e.toLocaleDateString('th-TH', { year: 'numeric' })}`;
  const title = hw === 0 ? 'สัปดาห์นี้' : hw === -1 ? 'สัปดาห์ที่แล้ว' : 'ย้อนหลัง ' + (-hw) + ' สัปดาห์';
  const wk = `<div class="wk"><button onclick="hwk(-1)" aria-label="สัปดาห์ก่อนหน้า">‹</button><div><b>${title}</b><span>${label}</span></div><button onclick="hwk(1)" ${hw >= 0 ? 'disabled' : ''} aria-label="สัปดาห์ถัดไป">›</button></div>`;
  if (H === null) { $('#main').innerHTML = hvTabs() + wk + '<p class="mut" style="text-align:center;margin:24px 0">กำลังโหลด...</p>'; return; }
  const box = (ic, n, t) => `<div class="stat blue inert"><span class="sic">${ic}</span><b>${n}</b><span>${t}</span></div>`;
  const stats = `<div class="stats">${box(IC.list, H.length, 'รายการ')}${box(IC.box, new Set(H.map(x => x.product_name)).size, 'สินค้า')}${box(IC.user, new Set(H.map(x => x.user_id).filter(Boolean)).size, 'ผู้ทำรายการ')}</div>`;
  const chips = `<div class="chips">${Object.keys(HK).map(k => `<button class="chip ${hk === k ? 'on' : ''}" onclick="hk='${k}';renderHist()">${HK[k]}</button>`).join('')}</div>`;
  $('#main').innerHTML = hvTabs() + wk + stats + `<div class="tools"><input type="search" placeholder="ค้นหาชื่อสินค้า" value="${esc(hq)}" oninput="hq=this.value;histList()"></div>` + chips + '<div id="hl"></div>'
    + (H.length ? `<button class="link red" style="display:block;margin:6px auto 0" onclick="delWeekLogs()">ลบประวัติสัปดาห์นี้ (${H.length} รายการ)</button>` : '');
  histList();
}
// วาดเฉพาะรายการประวัติ (ใช้ตอนพิมพ์ค้นหา จะได้ไม่เสียโฟกัสช่องค้นหา) จัดกลุ่มตามวัน
function histList() {
  const el = $('#hl'); if (!el) return;
  const s = hq.trim().toLowerCase();
  const L = H.filter(x => (hk === 'all' || (hk === 'cnt' ? ['qty', 'status'].includes(x.action) : ['add', 'edit', 'delete'].includes(x.action))) && (!s || String(x.product_name || '').toLowerCase().includes(s)));
  if (!L.length) { el.innerHTML = `<p class="mut" style="text-align:center;margin:20px 0">${H.length ? 'ไม่พบรายการที่ตรงกับตัวกรอง' : 'ยังไม่มีรายการในสัปดาห์นี้'}</p>`; return; }
  const days = {};
  L.forEach(x => { const k = new Date(x.created_at).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short' }); (days[k] = days[k] || []).push(x); });
  el.innerHTML = Object.keys(days).map(k => `<section class="card hday"><h3>${k} · ${days[k].length} รายการ</h3>${days[k].map(x => `<div class="hrow"><i class="hdot a-${esc(x.action)}"></i><div class="hbody"><div class="row"><h4>${esc(x.product_name)}</h4><span class="mut">${new Date(x.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</span></div><p class="hd">${hDesc(x)}</p><p class="mut">${esc(HACT[x.action] || x.action)} · โดย ${esc(who(x.user_id))}</p></div></div>`).join('')}</section>`).join('');
}
// ===== รายงานสรุปรายสัปดาห์ (ระบบสร้างให้อัตโนมัติทุกเช้าวันจันทร์ด้วย pg_cron ดูไฟล์ weekly_report.sql) =====
// ปุ่มสลับมุมมองด้านบนของแท็บประวัติ
const hvTabs = () => `<div class="chips"><button class="chip ${hv === 'log' ? 'on' : ''}" onclick="setHv('log')">การเปลี่ยนแปลง</button><button class="chip ${hv === 'rep' ? 'on' : ''}" onclick="setHv('rep')">รายงานสัปดาห์</button></div>`;
function setHv(v) { hv = v; H = null; RP = null; renderHist(); loadHist().then(render); }
const LVC = { out: 'red', crit: 'org', low: 'amb', ok: 'grn' };
// กดสร้างรายงานของสัปดาห์นี้ทันที (ไว้ทดสอบ/ดูก่อนถึงวันจันทร์) - เรียกฟังก์ชัน generate_weekly_report ในฐานข้อมูล
async function genReport() {
  if (!ok(await sb.rpc('generate_weekly_report', { p_which: 'this' }))) return;
  toast('สร้างรายงานแล้ว'); RP = null; await loadHist(); render();
}
// ลบรายงานสัปดาห์ 1 ฉบับ
async function delReport(id) {
  if (!confirm('ลบรายงานสัปดาห์นี้? ลบแล้วกู้คืนไม่ได้')) return;
  if (!ok(await sb.from('weekly_reports').delete().eq('id', id))) return;
  toast('ลบรายงานแล้ว'); RP = null; await loadHist(); render();
}
// วาดหน้ารายงานสัปดาห์: การ์ดต่อสัปดาห์ (ใหม่สุดอยู่บน) มีสรุปจำนวนตามระดับ + รายการที่ต้องเติม + ผู้นับสต๊อก
function renderRep() {
  const top = hvTabs() + `<button class="btn ghost add" onclick="genReport()">สร้างรายงานสัปดาห์นี้ตอนนี้</button>`;
  if (RP === null) { $('#main').innerHTML = top + '<p class="mut" style="text-align:center;margin:24px 0">กำลังโหลด...</p>'; return; }
  const d = s => new Date(s + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  const y = s => new Date(s + 'T00:00:00').toLocaleDateString('th-TH', { year: 'numeric' });
  const item = i => `<div class="rit"><div>${esc(i.name)}<small>${i.mode === 'status' ? 'นับตามสถานะ' : (+i.qty) + ' / ขั้นต่ำ ' + (+i.min) + ' ' + esc(i.unit || '')}</small></div><span class="tag ${LVC[i.level] || 'amb'}">${LV[i.level] || i.level}</span></div>`;
  $('#main').innerHTML = top + (RP.length ? RP.map(x => {
    const its = x.items || [], bu = x.by_user || [];
    return `<article class="card rep"><div class="row"><h3>${d(x.week_start)} – ${d(x.week_end)} ${y(x.week_end)}</h3><span class="mut">สร้างเมื่อ ${new Date(x.created_at).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} น.</span></div>
    <div class="rtags"><span class="tag grn">ปกติ ${x.n_ok}</span><span class="tag amb">ใกล้หมด ${x.n_low}</span><span class="tag org">เหลือน้อยมาก ${x.n_crit}</span><span class="tag red">หมด ${x.n_out}</span></div>
    <p class="mut" style="margin-top:8px">สินค้าทั้งหมด ${x.total} รายการ · ปรับสต๊อก ${x.n_changes} ครั้ง (${x.n_products} สินค้า, ${x.n_people} คน)</p>
    ${its.length ? `<details><summary>ต้องเติม ${its.length} รายการ</summary>${its.map(item).join('')}</details>` : '<p class="mut" style="margin-top:8px">✓ สต๊อกครบทุกรายการ</p>'}
    ${bu.length ? `<p class="mut" style="margin-top:8px">ผู้ทำรายการ: ${bu.map(u => esc(u.name) + ' ' + u.n + ' ครั้ง').join(' · ')}</p>` : ''}
    <button class="link red" onclick="delReport('${x.id}')">ลบรายงานนี้</button></article>`;
  }).join('') : '<p class="mut" style="text-align:center;margin:20px 0">ยังไม่มีรายงาน ระบบจะสร้างให้อัตโนมัติทุกเช้าวันจันทร์ (หรือกดปุ่มด้านบนเพื่อสร้างทันที)</p>');
}
// แท็บ 'ความเห็น': ข้อความที่พนักงานส่งมา
function renderFb() {
  $('#main').innerHTML = F.length ? F.map(x => `<article class="card"><div class="row"><h3>${esc(who(x.user_id))}</h3><span class="tag ${x.status === 'done' ? 'grn' : 'amb'}">${x.status === 'done' ? 'อ่านแล้ว' : 'ใหม่'}</span></div><p style="margin:6px 0">${esc(x.message)}</p><p class="mut">${new Date(x.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</p><div class="row">${x.status === 'todo' ? `<button class="link" style="color:var(--acc)" onclick="seenFb('${x.id}')">ทำเครื่องหมายว่าอ่านแล้ว</button>` : '<span></span>'}<button class="link red" onclick="delFb('${x.id}')">ลบ</button></div></article>`).join('') : '<p class="mut">ยังไม่มีความเห็นจากพนักงาน</p>';
}
async function seenFb(id) { if (ok(await sb.from('feedback').update({ status: 'done' }).eq('id', id))) load(); }
async function delFb(id) { if (confirm('ลบความเห็นนี้?') && ok(await sb.from('feedback').delete().eq('id', id))) load(); }
function renderProd() {
  $('#main').innerHTML = `<button class="btn add" onclick="openProd()">เพิ่มสินค้า</button>` +
    (P.length ? P.map(p => { const bad = st(p) !== 'ok'; return `<article class="card" onclick="openProd('${p.id}')"><div class="row"><h3>${esc(p.name)}</h3><div class="rt"><span class="tag ${TAGC[st(p)]}">${isSt(p) ? STL[p.status || 'ok'] : p.qty + ' ' + esc(p.unit)}</span></div></div><p class="mut">${isSt(p) ? 'นับตามสถานะ' : 'ขั้นต่ำ ' + p.min_qty}</p></article>`; }).join('') : '<p class="mut">ยังไม่มีสินค้า กด “เพิ่มสินค้า” เพื่อเริ่ม</p>');
}
function renderTask() {
  $('#main').innerHTML = `<button class="btn add" onclick="openTask()">สั่งงานใหม่</button>` +
    (T.length ? T.map(t => `<article class="card"><div class="row"><div><h3>${esc(t.title)}</h3><p class="mut">มอบให้ ${esc(who(t.assigned_to))}${t.note ? ' · ' + esc(t.note) : ''}</p></div><span class="tag ${t.status === 'done' ? 'grn' : 'amb'}">${t.status === 'done' ? 'เสร็จแล้ว' : 'รอทำ'}</span></div><button class="link red" onclick="delTask('${t.id}')">ลบงาน</button></article>`).join('') : '<p class="mut">ยังไม่มีงาน กด “สั่งงานใหม่” เพื่อมอบหมาย</p>');
}
// ฟอร์มเด้งจากด้านล่าง: ส่ง HTML ของช่องกรอก + ฟังก์ชันบันทึก
function sheet(h, fn) {
  const d = $('#sheet');
  d.innerHTML = `<form id="f">${h}<div class="acts"><button type="button" class="btn ghost" onclick="$('#sheet').close()">ยกเลิก</button><button class="btn">บันทึก</button></div></form>`;
  $('#f').onsubmit = async e => { e.preventDefault(); if (await fn(Object.fromEntries(new FormData(e.target)))) { d.close(); toast('บันทึกแล้ว'); load(); } };
  d.showModal();
}
// สลับช่องกรอกตามวิธีนับ: จำนวน (คงเหลือ+ขั้นต่ำ) หรือ สถานะ
const modeUi = m => { $('#mq').hidden = m === 'status'; $('#ms').hidden = m !== 'status'; };
// ฟอร์มเพิ่ม/แก้สินค้า (ชื่อ, วิธีนับ, คงเหลือ+ขั้นต่ำ หรือ สถานะ, หน่วย, หมวดหมู่)
// หน่วยที่เลือกได้แก้ที่ UNITS ใน common.js
function openProd(id) {
  const p = P.find(x => x.id === id) || { name: '', unit: 'ชิ้น', qty: 0, min_qty: 0, track_mode: 'qty', status: 'ok' };
  const S_ = isSt(p), other = !!p.unit && !UNITS.includes(p.unit);
  sheet(`<h2>${id ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า'}</h2>
  <label>ชื่อสินค้า<input name="name" required value="${esc(p.name)}"></label>
  <label>วิธีนับสินค้า<select name="track_mode" onchange="modeUi(this.value)">
    <option value="qty" ${S_ ? '' : 'selected'}>นับเป็นจำนวน (เทียบกับขั้นต่ำ)</option>
    <option value="status" ${S_ ? 'selected' : ''}>นับเป็นสถานะ (มีพอ / ใกล้หมด / หมด)</option></select></label>
  <div id="mq" ${S_ ? 'hidden' : ''}><div class="two"><label>คงเหลือ<input name="qty" type="number" step="any" inputmode="decimal" value="${p.qty}"></label>
  <label>ขั้นต่ำที่ต้องมี<input name="min_qty" type="number" step="any" inputmode="decimal" value="${p.min_qty}"></label></div></div>
  <label id="ms" ${S_ ? '' : 'hidden'}>สถานะปัจจุบัน<select name="status">${['ok', 'low', 'out'].map(s => `<option value="${s}" ${(p.status || 'ok') === s ? 'selected' : ''}>${STL[s]}</option>`).join('')}</select></label>
  <label>หน่วย<select name="unit" onchange="$('#uo').hidden=this.value!=='__other'">${UNITS.map(u => `<option ${p.unit === u ? 'selected' : ''}>${u}</option>`).join('')}<option value="__other" ${other ? 'selected' : ''}>อื่นๆ</option></select></label>
  <label id="uo" ${other ? '' : 'hidden'}>ระบุหน่วย<input name="unit_other" value="${other ? esc(p.unit) : ''}" placeholder="เช่น กล่อง, ลัง"></label>
  <label>หมวดหมู่<select name="category"><option value="">ไม่ระบุ</option>${[...new Set([...CATS, ...P.map(catOf).filter(k => k !== NOCAT)])].map(k => `<option value="${esc(k)}" ${k === (p.category || '') ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select></label>
  ${id ? `<button type="button" class="link red" onclick="delProd('${id}')">ลบสินค้านี้</button>` : ''}`,
    async v => {
      v.unit = v.unit === '__other' ? ((v.unit_other || '').trim() || 'ชิ้น') : v.unit;
      delete v.unit_other;
      // โหมดสถานะ: ไม่ส่ง qty/min_qty (คงค่าเดิมในฐานข้อมูล) / โหมดจำนวน: รีเซ็ตสถานะเป็น ok
      if (v.track_mode === 'status') { delete v.qty; delete v.min_qty; } else { v.status = 'ok'; }
      return ok(id ? await sb.from('products').update(v).eq('id', id) : await sb.from('products').insert(v));
    });
}
async function delProd(id) { if (confirm('ลบสินค้านี้?') && ok(await sb.from('products').delete().eq('id', id))) { $('#sheet').close(); load(); } }
async function delTask(id) { if (confirm('ลบงานนี้?') && ok(await sb.from('tasks').delete().eq('id', id))) load(); }
// ฟอร์มมอบงาน: ตัวเลือก 'มอบให้' ดึงรายชื่อจาก S (ตาราง profiles)
// อยากให้มีชื่อใหม่ในรายการ ให้เพิ่มผู้ใช้ใน Supabase ก่อน
function openTask(pid) {
  const p = P.find(x => x.id === pid);
  sheet(`<h2>สั่งงานใหม่</h2>
  <label>งานที่ต้องทำ<input name="title" required value="${p ? 'เติม ' + esc(p.name) : ''}"></label>
  <label>สินค้าที่เกี่ยวข้อง<select name="product_id"><option value="">ไม่ระบุ</option>${P.map(x => `<option value="${x.id}" ${x.id === pid ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
  <label>มอบให้<select name="assigned_to" required>${S.map(x => `<option value="${x.id}">${esc(x.name)}${x.role === 'admin' ? ' (แอดมิน)' : ''}</option>`).join('')}</select></label>
  <label>หมายเหตุ<textarea name="note" rows="2"></textarea></label>`,
    async v => { v.product_id = v.product_id || null; return ok(await sb.from('tasks').insert(v)); });
}
