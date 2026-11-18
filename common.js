// เชื่อมต่อ Supabase (ใช้ค่าจาก config.js) - ตัวแปร sb ใช้เรียกฐานข้อมูลทุกหน้า
// เก็บสถานะล็อกอินไว้ใน sessionStorage (หายเมื่อปิดแท็บ/ปิดเว็บ) จึงต้องล็อกอินใหม่ทุกครั้งที่เปิดเว็บใหม่
// (ถ้าอยากกลับไปแบบจำการล็อกอินไว้ ให้ลบบรรทัด auth: {...} ออก)
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true }
});
// ล้างสถานะล็อกอินเก่าที่เคยจำไว้ในเครื่อง (localStorage) จากเวอร์ชันก่อน
try { Object.keys(localStorage).filter(k => /^sb-.*-auth-token/.test(k)).forEach(k => localStorage.removeItem(k)); } catch (e) {}
// ทางลัด: $('#id') = document.querySelector
const $ = (s, r = document) => r.querySelector(s);
// กันข้อความที่ผู้ใช้พิมพ์ทำให้หน้าเว็บพัง (ใช้ครอบข้อความก่อนแสดงเสมอ)
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// แสดงข้อความเด้งสั้นๆ ด้านล่างจอ
function toast(m) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.append(t); setTimeout(() => t.remove(), 2400); }
// เช็กผลจาก Supabase: ถ้า error จะเด้งข้อความและคืน false
function ok(r) { if (r.error) { toast(r.error.message); return false; } return true; }
// ดึงข้อมูลผู้ใช้ที่ล็อกอินอยู่ (name, role) จากตาราง profiles; ไม่ได้ล็อกอิน = null
async function profile() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  const { data } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
  return data;
}
// ยามหน้าประตู: ไม่ได้ล็อกอินให้กลับหน้าล็อกอิน / สิทธิ์ไม่ตรงให้ไปหน้าที่ถูกต้อง
async function guard(role) {
  const p = await profile();
  if (!p) { location.href = 'index.html'; return; }
  if (role && p.role !== role) { location.href = p.role === 'admin' ? 'admin.html' : 'staff.html'; return; }
  return p;
}
// ออกจากระบบ
async function logout() { await sb.auth.signOut(); location.href = 'index.html'; }

// ===== หน่วย + วิธีนับสินค้า =====
// หน่วยที่เลือกได้ในฟอร์มสินค้า (อยากเพิ่มหน่วย ให้เพิ่มชื่อในลิสต์นี้ / "อื่นๆ" ให้พิมพ์เองอยู่แล้ว)
const UNITS = ['ขวด', 'ชิ้น', 'อัน', 'ถุง', 'แพ็ค'];
// ป้ายสถานะสำหรับสินค้าที่นับแบบสถานะ
const STL = { ok: 'มีพอ', low: 'ใกล้หมด', out: 'หมด' };
// สินค้านี้นับแบบสถานะหรือไม่ (track_mode = 'status')
const isSt = p => p.track_mode === 'status';
// ระดับสถานะรวมของสินค้า: ok / low / crit / out (ใช้ร่วมกันทั้งหน้าแอดมินและพนักงาน)
const stOf = p => {
  if (isSt(p)) return p.status === 'out' ? 'out' : p.status === 'low' ? 'low' : 'ok';
  const q = +p.qty, m = +p.min_qty;
  if (q > m) return 'ok';
  if (q <= 0) return 'out';
  return m > 0 && q / m <= 0.25 ? 'crit' : 'low';
};
// ป้ายสีของแต่ละระดับ: ปกติ=เขียว ใกล้หมด=เหลือง เหลือน้อยมาก=ส้ม หมด=แดง
const TAGC = { ok: 'grn', low: 'amb', crit: 'org', out: 'red' };
// ข้อความระดับสถานะ (ใช้ในหน้าพนักงาน)
const LVN = { ok: 'ปกติ', low: 'ใกล้หมด', crit: 'เหลือน้อยมาก', out: 'หมด' };
