// user.js - 个人中心脚本

document.addEventListener('DOMContentLoaded', function() {
    checkLoginStatus();
    bindEvents();
});

// 全局变量
let currentChatUserId = null;
let chatInterval = null;

function bindEvents() {
    const backBtn = document.getElementById('backBtn');
    if (backBtn) backBtn.addEventListener('click', () => window.location.href = 'index.html');

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
        localStorage.removeItem(TOKEN_KEY);
        window.location.href = 'index.html';
        showToast('已退出登录！');
    });

    const saveBtn = document.getElementById('saveInfoBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveUserInfo);

    // 管理员按钮（原有）
    const updateProvinceBtn = document.getElementById('updateProvinceLightBtn');
    if (updateProvinceBtn) updateProvinceBtn.addEventListener('click', updateProvinceLight);
    const deleteUserBtn = document.getElementById('deleteUserBtn');
    if (deleteUserBtn) deleteUserBtn.addEventListener('click', deleteUser);
    const resetPasswordBtn = document.getElementById('resetPasswordBtn');
    if (resetPasswordBtn) resetPasswordBtn.addEventListener('click', resetPassword);

    // 占位按钮提示
    const resetLightBtn = document.getElementById('resetLightBtn');
    if (resetLightBtn) resetLightBtn.addEventListener('click', () => showToast('功能开发中，敬请期待'));
    const importDataBtn = document.getElementById('importDataBtn');
    if (importDataBtn) importDataBtn.addEventListener('click', () => showToast('功能开发中，敬请期待'));
    const changeRoleBtn = document.getElementById('changeRoleBtn');
    if (changeRoleBtn) changeRoleBtn.addEventListener('click', () => showToast('功能开发中，敬请期待'));

    // 管理员面板折叠切换（原有）
    document.querySelectorAll('.collapse-header').forEach(header => {
        header.addEventListener('click', function(e) {
            const targetId = this.getAttribute('data-target');
            const body = document.getElementById(`${targetId}Body`);
            if (body) {
                const isOpen = body.style.display === 'block';
                body.style.display = isOpen ? 'none' : 'block';
                this.classList.toggle('open', !isOpen);
            }
        });
    });

    // 添加敏感词（原有）
    const addSensitiveBtn = document.getElementById('addSensitiveWordBtn');
    if (addSensitiveBtn) {
        addSensitiveBtn.addEventListener('click', async () => {
            const word = document.getElementById('newSensitiveWord').value.trim();
            if (!word) {
                showToast('请输入敏感词');
                return;
            }
            try {
                const res = await fetch(`${API_BASE_URL}/admin/addSensitiveWord`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ adminId: userInfo.id, word })
                });
                const data = await res.json();
                if (data.code === 200) {
                    showToast('敏感词添加成功');
                    document.getElementById('newSensitiveWord').value = '';
                    await fetch(`${API_BASE_URL}/admin/refreshSensitiveCache`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ adminId: userInfo.id })
                    });
                } else {
                    showToast(data.msg || '添加失败');
                }
            } catch (err) {
                showToast('网络错误');
            }
        });
    }

    // 刷新敏感词缓存（原有）
    const refreshCacheBtn = document.getElementById('refreshSensitiveCacheBtn');
    if (refreshCacheBtn) {
        refreshCacheBtn.addEventListener('click', async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/admin/refreshSensitiveCache`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ adminId: userInfo.id })
                });
                const data = await res.json();
                if (data.code === 200) {
                    showToast('敏感词缓存已刷新');
                } else {
                    showToast(data.msg || '刷新失败');
                }
            } catch (err) {
                showToast('网络错误');
            }
        });
    }

    // ========== 新功能菜单绑定 ==========
    // 私聊菜单
    const privateChatMenu = document.getElementById('privateChatMenu');
    if (privateChatMenu) {
        privateChatMenu.addEventListener('click', function() {
            setActiveMenu(this);
            document.getElementById('mainTitle').innerHTML = '<i class="ri-chat-1-line"></i> 私聊记录';
            hideAllSections();
            document.getElementById('privateChatSection').style.display = 'block';
            loadConversations();
        });
    }

    // 我的评论菜单
    const myCommentsMenu = document.getElementById('myCommentsMenu');
    if (myCommentsMenu) {
        myCommentsMenu.addEventListener('click', function() {
            setActiveMenu(this);
            document.getElementById('mainTitle').innerHTML = '<i class="ri-chat-quote-line"></i> 我的评论';
            hideAllSections();
            document.getElementById('myCommentsSection').style.display = 'block';
            loadMyComments();
        });
    }

    // 我的举报记录菜单（普通用户）
    const myReportsMenu = document.getElementById('myReportsMenu');
    if (myReportsMenu) {
        myReportsMenu.addEventListener('click', function() {
            setActiveMenu(this);
            document.getElementById('mainTitle').innerHTML = '<i class="ri-alert-line"></i> 我的举报记录';
            hideAllSections();
            document.getElementById('myReportsSection').style.display = 'block';
            loadMyReports();
        });
    }

    // 留言管理菜单（仅管理员）
    const msgManageMenu = document.getElementById('msgManageMenu');
    if (msgManageMenu) {
        msgManageMenu.addEventListener('click', function() {
            if (!userInfo || userInfo.role !== 'admin') {
                showToast('无权限');
                return;
            }
            setActiveMenu(this);
            document.getElementById('mainTitle').innerHTML = '<i class="ri-discuss-line"></i> 留言管理';
            hideAllSections();
            document.getElementById('msgManageSection').style.display = 'block';
            // 默认加载留言精选面板
            loadManageComments();
            bindManageTabs();
        });
    }

    // 原有个人信息菜单（第一个）
    const infoMenu = document.querySelectorAll('.menu-item')[0];
    if (infoMenu && !infoMenu.id) {
        infoMenu.addEventListener('click', function() {
            setActiveMenu(this);
            document.getElementById('mainTitle').innerHTML = '<i class="ri-user-info-line"></i> 个人信息';
            hideAllSections();
            document.getElementById('infoForm').style.display = 'grid';
        });
    }

    // 点亮记录菜单（原有）
    const lightRecordMenu = document.getElementById('lightRecordMenu');
    if (lightRecordMenu) {
        lightRecordMenu.addEventListener('click', function() {
            setActiveMenu(this);
            document.getElementById('mainTitle').innerHTML = '<i class="ri-calendar-check-line"></i> 点亮记录';
            hideAllSections();
            document.getElementById('lightRecordSection').style.display = 'block';
            loadLightRecords();
        });
    }

    // 管理员面板菜单（原有，现在只作为旧面板入口，新功能已移至留言管理）
    const adminMenu = document.getElementById('adminMenu');
    if (adminMenu) {
        adminMenu.addEventListener('click', function() {
            if (!userInfo || userInfo.role !== 'admin') {
                showToast('无管理员权限！');
                return;
            }
            setActiveMenu(this);
            document.getElementById('mainTitle').innerHTML = '<i class="ri-settings-3-line"></i> 管理员面板';
            hideAllSections();
            document.getElementById('adminPanel').style.display = 'block';
            // 如果旧面板中有举报管理，仍可加载（可选）
            if (document.getElementById('reportsList')) {
                loadReports('pending');
            }
        });
    }

    // 私聊发送按钮
    const sendChatBtn = document.getElementById('sendChatBtn');
    if (sendChatBtn) sendChatBtn.addEventListener('click', sendMessage);
    const closeChatBtn = document.getElementById('closeChatBtn');
    if (closeChatBtn) closeChatBtn.addEventListener('click', closeChat);
}

// 辅助函数：隐藏所有内容区域
function hideAllSections() {
    const sections = ['infoForm', 'lightRecordSection', 'adminPanel', 'privateChatSection', 'myCommentsSection', 'myReportsSection', 'msgManageSection'];
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}

// 辅助函数：激活菜单项
function setActiveMenu(menuItem) {
    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    menuItem.classList.add('active');
}

// ========== 原有函数（保持不变，但修复他人主页隐藏保存按钮） ==========
function checkLoginStatus() {
    const urlParams = new URLSearchParams(window.location.search);
    const viewUserId = urlParams.get('view');
    const token = localStorage.getItem(TOKEN_KEY);

    if (viewUserId) {
        // 查看他人主页
        fetch(`${API_BASE_URL}/getUserInfo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: viewUserId })
        })
        .then(res => res.json())
        .then(data => {
            if (data.code === 200) {
                userInfo = data.userInfo;
                document.getElementById('noLoginTip').style.display = 'none';
                document.getElementById('topNav').style.display = 'flex';
                document.getElementById('userContainer').style.display = 'flex';

                document.getElementById('showRegisterIp').textContent = userInfo.registerIp || '未知IP';
                document.getElementById('showRegisterProvince').textContent = userInfo.registerProvince || '未知省份';
                document.getElementById('showLastLoginIp').textContent = userInfo.lastLoginIp || '未知IP';
                document.getElementById('showLastLoginProvince').textContent = userInfo.lastLoginProvince || '未知省份';

                initUserInfo(); // 填充个人信息
                loadLightRecords(); // 加载点亮记录（但可隐藏菜单）
                loadUserBadges();

                // 禁用编辑并隐藏保存按钮
                const saveBtn = document.getElementById('saveInfoBtn');
                if (saveBtn) {
                    saveBtn.disabled = true;
                    saveBtn.style.display = 'none';
                }
                document.getElementById('adminMenu').style.display = 'none';
                document.getElementById('adminPanel').style.display = 'none';
                const formElements = document.querySelectorAll('#infoForm input, #infoForm select, #infoForm textarea');
                formElements.forEach(el => el.disabled = true);
                document.getElementById('lightRecordSection').style.display = 'none';

                // 隐藏不需要的菜单项
                const lightRecordMenu = document.getElementById('lightRecordMenu');
                const adminMenu = document.getElementById('adminMenu');
                const privateChatMenu = document.getElementById('privateChatMenu');
                const myCommentsMenu = document.getElementById('myCommentsMenu');
                const myReportsMenu = document.getElementById('myReportsMenu');
                const msgManageMenu = document.getElementById('msgManageMenu');
                if (lightRecordMenu) lightRecordMenu.style.display = 'none';
                if (adminMenu) adminMenu.style.display = 'none';
                if (privateChatMenu) privateChatMenu.style.display = 'none';
                if (myCommentsMenu) myCommentsMenu.style.display = 'none';
                if (myReportsMenu) myReportsMenu.style.display = 'none';
                if (msgManageMenu) msgManageMenu.style.display = 'none';

                // 显示发起私聊按钮
                const startChatBtnContainer = document.getElementById('startChatBtnContainer');
                if (startChatBtnContainer) {
                    startChatBtnContainer.style.display = 'block';
                    const startChatBtn = document.getElementById('startChatBtn');
                    startChatBtn.onclick = () => {
                        window.location.href = `user.html?chatWith=${viewUserId}`;
                    };
                }
            } else {
                showToast(data.msg || '用户不存在');
                setTimeout(() => window.location.href = 'index.html', 2000);
            }
        })
        .catch(err => {
            console.error('加载他人主页失败:', err);
            showToast('加载失败，请重试');
            setTimeout(() => window.location.href = 'index.html', 2000);
        });
    } else {
        // 自己的主页
        if (!token) {
            document.getElementById('noLoginTip').style.display = 'flex';
            setTimeout(() => window.location.href = 'index.html', 3000);
            return;
        }

        fetch(`${API_BASE_URL}/verifyToken`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        })
        .then(res => res.json())
        .then(res => {
            if (res.success) {
                userInfo = res.userInfo;
                document.getElementById('noLoginTip').style.display = 'none';
                document.getElementById('topNav').style.display = 'flex';
                document.getElementById('userContainer').style.display = 'flex';

                document.getElementById('showRegisterIp').textContent = userInfo.registerIp || '未知IP';
                document.getElementById('showRegisterProvince').textContent = userInfo.registerProvince || '未知省份';
                document.getElementById('showLastLoginIp').textContent = userInfo.lastLoginIp || '未知IP';
                document.getElementById('showLastLoginProvince').textContent = userInfo.lastLoginProvince || '未知省份';

                initUserInfo(); // 填充个人信息（编辑可用）
                loadLightRecords();
                loadUserBadges();
                document.getElementById('lightRecordSection').style.display = 'none';

                // 恢复所有菜单显示
                const lightRecordMenu = document.getElementById('lightRecordMenu');
                const adminMenu = document.getElementById('adminMenu');
                const privateChatMenu = document.getElementById('privateChatMenu');
                const myCommentsMenu = document.getElementById('myCommentsMenu');
                const myReportsMenu = document.getElementById('myReportsMenu');
                const msgManageMenu = document.getElementById('msgManageMenu');
                if (lightRecordMenu) lightRecordMenu.style.display = '';
                if (adminMenu) adminMenu.style.display = userInfo.role === 'admin' ? '' : 'none';
                if (privateChatMenu) privateChatMenu.style.display = '';
                if (myCommentsMenu) myCommentsMenu.style.display = '';
                if (myReportsMenu) myReportsMenu.style.display = userInfo.role === 'admin' ? 'none' : ''; // 普通用户显示
                if (msgManageMenu) msgManageMenu.style.display = userInfo.role === 'admin' ? '' : 'none';

                // 隐藏发起私聊按钮
                const startChatBtnContainer = document.getElementById('startChatBtnContainer');
                if (startChatBtnContainer) startChatBtnContainer.style.display = 'none';

                // 处理自动打开私聊窗口（如果URL包含chatWith）
                const chatWith = urlParams.get('chatWith');
                if (chatWith) {
                    const privateChatMenu = document.getElementById('privateChatMenu');
                    if (privateChatMenu) {
                        privateChatMenu.click();
                        setTimeout(() => {
                            if (typeof openChat === 'function') {
                                openChat(parseInt(chatWith));
                            }
                        }, 500);
                    }
                }
            } else {
                localStorage.removeItem(TOKEN_KEY);
                document.getElementById('noLoginTip').style.display = 'flex';
                setTimeout(() => window.location.href = 'index.html', 3000);
            }
        })
        .catch(err => {
            console.error('登录验证失败:', err);
            showToast('登录状态失效');
            document.getElementById('noLoginTip').style.display = 'flex';
            setTimeout(() => window.location.href = 'index.html', 3000);
        });
    }
}

