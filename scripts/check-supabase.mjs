/** Read-only Supabase smoke check — never prints keys and never modifies data. */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const env = {};
for (const filename of ['.env', '.env.local']) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(VITE_SUPABASE_[A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^(?:"|')|(?:"|')$/g, '');
  }
}
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const fail = (message) => { console.error('❌ ' + message); process.exitCode = 1; };
if (!url || !key || url.includes('YOUR_PROJECT_REF') || key.includes('YOUR_PUBLIC')) {
  fail('لم تُضبط إعدادات قاعدة البيانات بعد. انسخي .env.example إلى .env.local واملئي Project URL وPublishable key.');
} else {
  let origin;
  try { origin = new URL(url); } catch { fail('Project URL ليس عنوانًا صحيحًا.'); }
  if (origin && origin.protocol !== 'https:') fail('يجب أن يستخدم Project URL بروتوكول HTTPS.');
  if (origin && origin.protocol === 'https:') {
    const tables = ['doctors', 'teachers', 'teacher_groups'];
    console.log('التحقق من الاتصال (قراءة فقط، بلا حفظ لبيانات)...');
    let passed = 0;
    for (const table of tables) {
      try {
        const response = await fetch(`${origin.origin}/rest/v1/${table}?select=id&limit=1`, {
          headers: { apikey: key, ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}), Accept: 'application/json' },
          signal: AbortSignal.timeout(12000),
        });
        if (response.ok) {
          console.log(`✅ ${table}: قابل للقراءة من الاتصال العام (وجود سجلات غير مضمون)`);
          passed++;
        } else {
          let body = {};
          try { body = await response.json(); } catch { /* no body */ }
          const explanation = response.status === 401 || response.status === 403
            ? 'راجعي المفتاح العام أو صلاحيات RLS / Data API.'
            : response.status === 404 ? 'راجعي رابط المشروع والجداول وData API.'
            : 'راجعي تنفيذ migrations وسياسات الوصول.';
          console.error(`❌ ${table}: HTTP ${response.status} ${body.code || ''} — ${explanation}`);
          process.exitCode = 1;
        }
      } catch (error) {
        console.error(`❌ ${table}: تعذر الاتصال. ${error?.name === 'TimeoutError' ? 'انتهت مهلة الاتصال.' : 'راجعي الإنترنت ورابط Supabase.'}`);
        process.exitCode = 1;
      }
    }
    if (passed === tables.length) {
      console.log('\n✅ الاتصال العام بالجداول الأساسية يعمل.');
      console.log('⚠️ هذا ليس اختبارًا لتسجيل الدخول أو الحجوزات أو الصلاحيات أو التزامن. اختبريها وفق الدليل.');
    }
  }
}
