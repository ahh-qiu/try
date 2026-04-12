// index.js - 首页独有脚本（登录、留言墙、答题、选项卡）
document.addEventListener('DOMContentLoaded', function() {
    initTimeDisplay();
    checkLoginStatus();
    bindEvents();
    getUserIpProvince();
    loadMessages();
    initTabSwitching();          // 初始化选项卡切换
    window.mapInitialized = false; // 地图初始化标志
});

// 更新时间显示
function initTimeDisplay() {
    function updateTime() {
        const now = new Date();
        const timeStr = now.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).replace(/\//g, '-');
        const timeDisplay = document.getElementById('current-time');
        if (timeDisplay) timeDisplay.textContent = timeStr;
    }
    updateTime();
    setInterval(updateTime, 1000);
}

// 选项卡切换逻辑
function initTabSwitching() {
    const tabs = document.querySelectorAll('.tab-btn');
    const panels = {
        index: document.getElementById('indexPanel'),
        memory: document.getElementById('memoryPanel'),
        interaction: document.getElementById('interactionPanel')
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const target = this.getAttribute('data-tab');
            // 切换按钮状态
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            // 切换面板
            Object.values(panels).forEach(panel => panel.classList.remove('active'));
            panels[target].classList.add('active');

            // 如果切换到互动面板且地图未初始化，则初始化地图和弹幕
            if (target === 'interaction' && !window.mapInitialized) {
                initMapAndDanmu();
                window.mapInitialized = true;
            }
            // 如果地图已初始化但可能因隐藏导致尺寸异常，触发resize
            if (target === 'interaction' && window.myChart) {
                setTimeout(() => {
                    window.myChart.resize();
                }, 200);
            }
        });
    });
}

// 初始化地图和弹幕（仅一次，在 map.js 中定义）
function initMapAndDanmu() {
    if (typeof initMap === 'function') {
        initMap();       // 原地图初始化函数（在 map.js 中）
    }
    if (typeof initDanmu === 'function') {
        initDanmu();     // 原弹幕初始化函数（在 map.js 中）
    }
}

// 检查登录状态（覆盖common中的同名函数，扩展首页逻辑）
function checkLoginStatus() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
        fetch(`${API_BASE_URL}/verifyToken`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        }).then(res => res.json())
        .then(res => {
            if (res.success) {
                userInfo = res.userInfo;
                updateLoginUI();
                checkLightToday().then(() => updateTributeBtnStatus());
                document.getElementById('postMessageBox').style.display = 'block';
                updateQuizBtnStatus();
                getUserIpProvince();
            } else {
                clearLoginStatus();
            }
        }).catch(err => {
            clearLoginStatus();
            showToast('登录状态失效，请重新登录');
        });
    } else {
        clearLoginStatus();
    }
}

// 绑定各种事件（登录注册、答题、致敬、留言发布等）
function bindEvents() {
    // 登录注册弹窗
    const authBtn = document.getElementById('auth-btn');
    const authModal = document.getElementById('authModal');
    const authClose = document.getElementById('authClose');
    if (authBtn) authBtn.addEventListener('click', () => authModal.classList.add('active'));
    if (authClose) authClose.addEventListener('click', () => authModal.classList.remove('active'));

    // 切换登录/注册tab
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabType = this.dataset.tab;
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            document.getElementById('loginForm').classList.remove('active');
            document.getElementById('registerForm').classList.remove('active');
            document.getElementById(`${tabType}Form`).classList.add('active');
        });
    });

    // 切换链接
    const toRegister = document.querySelector('.to-register');
    const toLogin = document.querySelector('.to-login');
    if (toRegister) toRegister.addEventListener('click', () => document.querySelectorAll('.auth-tab')[1].click());
    if (toLogin) toLogin.addEventListener('click', () => document.querySelectorAll('.auth-tab')[0].click());

    // 登录注册按钮
    document.getElementById('loginBtn').addEventListener('click', login);
    document.getElementById('registerBtn').addEventListener('click', register);
    document.getElementById('logout-btn').addEventListener('click', logout);

    // 致敬按钮
    const tributeBtn = document.getElementById('tributeBtn');
    if (tributeBtn) tributeBtn.addEventListener('click', handleTribute);

    // 答题相关
    document.getElementById('quizBtn').addEventListener('click', openQuiz);
    document.getElementById('quizClose').addEventListener('click', () => {
        document.getElementById('quizModal').classList.remove('active');
    });
    // 注意：不再直接绑定 submitQuizBtn，它的点击事件会在 renderSingleQuiz 中动态设置

    // 发布留言按钮
    document.getElementById('postMessageBtn').addEventListener('click', postMessage);

    // 留言墙事件委托（点赞、管理员操作、普通用户删除）
    const chatContainer = document.getElementById('chatListContainer');
    if (chatContainer) {
        chatContainer.addEventListener('click', handleChatContainerClick);
    }

    // 绑定游戏相关事件
