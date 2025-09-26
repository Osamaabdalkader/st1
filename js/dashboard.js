document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard page loaded');
    
    // الانتظار لضمان تحميل Supabase
    setTimeout(initializeDashboard, 100);
});

function initializeDashboard() {
    // محاولة تهيئة Supabase إذا لم يكن موجوداً
    if (typeof window.supabaseClient === 'undefined') {
        try {
            window.supabaseClient = supabase.createClient(
                'https://twbpfuzvxneuuttilbdh.supabase.co',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3YnBmdXp2eG5ldXV0dGlsYmRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MTc4NTksImV4cCI6MjA3NDQ5Mzg1OX0.9QjiUIWExB5acoz98tGep0TMxrduM6SeHcpRkDRe2CA'
            );
            console.log('Supabase initialized in dashboard');
        } catch (error) {
            console.error('Failed to initialize Supabase in dashboard:', error);
            window.location.href = 'auth.html';
            return;
        }
    }

    checkAuthAndLoadData();
}

async function checkAuthAndLoadData() {
    try {
        const { data: { session }, error } = await window.supabaseClient.auth.getSession();
        
        if (error || !session) {
            console.error('No session found, redirecting to auth');
            window.location.href = 'auth.html';
            return;
        }

        console.log('User session found:', session.user.email);
        
        // تعيين بيانات المستخدم
        document.getElementById('user-email').textContent = session.user.email;
        
        // تحميل البيانات
        await loadUserData(session.user.id);
        await loadReferralNetwork(session.user.id);
        
        // إعداد الأحداث
        setupEventListeners();

    } catch (error) {
        console.error('Error in checkAuthAndLoadData:', error);
        window.location.href = 'auth.html';
    }
}

async function loadUserData(userId) {
    try {
        const { data: profile, error } = await window.supabaseClient
            .from('profiles')
            .select('referral_code, created_at')
            .eq('id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') { // لا يوجد سجل
                await createUserProfile(userId);
                // إعادة المحاولة بعد إنشاء البروفايل
                setTimeout(() => loadUserData(userId), 1000);
                return;
            }
            throw error;
        }

        document.getElementById('user-referral-code').textContent = profile.referral_code || 'جاري التوليد...';
        
        // إذا لم يكن هناك كود، إعادة المحاولة بعد قليل
        if (!profile.referral_code) {
            setTimeout(() => loadUserData(userId), 2000);
        }

        await loadReferralStats(userId);

    } catch (error) {
        console.error('Error loading user data:', error);
        document.getElementById('user-referral-code').textContent = 'خطأ في التحميل';
    }
}

async function createUserProfile(userId) {
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        
        const { error } = await window.supabaseClient
            .from('profiles')
            .insert([
                { 
                    id: userId,
                    email: user.email,
                    created_at: new Date().toISOString()
                }
            ]);

        if (error) throw error;
        
        console.log('User profile created successfully');
    } catch (error) {
        console.error('Error creating user profile:', error);
    }
}

async function loadReferralStats(userId) {
    try {
        // المستوى الأول
        const { data: level1, error: level1Error } = await window.supabaseClient
            .from('referrals')
            .select('referred_id')
            .eq('referrer_id', userId)
            .eq('level', 1);

        if (!level1Error) {
            document.getElementById('level1-referrals').textContent = level1 ? level1.length : 0;
        }

        // المستوى الثاني
        const { data: level2, error: level2Error } = await window.supabaseClient
            .from('referrals')
            .select('referred_id')
            .eq('referrer_id', userId)
            .eq('level', 2);

        if (!level2Error) {
            document.getElementById('level2-referrals').textContent = level2 ? level2.length : 0;
        }

        // المستوى الثالث
        const { data: level3, error: level3Error } = await window.supabaseClient
            .from('referrals')
            .select('referred_id')
            .eq('referrer_id', userId)
            .eq('level', 3);

        if (!level3Error) {
            document.getElementById('level3-referrals').textContent = level3 ? level3.length : 0;
        }

        // الإجمالي
        const { data: allReferrals, error: allError } = await window.supabaseClient
            .from('referrals')
            .select('referred_id')
            .eq('referrer_id', userId);

        if (!allError) {
            document.getElementById('total-referrals').textContent = allReferrals ? allReferrals.length : 0;
        }

    } catch (error) {
        console.error('Error loading referral stats:', error);
    }
}