function initUserInfo() {
    if (!userInfo) return;
    document.getElementById('userName').textContent = userInfo.username;
    document.getElementById('userRole').textContent = userInfo.role === 'admin' ? '管理员' : '普通用户';

    document.getElementById('editUsername').value = userInfo.username;
    document.getElementById('editRegisterIp').value = userInfo.registerIp || '未知';
    document.getElementById('editLastLoginIp').value = userInfo.lastLoginIp || '未知';
    document.getElementById('editGender').value = userInfo.gender || '男';
    document.getElementById('editHometown').value = userInfo.hometown || '';
    document.getElementById('editPhone').value = userInfo.phone || '';

    if (userInfo.role === 'admin') {
        document.getElementById('adminMenu').style.display = 'block';
        document.getElementById('adminPanel').classList.add('active');
    } else {
        document.getElementById('adminMenu').style.display = 'none';
        document.getElementById('adminPanel').classList.remove('active');
    }
    // 恢复所有菜单显示（针对自己的主页）
    const lightRecordMenu = document.getElementById('lightRecordMenu');
    const adminMenu = document.getElementById('adminMenu');
    const privateChatMenu = document.getElementById('privateChatMenu');
    const myCommentsMenu = document.getElementById('myCommentsMenu');
    const myReportsMenu = document.getElementById('myReportsMenu');
    const msgManageMenu = document.getElementById('msgManageMenu');
    if (lightRecordMenu) lightRecordMenu.style.display = '';
    if (adminMenu) adminMenu.style.display = userInfo.role === 'admin' ? '' : 'none';
    if (privateChatMenu) privateChatMenu.style.display = '';
    if (myCommentsMenu) myCommentsMenu.style.display = '';
    if (myReportsMenu) myReportsMenu.style.display = userInfo.role === 'admin' ? 'none' : '';
    if (msgManageMenu) msgManageMenu.style.display = userInfo.role === 'admin' ? '' : 'none';
}