bindGameEvents();
// 精选留言点赞（事件委托）
document.addEventListener('click', function(e) {
    const likeBtn = e.target.closest('.featured-like-btn');
    if (likeBtn) {
        e.preventDefault();
        const messageId = likeBtn.dataset.messageId;
        if (messageId) {
            likeMessage(messageId);
        }
    }
});
}
window.viewUserProfile = function(userId) {
    window.location.href = `user.html?view=${userId}`;
};
//登录
function login() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    let hasError = false;
    // 清除之前的错误样式
    document.getElementById('loginUsernameError').classList.remove('show');
    document.getElementById('loginPasswordError').classList.remove('show');

    if (!username) {
        document.getElementById('loginUsernameError').textContent = '请输入用户名';
        document.getElementById('loginUsernameError').classList.add('show');
        hasError = true;
    }
    if (!password) {
        document.getElementById('loginPasswordError').textContent = '请输入密码';
        document.getElementById('loginPasswordError').classList.add('show');
        hasError = true;
    }
    if (hasError) return;

    fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
    .then(res => res.json())
    .then(data => {
        if (data.code === 200) {
            localStorage.setItem(TOKEN_KEY, data.token);
            userInfo = data.userInfo;
            document.getElementById('authModal').classList.remove('active');
            updateLoginUI();
            checkLightToday().then(() => updateTributeBtnStatus());
            document.getElementById('postMessageBox').style.display = 'block';
            updateQuizBtnStatus();
            getUserIpProvince();
            loadMessages();
            showToast('登录成功！');
        } else {
            // 根据错误信息显示在对应字段下方
            const msg = data.msg || '登录失败';
            if (msg.includes('用户名不存在')) {
                document.getElementById('loginUsernameError').textContent = msg;
                document.getElementById('loginUsernameError').classList.add('show');
            } else if (msg.includes('密码错误')) {
                document.getElementById('loginPasswordError').textContent = msg;
                document.getElementById('loginPasswordError').classList.add('show');
            } else {
                // 其他错误统一用 toast 显示
                showToast(msg);
            }
        }
    })
    .catch(err => {
        showToast('网络错误，请重试');
    });
}

// 注册
function register() {
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    const confirmPwd = document.getElementById('regConfirmPwd').value.trim();
    const hometown = document.getElementById('regHometown').value;
    const gender = document.querySelector('input[name="gender"]:checked').value;
    let hasError = false;

    // 清除之前的错误样式
    document.getElementById('regUsernameError').classList.remove('show');
    document.getElementById('regPasswordError').classList.remove('show');
    document.getElementById('regConfirmPwdError').classList.remove('show');
    document.getElementById('regHometownError').classList.remove('show');

    if (!username) {
        document.getElementById('regUsernameError').textContent = '请输入用户名';
        document.getElementById('regUsernameError').classList.add('show');
        hasError = true;
    }
    if (password.length < 6) {
        document.getElementById('regPasswordError').textContent = '密码长度不少于6位';
        document.getElementById('regPasswordError').classList.add('show');
        hasError = true;
    }
    if (password !== confirmPwd) {
        document.getElementById('regConfirmPwdError').textContent = '两次密码不一致';
        document.getElementById('regConfirmPwdError').classList.add('show');
        hasError = true;
    }
    if (!hometown) {
        document.getElementById('regHometownError').textContent = '请选择家乡省份';
        document.getElementById('regHometownError').classList.add('show');
        hasError = true;
    }
    if (hasError) return;

    fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, gender, hometown })
    })
    .then(res => res.json())
    .then(data => {
        if (data.code === 200) {
            showToast('注册成功，请登录');
            document.querySelectorAll('.auth-tab')[0].click();
            document.getElementById('loginUsername').value = username;
        } else {
            const msg = data.msg || '注册失败';
            if (msg.includes('用户名已存在')) {
                document.getElementById('regUsernameError').textContent = msg;
                document.getElementById('regUsernameError').classList.add('show');
            } else if(msg.includes('用户名包含敏感词，请更换')){
                document.getElementById('regUsernameError').textContent = msg;
                document.getElementById('regUsernameError').classList.add('show');
            }
            else {
                showToast(msg);
            }
        }
    })
    .catch(err => {
        showToast('网络错误，请重试');
    });
}