async function loadReferralNetwork(userId) {
    try {
        const [level1, level2, level3] = await Promise.all([
            getReferralsByLevel(userId, 1),
            getReferralsByLevel(userId, 2),
            getReferralsByLevel(userId, 3)
        ]);

        displayReferrals('level1-list', level1, 1);
        displayReferrals('level2-list', level2, 2);
        displayReferrals('level3-list', level3, 3);

    } catch (error) {
        console.error('Error loading referral network:', error);
    }
}

async function getReferralsByLevel(userId, level) {
    try {
        const { data, error } = await window.supabaseClient
            .from('referrals')
            .select(`
                referred_id,
                profiles:referred_id (email, created_at, referral_code)
            `)
            .eq('referrer_id', userId)
            .eq('level', level)
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        return data || [];

    } catch (error) {
        console.error(`Error getting level ${level} referrals:`, error);
        return [];
    }
}

function displayReferrals(containerId, referrals, level) {
    const container = document.getElementById(containerId);
    
    if (!container) {
        console.error(`Container ${containerId} not found`);
        return;
    }

    if (!referrals || referrals.length === 0) {
        container.innerHTML = '<div class="empty-state">لا توجد إحالات في هذا المستوى</div>';
        return;
    }

    let html = '';
    referrals.forEach((referral, index) => {
        const date = new Date(referral.profiles.created_at).toLocaleDateString('ar-EG');
        
        html += `
            <div class="referral-item">
                <div class="referral-header">
                    <span class="referral-number">${index + 1}</span>
                    <strong class="referral-email">${referral.profiles.email}</strong>
                </div>
                <div class="referral-details">
                    <small>انضم في: ${date}</small>
                    <small>كود: ${referral.profiles.referral_code || 'غير متوفر'}</small>
                </div>
                ${level < 3 ? `<button class="view-sub-referrals" data-user-id="${referral.referred_id}" data-level="${level}">عرض التابعين</button>` : ''}
            </div>
        `;
    });

    container.innerHTML = html;

    // إضافة event listeners للأزرار
    if (level < 3) {
        container.querySelectorAll('.view-sub-referrals').forEach(button => {
            button.addEventListener('click', function() {
                const userId = this.getAttribute('data-user-id');
                const currentLevel = parseInt(this.getAttribute('data-level'));
                showSubReferrals(userId, currentLevel + 1);
            });
        });
    }
}

async function showSubReferrals(userId, level) {
    try {
        const referrals = await getReferralsByLevel(userId, 1);
        
        if (referrals.length === 0) {
            alert('لا توجد إحالات تابعة لهذا العضو');
            return;
        }

        showModal(referrals, level);
        
    } catch (error) {
        console.error('Error showing sub referrals:', error);
        alert('حدث خطأ في تحميل الإحالات التابعة');
    }
}

function showModal(referrals, level) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>الإحالات التابعة - المستوى ${level}</h3>
                <span class="close">&times;</span>
            </div>
            <div class="modal-body">
                ${referrals.map((ref, i) => `
                    <div class="referral-item">
                        <strong>${ref.profiles.email}</strong>
                        <small>انضم في: ${new Date(ref.profiles.created_at).toLocaleDateString('ar-EG')}</small>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    modal.querySelector('.close').onclick = () => modal.remove();
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };

    document.body.appendChild(modal);
}

function setupEventListeners() {
    // تسجيل الخروج
    document.getElementById('logout-btn').addEventListener('click', async function() {
        const { error } = await window.supabaseClient.auth.signOut();
        if (!error) {
            window.location.href = 'index.html';
        }
    });

    // نسخ كود الإحالة
    document.getElementById('copy-referral-code').addEventListener('click', function() {
        const code = document.getElementById('user-referral-code').textContent;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(code).then(() => {
                alert('تم نسخ كود الإحالة!');
            });
        } else {
            // طريقة بديلة
            const temp = document.createElement('textarea');
            temp.value = code;
            document.body.appendChild(temp);
            temp.select();
            document.execCommand('copy');
            document.body.removeChild(temp);
            alert('تم نسخ كود الإحالة!');
        }
    });
}

// تحديث البيانات كل 30 ثانية
setInterval(async () => {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (session) {
        await loadReferralStats(session.user.id);
    }
}, 30000);
