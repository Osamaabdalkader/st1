// انتظر حتى يتم تحميل كل شيء
document.addEventListener('DOMContentLoaded', function() {
    console.log('Auth page loaded');
    
    // الانتظار قليلاً لضمان تحميل Supabase
    setTimeout(initializeAuth, 100);
});

function initializeAuth() {
    // فحص وجود Supabase
    if (typeof window.supabaseClient === 'undefined') {
        console.error('Supabase client is not available!');
        
        // محاولة تهيئة Supabase مباشرة
        try {
            window.supabaseClient = supabase.createClient(
                'https://twbpfuzvxneuuttilbdh.supabase.co',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3YnBmdXp2eG5ldXV0dGlsYmRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MTc4NTksImV4cCI6MjA3NDQ5Mzg1OX0.9QjiUIWExB5acoz98tGep0TMxrduM6SeHcpRkDRe2CA'
            );
            console.log('Supabase initialized directly');
        } catch (error) {
            console.error('Failed to initialize Supabase:', error);
            showMessage('خطأ في تحميل النظام. يرجى تحديث الصفحة.', 'error');
            return;
        }
    }

    // عناصر DOM
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const formTitle = document.getElementById('form-title');
    const switchText = document.getElementById('switch-text');
    const switchLink = document.getElementById('switch-link');
    const authMessage = document.getElementById('auth-message');

    if (!loginForm || !signupForm) {
        console.error('Forms not found!');
        return;
    }

    console.log('All DOM elements found');

    let isLoginMode = true;

    // تبديل بين تسجيل الدخول وإنشاء حساب
    switchLink.addEventListener('click', function(e) {
        e.preventDefault();
        toggleAuthMode();
    });

    // تسجيل الدخول
    loginForm.addEventListener('submit', handleLogin);

    // إنشاء حساب
    signupForm.addEventListener('submit', handleSignup);

    function toggleAuthMode() {
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
        
        // إعادة تعيين
        clearMessage();
        loginForm.reset();
        signupForm.reset();
    }

    async function handleLogin(e) {
        e.preventDefault();
        console.log('Login attempt');
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        if (!email || !password) {
            showMessage('يرجى ملء جميع الحقول', 'error');
            return;
        }

        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'جاري تسجيل الدخول...';
        submitBtn.disabled = true;

        try {
            console.log('Attempting login with:', email);
            
            const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                console.error('Login error:', error);
                throw error;
            }

            console.log('Login successful:', data);
            showMessage('تم تسجيل الدخول بنجاح!', 'success');

            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);

        } catch (error) {
            console.error('Login failed:', error);
            showMessage(translateError(error.message), 'error');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    async function handleSignup(e) {
        e.preventDefault();
        console.log('Signup attempt');
        
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const referralCode = document.getElementById('referral-code').value;

        if (!email || !password) {
            showMessage('يرجى ملء جميع الحقول الإلزامية', 'error');
            return;
        }

        const submitBtn = signupForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'جاري إنشاء الحساب...';
        submitBtn.disabled = true;

        try {
            console.log('Attempting signup with:', email);
            
            const { data, error } = await window.supabaseClient.auth.signUp({
                email: email,
                password: password,
                options: {
                    emailRedirectTo: window.location.origin + '/dashboard.html'
                }
            });

            if (error) {
                console.error('Signup error:', error);
                throw error;
            }

            console.log('Signup successful:', data);

            // إنشاء الملف الشخصي
            if (data.user) {
                await createUserProfile(data.user);
                
                // معالجة كود الإحالة إذا وجد
                if (referralCode && referralCode.trim() !== '') {
                    await processReferral(data.user.id, referralCode);
                }
            }

            showMessage('تم إنشاء الحساب بنجاح! يرجى التحقق من بريدك الإلكتروني.', 'success');
            signupForm.reset();

        } catch (error) {
            console.error('Signup failed:', error);
            showMessage(translateError(error.message), 'error');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    async function createUserProfile(user) {
        try {
            const { error } = await window.supabaseClient
                .from('profiles')
                .insert([
                    { 
                        id: user.id,
                        email: user.email,
                        created_at: new Date().toISOString()
                    }
                ]);

            if (error) {
                console.error('Error creating profile:', error);
                // لا نرمي الخطأ لأن المستخدم أنشئ بنجاح حتى لو فشل إنشاء البروفايل
            } else {
                console.log('Profile created successfully');
            }
        } catch (error) {
            console.error('Exception creating profile:', error);
        }
    }

    async function processReferral(userId, referralCode) {
        try {
            // البحث عن صاحب كود الإحالة
            const { data: referrer, error } = await window.supabaseClient
                .from('profiles')
                .select('id')
                .eq('referral_code', referralCode)
                .single();

            if (error || !referrer) {
                console.warn('Invalid referral code:', referralCode);
                return;
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

            if (insertError) {
                console.error('Error saving referral:', insertError);
            } else {
                console.log('Referral saved successfully');
            }
        } catch (error) {
            console.error('Exception processing referral:', error);
        }
    }

    function showMessage(message, type) {
        if (authMessage) {
            authMessage.textContent = message;
            authMessage.className = `message ${type}`;
            authMessage.style.display = 'block';
            
            setTimeout(() => {
                authMessage.style.display = 'none';
            }, 5000);
        } else {
            alert(message); // fallback
        }
    }

    function clearMessage() {
        if (authMessage) {
            authMessage.textContent = '';
            authMessage.className = 'message';
            authMessage.style.display = 'none';
        }
    }

    function translateError(errorMessage) {
        const errorMap = {
            'Invalid login credentials': 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
            'Email not confirmed': 'يرجى تأكيد بريدك الإلكتروني أولاً',
            'User already registered': 'هذا البريد الإلكتروني مسجل بالفعل',
            'Weak password': 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
            'Invalid email': 'البريد الإلكتروني غير صالح',
            'To signup, please provide your email and password': 'يرجى إدخال البريد الإلكتروني وكلمة المرور'
        };
        
        return errorMap[errorMessage] || errorMessage;
    }
}