// ---------- 答题系统（逐题模式） ----------
let currentQuiz = [];          // 存储所有题目
let currentQuizIndex = 0;      // 当前第几题（0-based）
let userAnswers = [];          // 记录每道题的答案，用于最后提交

function openQuiz() {
    if (!userInfo) return;
    fetch(`${API_BASE_URL}/checkQuizToday`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userInfo.id })
    })
    .then(res => res.json())
    .then(data => {
        if (data.code === 200 && data.hasTaken) {
            showToast('今日已经答过题，请明天再来');
            return;
        }
        fetch(`${API_BASE_URL}/dailyQuiz`)
        .then(res => res.json())
        .then(data => {
            if (data.code === 200) {
                currentQuiz = data.questions;
                currentQuizIndex = 0;
                userAnswers = [];
                renderSingleQuiz();
                document.getElementById('quizModal').classList.add('active');
            } else {
                showToast('获取题目失败');
            }
        });
    });
}

function renderSingleQuiz() {
    const container = document.getElementById('quizQuestions');
    if (!container) return;
    if (currentQuizIndex >= currentQuiz.length) {
        // 所有题目已答完，提交最终结果
        finishQuiz(true);
        return;
    }
    const q = currentQuiz[currentQuizIndex];
    let html = `<div class="quiz-item">
        <p><strong>第 ${currentQuizIndex+1} / ${currentQuiz.length} 题</strong></p>
        <p>${q.question}</p>`;
    q.options.forEach((opt, optIdx) => {
        html += `<label style="display: block; margin: 8px 0;">
            <input type="radio" name="currentAnswer" value="${optIdx}"> ${opt}
        </label>`;
    });
    html += `</div>`;
    container.innerHTML = html;
    // 修改按钮文字和功能
    const submitBtn = document.getElementById('submitQuizBtn');
    if (submitBtn) {
        submitBtn.textContent = '下一题';
        submitBtn.onclick = nextQuestion;
    }
}

async function nextQuestion() {
    const selected = document.querySelector('input[name="currentAnswer"]:checked');
    if (!selected) {
        showToast('请先选择答案');
        return;
    }
    const selectedIndex = parseInt(selected.value);
    const currentQ = currentQuiz[currentQuizIndex];

    // 记录答案
    userAnswers.push({
        questionId: currentQ.id,
        selectedOptionIndex: selectedIndex
    });

    // 验证答案
    try {
        const res = await fetch(`${API_BASE_URL}/verifySingleQuiz`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userInfo.id,
                questionId: currentQ.id,
                selectedOptionIndex: selectedIndex
            })
        });
        const data = await res.json();
        if (data.code === 200 && data.correct) {
            // 答案正确，进入下一题
            currentQuizIndex++;
            if (currentQuizIndex < currentQuiz.length) {
                renderSingleQuiz();
            } else {
                // 所有题目答完，全对
                finishQuiz(true);
            }
        } else {
            // 答案错误，挑战失败
            showToast('❌ 答案错误，挑战失败！');
            document.getElementById('quizModal').classList.remove('active');
            // 记录今日答题失败（防止重复尝试）
            await fetch(`${API_BASE_URL}/submitQuiz`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: userInfo.id, answers: [] }) // 空答案表示失败
            });
        }
    } catch (err) {
        showToast('网络错误，请重试');
    }
}

