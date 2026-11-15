// เชื่อมต่อ Supabase (ใช้ค่าจาก config.js) - ตัวแปร sb ใช้เรียกฐานข้อมูลทุกหน้า
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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
