// dashboard.js - محدث وكامل
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard loaded');
    
    if (!window.supabaseClient) {
        alert('خطأ في التهيئة. يرجى تحديث الصفحة.');
        return;
    }

    initializeDashboard();
});

async function initializeDashboard() {
    try {
        // التحقق من المصادقة
        const { data: { session }, error } = await window.supabaseClient.auth.getSession();
        
        if (error || !session) {
            window.location.href = 'auth.html';
            return;
        }

        console.log('User:', session.user);
        document.getElementById('user-email').textContent = session.user.email;

        // تحميل جميع البيانات
        await Promise.all([
            loadUserProfile(session.user.id),
            loadReferralStats(session.user.id),
            loadReferralTree(session.user.id),
            loadReferralsTable(session.user.id)
        ]);

        // إعداد الأحداث
        setupEventListeners(session.user.id);

    } catch (error) {
        console.error('Dashboard initialization error:', error);
        alert('حدث خطأ في تحميل البيانات');
    }
}

async function loadUserProfile(userId) {
    try {
        const { data: profile, error } = await window.supabaseClient
            .from('profiles')
            .select('referral_code, created_at')
            .eq('id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                await createUserProfile(userId);
                setTimeout(() => loadUserProfile(userId), 1000);
                return;
            }
            throw error;
        }

        document.getElementById('user-referral-code').textContent = profile.referral_code || 'جاري التوليد...';
        
        if (!profile.referral_code) {
            setTimeout(() => loadUserProfile(userId), 2000);
        }

    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

async function createUserProfile(userId) {
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        
        const { error } = await window.supabaseClient
            .from('profiles')
            .insert([{ 
                id: userId, 
                email: user.email,
                created_at: new Date().toISOString()
            }]);

        if (error) throw error;
        
    } catch (error) {
        console.error('Error creating profile:', error);
    }
}

async function loadReferralStats(userId) {
    try {
        // إحصائيات المستوى الأول
        const { data: level1, error: e1 } = await window.supabaseClient
            .from('referrals')
            .select('id')
            .eq('referrer_id', userId)
            .eq('level', 1);

        if (!e1) document.getElementById('level1-referrals').textContent = level1?.length || 0;

        // المستوى الثاني
        const { data: level2, error: e2 } = await window.supabaseClient
            .from('referrals')
            .select('id')
            .eq('referrer_id', userId)
            .eq('level', 2);

        if (!e2) document.getElementById('level2-referrals').textContent = level2?.length || 0;

        // المستوى الثالث
        const { data: level3, error: e3 } = await window.supabaseClient
            .from('referrals')
            .select('id')
            .eq('referrer_id', userId)
            .eq('level', 3);

        if (!e3) document.getElementById('level3-referrals').textContent = level3?.length || 0;

        // الإجمالي
        const { data: all, error: e4 } = await window.supabaseClient
            .from('referrals')
            .select('id')
            .eq('referrer_id', userId);

        if (!e4) document.getElementById('total-referrals').textContent = all?.length || 0;

    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadReferralTree(userId) {
    try {
        const treeData = await buildReferralTree(userId, 3);
        renderTree(treeData, document.getElementById('tree-view'));
        
    } catch (error) {
        console.error('Error loading tree:', error);
        document.getElementById('tree-view').innerHTML = '<p>خطأ في تحميل الشجرة</p>';
    }
}

async function buildReferralTree(userId, maxLevel, currentLevel = 0) {
    if (currentLevel >= maxLevel) return null;

    const { data: referrals, error } = await window.supabaseClient
        .from('referrals')
        .select(`
            referred_id,
            level,
            profiles:referred_id (email, referral_code, created_at)
        `)
        .eq('referrer_id', userId)
        .eq('level', currentLevel + 1);

    if (error || !referrals) return null;

    const node = {
        id: userId,
        level: currentLevel,
        children: []
    };

    for (const ref of referrals) {
        const childNode = {
            id: ref.referred_id,
            email: ref.profiles.email,
            referral_code: ref.profiles.referral_code,
            join_date: ref.profiles.created_at,
            level: ref.level,
            children: await buildReferralTree(ref.referred_id, maxLevel, currentLevel + 1)
        };
        node.children.push(childNode);
    }

    return node;
}

function renderTree(treeData, container) {
    if (!treeData || !treeData.children || treeData.children.length === 0) {
        container.innerHTML = '<p>لا توجد إحالات حتى الآن</p>';
        return;
    }

    container.innerHTML = '';
    renderTreeNode(treeData, container, 0);
}

function renderTreeNode(node, container, depth) {
    if (!node.children) return;

    node.children.forEach(child => {
        const nodeElement = document.createElement('div');
        nodeElement.className = 'tree-node';
        
        const hasChildren = child.children && child.children.length > 0;
        
        nodeElement.innerHTML = `
            <div class="node-content" data-node-id="${child.id}">
                <i class="fas fa-user${hasChildren ? '-friends' : ''}"></i>
                <div class="node-info">
                    <strong>${child.email}</strong>
                    <small>المستوى: ${child.level} | الانضمام: ${new Date(child.join_date).toLocaleDateString('ar-EG')}</small>
                </div>
                ${hasChildren ? '<i class="fas fa-chevron-down toggle-icon"></i>' : ''}
            </div>
            ${hasChildren ? '<div class="node-children"></div>' : ''}
        `;

        container.appendChild(nodeElement);

        if (hasChildren) {
            const toggleBtn = nodeElement.querySelector('.toggle-icon');
            const childrenContainer = nodeElement.querySelector('.node-children');
            
            toggleBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                nodeElement.classList.toggle('node-expanded');
                nodeElement.classList.toggle('node-collapsed');
                toggleBtn.classList.toggle('fa-chevron-down');
                toggleBtn.classList.toggle('fa-chevron-up');
            });

            renderTreeNode(child, childrenContainer, depth + 1);
        }
    });
}

