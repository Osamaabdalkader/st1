// dashboard.js - نظام متعدد المستويات غير محدود
class ReferralDashboard {
    constructor() {
        this.userId = null;
        this.currentUser = null;
        this.networkData = null;
        this.statsData = null;
        this.init();
    }

    async init() {
        try {
            await this.checkAuth();
            await this.loadUserData();
            await this.loadAllData();
            this.setupEventListeners();
            this.setupAutoRefresh();
        } catch (error) {
            console.error('Dashboard initialization failed:', error);
            this.showError('فشل تحميل لوحة التحكم');
        }
    }

    async checkAuth() {
        const { data: { session }, error } = await window.supabaseClient.auth.getSession();
        if (error || !session) {
            window.location.href = 'auth.html';
            throw new Error('غير مصرح بالدخول');
        }
        this.userId = session.user.id;
        this.currentUser = session.user;
    }

    async loadUserData() {
        const { data: profile, error } = await window.supabaseClient
            .from('user_profiles')
            .select('*')
            .eq('user_id', this.userId)
            .single();

        if (error) {
            // إنشاء البروفايل إذا لم يكن موجوداً
            await this.createUserProfile();
            return this.loadUserData();
        }

        document.getElementById('user-email').textContent = this.currentUser.email;
        document.getElementById('user-referral-code').textContent = profile.referral_code;
        
        return profile;
    }

    async createUserProfile() {
        const { data, error } = await window.supabaseClient.rpc('add_user_to_network', {
            p_user_id: this.userId,
            p_email: this.currentUser.email
        });

        if (error) throw error;
    }

    async loadAllData() {
        await Promise.all([
            this.loadStatistics(),
            this.loadNetworkTree(),
            this.loadReferralsTable()
        ]);
    }

    async loadStatistics() {
        try {
            const { data: stats, error } = await window.supabaseClient
                .from('referral_stats')
                .select('*')
                .eq('user_id', this.userId)
                .single();

            if (error) throw error;

            this.statsData = stats;
            this.renderStatistics(stats);
        } catch (error) {
            console.error('Error loading statistics:', error);
        }
    }

    renderStatistics(stats) {
        if (!stats) return;

        // الإجمالي
        document.getElementById('total-referrals').textContent = stats.total_referrals || 0;

        // المستويات من 1 إلى 10
        for (let i = 1; i <= 10; i++) {
            const element = document.getElementById(`level${i}-referrals`);
            if (element) {
                element.textContent = stats[`level_${i}_count`] || 0;
            }
        }

        // رسم مخطط المستويات
        this.renderLevelsChart(stats);
    }

