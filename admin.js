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
  P = a.data || []; S = b.data || []; T = c.data || []; F = d.data || []; render();
}
// สลับแท็บ
function go(t) { tab = t; document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.t === t)); render(); }
// สัดส่วนที่เหลือเทียบกับขั้นต่ำ (0 = หมด, 1 = ถึงขั้นต่ำ) ใช้จัดลำดับความเร่งด่วน
const pct = p => +p.min_qty > 0 ? +p.qty / +p.min_qty : 0;
// รายการที่ต้องเติม = qty <= min_qty เรียงจากเหลือน้อยที่สุดขึ้นก่อน
const low = () => P.filter(p => +p.qty <= +p.min_qty).sort((x, y) => pct(x) - pct(y) || x.qty - y.qty);
// แปลง id ผู้ใช้เป็นชื่อ (อ่านจากคอลัมน์ name ในตาราง profiles)
// ชื่อพนักงาน/แอดมินที่แสดงในแอปมาจากตรงนี้ - แก้ชื่อได้ที่ Supabase (ดูท้ายไฟล์ schema.sql)
const who = id => (S.find(x => x.id === id) || {}).name || '-';
// วาดหน้าตามแท็บ + อัปเดตเลขแจ้งบนเมนู
function render() {
  const n = low().length; $('#n').hidden = !n; $('#n').textContent = n;
  const u = F.filter(x => x.status === 'todo').length; $('#fbn').hidden = !u; $('#fbn').textContent = u;
  ({ short: renderShort, prod: renderProd, task: renderTask, fb: renderFb })[tab]();
}
// ระดับความขาดของสินค้า: out=หมด, crit=เหลือน้อยมาก (<=25% ของขั้นต่ำ), low=ใกล้หมด
const lvl = p => +p.qty <= 0 ? 'out' : pct(p) <= 0.25 ? 'crit' : 'low';
// สถานะรวม: ถ้าเหลือเกินขั้นต่ำ = ok (ปกติ) ไม่งั้นใช้ระดับความขาดด้านบน
const st = p => +p.qty <= +p.min_qty ? lvl(p) : 'ok';
const LV = { out: 'หมด', crit: 'เหลือน้อยมาก', low: 'ใกล้หมด', ok: 'ปกติ' };
const VIEWS = { low: 'ต้องเติม', all: 'สินค้าทั้งหมด', ok: 'ปกติ' };
// ตัวเลือกหมวดหมู่ในฟอร์มเพิ่ม/แก้สินค้า - อยากเพิ่มหมวดใหม่ ให้เพิ่มชื่อในลิสต์นี้
// (หมวดที่เคยใส่ไว้ในสินค้าแล้วจะขึ้นในตัวเลือกให้เองด้วย)
const CATS = ['ขนม', 'ของใช้', 'ของจิปาถะ'];
const NOCAT = 'ไม่ระบุหมวด';
const catOf = p => String(p.category || '').trim() || NOCAT;
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
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 16.5h.01"/></svg>'
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
  const cs = {}; P.forEach(p => { const k = catOf(p); const o = cs[k] || (cs[k] = { n: 0, ok: 0 }); o.n++; if (+p.qty > +p.min_qty) o.ok++; });
  catList = Object.keys(cs).sort((a, b) => (cs[b].n - cs[b].ok) - (cs[a].n - cs[a].ok) || a.localeCompare(b, 'th'));
  const showCat = !(catList.length === 1 && catList[0] === NOCAT);
  const catCard = showCat ? `<section class="card chart"><h3>สรุปตามหมวดหมู่</h3>${catList.map((k, i) => { const o = cs[k], bad = o.n - o.ok, pc = Math.round(o.ok / o.n * 100);
    return `<button class="ccat ${cat === k ? 'on' : ''}" onclick="setCat(${i})"><div class="top"><span>${esc(k)}</span><em>${o.ok}/${o.n} (${pc}%)${bad ? `<i>ต้องเติม ${bad}</i>` : ''}</em></div><div class="ctr ${bad ? 'bad' : ''}"><i style="width:${pc}%"></i></div></button>`; }).join('')}<p class="mut hint">แตะหมวดเพื่อดูเฉพาะหมวดนั้น (แตะซ้ำเพื่อดูทุกหมวด)</p></section>` : '';
  return stats + donutCard + catCard;
}
// หน้าต่างรายละเอียดสินค้า (เด้งขึ้นเมื่อกดการ์ดสินค้า)
function detail(id) {
  const p = P.find(x => x.id === id); if (!p) return;
  const k = st(p), mn = +p.min_qty, r = mn > 0 ? Math.round(+p.qty / mn * 100) : (+p.qty > 0 ? 100 : 0), open = T.some(t => t.product_id === id && t.status === 'todo');
  const need = +(mn - +p.qty).toFixed(2);
  const d = $('#sheet');
  d.innerHTML = `<h2>${esc(p.name)}</h2>
  <div class="two dstat"><div><span class="mut">คงเหลือ</span><b class="v-${k}">${p.qty} ${esc(p.unit)}</b></div><div><span class="mut">ขั้นต่ำที่ต้องมี</span><b>${p.min_qty} ${esc(p.unit)}</b></div></div>
  <div class="ctrack big"><i class="s-${k}" style="width:${Math.max(0, Math.min(100, r))}%"></i></div>
  <p class="mut" style="margin:8px 0 4px">${k === 'out' ? 'หมดแล้ว' : k === 'ok' ? 'ปกติ · ' + r + '% ของขั้นต่ำ' : 'เหลือ ' + r + '% ของขั้นต่ำ'}${need > 0 ? ' · เติมอย่างน้อย ' + need + ' ' + esc(p.unit) + ' จึงจะถึงขั้นต่ำ' : ''}${catOf(p) !== NOCAT ? ' · หมวด ' + esc(catOf(p)) : ''}</p>
  ${open ? '<p class="mut">มีงานเติมของที่ยังไม่เสร็จ</p>' : ''}
  <div class="acts" style="margin-top:14px"><button type="button" class="btn ghost" onclick="$('#sheet').close()">ปิด</button>
  ${k === 'ok' || open ? `<button type="button" class="btn" onclick="$('#sheet').close();openProd('${id}')">แก้ไขสินค้า</button>` : `<button type="button" class="btn" onclick="$('#sheet').close();openTask('${id}')">สั่งงานเติมของ</button>`}</div>`;
  d.showModal();
}
// แท็บ 'ขาดสต๊อก' (หน้าแรกของแอดมิน): แดชบอร์ด + รายการสินค้าตามตัวกรอง (ค่าเริ่มต้น = ที่ต้องเติม เรียงตามความเร่งด่วน)
function renderShort() {
  if (cat && !P.some(p => catOf(p) === cat)) cat = '';
  const sc = cat ? P.filter(p => catOf(p) === cat) : P;
  if (fl && !sc.some(p => +p.qty <= +p.min_qty && lvl(p) === fl)) fl = '';
  const isLow = p => +p.qty <= +p.min_qty;
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
      if (!isLow(p)) { const w = +p.min_qty > 0 ? Math.min(100, Math.round(+p.qty / +p.min_qty * 100)) : 100;
        return `<article class="card tap okc" onclick="detail('${p.id}')"><div class="row"><div><h3>${esc(p.name)}</h3><p class="mut">เหลือ ${p.qty} จากขั้นต่ำ ${p.min_qty} ${esc(p.unit)}${cn}</p></div><span class="tag grn">ปกติ</span></div><div class="bar"><i style="width:${w}%"></i></div></article>`; }
      const out = +p.qty <= 0, r = pct(p), urg = out || r <= 0.25, open = T.some(t => t.product_id === p.id && t.status === 'todo');
      return `<article class="card tap ${urg ? 'urg' : ''}" onclick="detail('${p.id}')"><div class="row"><div><h3>${esc(p.name)}</h3><p class="mut">เหลือ ${p.qty} จากขั้นต่ำ ${p.min_qty} ${esc(p.unit)}${cn}</p></div><span class="tag ${urg ? 'red' : 'amb'}">${out ? 'หมด' : urg ? 'เหลือน้อยมาก' : 'ใกล้หมด'}</span></div><div class="bar"><i style="width:${Math.min(100, Math.round(r * 100))}%"></i></div>` +
        (open ? '<p class="mut" style="margin-top:8px">มีงานเติมของที่ยังไม่เสร็จ</p>' : `<button class="btn" onclick="event.stopPropagation();openTask('${p.id}')">สั่งงานเติมของ</button>`) + '</article>';
    }).join('');
}
// แท็บ 'ความเห็น': ข้อความที่พนักงานส่งมา
function renderFb() {
  $('#main').innerHTML = F.length ? F.map(x => `<article class="card"><div class="row"><h3>${esc(who(x.user_id))}</h3><span class="tag ${x.status === 'done' ? 'grn' : 'amb'}">${x.status === 'done' ? 'อ่านแล้ว' : 'ใหม่'}</span></div><p style="margin:6px 0">${esc(x.message)}</p><p class="mut">${new Date(x.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</p><div class="row">${x.status === 'todo' ? `<button class="link" style="color:var(--acc)" onclick="seenFb('${x.id}')">ทำเครื่องหมายว่าอ่านแล้ว</button>` : '<span></span>'}<button class="link red" onclick="delFb('${x.id}')">ลบ</button></div></article>`).join('') : '<p class="mut">ยังไม่มีความเห็นจากพนักงาน</p>';
}
async function seenFb(id) { if (ok(await sb.from('feedback').update({ status: 'done' }).eq('id', id))) load(); }
async function delFb(id) { if (confirm('ลบความเห็นนี้?') && ok(await sb.from('feedback').delete().eq('id', id))) load(); }
function renderProd() {
  $('#main').innerHTML = `<button class="btn add" onclick="openProd()">เพิ่มสินค้า</button>` +
    (P.length ? P.map(p => { const bad = +p.qty <= +p.min_qty; return `<article class="card" onclick="openProd('${p.id}')"><div class="row"><h3>${esc(p.name)}</h3><span class="tag ${bad ? 'red' : 'grn'}">${p.qty} ${esc(p.unit)}</span></div><p class="mut">ขั้นต่ำ ${p.min_qty}</p></article>`; }).join('') : '<p class="mut">ยังไม่มีสินค้า กด “เพิ่มสินค้า” เพื่อเริ่ม</p>');
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
// ฟอร์มเพิ่ม/แก้สินค้า (ชื่อ, คงเหลือ, ขั้นต่ำ, หน่วย) - อยากเพิ่มช่อง เช่น หมวดหมู่ ให้เพิ่ม <label> ตรงนี้ และเพิ่มคอลัมน์ในตาราง products
function openProd(id) {
  const p = P.find(x => x.id === id) || { name: '', unit: 'ชิ้น', qty: 0, min_qty: 0 };
  sheet(`<h2>${id ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า'}</h2>
  <label>ชื่อสินค้า<input name="name" required value="${esc(p.name)}"></label>
  <div class="two"><label>คงเหลือ<input name="qty" type="number" step="any" inputmode="decimal" value="${p.qty}"></label>
  <label>ขั้นต่ำที่ต้องมี<input name="min_qty" type="number" step="any" inputmode="decimal" value="${p.min_qty}"></label></div>
  <label>หน่วย<input name="unit" value="${esc(p.unit)}"></label>
  <label>หมวดหมู่<select name="category"><option value="">ไม่ระบุ</option>${[...new Set([...CATS, ...P.map(catOf).filter(k => k !== NOCAT)])].map(k => `<option value="${esc(k)}" ${k === (p.category || '') ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select></label>
  ${id ? `<button type="button" class="link red" onclick="delProd('${id}')">ลบสินค้านี้</button>` : ''}`,
    async v => ok(id ? await sb.from('products').update(v).eq('id', id) : await sb.from('products').insert(v)));
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
