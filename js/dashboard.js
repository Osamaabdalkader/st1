// dashboard.js - مصحح لعرض جميع المستويات
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
        const { data: { session }, error } = await window.supabaseClient.auth.getSession();
        
        if (error || !session) {
            window.location.href = 'auth.html';
            return;
        }

        console.log('User:', session.user);
        document.getElementById('user-email').textContent = session.user.email;

        await Promise.all([
            loadUserProfile(session.user.id),
            loadReferralStats(session.user.id),
            loadAllReferralsForTable(session.user.id)
        ]);

        // تحميل الشجرة بعد تحميل البيانات الأساسية
        await loadReferralTree(session.user.id);
        
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

        if (error && error.code === 'PGRST116') {
            await createUserProfile(userId);
            setTimeout(() => loadUserProfile(userId), 1000);
            return;
        }

        if (profile) {
            document.getElementById('user-referral-code').textContent = profile.referral_code || 'جاري التوليد...';
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

        if (error) console.error('Profile creation error:', error);
        
    } catch (error) {
        console.error('Error creating profile:', error);
    }
}

async function loadReferralStats(userId) {
    try {
        console.log('Loading referral stats for user:', userId);
        
        // الحصول على جميع الإحالات بجميع المستويات
        const { data: allReferrals, error } = await window.supabaseClient
            .from('referrals')
            .select('level, referred_id')
            .eq('referrer_id', userId);

        if (error) {
            console.error('Error loading referrals:', error);
            return;
        }

        console.log('All referrals found:', allReferrals);

        // حساب الإحصائيات
        const level1Count = allReferrals.filter(ref => ref.level === 1).length;
        const level2Count = allReferrals.filter(ref => ref.level === 2).length;
        const level3Count = allReferrals.filter(ref => ref.level === 3).length;
        const totalCount = allReferrals.length;

        // تحديث الواجهة
        document.getElementById('level1-referrals').textContent = level1Count;
        document.getElementById('level2-referrals').textContent = level2Count;
        document.getElementById('level3-referrals').textContent = level3Count;
        document.getElementById('total-referrals').textContent = totalCount;

        console.log('Stats updated:', { level1Count, level2Count, level3Count, totalCount });

    } catch (error) {
        console.error('Error loading referral stats:', error);
    }
}

// دالة جديدة لبناء الشجرة بشكل صحيح
async function buildReferralTree(userId, maxLevel = 3) {
    try {
        // الحصول على جميع الإحالات للمستخدم الحالي بجميع المستويات
        const { data: allReferrals, error } = await window.supabaseClient
            .from('referrals')
            .select(`
                referred_id,
                level,
                profiles:referred_id (email, referral_code, created_at)
            `)
            .eq('referrer_id', userId)
            .order('level', { ascending: true });

        if (error) throw error;

        console.log('All referrals for tree:', allReferrals);

        if (!allReferrals || allReferrals.length === 0) {
            return { id: userId, level: 0, children: [] };
        }

        // بناء هيكل الشجرة
        const rootNode = {
            id: userId,
            level: 0,
            email: 'أنت (المستخدم الأساسي)',
            children: []
        };

        // تجميع الإحالات حسب المستوى
        const referralsByLevel = {};
        allReferrals.forEach(ref => {
            if (!referralsByLevel[ref.level]) {
                referralsByLevel[ref.level] = [];
            }
            referralsByLevel[ref.level].push(ref);
        });

        // بناء الشجرة مستوى بمستوى
        await buildTreeLevel(rootNode, referralsByLevel, 1, maxLevel);

        return rootNode;

    } catch (error) {
        console.error('Error building referral tree:', error);
        return { id: userId, level: 0, children: [] };
    }
}

