document.addEventListener('DOMContentLoaded', function() {
    console.log('Auth page loaded - Supabase:', window.supabaseClient);
    
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const switchLink = document.getElementById('switch-link');
    
    if (!window.supabaseClient) {
        alert('خطأ: Supabase غير مهيئ. تحديث الصفحة.');
        return;
    }

    // تبديل النماذج
    switchLink.addEventListener('click', function(e) {
        e.preventDefault();
        const isLogin = loginForm.style.display !== 'none';
        
        loginForm.style.display = isLogin ? 'none' : 'block';
        signupForm.style.display = isLogin ? 'block' : 'none';
        document.getElementById('form-title').textContent = isLogin ? 'إنشاء حساب' : 'تسجيل الدخول';
        document.getElementById('switch-text').innerHTML = isLogin 
            ? 'لديك حساب؟ <a href="#" id="switch-link">تسجيل الدخول</a>'
            : 'ليس لديك حساب؟ <a href="#" id="switch-link">إنشاء حساب</a>';
    });

    // تسجيل الدخول
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const btn = this.querySelector('button');
        
        btn.disabled = true;
        btn.textContent = 'جاري التسجيل...';
        
        try {
            const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });
            
            if (error) throw error;
            
            showMessage('تم الدخول بنجاح!', 'success');
            setTimeout(() => window.location.href = 'dashboard.html', 1000);
            
        } catch (error) {
            showMessage(translateError(error.message), 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'تسجيل الدخول';
        }
    });

    // إنشاء حساب - هذا هو الجزء الأهم!
    signupForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const referralCode = document.getElementById('referral-code').value;
        const btn = this.querySelector('button');
        
        btn.disabled = true;
        btn.textContent = 'جاري الإنشاء...';
        
        try {
            // 1. إنشاء المستخدم في المصادقة
            const { data: authData, error: authError } = await window.supabaseClient.auth.signUp({
                email: email,
                password: password
            });
            
            if (authError) throw authError;
            if (!authData.user) throw new Error('فشل إنشاء المستخدم');
            
            // 2. إنشاء البروفايل في جدول profiles
            const { error: profileError } = await window.supabaseClient
                .from('profiles')
                .insert([
                    { 
                        id: authData.user.id,
                        email: email,
                        created_at: new Date().toISOString()
                    }
                ]);
            
            if (profileError) {
                console.error('Profile error:', profileError);
                // نستمر حتى لو فشل إنشاء البروفايل
            }
            
            // 3. إذا كان هناك كود إحالة، نعالجه
            if (referralCode.trim()) {
                await handleReferral(authData.user.id, referralCode);
            }
            
            showMessage('تم إنشاء الحساب! تأكد من بريدك.', 'success');
            this.reset();
            
        } catch (error) {
            console.error('Signup error:', error);
            showMessage(translateError(error.message), 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'إنشاء حساب';
        }
    });

    async function handleReferral(userId, referralCode) {
        try {
            // البحث عن صاحب كود الإحالة
            const { data: referrer, error } = await window.supabaseClient
                .from('profiles')
                .select('id')
                .eq('referral_code', referralCode)
                .single();
            
            if (error || !referrer) {
                console.log('كود إحالة غير صحيح:', referralCode);
                return;
            }
            
            // حفظ علاقة الإحالة
            const { error: refError } = await window.supabaseClient
                .from('referrals')
                .insert([
                    { 
                        referrer_id: referrer.id,
                        referred_id: userId,
                        level: 1,
                        created_at: new Date().toISOString()
                    }
                ]);
            
            if (refError) throw refError;
            
        } catch (error) {
            console.error('Referral error:', error);
        }
    }

    function showMessage(msg, type) {
        const el = document.getElementById('auth-message');
        el.textContent = msg;
        el.className = `message ${type}`;
        el.style.display = 'block';
        setTimeout(() => el.style.display = 'none', 5000);
    }

    function translateError(msg) {
        const errors = {
            'Invalid login credentials': 'بيانات الدخول خاطئة',
            'User already registered': 'الحساب موجود بالفعل',
            'Email not confirmed': 'يجب تأكيد البريد أولاً'
        };
        return errors[msg] || msg;
    }
});
