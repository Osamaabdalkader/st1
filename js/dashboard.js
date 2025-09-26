// التأكد من أن المستخدم مسجل الدخول
document.addEventListener('DOMContentLoaded', async function() {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (!session) {
        window.location.href = 'auth.html';
        return;
    }
    
    // تعيين بيانات المستخدم
    document.getElementById('user-email').textContent = session.user.email;
    
    // تحميل بيانات المستخدم وشبكة الإحالة
    await loadUserData(session.user.id);
    await loadReferralNetwork(session.user.id);
    
    // إعداد زر تسجيل الخروج
    document.getElementById('logout-btn').addEventListener('click', async function() {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    });
    
    // إعداد زر نسخ كود الإحالة
    document.getElementById('copy-referral-code').addEventListener('click', function() {
        const referralCode = document.getElementById('user-referral-code').textContent;
        navigator.clipboard.writeText(referralCode).then(function() {
            alert('تم نسخ كود الإحالة بنجاح!');
        });
    });
});

// تحميل بيانات المستخدم
async function loadUserData(userId) {
    try {
        // الحصول على الملف الشخصي للمستخدم
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('referral_code')
            .eq('id', userId)
            .single();
            
        if (error) throw error;
        
        document.getElementById('user-referral-code').textContent = profile.referral_code;
        
        // حساب عدد الإحالات
        await calculateReferralStats(userId);
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// حساب إحصائيات الإحالة
async function calculateReferralStats(userId) {
    try {
        // المستوى الأول: المستخدمون الذين أحالهم المستخدم مباشرة
        const { data: level1, error: level1Error } = await supabase
            .from('referrals')
            .select('referred_id')
            .eq('referrer_id', userId)
            .eq('level', 1);
            
        if (level1Error) throw level1Error;
        
        document.getElementById('level1-referrals').textContent = level1 ? level1.length : 0;
        
        // إجمالي الإحالات عبر جميع المستويات
        const { data: allReferrals, error: allError } = await supabase
            .from('referrals')
            .select('referred_id')
            .eq('referrer_id', userId);
            
        if (allError) throw allError;
        
        document.getElementById('total-referrals').textContent = allReferrals ? allReferrals.length : 0;
    } catch (error) {
        console.error('Error calculating referral stats:', error);
    }
}

// تحميل شبكة الإحالة
async function loadReferralNetwork(userId) {
    try {
        // المستوى الأول
        const level1Referrals = await getReferralsByLevel(userId, 1);
        displayReferrals('level1-list', level1Referrals);
        
        // المستوى الثاني
        const level2Referrals = await getReferralsByLevel(userId, 2);
        displayReferrals('level2-list', level2Referrals);
        
        // المستوى الثالث
        const level3Referrals = await getReferralsByLevel(userId, 3);
        displayReferrals('level3-list', level3Referrals);
    } catch (error) {
        console.error('Error loading referral network:', error);
    }
}

// الحصول على الإحالات حسب المستوى
async function getReferralsByLevel(userId, level) {
    try {
        const { data, error } = await supabase
            .from('referrals')
            .select(`
                referred_id,
                profiles:referred_id (email, created_at)
            `)
            .eq('referrer_id', userId)
            .eq('level', level);
            
        if (error) throw error;
        
        return data;
    } catch (error) {
        console.error(`Error getting level ${level} referrals:`, error);
        return [];
    }
}

// عرض الإحالات في القائمة
function displayReferrals(containerId, referrals) {
    const container = document.getElementById(containerId);
    
    if (!referrals || referrals.length === 0) {
        container.innerHTML = '<p>لا توجد إحالات في هذا المستوى</p>';
        return;
    }
    
    let html = '';
    referrals.forEach(referral => {
        const date = new Date(referral.profiles.created_at).toLocaleDateString('ar-EG');
        html += `
            <div class="referral-item">
                <strong>${referral.profiles.email}</strong>
                <br>
                <small>انضم في: ${date}</small>
            </div>
        `;
    });
    
    container.innerHTML = html;
}