// دالة مساعدة لبناء كل مستوى من الشجرة
async function buildTreeLevel(parentNode, referralsByLevel, currentLevel, maxLevel) {
    if (currentLevel > maxLevel) return;

    const levelReferrals = referralsByLevel[currentLevel] || [];
    
    for (const ref of levelReferrals) {
        const childNode = {
            id: ref.referred_id,
            email: ref.profiles.email,
            referral_code: ref.profiles.referral_code,
            join_date: ref.profiles.created_at,
            level: currentLevel,
            children: []
        };

        // إذا لم نصل إلى الحد الأقصى، نبحث عن الإحالات التابعة لهذا المستخدم
        if (currentLevel < maxLevel) {
            const { data: subReferrals, error } = await window.supabaseClient
                .from('referrals')
                .select(`
                    referred_id,
                    level,
                    profiles:referred_id (email, referral_code, created_at)
                `)
                .eq('referrer_id', ref.referred_id)
                .eq('level', 1); // نبحث فقط عن المستوى الأول لهذا المستخدم

            if (!error && subReferrals) {
                // تحويل المستوى بالنسبة للجذر
                const nextLevel = currentLevel + 1;
                const subReferralsByLevel = { [nextLevel]: subReferrals };
                await buildTreeLevel(childNode, subReferralsByLevel, nextLevel, maxLevel);
            }
        }

        parentNode.children.push(childNode);
    }
}

async function loadReferralTree(userId) {
    try {
        const treeData = await buildReferralTree(userId, 3);
        renderTree(treeData, document.getElementById('tree-view'));
        
    } catch (error) {
        console.error('Error loading tree:', error);
        document.getElementById('tree-view').innerHTML = '<p class="error-message">خطأ في تحميل شجرة الإحالة</p>';
    }
}

function renderTree(treeData, container) {
    if (!treeData || !treeData.children || treeData.children.length === 0) {
        container.innerHTML = '<p class="empty-message">لا توجد إحالات حتى الآن</p>';
        return;
    }

    container.innerHTML = '';
    renderTreeNode(treeData, container, true);
}

function renderTreeNode(node, container, isRoot = false) {
    if (!node.children) return;

    node.children.forEach((child, index) => {
        const hasChildren = child.children && child.children.length > 0;
        const nodeElement = document.createElement('div');
        nodeElement.className = `tree-node level-${child.level}`;
        
        nodeElement.innerHTML = `
            <div class="node-content" data-node-id="${child.id}" data-level="${child.level}">
                <div class="node-main">
                    <div class="node-icon">
                        <i class="fas fa-user${hasChildren ? '-friends' : ''}"></i>
                    </div>
                    <div class="node-info">
                        <div class="node-email">${child.email}</div>
                        <div class="node-details">
                            <span class="level-badge">المستوى ${child.level}</span>
                            <span class="join-date">${new Date(child.join_date).toLocaleDateString('ar-EG')}</span>
                        </div>
                    </div>
                </div>
                ${hasChildren ? 
                    `<button class="toggle-children" data-expanded="false">
                        <i class="fas fa-chevron-down"></i>
                    </button>` 
                    : ''
                }
            </div>
            ${hasChildren ? 
                `<div class="children-container" style="display: none;">
                    <div class="children-content"></div>
                </div>` 
                : ''
            }
        `;

        container.appendChild(nodeElement);

        if (hasChildren) {
            const toggleBtn = nodeElement.querySelector('.toggle-children');
            const childrenContainer = nodeElement.querySelector('.children-container');
            const childrenContent = nodeElement.querySelector('.children-content');
            
            toggleBtn.addEventListener('click', async function(e) {
                e.stopPropagation();
                const isExpanded = this.getAttribute('data-expanded') === 'true';
                
                if (!isExpanded) {
                    // إذا لم يتم تحميل الأطفال بعد، قم بتحميلهم
                    if (childrenContent.children.length === 0) {
                        await loadAndRenderChildNodes(child, childrenContent);
                    }
                    childrenContainer.style.display = 'block';
                    this.innerHTML = '<i class="fas fa-chevron-up"></i>';
                    this.setAttribute('data-expanded', 'true');
                } else {
                    childrenContainer.style.display = 'none';
                    this.innerHTML = '<i class="fas fa-chevron-down"></i>';
                    this.setAttribute('data-expanded', 'false');
                }
            });
        }
    });
}

