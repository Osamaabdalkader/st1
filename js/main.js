// وظائف مساعدة عامة
console.log('Main JS loaded');

// فحص شامل لتهيئة Supabase
function initializeSupabase() {
    if (typeof window.supabaseClient !== 'undefined') {
        return window.supabaseClient;
    }
    
    try {
        window.supabaseClient = supabase.createClient(
            'https://twbpfuzvxneuuttilbdh.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3YnBmdXp2eG5ldXV0dGlsYmRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MTc4NTksImV4cCI6MjA3NDQ5Mzg1OX0.9QjiUIWExB5acoz98tGep0TMxrduM6SeHcpRkDRe2CA'
        );
        console.log('Supabase initialized successfully');
        return window.supabaseClient;
    } catch (error) {
        console.error('Failed to initialize Supabase:', error);
        return null;
    }
}

// استدعاء التهيئة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    initializeSupabase();
});        
        // إخفاء الرسالة بعد 5 ثواني
        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    }
      }