function loadLightRecords() {
    if (!userInfo) return;
    fetch(`${API_BASE_URL}/getLightRecords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userInfo.id })
    })
    .then(res => res.json())
    .then(data => {
        const recordList = document.getElementById('recordList');
        if (data.code === 200 && data.records.length > 0) {
            recordList.innerHTML = '';
            data.records.forEach((item, index) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${item.province}</td>
                    <td>${item.city || '未知'}</td>
                    <td>${item.ip || '未知'}</td>
                    <td>${item.lightTime}</td>
                    <td>${item.danmuContent}</td>
                `;
                recordList.appendChild(tr);
            });
        } else {
            recordList.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #999;">暂无点亮记录</td></tr>';
        }
    })
    .catch(() => {
        document.getElementById('recordList').innerHTML = '<tr><td colspan="6" style="text-align: center; color: #999;">加载记录失败</td></tr>';
    });
}

function saveUserInfo() {
    if (userInfo.last_profile_update) {
        const last = new Date(userInfo.last_profile_update);
        const now = new Date();
        const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));
        if (diffDays < 7) {
            showToast(`一周只能修改一次，还剩${7-diffDays}天可修改`);
            return;
        }
    }

    const gender = document.getElementById('editGender').value;
    const hometown = document.getElementById('editHometown').value;
    const phone = document.getElementById('editPhone').value;

    if (!hometown) {
        showToast('请选择家乡！');
        return;
    }

    fetch(`${API_BASE_URL}/updateUserInfo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userInfo.id, gender, hometown, phone })
    })
    .then(res => res.json())
    .then(data => {
        if (data.code === 200) {
            userInfo.gender = gender;
            userInfo.hometown = hometown;
            userInfo.phone = phone;
            userInfo.last_profile_update = new Date().toISOString().split('T')[0];
            showToast('信息保存成功！');
        } else {
            showToast(data.msg || '保存失败');
        }
    })
    .catch(() => showToast('网络错误，请重试'));
}

function loadUserBadges() {
    if (!userInfo) return;
    fetch(`${API_BASE_URL}/getUserBadges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userInfo.id })
    })
    .then(res => res.json())
    .then(data => {
        if (data.code === 200) {
            let html = '';
            data.badges.forEach(b => {
                if (b.badge_type === 'quiz_pass') {
                    html += '<span class="badge" title="单日全对">🏅 答题全对</span>';
                } else if (b.badge_type === 'weekly_master') {
                    html += '<span class="badge weekly" title="连续7天全对+连续7天点亮">🌟 周荣誉</span>';
                }
            });
            document.getElementById('userBadges').innerHTML = html;
        }
    });
}