function finishQuiz(isPassed) {
    if (isPassed) {
        // 全对，提交最终记录
        fetch(`${API_BASE_URL}/submitQuiz`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userInfo.id, answers: userAnswers })
        })
        .then(res => res.json())
        .then(data => {
            if (data.code === 200) {
                showToast(data.msg);
            } else {
                showToast(data.msg || '提交失败');
            }
        })
        .catch(() => showToast('网络错误'));
    }
    document.getElementById('quizModal').classList.remove('active');
}

// ---------- 留言墙（对话框风格） ----------
function loadMessages() {
    fetch(`${API_BASE_URL}/getMessages`)
    .then(res => res.json())
    .then(data => {
        if (data.code === 200) {
            renderMessages(data.messages);
        }
    });
}

function renderMessages(messages) {
    const container = document.getElementById('chatListContainer');
    if (!container) return;

    if (!messages || messages.length === 0) {
        container.innerHTML = `<div class="empty-chat"><i class="ri-chat-smile-2-line" style="font-size: 48px; opacity: 0.5;"></i><p>暂无致敬留言，成为第一个传承者 ✨</p></div>`;
        return;
    }

    // 分离精选留言和非精选留言
    const featuredMsgs = messages.filter(msg => msg.is_approved === 1);
    const normalMsgs = messages.filter(msg => msg.is_approved !== 1);

    let html = '';

    // 精选留言轮播区域（如果有）—— 固定顶部
    if (featuredMsgs.length > 0) {
        let carouselContent = '';
        // 复制一份以实现无缝循环
        [...featuredMsgs, ...featuredMsgs].forEach(msg => {
            carouselContent += `
                <span class="featured-item">
                    <i class="ri-star-fill"></i>
                    <span class="featured-username" onclick="viewUserProfile(${msg.user_id})">${escapeHtml(msg.username)}</span>：
                    ${escapeHtml(msg.content)}
                    <button class="featured-like-btn" data-message-id="${msg.id}">
                        <i class="ri-thumb-up-line"></i> <span class="like-count">${msg.like_count || 0}</span>
                    </button>
                </span>
            `;
        });
        html += `
            <div class="featured-carousel-wrapper">
                <div class="featured-carousel" id="featuredCarousel">
                    <div class="carousel-track">
                        ${carouselContent}
                    </div>
                </div>
            </div>
        `;
    }

    // 非精选留言正常展示
    normalMsgs.forEach(msg => {
        const isFeatured = false;
        const avatarLetter = (msg.username && msg.username.charAt(0)) || '客';
        const timeStr = new Date(msg.created_at).toLocaleString('zh-CN');
        const isAdmin = userInfo && userInfo.role === 'admin';
        const isOwner = userInfo && userInfo.id === msg.user_id;

        // 管理员按钮
        let adminButtons = '';
        if (isAdmin) {
            adminButtons = `
                <div class="admin-actions">
                    <button class="admin-btn-sm approve-btn" data-message-id="${msg.id}" data-action="toggleApprove">
                        <i class="ri-star-line"></i> <span>精选</span>
                    </button>
                    <button class="admin-btn-sm delete-btn" data-message-id="${msg.id}" data-action="deleteMessage">
                        <i class="ri-delete-bin-line"></i> <span>删除</span>
                    </button>
                </div>
            `;
        }

        // 普通用户删除自己的留言按钮
        let ownDeleteButton = '';
        if (!isAdmin && isOwner) {
            ownDeleteButton = `
                <button class="admin-btn-sm delete-my-btn" data-message-id="${msg.id}" data-action="deleteMyMessage">
                    <i class="ri-delete-bin-line"></i> <span>删除</span>
                </button>
            `;
        }

        // 举报按钮（非管理员且非本人）
        let reportButton = '';
        if (userInfo && userInfo.role !== 'admin' && userInfo.id !== msg.user_id) {
            reportButton = `<button class="report-comment-btn" data-message-id="${msg.id}">举报</button>`;
        }

        html += `
            <div class="chat-bubble" data-message-id="${msg.id}">
                <div class="chat-avatar">${escapeHtml(avatarLetter.toUpperCase())}</div>
                <div class="chat-content">
                    <div class="message-header">
                        <div class="user-info">
                            <span class="message-user" onclick="viewUserProfile(${msg.user_id})">${escapeHtml(msg.username)}</span>
                            <span class="message-time">${timeStr}</span>
                        </div>
                    </div>
                    <div class="message-text">${escapeHtml(msg.content)}</div>
                    <div class="message-footer">
                        <div class="like-area" data-message-id="${msg.id}" data-like-action="like">
                            <i class="ri-thumb-up-line"></i> <span class="like-count">${msg.like_count || 0}</span>
                        </div>
                        ${reportButton}
                        ${adminButtons}
                        ${ownDeleteButton}
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}
let reportButton = '';
if (userInfo && userInfo.role !== 'admin' && userInfo.id !== msg.user_id) {
    reportButton = `<button class="report-comment-btn" data-message-id="${msg.id}">举报</button>`;
}
// 然后将 reportButton 添加到 message-footer 中

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function likeMessage(messageId) {
    if (!userInfo) {
        showToast('请先登录后再点赞');
        return;
    }
    fetch(`${API_BASE_URL}/likeMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userInfo.id, messageId: parseInt(messageId) })
    })
    .then(res => res.json())
    .then(data => {
        if (data.code === 200) {
            loadMessages();
        } else {
            showToast(data.msg || '操作失败');
        }
    })
    .catch(() => showToast('网络错误'));
}

