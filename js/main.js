// js/main.js - وظائف عامة

// فحص حالة المستخدم
async function checkAuth() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        return session;
    } catch (error) {
        console.error('Error checking auth:', error);
        return null;
    }
}

// إعادة التوجيه إذا كان المستخدم مسجلاً الدخول
async function redirectIfAuthenticated() {
    const session = await checkAuth();
    if (session) {
        window.location.href = 'dashboard.html';
    }
}

// إعادة التوجيه إذا لم يكن المستخدم مسجلاً الدخول
async function redirectIfNotAuthenticated() {
    const session = await checkAuth();
    if (!session) {
        window.location.href = 'auth.html';
    }
}

// عرض رسائل للمستخدم
function showMessage(elementId, message, type = 'info') {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.className = `message ${type}`;
        element.style.display = 'block';
        
        // إخفاء الرسالة بعد 5 ثواني
        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    }
      }