// 管理员功能（原有）
function updateProvinceLight() {
    const province = document.getElementById('adminProvince').value;
    const count = document.getElementById('adminLightCount').value;
    if (!province || count === '') return showToast('请填写完整');
    fetch(`${API_BASE_URL}/admin/updateProvinceLight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: userInfo.id, province, newCount: parseInt(count) })
    })
    .then(res => res.json())
    .then(data => {
        if (data.code === 200) showToast('更新成功');
        else showToast(data.msg);
    });
}

function deleteUser() {
    const targetId = document.getElementById('adminDeleteUserId').value;
    if (!targetId) return showToast('请输入用户ID');
    if (!confirm('确定删除该用户？所有关联数据将被删除！')) return;
    fetch(`${API_BASE_URL}/admin/deleteUser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: userInfo.id, targetUserId: targetId })
    })
    .then(res => res.json())
    .then(data => {
        if (data.code === 200) showToast('删除成功');
        else showToast(data.msg);
    });
}

function resetPassword() {
    const targetId = document.getElementById('adminResetPwdUserId').value;
    if (!targetId) return showToast('请输入用户ID');
    fetch(`${API_BASE_URL}/admin/resetPassword`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: userInfo.id, targetUserId: targetId })
    })
    .then(res => res.json())
    .then(data => {
        if (data.code === 200) showToast('密码已重置为123456');
        else showToast(data.msg);
    });
}

