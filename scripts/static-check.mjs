// Dependency-free structural smoke test. DOES NOT replace TypeScript, SQL or integration testing.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const root=process.cwd();
const src=join(root,'src');
let count=0;
let failures=0;
function walk(dir){for(const item of readdirSync(dir,{withFileTypes:true})){const file=join(dir,item.name);if(item.isDirectory())walk(file);else if(/\.tsx?$/.test(item.name)){count++;const s=readFileSync(file,'utf8');for(const importName of s.matchAll(/from ['"]@\/(.*?)['"]/g)){
 const target=join(src,importName[1]);if(!['.ts','.tsx','/index.ts','/index.tsx'].some(ext=>existsSync(target+ext))){console.error(`Missing import ${importName[1]} in ${file}`);failures++}
}}}}
walk(src);
const migrations=join(root,'supabase','migrations');
for(const key of ['book_appointment','enroll_in_group','cancel_group_enrollment','clinic_check_in','clinic_update_queue','teacher_mark_attendance','get_doctor_busy_intervals']){
 if(!readdirSync(migrations).some(file=>readFileSync(join(migrations,file),'utf8').includes(`FUNCTION public.${key}`))){console.error('Missing backend RPC:',key);failures++}
}
for(const path of ['src/pages/HomePage.tsx','src/pages/TeacherDashboardPage.tsx','src/pages/DoctorDashboardPage.tsx','src/pages/AdminPage.tsx','src/pages/DemoPage.tsx','src/pages/MyBookingsPage.tsx','.env.example','README.md']){
 if(!existsSync(join(root,path))){console.error('Missing required file:',path);failures++}
}
console.log(`Static check: ${count} source files reviewed; ${failures} problems.`);
console.log('Note: compile, deploy, database and concurrency behavior still need live testing.');
process.exitCode=failures?1:0;