    renderLevelsChart(stats) {
        const levelsContainer = document.getElementById('levels-chart');
        if (!levelsContainer) return;

        let chartHTML = '';
        for (let i = 1; i <= 10; i++) {
            const count = stats[`level_${i}_count`] || 0;
            const percentage = stats.total_referrals ? (count / stats.total_referrals * 100) : 0;
            
            chartHTML += `
                <div class="level-chart-item">
                    <div class="level-info">
                        <span class="level-label">المستوى ${i}</span>
                        <span class="level-count">${count}</span>
                        <span class="level-percentage">${percentage.toFixed(1)}%</span>
                    </div>
                    <div class="level-bar">
                        <div class="level-bar-fill" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        }

        levelsContainer.innerHTML = chartHTML;
    }

    async loadNetworkTree() {
        try {
            const { data: network, error } = await window.supabaseClient
                .rpc('get_user_network_tree', {
                    p_user_id: this.userId,
                    p_max_depth: 10
                });

            if (error) throw error;

            this.networkData = network;
            this.renderNetworkTree(network);
        } catch (error) {
            console.error('Error loading network tree:', error);
        }
    }

    renderNetworkTree(network) {
        const container = document.getElementById('tree-view');
        if (!network || network.length === 0) {
            container.innerHTML = '<div class="empty-state">لا توجد إحالات في شبكتك بعد</div>';
            return;
        }

        // تجميع البيانات حسب المستوى
        const levels = {};
        network.forEach(item => {
            if (!levels[item.depth]) levels[item.depth] = [];
            levels[item.depth].push(item);
        });

        let treeHTML = '<div class="network-tree">';
        
        // إضافة المستخدم الحالي كجذر
        treeHTML += `
            <div class="tree-level root-level">
                <div class="tree-node root-node">
                    <div class="node-content">
                        <div class="node-avatar">
                            <i class="fas fa-crown"></i>
                        </div>
                        <div class="node-info">
                            <div class="node-name">أنت</div>
                            <div class="node-email">${this.currentUser.email}</div>
                        </div>
                        <div class="node-stats">
                            <span class="total-referrals">${this.statsData?.total_referrals || 0} مشترك</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // إضافة المستويات
        Object.keys(levels).sort((a, b) => a - b).forEach(level => {
            const levelData = levels[level];
            treeHTML += `
                <div class="tree-level level-${level}">
                    <div class="level-header">
                        <h4>المستوى ${level}</h4>
                        <span class="level-count">${levelData.length} عضو</span>
                    </div>
                    <div class="level-nodes">
            `;

            levelData.forEach((node, index) => {
                treeHTML += this.renderTreeNode(node, level, index);
            });

            treeHTML += '</div></div>';
        });

        treeHTML += '</div>';
        container.innerHTML = treeHTML;

        // إضافة event listeners للعقد
        this.setupTreeInteractions();
    }

    renderTreeNode(node, level, index) {
        return `
            <div class="tree-node level-${level}" data-user-id="${node.user_id}" data-level="${level}">
                <div class="node-content">
                    <div class="node-avatar level-${level}">
                        <span>${index + 1}</span>
                    </div>
                    <div class="node-info">
                        <div class="node-email">${node.email}</div>
                        <div class="node-details">
                            <span class="join-date">${new Date(node.join_date).toLocaleDateString('ar-EG')}</span>
                            <span class="user-referrals">${node.path_length} مشترك</span>
                        </div>
                    </div>
                    <div class="node-actions">
                        <button class="btn-action view-details" title="عرض التفاصيل">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-action expand-node" title="عرض التابعين">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                    </div>
                </div>
                <div class="node-children" style="display: none;"></div>
            </div>
        `;
    }

    setupTreeInteractions() {
        // أزرار التوسيع
        document.querySelectorAll('.expand-node').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const node = e.target.closest('.tree-node');
                const userId = node.dataset.userId;
                const level = parseInt(node.dataset.level);
                
                await this.toggleNodeChildren(node, userId, level);
            });
        });

        // أزرار عرض التفاصيل
        document.querySelectorAll('.view-details').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const node = e.target.closest('.tree-node');
                const userId = node.dataset.userId;
                this.showUserDetails(userId);
            });
        });
    }

    async toggleNodeChildren(node, userId, currentLevel) {
        const childrenContainer = node.querySelector('.node-children');
        const expandBtn = node.querySelector('.expand-node i');
        
        if (childrenContainer.style.display === 'none') {
            // تحميل التابعين
            const { data: children, error } = await window.supabaseClient
                .rpc('get_user_network_tree', {
                    p_user_id: userId,
                    p_max_depth: 1
                });

            if (!error && children && children.length > 0) {
                let childrenHTML = '';
                children.forEach((child, index) => {
                    childrenHTML += this.renderTreeNode(child, currentLevel + 1, index);
                });
                childrenContainer.innerHTML = childrenHTML;
            } else {
                childrenContainer.innerHTML = '<div class="no-children">لا توجد إحالات تابعة</div>';
            }

            childrenContainer.style.display = 'block';
            expandBtn.className = 'fas fa-chevron-up';
        } else {
            childrenContainer.style.display = 'none';
            expandBtn.className = 'fas fa-chevron-down';
        }
    }

    async loadReferralsTable(searchText = '', levelFilter = '') {
        try {
            const { data: referrals, error } = await window.supabaseClient
                .rpc('get_all_referrals', {
                    p_user_id: this.userId,
                    p_search_text: searchText || null,
                    p_level_filter: levelFilter ? parseInt(levelFilter) : null
                });

            if (error) throw error;

            this.renderReferralsTable(referrals || []);
        } catch (error) {
            console.error('Error loading referrals table:', error);
        }
    }

    renderReferralsTable(referrals) {
        const tbody = document.getElementById('referrals-tbody');
        
        if (!referrals || referrals.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">لا توجد إحالات</td></tr>';
            return;
        }

        tbody.innerHTML = referrals.map(ref => `
            <tr data-user-id="${ref.user_id}" data-level="${ref.level}">
                <td>${ref.row_num}</td>
                <td>
                    <div class="user-info">
                        <div class="user-avatar level-${ref.level}">${ref.level}</div>
                        <div class="user-details">
                            <div class="user-email">${ref.email}</div>
                            <div class="user-code">${ref.referral_code}</div>
                        </div>
                    </div>
                </td>
                <td>${new Date(ref.join_date).toLocaleDateString('ar-EG')}</td>
                <td>
                    <span class="level-badge level-${ref.level}">المستوى ${ref.level}</span>
                </td>
                <td>${ref.total_referrals}</td>
                <td>
                    <span class="status-badge status-active">نشط</span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action view-user" title="عرض التفاصيل">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-action send-message" title="إرسال رسالة">
                            <i class="fas fa-envelope"></i>
                        </button>
                        <button class="btn-action view-network" title="عرض الشبكة">
                            <i class="fas fa-sitemap"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        this.setupTableInteractions();
    }

    setupTableInteractions() {
        // تفاعلات الجدول
        document.querySelectorAll('.view-user').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = e.target.closest('tr').dataset.userId;
                this.showUserDetails(userId);
            });
        });

        document.querySelectorAll('.view-network').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = e.target.closest('tr').dataset.userId;
                this.showUserNetwork(userId);
            });
        });
    }

    setupEventListeners() {
        // نسخ كود الإحالة
        document.getElementById('copy-referral-code').addEventListener('click', () => {
            this.copyReferralCode();
        });

        // البحث في الجدول
        document.getElementById('search-referrals').addEventListener('input', (e) => {
            this.loadReferralsTable(e.target.value, document.getElementById('level-filter').value);
        });

        // تصفية بالمستوى
        document.getElementById('level-filter').addEventListener('change', (e) => {
            this.loadReferralsTable(document.getElementById('search-referrals').value, e.target.value);
        });

        // تصدير البيانات
        document.getElementById('export-data').addEventListener('click', () => {
            this.exportData();
        });

        // تسجيل الخروج
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.logout();
        });
    }

    setupAutoRefresh() {
        // تحديث تلقائي كل 30 ثانية
        setInterval(async () => {
            await this.loadStatistics();
            await this.loadReferralsTable();
        }, 30000);
    }

    async copyReferralCode() {
        const code = document.getElementById('user-referral-code').textContent;
        try {
            await navigator.clipboard.writeText(code);
            this.showNotification('تم نسخ كود الإحالة بنجاح', 'success');
        } catch (error) {
            this.showNotification('فشل نسخ الكود', 'error');
        }
    }

    async showUserDetails(userId) {
        // يمكن تطوير هذه الوظيفة لفتح modal بالتفاصيل
        const { data: user, error } = await window.supabaseClient
            .from('user_profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (!error) {
            alert(`تفاصيل المستخدم:\nالبريد: ${user.email}\nكود الإحالة: ${user.referral_code}`);
        }
    }

    async showUserNetwork(userId) {
        // يمكن تطوير هذه الوظيفة لفتح صفحة شبكة المستخدم
        alert(`عرض شبكة المستخدم: ${userId}`);
    }

    async exportData() {
        // تصدير البيانات إلى Excel أو CSV
        if (!this.networkData) return;
        
        const csvContent = this.convertToCSV(this.networkData);
        this.downloadCSV(csvContent, 'شبكة-الإحالة.csv');
    }

    convertToCSV(data) {
        const headers = ['المستوى', 'البريد الإلكتروني', 'كود الإحالة', 'تاريخ الانضمام'];
        const rows = data.map(item => [
            item.depth,
            item.email,
            item.referral_code,
            new Date(item.join_date).toLocaleDateString('ar-EG')
        ]);
        
        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    downloadCSV(content, filename) {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    }

    async logout() {
        if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
            await window.supabaseClient.auth.signOut();
            window.location.href = 'index.html';
        }
    }

    showNotification(message, type) {
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
        setTimeout(() => notification.remove(), 3000);
    }

    showError(message) {
        this.showNotification(message, 'error');
    }
}

// تهيئة النظام عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    new ReferralDashboard();
});
