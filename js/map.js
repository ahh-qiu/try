// map/map.js - 地图模块脚本
let myChart = null;
let danmuInstance = null;
const presetDanmuList = [
    "🇨🇳 致敬英雄，永垂不朽！",
    "星星之火可以燎原 🔥",
    "铭记历史，吾辈自强 ✨",
    "山河无恙，英雄不朽 ❤️",
    "通化杨靖宇，民族脊梁！",
    "向所有抗日英雄致敬 🙏",
    "红色基因，代代相传 🌟",
    "一寸山河一寸血 💪",
    "不忘初心，牢记使命",
    "伟大的抗战精神永存！"
];

// 初始化地图
function initMap() {
    myChart = echarts.init(document.getElementById('map-container'));
    const option = {
        backgroundColor: '#fff',
        title: { show: false },
        tooltip: {
            trigger: 'item',
            formatter: function(params) {
                return params.name + '<br/>点亮次数：' + (params.value || 0);
            },
            textStyle: { fontSize: 14 }
        },
        visualMap: {
            show: false,
            min: 0,
            max: 40,
            inRange: {
                color: ['#fff5f5', '#ffe0e0', '#ff8181', '#ff1818', '#b30000']
            },
            calculable: true
        },
        series: [{
            name: '点亮次数',
            type: 'map',
            mapType: 'china',
            roam: false,
            label: { show: true, fontSize: 12, color: '#333' },
            emphasis: {
                label: { color: '#c8102e', fontSize: 14 },
                itemStyle: { areaColor: '#ffe0e0' }
            },
            data: []
        }]
    };
    myChart.setOption(option);
    window.addEventListener('resize', () => myChart && myChart.resize());
    
    // 加载点亮数据
    loadLightData((data) => {
        if (data && data.length) {
            myChart.setOption({ series: [{ data: data }] });
        }
    });
}

// 更新地图点亮数据
function updateMapLight(province) {
    if (!myChart) return;
    const seriesData = myChart.getOption().series[0].data;
    let newData = [...seriesData];
    const targetName = provinceNameMap[province] || province;
    const index = newData.findIndex(item => item.name === targetName);
    if (index > -1) {
        newData[index].value = (newData[index].value || 0) + 1;
    } else {
        newData.push({ name: targetName, value: 1 });
    }
    myChart.setOption({ series: [{ data: newData }] });
}

// 发送弹幕
function sendDanmu(text, isOwn = false) {
    if (!danmuInstance) return;
    if (document.visibilityState === 'hidden') {
        const checkVisible = () => {
            if (document.visibilityState === 'visible') {
                document.removeEventListener('visibilitychange', checkVisible);
                actuallySendDanmu(text, isOwn);
            }
        };
        document.addEventListener('visibilitychange', checkVisible);
        return;
    }
    actuallySendDanmu(text, isOwn);
}

function actuallySendDanmu(text, isOwn) {
    const speed = 20 + Math.pow(Math.random(), 1.5) * 180;
    const opacity = isOwn ? 0.95 : 0.7 + Math.random() * 0.2;
    const channel = Math.floor(Math.random() * 30);
    danmuInstance.emit({
        text: text,
        style: {
            color: getRandomColor(),
            fontSize: 24 + Math.random() * 12,
            opacity: opacity
        },
        speed: speed,
        channel: channel
    });
    setTimeout(() => {
        if (danmuInstance && typeof danmuInstance.clearExpired === 'function') {
            danmuInstance.clearExpired();
        }
    }, 5000);
}

// 发送预设弹幕
function sendPresetDanmu(count) {
    if (count <= 0) return;
    const randomText = presetDanmuList[Math.floor(Math.random() * presetDanmuList.length)];
    sendDanmu(randomText, false);
    setTimeout(() => sendPresetDanmu(count - 1), 3000 + Math.random() * 4000);
}

// 加载历史弹幕
function loadHistoryDanmu() {
    fetch(`${API_BASE_URL}/getAllDanmu`)
        .then(res => res.json())
        .then(data => {
            if (data.code === 200 && data.danmuList.length > 0) {
                const shuffled = data.danmuList.sort(() => Math.random() - 0.5);
                function sendNext(index) {
                    if (index >= shuffled.length) return;
                    sendDanmu(shuffled[index].danmu_content, false);
                    setTimeout(() => sendNext(index + 1), 2000 + Math.random() * 4000);
                }
                sendNext(0);
            }
        })
        .catch(err => console.error('加载历史弹幕失败:', err));
}

// 初始化弹幕
function initDanmu() {
    danmuInstance = new Danmaku({
        container: document.getElementById('danmu'),
        speed: 80,
        channelCount: 30,
        channelHeight: 30,
        fontSize: 18,
        opacity: 0.95
    });
    if (danmuInstance && typeof danmuInstance.play === 'function') {
        danmuInstance.play();
    }
    sendPresetDanmu(10);
    loadHistoryDanmu();
    setInterval(() => loadHistoryDanmu(), 90000);
    setInterval(() => sendPresetDanmu(5), 45000);
}

// 致敬操作
function handleTribute() {
    if (!userInfo || isLightToday || !ipInfo.province) return;
    const hometown = userInfo.hometown || '中国';
    const emojis = ['🇨🇳', '✨', '❤️', '🙏', '🌟', '🔥'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    const danmuText = `我是${hometown}人，我在${ipInfo.province}${ipInfo.city}向您致敬 ${randomEmoji}`;

    fetch(`${API_BASE_URL}/lightProvince`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: userInfo.id,
            province: ipInfo.province,
            danmuContent: danmuText
        })
    }).then(res => res.json())
    .then(data => {
        if (data.code === 200) {
            isLightToday = true;
            updateTributeBtnStatus();
            updateMapLight(ipInfo.province);
            sendDanmu(danmuText, true);
            showToast('致敬成功！');
        } else {
            showToast(data.msg || '致敬失败，请重试');
        }
    }).catch(err => {
        showToast('网络错误，请重试');
    });
}