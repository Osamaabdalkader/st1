// js/auth.js - محدث وكامل
document.addEventListener('DOMContentLoaded', function() {
    // فحص تهيئة Supabase
    console.log('Checking Supabase initialization...');
    console.log('supabase object:', window.supabaseClient);
    
    if (!window.supabaseClient) {
        console.error('Supabase client is not initialized!');
        showMessage('خطأ في تهيئة النظام. يرجى تحديث الصفحة.', 'error');
        return;
    }

    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const formTitle = document.getElementById('form-title');
    const switchText = document.getElementById('switch-text');
    const switchLink = document.getElementById('switch-link');
    const authMessage = document.getElementById('auth-message');
    
    let isLoginMode = true;
    
    // وظيفة تبديل النماذج
    switchLink.addEventListener('click', function(e) {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        
        if (isLoginMode) {
            loginForm.style.display = 'block';
            signupForm.style.display = 'none';
            formTitle.textContent = 'تسجيل الدخول';
            switchText.innerHTML = 'ليس لديك حساب؟ <a href="#" id="switch-link">إنشاء حساب</a>';
        } else {
            loginForm.style.display = 'none';
            signupForm.style.display = 'block';
            formTitle.textContent = 'إنشاء حساب';
            switchText.innerHTML = 'لديك حساب بالفعل؟ <a href="#" id="switch-link">تسجيل الدخول</a>';
        }
        
        // إعادة تعيين الرسالة والنماذج
        authMessage.textContent = '';
        authMessage.className = 'message';
        loginForm.reset();
        signupForm.reset();
    });
    
    // تسجيل الدخول
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        // عرض تحميل
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'جاري تسجيل الدخول...';
        submitBtn.disabled = true;
        
        try {
            const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });
            
            if (error) {
                throw error;
            }
            
            showMessage('تم تسجيل الدخول بنجاح!', 'success');
            
            // الانتقال إلى لوحة التحكم بعد ثانية
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
            
        } catch (error) {
            console.error('Login error:', error);
            showMessage(getErrorMessage(error), 'error');
        } finally {
            // إعادة زر الإرسال إلى حالته الأصلية
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
    
    // إنشاء حساب
    signupForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const referralCode = document.getElementById('referral-code').value;
        
        // عرض تحميل
        const submitBtn = signupForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'جاري إنشاء الحساب...';
        submitBtn.disabled = true;
        
        try {
            const { data, error } = await window.supabaseClient.auth.signUp({
                email: email,
                password: password,
                options: {
                    emailRedirectTo: window.location.origin + '/dashboard.html'
                }
            });
            
            if (error) {
                throw error;
            }
            
            // إنشاء الملف الشخصي للمستخدم
            if (data.user) {
                await createUserProfile(data.user.id, data.user.email);
                
                // إذا كان هناك كود إحالة، حفظه
                if (referralCode.trim() !== '') {
                    await saveReferralCode(data.user.id, referralCode);
                }
            }
            
            showMessage('تم إنشاء الحساب بنجاح! يرجى التحقق من بريدك الإلكتروني لتأكيد الحساب.', 'success');
            signupForm.reset();
            
        } catch (error) {
            console.error('Signup error:', error);
            showMessage(getErrorMessage(error), 'error');
        } finally {
            // إعادة زر الإرسال إلى حالته الأصلية
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
    
    // وظيفة إنشاء الملف الشخصي
    async function createUserProfile(userId, email) {
        try {
            const { error } = await window.supabaseClient
                .from('profiles')
                .insert([
                    { 
                        id: userId,
                        email: email,
                        created_at: new Date().toISOString()
                    }
                ]);
                
            if (error) throw error;
            
        } catch (error) {
            console.error('Error creating profile:', error);
            throw error;
        }
    }
    
    // وظيفة حفظ كود الإحالة
    async function saveReferralCode(userId, referralCode) {
        try {
            // البحث عن المستخدم الذي يملك كود الإحالة
            const { data: referrer, error } = await window.supabaseClient
                .from('profiles')
                .select('id')
                .eq('referral_code', referralCode)
                .single();
                
            if (error || !referrer) {
                throw new Error('كود الإحالة غير صحيح');
            }
            
            // حفظ علاقة الإحالة
            const { error: insertError } = await window.supabaseClient
                .from('referrals')
                .insert([
                    { 
                        referrer_id: referrer.id, 
                        referred_id: userId,
                        level: 1,
                        created_at: new Date().toISOString()
                    }
                ]);
                
            if (insertError) throw insertError;
            
        } catch (error) {
            console.error('Error saving referral:', error);
            throw error;
        }
    }
    
    // وظيفة عرض الرسائل
    function showMessage(message, type) {
        authMessage.textContent = message;
        authMessage.className = `message ${type}`;
        authMessage.style.display = 'block';
        
        // إخفاء الرسالة بعد 5 ثواني
        setTimeout(() => {
            authMessage.style.display = 'none';
        }, 5000);
    }
    
    // وظيفة ترجمة رسائل الخطأ
    function getErrorMessage(error) {
        const errorMessages = {
            'Invalid login credentials': 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
            'Email not confirmed': 'يرجى تأكيد بريدك الإلكتروني أولاً',
            'User already registered': 'هذا البريد الإلكتروني مسجل بالفعل',
            'Weak password': 'كلمة المرور ضعيفة جداً',
            'Invalid email': 'البريد الإلكتروني غير صالح'
        };
        
        return errorMessages[error.message] || error.message;
    }
});