// ========== 私聊功能 ==========
async function loadConversations() {
    const container = document.getElementById('conversationList');
    if (!container) return;
    container.innerHTML = '<div class="loading">加载中...</div>';
    try {
        const res = await fetch(`${API_BASE_URL}/private/conversations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userInfo.id })
        });
        const data = await res.json();
        if (data.code === 200) {
            if (data.conversations.length === 0) {
                container.innerHTML = '<div class="empty-chat">暂无私聊记录</div>';
                return;
            }
            let html = '';
            data.conversations.forEach(conv => {
                html += `
                    <div class="conversation-item" data-user-id="${conv.id}">
                        <div class="conv-avatar">${escapeHtml(conv.username.charAt(0).toUpperCase())}</div>
                        <div class="conv-info">
                            <div class="conv-name">${escapeHtml(conv.username)}</div>
                            <div class="conv-last-msg">${escapeHtml(conv.last_message || '')}</div>
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;
            // 绑定点击事件
            document.querySelectorAll('.conversation-item').forEach(item => {
                item.addEventListener('click', () => openChat(parseInt(item.dataset.userId)));
            });
        } else {
            container.innerHTML = '<div class="error">加载失败</div>';
        }
    } catch (err) {
        container.innerHTML = '<div class="error">网络错误</div>';
    }
}

async function openChat(targetUserId) {
    if (chatInterval) clearInterval(chatInterval);
    currentChatUserId = targetUserId;
    document.getElementById('conversationList').style.display = 'none';
    document.getElementById('chatDetail').style.display = 'block';

    // 获取对方用户名
    const convItem = document.querySelector(`.conversation-item[data-user-id="${targetUserId}"]`);
    const username = convItem ? convItem.querySelector('.conv-name').innerText : '用户';
    document.getElementById('chatWithName').innerHTML = `<span onclick="viewUserProfile(${targetUserId})" style="cursor:pointer; color:#c8102e;">${escapeHtml(username)}</span>`;

    await loadChatMessages(targetUserId);
    // 每5秒刷新一次
    chatInterval = setInterval(() => loadChatMessages(targetUserId), 5000);
}

