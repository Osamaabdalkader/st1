// js/dashboard.js - مكتمل
document.addEventListener('DOMContentLoaded', async function() {
    // فحص التهيئة
    if (!window.supabaseClient) {
        console.error('Supabase client is not initialized!');
        window.location.href = 'auth.html';
        return;
    }

    // التحقق من جلسة المستخدم
    const { data: { session }, error } = await window.supabaseClient.auth.getSession();
    
    if (!session) {
        window.location.href = 'auth.html';
        return;
    }
    
    console.log('User session:', session);
    
    // تعيين بيانات المستخدم
    document.getElementById('user-email').textContent = session.user.email;
    
    // تحميل البيانات
    await loadUserData(session.user.id);
    await loadReferralNetwork(session.user.id);
    
    // إعداد زر تسجيل الخروج
    document.getElementById('logout-btn').addEventListener('click', async function() {
        const { error } = await window.supabaseClient.auth.signOut();
        if (!error) {
            window.location.href = 'index.html';
        }
    });
    
    // إعداد زر نسخ كود الإحالة
    document.getElementById('copy-referral-code').addEventListener('click', function() {
        const referralCode = document.getElementById('user-referral-code').textContent;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(referralCode).then(function() {
                showTempMessage('تم نسخ كود الإحالة بنجاح!', 'success');
            }).catch(function() {
                copyFallback(referralCode);
            });
        } else {
            copyFallback(referralCode);
        }
    });
});

// تحميل بيانات المستخدم
async function loadUserData(userId) {
    try {
        const { data: profile, error } = await window.supabaseClient
            .from('profiles')
            .select('referral_code, created_at')
            .eq('id', userId)
            .single();
            
        if (error) {
            // إذا لم يكن هناك ملف شخصي، إنشاء واحد
            if (error.code === 'PGRST116') {
                await createUserProfile(userId);
                await loadUserData(userId); // إعادة تحميل البيانات
                return;
            }
            throw error;
        }
        
        document.getElementById('user-referral-code').textContent = profile.referral_code || 'جاري التوليد...';
        
        // إذا لم يكن هناك كود إحالة، انتظر قليلاً ثم أعد المحاولة
        if (!profile.referral_code) {
            setTimeout(() => {
                loadUserData(userId);
            }, 2000);
        }
        
        await calculateReferralStats(userId);
    } catch (error) {
        console.error('Error loading user data:', error);
        document.getElementById('user-referral-code').textContent = 'خطأ في التحميل';
    }
}

// إنشاء ملف شخصي للمستخدم
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

// حساب إحصائيات الإحالة
async function calculateReferralStats(userId) {
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

        // إجمالي الإحالات
        const { data: allReferrals, error: allError } = await window.supabaseClient
            .from('referrals')
            .select('referred_id')
            .eq('referrer_id', userId);
            
        if (!allError) {
            document.getElementById('total-referrals').textContent = allReferrals ? allReferrals.length : 0;
        }
        
    } catch (error) {
        console.error('Error calculating referral stats:', error);
    }
}

// تحميل شبكة الإحالة
async function loadReferralNetwork(userId) {
    try {
        // المستوى الأول
        const level1Referrals = await getReferralsByLevel(userId, 1);
        displayReferrals('level1-list', level1Referrals, 1);
        
        // المستوى الثاني
        const level2Referrals = await getReferralsByLevel(userId, 2);
        displayReferrals('level2-list', level2Referrals, 2);
        
        // المستوى الثالث
        const level3Referrals = await getReferralsByLevel(userId, 3);
        displayReferrals('level3-list', level3Referrals, 3);
        
    } catch (error) {
        console.error('Error loading referral network:', error);
    }
}

// الحصول على الإحالات حسب المستوى
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

// عرض الإحالات في القائمة
function displayReferrals(containerId, referrals, level) {
    const container = document.getElementById(containerId);
    
    if (!referrals || referrals.length === 0) {
        container.innerHTML = '<div class="empty-state">لا توجد إحالات في هذا المستوى</div>';
        return;
    }
    
    let html = '';
    referrals.forEach((referral, index) => {
        const date = new Date(referral.profiles.created_at).toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        html += `
            <div class="referral-item">
                <div class="referral-header">
                    <span class="referral-number">${index + 1}</span>
                    <strong class="referral-email">${referral.profiles.email}</strong>
                </div>
                <div class="referral-details">
                    <small>انضم في: ${date}</small>
                    <small>كود الإحالة: ${referral.profiles.referral_code || 'غير متوفر'}</small>
                </div>
                ${level < 3 ? `<button class="view-sub-referrals" data-user-id="${referral.referred_id}" data-level="${level}">عرض الإحالات التابعة</button>` : ''}
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // إضافة event listeners للأزرار
    if (level < 3) {
        container.querySelectorAll('.view-sub-referrals').forEach(button => {
            button.addEventListener('click', function() {
                const referredUserId = this.getAttribute('data-user-id');
                const currentLevel = parseInt(this.getAttribute('data-level'));
                loadSubReferrals(referredUserId, currentLevel + 1);
            });
        });
    }
}

// تحميل الإحالات التابعة
async function loadSubReferrals(userId, level) {
    try {
        const referrals = await getReferralsByLevel(userId, 1); // دائماً المستوى الأول للعضو الفرعي
        
        if (referrals.length === 0) {
            alert('لا توجد إحالات تابعة لهذا العضو');
            return;
        }
        
        // إنشاء نافذة عرض للإحالات التابعة
        showSubReferralsModal(referrals, level);
        
    } catch (error) {
        console.error('Error loading sub-referrals:', error);
        alert('حدث خطأ في تحميل الإحالات التابعة');
    }
}

// عرض الإحالات التابعة في نافذة منبثقة
function showSubReferralsModal(referrals, level) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;
    
    let modalContent = `
        <div style="background: white; padding: 20px; border-radius: 10px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3>الإحالات التابعة - المستوى ${level}</h3>
                <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background: none; border: none; font-size: 20px; cursor: pointer;">×</button>
            </div>
            <div class="referrals-list">
    `;
    
    referrals.forEach((referral, index) => {
        const date = new Date(referral.profiles.created_at).toLocaleDateString('ar-EG');
        modalContent += `
            <div class="referral-item" style="padding: 10px; border-bottom: 1px solid #eee;">
                <strong>${referral.profiles.email}</strong>
                <br>
                <small>انضم في: ${date}</small>
            </div>
        `;
    });
    
    modalContent += `
            </div>
            <button onclick="this.parentElement.parentElement.remove()" style="margin-top: 20px; padding: 10px 20px; background: #4f46e5; color: white; border: none; border-radius: 5px; cursor: pointer;">إغلاق</button>
        </div>
    `;
    
    modal.innerHTML = modalContent;
    document.body.appendChild(modal);
    
    // إغلاق النافذة عند النقر خارجها
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// وظيفة نسخ احتياطية
function copyFallback(text) {
    const tempInput = document.createElement('input');
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    showTempMessage('تم نسخ كود الإحالة بنجاح!', 'success');
}

// عرض رسائل مؤقتة
function showTempMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 10px 20px;
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        border-radius: 5px;
        z-index: 1000;
    `;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

// تحديث البيانات كل 30 ثانية
setInterval(async () => {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (session) {
        await calculateReferralStats(session.user.id);
    }
}, 30000);
