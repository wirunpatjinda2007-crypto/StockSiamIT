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
// แท็บ 'ขาดสต๊อก' (หน้าแรกของแอดมิน): ตัวเลขรวม + การ์ดสินค้าเรียงตามความเร่งด่วน
function renderShort() {
  const l = low();
  $('#main').innerHTML = `<section class="hero ${l.length ? 'bad' : 'ok'}"><b>${l.length || '✓'}</b><span>${l.length ? 'รายการที่ต้องเติม' : 'สต๊อกครบทุกรายการ'}</span></section>` +
    (l.length ? '<p class="mut" style="margin:0 4px 12px">เรียงจากเหลือน้อยที่สุดขึ้นก่อน</p>' : '') +
    l.map(p => {
      const out = +p.qty <= 0, r = pct(p), urg = out || r <= 0.25, open = T.some(t => t.product_id === p.id && t.status === 'todo');
      return `<article class="card ${urg ? 'urg' : ''}"><div class="row"><div><h3>${esc(p.name)}</h3><p class="mut">เหลือ ${p.qty} จากขั้นต่ำ ${p.min_qty} ${esc(p.unit)}</p></div><span class="tag ${urg ? 'red' : 'amb'}">${out ? 'หมด' : urg ? 'เหลือน้อยมาก' : 'ใกล้หมด'}</span></div><div class="bar"><i style="width:${Math.min(100, Math.round(r * 100))}%"></i></div>` +
        (open ? '<p class="mut" style="margin-top:8px">มีงานเติมของที่ยังไม่เสร็จ</p>' : `<button class="btn" onclick="openTask('${p.id}')">สั่งงานเติมของ</button>`) + '</article>';
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