async function loadAndRenderChildNodes(parentNode, container) {
    try {
        // تحميل الإحالات التابعة للمستخدم الحالي في هذه العقدة
        const { data: childReferrals, error } = await window.supabaseClient
            .from('referrals')
            .select(`
                referred_id,
                level,
                profiles:referred_id (email, referral_code, created_at)
            `)
            .eq('referrer_id', parentNode.id);

        if (error || !childReferrals) return;

        childReferrals.forEach(childRef => {
            const childNode = {
                id: childRef.referred_id,
                email: childRef.profiles.email,
                referral_code: childRef.profiles.referral_code,
                join_date: childRef.profiles.created_at,
                level: childRef.level,
                children: []
            };

            const childElement = document.createElement('div');
            childElement.className = `tree-node level-${childNode.level}`;
            childElement.innerHTML = `
                <div class="node-content" data-node-id="${childNode.id}" data-level="${childNode.level}">
                    <div class="node-main">
                        <div class="node-icon">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="node-info">
                            <div class="node-email">${childNode.email}</div>
                            <div class="node-details">
                                <span class="level-badge">المستوى ${childNode.level}</span>
                                <span class="join-date">${new Date(childNode.join_date).toLocaleDateString('ar-EG')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(childElement);
        });

    } catch (error) {
        console.error('Error loading child nodes:', error);
    }
}

async function loadAllReferralsForTable(userId) {
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
        setupTableFilters(referrals || []);

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
                <span class="status-badge level-${ref.level}">المستوى ${ref.level}</span>
            </td>
            <td>
                <span class="status-badge status-active">نشط</span>
            </td>
            <td>
                <button class="btn-action" title="عرض التفاصيل" onclick="viewUserDetails('${ref.referred_id}')">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn-action" title="إرسال رسالة" onclick="sendMessage('${ref.profiles.email}')">
                    <i class="fas fa-envelope"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function setupTableFilters(originalData) {
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
        if (navigator.clipboard) {
            navigator.clipboard.writeText(code).then(() => {
                showNotification('تم نسخ كود الإحالة: ' + code, 'success');
            });
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = code;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showNotification('تم نسخ كود الإحالة', 'success');
        }
    });

    // زر العرض الشجري
    document.getElementById('toggle-tree-view').addEventListener('click', function() {
        const treeView = document.getElementById('tree-view');
        const isHidden = treeView.style.display === 'none';
        treeView.style.display = isHidden ? 'block' : 'none';
        this.innerHTML = isHidden ? 
            '<i class="fas fa-compress"></i> إخفاء الشجرة' : 
            '<i class="fas fa-expand"></i> عرض شجري';
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
        loadAllReferralsForTable(userId);
    }, 30000);
}

// وظائف مساعدة عالمية
window.viewUserDetails = function(userId) {
    alert('عرض تفاصيل المستخدم: ' + userId);
    // يمكنك تطوير هذه الوظيفة لفتح نافذة تفاصيل
};

window.sendMessage = function(email) {
    alert('إرسال رسالة إلى: ' + email);
    // يمكنك تطوير هذه الوظيفة لفتح نموذج إرسال رسالة
};

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
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
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// إضافة أنماط CSS إضافية للشجرة
const additionalStyles = `
.tree-node {
    margin: 5px 0;
}

.tree-node.level-1 {
    margin-right: 0;
}

.tree-node.level-2 {
    margin-right: 20px;
    border-right: 2px solid #e2e8f0;
}

.tree-node.level-3 {
    margin-right: 40px;
    border-right: 2px solid #e2e8f0;
}

.node-content {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px;
    margin: 5px 0;
    cursor: pointer;
    transition: all 0.3s ease;
}

.node-content:hover {
    background: #f7fafc;
    border-color: #cbd5e0;
}

.node-main {
    display: flex;
    align-items: center;
    gap: 10px;
}

.node-icon {
    color: #4f46e5;
    font-size: 16px;
}

.node-info {
    flex: 1;
}

.node-email {
    font-weight: 600;
    color: #2d3748;
}

.node-details {
    display: flex;
    gap: 10px;
    margin-top: 5px;
    font-size: 12px;
}

.level-badge {
    background: #edf2f7;
    padding: 2px 8px;
    border-radius: 12px;
    color: #4a5568;
}

.join-date {
    color: #718096;
}

.toggle-children {
    background: none;
    border: none;
    cursor: pointer;
    color: #718096;
    padding: 5px;
}

.children-container {
    margin-right: 20px;
}

.children-content {
    margin-top: 10px;
}

.empty-message {
    text-align: center;
    color: #718096;
    padding: 20px;
    font-style: italic;
}

.error-message {
    text-align: center;
    color: #e53e3e;
    padding: 20px;
}

.level-1 .level-badge { background: #c6f6d5; color: #276749; }
.level-2 .level-badge { background: #fef5e7; color: #744210; }
.level-3 .level-badge { background: #fed7d7; color: #9b2c2c; }
`;

// إضافة الأنماط إلى الصفحة
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);