function handleAdminApprove(messageId) {
    if (!userInfo || userInfo.role !== 'admin') {
        showToast('无权限');
        return;
    }
    fetch(`${API_BASE_URL}/admin/toggleApproveMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: userInfo.id, messageId: parseInt(messageId) })
    })
    .then(res => res.json())
    .then(data => {
        if (data.code === 200) {
            showToast(data.msg);
            loadMessages();
        } else {
            showToast(data.msg || '操作失败');
        }
    })
    .catch(() => showToast('网络错误'));
}

function handleAdminDelete(messageId) {
    if (!userInfo || userInfo.role !== 'admin') {
        showToast('无权限');
        return;
    }
    if (!confirm('确定删除这条致敬留言吗？')) return;
    fetch(`${API_BASE_URL}/admin/deleteMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: userInfo.id, messageId: parseInt(messageId) })
    })
    .then(res => res.json())
    .then(data => {
        if (data.code === 200) {
            showToast('留言已删除');
            loadMessages();
        } else {
            showToast(data.msg || '删除失败');
        }
    })
    .catch(() => showToast('网络错误'));
}

// 普通用户删除自己的留言
function deleteMyMessage(messageId) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
        showToast('请先登录');
        return;
    }
    if (!confirm('确定删除自己的致敬留言吗？')) return;
    fetch(`${API_BASE_URL}/deleteOwnMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, messageId: parseInt(messageId) })
    })
    .then(res => res.json())
    .then(data => {
        if (data.code === 200) {
            showToast('留言已删除');
            loadMessages(); // 刷新留言列表
        } else {
            showToast(data.msg || '删除失败');
        }
    })
    .catch(() => showToast('网络错误'));
}

function handleChatContainerClick(e) {
    const likeArea = e.target.closest('.like-area');
    if (likeArea) {
        e.preventDefault();
        const msgId = likeArea.getAttribute('data-message-id');
        if (msgId) likeMessage(msgId);
        return;
    }
    const reportBtn = e.target.closest('.report-comment-btn');
if (reportBtn) {
    e.preventDefault();
    const msgId = reportBtn.getAttribute('data-message-id');
    showReportModal('comment', msgId);
    return;
}

    const adminBtn = e.target.closest('.admin-btn-sm');
    if (adminBtn) {
        e.preventDefault();
        const msgId = adminBtn.getAttribute('data-message-id');
        const action = adminBtn.getAttribute('data-action');
        if (msgId) {
            if (action === 'toggleApprove') {
                handleAdminApprove(msgId);
            } else if (action === 'deleteMessage') {
                handleAdminDelete(msgId);
            } else if (action === 'deleteMyMessage') {
                deleteMyMessage(msgId);
            }
        }
    }
}

function postMessage() {
    const content = document.getElementById('messageContent').value.trim();
    if (!content) {
        showToast('内容不能为空');
        return;
    }
    fetch(`${API_BASE_URL}/postMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userInfo.id, content })
    })
    .then(res => res.json())
    .then(data => {
        if (data.code === 200) {
            if (data.warning) showToast('留言成功，但含敏感词已替换');
            else showToast('致敬发布成功！');
            document.getElementById('messageContent').value = '';
            loadMessages();
        } else {
            showToast(data.msg || '发布失败');
        }
    });
}