async function loadChatMessages(targetUserId) {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    try {
        const res = await fetch(`${API_BASE_URL}/private/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userInfo.id, targetUserId })
        });
        const data = await res.json();
        if (data.code === 200) {
            let html = '';
            data.messages.forEach(msg => {
                const isMine = msg.from_user_id === userInfo.id;
                const time = new Date(msg.created_at).toLocaleString();
                if (isMine) {
                    html += `
                        <div class="chat-message mine">
                            <div class="message-bubble">
                                <div class="message-text">${escapeHtml(msg.content)}</div>
                                <div class="message-time">${time}</div>
                            </div>
                        </div>
                    `;
                } else {
                    // 非本人消息：显示可点击的用户名
                    html += `
                        <div class="chat-message others">
                            <div class="message-bubble">
                                <div class="message-author" onclick="viewUserProfile(${msg.from_user_id})" style="cursor:pointer; font-weight:bold; color:#c8102e;">${escapeHtml(msg.username)}</div>
                                <div class="message-text">${escapeHtml(msg.content)}</div>
                                <div class="message-time">${time}</div>
                                <button class="report-chat-btn" data-message-id="${msg.id}">举报</button>
                            </div>
                        </div>
                    `;
                }
            });
            messagesContainer.innerHTML = html;
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            // 绑定举报按钮
            document.querySelectorAll('.report-chat-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const msgId = parseInt(btn.dataset.messageId);
                    showReportModal('message', msgId);
                });
            });
        }
    } catch (err) {
        console.error('加载聊天记录失败', err);
    }
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const content = input.value.trim();
    if (!content) return;
    try {
        const res = await fetch(`${API_BASE_URL}/private/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fromUserId: userInfo.id,
                toUserId: currentChatUserId,
                content
            })
        });
        const data = await res.json();
        if (data.code === 200) {
            input.value = '';
            await loadChatMessages(currentChatUserId);
        } else {
            showToast(data.msg || '发送失败');
        }
    } catch (err) {
        showToast('网络错误');
    }
}

function closeChat() {
    if (chatInterval) clearInterval(chatInterval);
    document.getElementById('conversationList').style.display = 'block';
    document.getElementById('chatDetail').style.display = 'none';
    loadConversations(); // 刷新会话列表，更新最后消息
}

// ========== 我的评论功能 ==========
async function loadMyComments() {
    const container = document.getElementById('myCommentsList');
    if (!container) return;
    container.innerHTML = '<div class="loading">加载中...</div>';
    try {
        const res = await fetch(`${API_BASE_URL}/user/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userInfo.id })
        });
        const data = await res.json();
        if (data.code === 200) {
            if (data.comments.length === 0) {
                container.innerHTML = '<div class="empty-chat">暂无评论记录</div>';
                return;
            }
            let html = '';
            data.comments.forEach(comment => {
                const time = new Date(comment.created_at).toLocaleString();
                html += `
                    <div class="my-comment-item" data-comment-id="${comment.id}">
                        <div class="comment-content">${escapeHtml(comment.content)}</div>
                        <div class="comment-meta">
                            <span>发布时间：${time}</span>
                            <span>点赞：${comment.like_count || 0}</span>
                            <button class="delete-my-comment-btn">删除</button>
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;
            // 绑定删除按钮
            document.querySelectorAll('.delete-my-comment-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const item = btn.closest('.my-comment-item');
                    const commentId = parseInt(item.dataset.commentId);
                    deleteMyComment(commentId);
                });
            });
        } else {
            container.innerHTML = '<div class="error">加载失败</div>';
        }
    } catch (err) {
        container.innerHTML = '<div class="error">网络错误</div>';
    }
}