async function loadReferralsTable(userId) {
    try {
        const { data: referrals, error } = await window.supabaseClient
            .from('referrals')
            .select(`
                id,
                level,
                created_at,
                profiles:referred_id (email, referral_code, created_at)
            `)
            .eq('referrer_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        renderReferralsTable(referrals || []);

        // إعداد البحث والتصفية
        setupTableFilters(referrals || [], userId);

    } catch (error) {
        console.error('Error loading table data:', error);
        document.getElementById('referrals-tbody').innerHTML = 
            '<tr><td colspan="6" style="text-align: center;">خطأ في تحميل البيانات</td></tr>';
    }
}

function renderReferralsTable(referrals) {
    const tbody = document.getElementById('referrals-tbody');
    
    if (referrals.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">لا توجد إحالات حتى الآن</td></tr>';
        return;
    }

    tbody.innerHTML = referrals.map((ref, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>
                <i class="fas fa-envelope"></i>
                ${ref.profiles.email}
            </td>
            <td>${new Date(ref.profiles.created_at).toLocaleDateString('ar-EG')}</td>
            <td>
                <span class="status-badge">المستوى ${ref.level}</span>
            </td>
            <td>
                <span class="status-badge status-active">نشط</span>
            </td>
            <td>
                <button class="btn-action" title="عرض التفاصيل">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn-action" title="إرسال رسالة">
                    <i class="fas fa-envelope"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function setupTableFilters(originalData, userId) {
    const searchInput = document.getElementById('search-referrals');
    const levelFilter = document.getElementById('level-filter');

    function filterTable() {
        const searchTerm = searchInput.value.toLowerCase();
        const levelValue = levelFilter.value;

        const filtered = originalData.filter(ref => {
            const matchesSearch = ref.profiles.email.toLowerCase().includes(searchTerm);
            const matchesLevel = !levelValue || ref.level.toString() === levelValue;
            return matchesSearch && matchesLevel;
        });

        renderReferralsTable(filtered);
    }

    searchInput.addEventListener('input', filterTable);
    levelFilter.addEventListener('change', filterTable);
}

function setupEventListeners(userId) {
    // نسخ كود الإحالة
    document.getElementById('copy-referral-code').addEventListener('click', function() {
        const code = document.getElementById('user-referral-code').textContent;
        navigator.clipboard.writeText(code).then(() => {
            alert('تم نسخ كود الإحالة: ' + code);
        });
    });

    // زر العرض الشجري
    document.getElementById('toggle-tree-view').addEventListener('click', function() {
        const treeView = document.getElementById('tree-view');
        treeView.style.display = treeView.style.display === 'none' ? 'block' : 'none';
        this.innerHTML = treeView.style.display === 'none' ? 
            '<i class="fas fa-expand"></i> عرض شجري' : 
            '<i class="fas fa-compress"></i> إخفاء الشجرة';
    });

    // تسجيل الخروج
    document.getElementById('logout-btn').addEventListener('click', async function() {
        if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
            await window.supabaseClient.auth.signOut();
            window.location.href = 'index.html';
        }
    });

    // تحديث تلقائي كل 30 ثانية
    setInterval(() => {
        loadReferralStats(userId);
    }, 30000);
            }
