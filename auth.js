// التحويل بين نموذج تسجيل الدخول وإنشاء حساب
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const formTitle = document.getElementById('form-title');
    const switchText = document.getElementById('switch-text');
    const switchLink = document.getElementById('switch-link');
    const authMessage = document.getElementById('auth-message');
    
    let isLoginMode = true;
    
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
        
        // إعادة تعيين الرسالة
        authMessage.textContent = '';
        authMessage.className = 'message';
        
        // إعادة تعيين النماذج
        loginForm.reset();
        signupForm.reset();
    });
    
    // تسجيل الدخول
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });
            
            if (error) throw error;
            
            // تسجيل الدخول ناجح، إعادة التوجيه إلى لوحة التحكم
            window.location.href = 'dashboard.html';
        } catch (error) {
            showMessage(error.message, 'error');
        }
    });
    
    // إنشاء حساب
    signupForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const referralCode = document.getElementById('referral-code').value;
        
        try {
            // إنشاء حساب المستخدم
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    emailRedirectTo: window.location.origin + '/dashboard.html'
                }
            });
            
            if (error) throw error;
            
            // إذا كان هناك كود إحالة، حفظه في قاعدة البيانات
            if (referralCode) {
                await saveReferralCode(data.user.id, referralCode);
            }
            
            showMessage('تم إنشاء الحساب بنجاح! يرجى التحقق من بريدك الإلكتروني لتأكيد الحساب.', 'success');
            signupForm.reset();
        } catch (error) {
            showMessage(error.message, 'error');
        }
    });
    
    function showMessage(message, type) {
        authMessage.textContent = message;
        authMessage.className = `message ${type}`;
    }
    
    async function saveReferralCode(userId, referralCode) {
        // البحث عن المستخدم الذي يملك كود الإحالة
        const { data: referrer, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('referral_code', referralCode)
            .single();
            
        if (error || !referrer) {
            throw new Error('كود الإحالة غير صحيح');
        }
        
        // حفظ علاقة الإحالة
        const { error: insertError } = await supabase
            .from('referrals')
            .insert([
                { 
                    referrer_id: referrer.id, 
                    referred_id: userId,
                    level: 1
                }
            ]);
            
        if (insertError) throw insertError;
    }
});