function viewUserProfile(userId) {
    window.location.href = `user.html?view=${userId}`;
}
// ---------- 身临其境小游戏 ----------
let gameActive = false; // 游戏是否进行中

// 游戏状态机
let currentGameStep = null; // 存储当前步骤ID

// 游戏步骤定义
const gameSteps = {
    // 开始
    start: {
        text: "❄️ 你作为杨靖宇将军的亲兵，跟随部队在零下40度的长白山区转战。\n\n连日激战，粮尽援绝，你和将军已经几天没有进食。将军面容坚毅，但你知道他也已筋疲力尽。\n\n现在，你面临人生的抉择：",
        options: [
            { text: "跟随将军继续前进", next: "follow" },
            { text: "主动留下断后", next: "stay" },
            { text: "只身引开追敌", next: "distract" }
        ]
    },
    // 跟随将军路线
    follow: {
        text: "你决定跟随杨将军。雪深没膝，每一步都耗尽力气。突然，你的胃如刀绞般疼痛——太饿了。",
        options: [
            { text: "寻找食物（只能吃草根）", next: "eatGrass" }
        ]
    },
    eatGrass: {
        text: "你拨开积雪，扒出枯黄的草根，艰难地咀嚼。苦涩的草根勉强让胃不再痉挛，但干渴又袭来。",
        options: [
            { text: "寻找水源（只能吃雪）", next: "drinkSnow" }
        ]
    },
    drinkSnow: {
        text: "你捧起一把雪塞进嘴里，冰冷刺激得牙齿打颤。稍作喘息，忽然远处传来犬吠和日军的嚎叫——敌人追上来了！\n\n你们被包围了！",
        options: [
            { text: "拼死一搏，冲上去！", next: "fight" },
            { text: "隐蔽躲藏", next: "hide" }
        ]
    },
    fight: {
        text: "你大吼一声，端起早已没有子弹的步枪，向敌人冲去。子弹穿透你的胸膛，你倒在血泊中，眼前浮现将军坚毅的背影……\n\n⚰️ 你英勇战死，但为将军争取了宝贵时间。",
        options: [],
        isDeath: true
    },
    hide: {
        text: "你躲在一块巨石后，屏住呼吸。然而一只军犬嗅到了你的气味，狂吠引来日军。乱枪之下，你身中数弹……\n\n⚰️ 你牺牲了，但将军趁机突围。",
        options: [],
        isDeath: true
    },
    // 留下断后
    stay: {
        text: "你主动要求留下断后，杨将军深深看了你一眼，点头默许。你抱着仅剩的两颗手榴弹，藏身在隘口。\n\n日军蜂拥而至，你拉响手榴弹，与数名敌人同归于尽。\n\n⚰️ 你壮烈殉国，用生命掩护了将军转移。",
        options: [],
        isDeath: true
    },
    // 只身引敌
    distract: {
        text: "你决定只身引开敌人。你向相反方向奔跑，边跑边开枪吸引注意。\n\n跑了不知多久，前方出现岔路，你需要选择一个方向：",
        options: [
            { text: "向东", next: "die" },
            { text: "向南", next: "die" },
            { text: "向西", next: "die" },
            { text: "向北", next: "die" }
        ]
    },
    die: {
        text: "你选的方向通往悬崖绝壁，追兵堵住退路。你转身面对敌人，高呼“抗联万岁！”饮弹殉国。\n\n⚰️ 你为革命流尽最后一滴血。",
        options: [],
        isDeath: true
    }
};