async function deleteMyComment(commentId) {
    if (!confirm('确定删除这条评论吗？')) return;
    const token = localStorage.getItem(TOKEN_KEY);
    try {
        const res = await fetch(`${API_BASE_URL}/deleteOwnMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, messageId: commentId })
        });
        const data = await res.json();
        if (data.code === 200) {
            showToast('删除成功');
            loadMyComments(); // 刷新列表
        } else {
            showToast(data.msg || '删除失败');
        }
    } catch (err) {
        showToast('网络错误');
    }
}

// ========== 我的举报记录（普通用户） ==========
async function loadMyReports() {
    const container = document.getElementById('myReportsList');
    if (!container) return;
    container.innerHTML = '<div class="loading">加载中...</div>';
    try {
        const res = await fetch(`${API_BASE_URL}/user/reports`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userInfo.id })
        });
        const data = await res.json();
        if (data.code === 200) {
            if (data.reports.length === 0) {
                container.innerHTML = '<div class="empty-chat">暂无举报记录</div>';
                return;
            }
            let html = '';
            data.reports.forEach(r => {
                let statusText = '';
                if (r.status === 'pending') statusText = '待处理';
                else if (r.status === 'resolved') statusText = '已处理';
                else statusText = '已驳回';
                html += `
                    <div class="my-report-card">
                        <div class="report-header">
                            <span class="report-type">${r.target_type === 'comment' ? '📝 留言举报' : '💬 私聊举报'}</span>
                            <span class="report-status ${r.status}">${statusText}</span>
                        </div>
                        <div class="report-content-preview">${escapeHtml(r.target_content || '内容已删除')}</div>
                        <div class="report-reason">原因：${escapeHtml(r.reason)}</div>
                        <div class="report-time">${new Date(r.created_at).toLocaleString()}</div>
                    </div>
                `;
            });
            container.innerHTML = html;
        } else {
            container.innerHTML = '<div class="error">加载失败</div>';
        }
    } catch (err) {
        container.innerHTML = '<div class="error">网络错误</div>';
    }
}

// ========== 留言管理（管理员） ==========
// 加载留言精选列表
async function loadManageComments() {
    const container = document.getElementById('manageCommentsPanel');
    if (!container) return;
    container.innerHTML = '<div class="loading">加载中...</div>';
    try {
        const res = await fetch(`${API_BASE_URL}/admin/allMessages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: userInfo.id })
        });
        const data = await res.json();
        if (data.code === 200 && data.messages.length) {
            let html = '';
            data.messages.forEach(msg => {
                html += `
                    <div class="manage-message-item">
                        <div class="msg-user">${escapeHtml(msg.username)}</div>
                        <div class="msg-content">${escapeHtml(msg.content)}</div>
                        <div class="msg-stats">❤️ ${msg.like_count}</div>
                        <div class="msg-actions">
                            <button class="admin-btn-sm toggle-approve-btn" data-id="${msg.id}" data-approved="${msg.is_approved}">${msg.is_approved ? '取消精选' : '精选'}</button>
                            <button class="admin-btn-sm delete-msg-btn" data-id="${msg.id}">删除</button>
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;
            document.querySelectorAll('#manageCommentsPanel .toggle-approve-btn').forEach(btn => {
                btn.addEventListener('click', () => toggleApproveMessage(btn.dataset.id));
            });
            document.querySelectorAll('#manageCommentsPanel .delete-msg-btn').forEach(btn => {
                btn.addEventListener('click', () => deleteMessageById(btn.dataset.id));
            });
        } else {
            container.innerHTML = '<div class="empty-chat">暂无符合条件的留言</div>';
        }
    } catch (err) {
        container.innerHTML = '<div class="error">加载失败</div>';
    }
}

async function toggleApproveMessage(messageId) {
    try {
        const res = await fetch(`${API_BASE_URL}/admin/toggleApproveMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: userInfo.id, messageId: parseInt(messageId) })
        });
        const data = await res.json();
        if (data.code === 200) {
            showToast(data.msg);
            loadManageComments(); // 刷新精选列表
        } else {
            showToast(data.msg || '操作失败');
        }
    } catch (err) {
        showToast('网络错误');
    }
}

