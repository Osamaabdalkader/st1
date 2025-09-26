// js/supabase.js - التهيئة الصحيحة
const SUPABASE_URL = 'https://twbpfuzvxneuuttilbdh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3YnBmdXp2eG5ldXV0dGlsYmRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MTc4NTksImV4cCI6MjA3NDQ5Mzg1OX0.9QjiUIWExB5acoz98tGep0TMxrduM6SeHcpRkDRe2CA';

// تهيئة Supabase بشكل صحيح
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// تصدير المتغير للاستخدام في الملفات الأخرى
window.supabaseClient = supabase;