// 渲染游戏界面
function renderGameStep(stepId) {
    const step = gameSteps[stepId];
    if (!step) return;

    // 更新内容区
    const contentDiv = document.getElementById('gameContent');
    const buttonsDiv = document.getElementById('gameButtons');
    if (!contentDiv || !buttonsDiv) return;

    contentDiv.innerHTML = step.text.replace(/\n/g, '<br>');

    // 清空并重新生成按钮
    buttonsDiv.innerHTML = '';
    if (step.options && step.options.length > 0) {
        step.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'game-option-btn';
            btn.textContent = opt.text;
            btn.onclick = () => {
                if (gameSteps[opt.next]) {
                    renderGameStep(opt.next);
                } else {
                    // 如果下一步不存在，默认结束
                    endGame();
                }
            };
            buttonsDiv.appendChild(btn);
        });
    } else {
        // 没有选项（死亡结局），显示一个“结束游戏”按钮
        const endBtn = document.createElement('button');
        endBtn.className = 'game-option-btn';
        endBtn.textContent = '游戏结束';
        endBtn.onclick = endGame;
        buttonsDiv.appendChild(endBtn);
    }

    // 如果步骤标记为死亡，还可以自动结束（但保留用户点击）
    if (step.isDeath) {
        // 可添加额外效果，但不自动关闭
    }
}

// 开始游戏
function startGame() {
    if (gameActive) return;
    gameActive = true;
    currentGameStep = 'start';
    renderGameStep('start');
    document.getElementById('gameModal').classList.add('active');
}

// 结束游戏并关闭模态框
function endGame() {
    gameActive = false;
    document.getElementById('gameModal').classList.remove('active');
    // 可选：重置游戏状态
    currentGameStep = null;
}

// 绑定游戏相关事件
function bindGameEvents() {
    const immerseBtn = document.getElementById('immerseBtn');
    if (immerseBtn) immerseBtn.addEventListener('click', startGame);

    const gameClose = document.getElementById('gameClose');
    if (gameClose) gameClose.addEventListener('click', endGame);

    const gameExitBtn = document.getElementById('gameExitBtn');
    if (gameExitBtn) gameExitBtn.addEventListener('click', endGame);
}
let currentReportTarget = { type: null, id: null };

function showReportModal(type, id) {
    currentReportTarget = { type, id };
    document.getElementById('reportModal').classList.add('active');
}

function hideReportModal() {
    document.getElementById('reportModal').classList.remove('active');
    document.getElementById('reportReason').value = '';
}

async function submitReport() {
    const reason = document.getElementById('reportReason').value.trim();
    if (!reason) {
        showToast('请填写举报原因');
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

const reportClose = document.getElementById('reportClose');
if (reportClose) reportClose.addEventListener('click', hideReportModal);

const submitReportBtn = document.getElementById('submitReportBtn');
if (submitReportBtn) submitReportBtn.addEventListener('click', submitReport);

// ========== 举报功能（复用 user.js 中的逻辑） ==========

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

// 绑定举报模态框事件（在页面加载后调用）
function bindReportModalEvents() {
    const closeBtn = document.getElementById('reportClose');
    if (closeBtn) closeBtn.addEventListener('click', hideReportModal);
    const submitBtn = document.getElementById('submitReportBtn');
    if (submitBtn) submitBtn.addEventListener('click', submitReport);
}
setTimeout(() => bindReportModalEvents(), 500);

// 精选轮播点击展示所有精选（占位函数）
function showAllFeatured() {
    showToast('精选致敬展示中');
}
// 全屏视频自动播放结束后淡出并显示主内容
function initOpeningVideo() {
    const videoContainer = document.getElementById('openingVideo');
    const video = document.getElementById('introVideo');
    const mainContent = document.getElementById('appContent');

    if (!video || !videoContainer || !mainContent) {
        console.warn('开场视频所需元素缺失，直接显示主内容');
        if (mainContent) mainContent.style.opacity = '1';
        if (videoContainer) videoContainer.style.display = 'none';
        return;
    }

    // 视频播放结束后淡出
    video.addEventListener('ended', function() {
        videoContainer.classList.add('fade-out');
        mainContent.style.opacity = '1';
        setTimeout(() => {
            videoContainer.style.display = 'none';
        }, 500);
    });

    // 开始播放视频（静音视频通常可以自动播放）
    video.play().catch(err => {
        console.error('视频自动播放失败:', err);
        // 播放失败时直接显示主内容，同时隐藏视频容器
        mainContent.style.opacity = '1';
        videoContainer.style.display = 'none';
    });
}

// 在 DOM 加载完成后调用
document.addEventListener('DOMContentLoaded', function() {
    initOpeningVideo();
});