async function deleteMessageById(messageId) {
    if (!confirm('确定删除此留言吗？')) return;
    try {
        const res = await fetch(`${API_BASE_URL}/admin/deleteMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: userInfo.id, messageId: parseInt(messageId) })
        });
        const data = await res.json();
        if (data.code === 200) {
            showToast('删除成功');
            loadManageComments(); // 刷新精选列表
        } else {
            showToast(data.msg || '删除失败');
        }
    } catch (err) {
        showToast('网络错误');
    }
}

// 加载留言举报
async function loadCommentReports(status = 'pending') {
    const container = document.getElementById('commentReportsList');
    if (!container) return;
    await loadReportsToContainer(container, 'comment', status);
}

async function loadMessageReports(status = 'pending') {
    const container = document.getElementById('messageReportsList');
    if (!container) return;
    await loadReportsToContainer(container, 'message', status);
}

async function loadReportsToContainer(container, targetType, status) {
    container.innerHTML = '<div class="loading">加载中...</div>';
    try {
        const res = await fetch(`${API_BASE_URL}/admin/reports`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: userInfo.id, status })
        });
        const data = await res.json();
        if (data.code === 200) {
            const filtered = data.reports.filter(r => r.target_type === targetType);
            if (filtered.length === 0) {
                container.innerHTML = '<div class="empty-chat">暂无举报记录</div>';
                return;
            }
            let html = '';
            filtered.forEach(r => {
                let statusText = '';
                if (r.status === 'pending') statusText = '待处理';
                else if (r.status === 'resolved') statusText = '已处理';
                else statusText = '已驳回';
                html += `
                    <div class="report-item">
                        <div><strong>举报人：</strong>${escapeHtml(r.reporter_name)}</div>
                        <div><strong>内容：</strong>${escapeHtml(r.target_content || '内容已删除')}</div>
                        <div><strong>作者：</strong>${escapeHtml(r.target_author_name || '未知')}</div>
                        <div><strong>原因：</strong>${escapeHtml(r.reason)}</div>
                        <div><strong>状态：</strong>${statusText}</div>
                        ${r.status === 'pending' ? `
                        <div class="report-actions">
                            <button class="admin-btn resolve-report" data-id="${r.id}">✓ 已处理</button>
                            <button class="admin-btn dismiss-report" data-id="${r.id}">✗ 驳回</button>
                        </div>
                        ` : ''}
                    </div>
                `;
            });
            container.innerHTML = html;
            container.querySelectorAll('.resolve-report').forEach(btn => {
                btn.addEventListener('click', () => resolveReport(btn.dataset.id, 'resolve', targetType, status));
            });
            container.querySelectorAll('.dismiss-report').forEach(btn => {
                btn.addEventListener('click', () => resolveReport(btn.dataset.id, 'dismiss', targetType, status));
            });
        } else {
            container.innerHTML = '<div class="error">加载失败</div>';
        }
    } catch (err) {
        container.innerHTML = '<div class="error">网络错误</div>';
    }
}

async function resolveReport(reportId, action, targetType, currentStatus) {
    try {
        const res = await fetch(`${API_BASE_URL}/admin/resolveReport`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: userInfo.id, reportId, action })
        });
        const data = await res.json();
        if (data.code === 200) {
            showToast('处理成功');
            if (targetType === 'comment') {
                loadCommentReports(currentStatus);
            } else {
                loadMessageReports(currentStatus);
            }
        } else {
            showToast(data.msg || '处理失败');
        }
    } catch (err) {
        showToast('网络错误');
    }
}

function bindManageTabs() {
    const tabs = document.querySelectorAll('.manage-tab');
    tabs.forEach(tab => {
        tab.removeEventListener('click', handleTabClick);
        tab.addEventListener('click', handleTabClick);
    });
    bindReportStatusFilters();
}

function handleTabClick(e) {
    const tab = e.currentTarget;
    const tabName = tab.dataset.tab;
    document.querySelectorAll('.manage-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.manage-panel').forEach(panel => panel.style.display = 'none');
    if (tabName === 'comments') {
        document.getElementById('manageCommentsPanel').style.display = 'block';
        loadManageComments();
    } else if (tabName === 'commentReports') {
        document.getElementById('manageCommentReportsPanel').style.display = 'block';
        loadCommentReports('pending');
    } else if (tabName === 'messageReports') {
        document.getElementById('manageMessageReportsPanel').style.display = 'block';
        loadMessageReports('pending');
    }
}

function bindReportStatusFilters() {
    // 留言举报筛选
    const commentFilters = document.querySelectorAll('#manageCommentReportsPanel .status-filter-btn');
    commentFilters.forEach(btn => {
        btn.removeEventListener('click', handleCommentFilter);
        btn.addEventListener('click', handleCommentFilter);
    });
    // 私聊举报筛选
    const messageFilters = document.querySelectorAll('#manageMessageReportsPanel .status-filter-btn');
    messageFilters.forEach(btn => {
        btn.removeEventListener('click', handleMessageFilter);
        btn.addEventListener('click', handleMessageFilter);
    });
}

function handleCommentFilter(e) {
    const btn = e.currentTarget;
    const status = btn.dataset.status;
    document.querySelectorAll('#manageCommentReportsPanel .status-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadCommentReports(status);
}

function handleMessageFilter(e) {
    const btn = e.currentTarget;
    const status = btn.dataset.status;
    document.querySelectorAll('#manageMessageReportsPanel .status-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadMessageReports(status);
}

// ========== 举报功能（通用） ==========
let currentReportTarget = { type: null, id: null };

function showReportModal(type, id) {
    const modal = document.getElementById('reportModal');
    if (!modal) {
        console.error('举报模态框不存在');
        showToast('页面加载异常，请刷新重试');
        return;
    }
    currentReportTarget = { type, id };
    modal.classList.add('active');
}

function hideReportModal() {
    const modal = document.getElementById('reportModal');
    if (modal) modal.classList.remove('active');
    const reasonInput = document.getElementById('reportReason');
    if (reasonInput) reasonInput.value = '';
}

async function submitReport() {
    const reason = document.getElementById('reportReason')?.value.trim();
    if (!reason) {
        showToast('请填写举报原因');
        return;
    }
    if (!userInfo) {
        showToast('请先登录');
        return;
    }
    try {
        const res = await fetch(`${API_BASE_URL}/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                reporterId: userInfo.id,
                targetType: currentReportTarget.type,
                targetId: currentReportTarget.id,
                reason
            })
        });
        const data = await res.json();
        if (data.code === 200) {
            showToast('举报已提交');
            hideReportModal();
        } else {
            showToast(data.msg || '提交失败');
        }
    } catch (err) {
        showToast('网络错误');
    }
}

// 绑定举报模态框事件（在页面加载后绑定）
function bindReportModalEvents() {
    const closeBtn = document.getElementById('reportClose');
    if (closeBtn) closeBtn.addEventListener('click', hideReportModal);
    const submitBtn = document.getElementById('submitReportBtn');
    if (submitBtn) submitBtn.addEventListener('click', submitReport);
}
setTimeout(() => bindReportModalEvents(), 500);

// 全局跳转他人主页函数
window.viewUserProfile = function(userId) {
    window.location.href = `user.html?view=${userId}`;
};

// 通用 HTML 转义
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}