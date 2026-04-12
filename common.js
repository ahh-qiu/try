// common.js - 公共脚本
const API_BASE_URL = 'https://b578761.r39.cpolar.top/api';
const TOKEN_KEY = "yangjingyu_token";

// 省份名称映射
const provinceNameMap = {
    "北京市": "北京", "上海市": "上海", "天津市": "天津", "重庆市": "重庆",
    "河北省": "河北", "山西省": "山西", "辽宁省": "辽宁", "吉林省": "吉林",
    "黑龙江省": "黑龙江", "江苏省": "江苏", "浙江省": "浙江", "安徽省": "安徽",
    "福建省": "福建", "江西省": "江西", "山东省": "山东", "河南省": "河南",
    "湖北省": "湖北", "湖南省": "湖南", "广东省": "广东", "海南省": "海南",
    "四川省": "四川", "贵州省": "贵州", "云南省": "云南", "陕西省": "陕西",
    "甘肃省": "甘肃", "青海省": "青海", "内蒙古自治区": "内蒙古",
    "广西壮族自治区": "广西", "西藏自治区": "西藏", "宁夏回族自治区": "宁夏",
    "新疆维吾尔自治区": "新疆", "台湾省": "台湾", "香港特别行政区": "香港",
    "澳门特别行政区": "澳门"
};

// 全局变量
let userInfo = null;
let ipInfo = { ip: "", province: "", city: "" };
let isLightToday = false;

// 显示提示
function showToast(text) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = text;
    toast.style.display = 'block';
    setTimeout(() => {
        toast.style.display = 'none';
    }, 2000);
}

// 获取随机颜色（弹幕用）
function getRandomColor() {
    const colors = ['#c8102e', '#e63946', '#ff6b6b', '#ff8181', '#ff4d4f'];
    return colors[Math.floor(Math.random() * colors.length)];
}

// 时间格式化
function formatTime(date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}:${String(date.getSeconds()).padStart(2,'0')}`;
}

// 更新导航栏UI
function updateLoginUI() {
    const authBtn = document.getElementById('auth-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userNameSpan = document.getElementById('userName');
    if (!authBtn) return;
    if (userInfo) {
        authBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'inline-block';
        if (userNameSpan) {
            userNameSpan.style.display = 'inline-block';
            userNameSpan.textContent = userInfo.username;
        }
    } else {
        authBtn.style.display = 'inline-block';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (userNameSpan) userNameSpan.style.display = 'none';
    }
}

// 清除登录状态
function clearLoginStatus() {
    localStorage.removeItem(TOKEN_KEY);
    userInfo = null;
    isLightToday = false;
    updateLoginUI();
    const postMessageBox = document.getElementById('postMessageBox');
    if (postMessageBox) postMessageBox.style.display = 'none';
    const quizBtn = document.getElementById('quizBtn');
    if (quizBtn) quizBtn.disabled = true;
    const tributeBtn = document.getElementById('tributeBtn');
    if (tributeBtn) {
        tributeBtn.disabled = true;
        const btnText = document.getElementById('tributeBtnText');
        if (btnText) btnText.textContent = '请先登录';
    }
}

// 登出
function logout() {
    clearLoginStatus();
    showToast('已退出登录！');
    if (window.location.pathname.includes('user.html')) {
        setTimeout(() => window.location.href = 'index.html', 1500);
    } else {
        // 刷新页面重置状态
        window.location.reload();
    }
}

// 获取用户IP省份（仅用于显示）
function getUserIpProvince() {
    if (!userInfo) {
        const ipDisplay = document.getElementById('ipDisplay');
        if (ipDisplay) ipDisplay.style.display = 'none';
        return;
    }
    fetch(`${API_BASE_URL}/getIpProvince`)
        .then(res => res.json())
        .then(data => {
            if (data.code === 200) {
                ipInfo = { ip: data.ip, province: data.province, city: data.city };
                const ipDisplay = document.getElementById('ipDisplay');
                if (ipDisplay) {
                    ipDisplay.textContent = `归属：${ipInfo.province}`;
                    ipDisplay.style.display = 'inline-block';
                }
            }
        })
        .catch(err => console.error('IP解析失败:', err));
}

// 加载点亮数据（供地图调用）
function loadLightData(callback) {
    fetch(`${API_BASE_URL}/getLightData`)
        .then(res => res.json())
        .then(data => {
            if (data.code === 200) {
                const mappedData = data.data.map(item => ({
                    name: provinceNameMap[item.province] || item.province,
                    value: item.value
                }));
                if (callback) callback(mappedData);
            } else if (callback) callback([]);
        })
        .catch(err => {
            console.error('加载点亮数据失败:', err);
            if (callback) callback([]);
        });
}

// 检查今日是否已点亮
function checkLightToday() {
    if (!userInfo) return Promise.resolve(false);
    return fetch(`${API_BASE_URL}/checkLightToday`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userInfo.id })
    })
    .then(res => res.json())
    .then(data => {
        isLightToday = data.isLightToday;
        return isLightToday;
    })
    .catch(() => false);
}

// 更新致敬按钮状态
function updateTributeBtnStatus() {
    const btn = document.getElementById('tributeBtn');
    const btnText = document.getElementById('tributeBtnText');
    if (!btn) return;
    if (!userInfo) {
        btn.disabled = true;
        if (btnText) btnText.textContent = '请先登录';
    } else if (isLightToday) {
        btn.disabled = true;
        if (btnText) btnText.textContent = '今日已致敬';
    } else {
        btn.disabled = false;
        if (btnText) btnText.textContent = '向英雄致敬';
    }
}

// 更新答题按钮状态
function updateQuizBtnStatus() {
    const quizBtn = document.getElementById('quizBtn');
    if (quizBtn) quizBtn.disabled = !userInfo;
}