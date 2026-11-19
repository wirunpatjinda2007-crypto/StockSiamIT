// เชื่อมต่อ Supabase (ใช้ค่าจาก config.js) - ตัวแปร sb ใช้เรียกฐานข้อมูลทุกหน้า
// เก็บสถานะล็อกอินไว้ใน sessionStorage (ปิดแท็บ/ปิดเว็บแล้วต้องล็อกอินใหม่)
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true }
});
try { Object.keys(localStorage).filter(k => /^sb-.*-auth-token/.test(k)).forEach(k => localStorage.removeItem(k)); } catch (e) {}
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(m) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.append(t); setTimeout(() => t.remove(), 2400); }
function ok(r) { if (r.error) { toast(r.error.message); return false; } return true; }
async function profile() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  const { data } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
  return data;
}
async function guard(role) {
  const p = await profile();
  if (!p) { location.href = 'index.html'; return; }
  if (role && p.role !== role) { location.href = p.role === 'admin' ? 'admin.html' : 'staff.html'; return; }
  return p;
}
async function logout() { await sb.auth.signOut(); location.href = 'index.html'; }

// ===== หน่วย + วิธีนับสินค้า =====
const UNITS = ['ขวด', 'ชิ้น', 'อัน', 'ถุง', 'แพ็ค', 'กล่อง', 'ซอง', 'ม้วน', 'ชุด', 'แผง', 'ลัง', 'กระป๋อง', 'ฟอง', 'แก้ว', 'โหล'];
const STL = { ok: 'มีพอ', low: 'ใกล้หมด', out: 'หมด' };
const isSt = p => p.track_mode === 'status';
const stOf = p => {
  if (isSt(p)) return p.status === 'out' ? 'out' : p.status === 'low' ? 'low' : 'ok';
  const q = +p.qty, m = +p.min_qty;
  if (q > m) return 'ok';
  if (q <= 0) return 'out';
  return m > 0 && q / m <= 0.25 ? 'crit' : 'low';
};
const TAGC = { ok: 'grn', low: 'amb', crit: 'org', out: 'red' };
const LVN = { ok: 'ปกติ', low: 'ใกล้หมด', crit: 'เหลือน้อยมาก', out: 'หมด' };
// ===== นับแบบแพ็ค/บรรจุภัณฑ์: qty เก็บเป็น "ชิ้นรวม" เสมอ, pack_size = ชิ้นต่อ 1 หน่วยบรรจุ =====
const PACK_UNITS = ['แพ็ค', 'แผง', 'ลัง', 'กล่อง', 'ถาด', 'โหล'];
const pkUnitOf = p => (p && (p.pack_unit || (typeof localStorage !== 'undefined' && localStorage.getItem('pu_' + p.id)))) || 'แพ็ค';
const isPk = p => !isSt(p) && +p.pack_size > 0;
const fmtQ = p => {
  if (!isPk(p)) return `${p.qty} ${esc(p.unit)}`;
  const pu = esc(pkUnitOf(p));
  const s = +p.pack_size, n = +p.qty, k = Math.floor(n / s), r = +(n - k * s).toFixed(2);
  return `${k} ${pu}${r ? ' + ' + r + ' ' + esc(p.unit) : ''} (= ${n} ${esc(p.unit)})`;
};
// แปลงจำนวนเป็น "X หน่วยบรรจุ Y หน่วยย่อย" (เช่น 2 แพ็ค 3 ขวด, 1 ลัง 4 กล่อง, 2 แผง 5 ฟอง)
const fmtPack = (qty, pack_size, unit = '', pack_unit = 'แพ็ค') => {
  const s = +pack_size, n = +qty, pu = esc(pack_unit || 'แพ็ค');
  if (!s || s <= 0) return `${n} ${esc(unit)}`.trim();
  const k = Math.floor(n / s), r = +(n - k * s).toFixed(2);
  if (k > 0 && r > 0) return `${k} ${pu} ${r} ${esc(unit)}`;
  if (k > 0) return `${k} ${pu}`;
  return `${r} ${esc(unit)}`;
};
