const express = require('express');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const cors = require('cors');
const Ip2Region = require('ip2region').default;

const app = express();
const PORT = 3000;

app.use(cors());
// 托管当前目录下的所有静态文件（包括 .mp4、.css、.js 等）
app.use(express.static(__dirname));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 数据库配置（请修改为你的密码）
const DB_CONFIG = {
  host: 'localhost',
  user: 'root',
  password: '123456', // 请修改为你的MySQL密码
  database: 'yangjingyu_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const ip2region = new Ip2Region({ enableMemorySearch: true, enableFileCache: true });
const pool = mysql.createPool(DB_CONFIG);

// ------------- 工具函数 -------------
function generateToken(userId) {
  return `${userId}-${crypto.randomBytes(16).toString('hex')}-${Date.now()}`;
}
function md5(str) { return crypto.createHash('md5').update(str).digest('hex'); }
function formatTime(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}:${String(date.getSeconds()).padStart(2,'0')}`;
}
// 转义正则表达式特殊字符
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 获取真实IP（兼容代理）
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket.remoteAddress ||
    '127.0.0.1'
  );
}

// 核心：IP解析函数
function parseIpToProvince(ip) {
  try {
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
      return { province: '吉林省', city: '通化市' };
    }
    const ipInfo = ip2region.search(ip);
    const regionStr = ipInfo?.region || '0|0|未知省份|未知城市|0|0';
    const regionArr = regionStr.split('|');
    return {
      province: regionArr[2] || '未知省份',
      city: regionArr[3] || '未知城市'
    };
  } catch (err) {
    console.error('IP解析失败:', err);
    return { province: '未知省份', city: '未知城市' };
  }
}

// ------------- 敏感词缓存（优化性能） -------------
let sensitiveWordsCache = [];
let cacheLastUpdate = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1小时

async function getSensitiveWords() {
  const now = Date.now();
  if (sensitiveWordsCache.length && (now - cacheLastUpdate) < CACHE_TTL) {
    return sensitiveWordsCache;
  }
  try {
    const [rows] = await pool.execute('SELECT word FROM sensitive_words');
    sensitiveWordsCache = rows.map(r => r.word);
    cacheLastUpdate = now;
    console.log(`敏感词缓存已更新，共 ${sensitiveWordsCache.length} 条`);
  } catch (err) {
    console.error('加载敏感词失败:', err);
    sensitiveWordsCache = [];
  }
  return sensitiveWordsCache;
}

// ------------- 原有接口（保持）-------------
// 1. 注册
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, gender, hometown } = req.body;
    if (!username || !password || !gender || !hometown) return res.json({ code:400, msg:'参数不全' });
    // 获取敏感词列表
const sensitiveWords = await getSensitiveWords();
let hasSensitive = false;
for (const word of sensitiveWords) {
    if (username.includes(word)) {
        return res.json({ code: 400, msg: '用户名包含敏感词，请更换' });
    }
}
    const [exist] = await pool.execute('SELECT id FROM `user` WHERE username=?', [username]);
    if (exist.length) return res.json({ code:400, msg:'用户名已存在' });

    const clientIp = getClientIp(req);
    const { province: registerProvince } = parseIpToProvince(clientIp);

    const [result] = await pool.execute(
      'INSERT INTO `user` (username, password, gender, hometown, register_ip, register_province) VALUES (?,?,?,?,?,?)',
      [username, md5(password), gender, hometown, clientIp, registerProvince]
    );
    res.json({ code:200, msg:'注册成功', userId:result.insertId });
  } catch (err) { console.error(err); res.json({ code:500, msg:'服务器错误' }); }
});

// 2. 登录（增强错误提示）
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ code: 400, msg: '用户名和密码不能为空' });

    // 先查询用户名是否存在
    const [users] = await pool.execute('SELECT id, username, gender, hometown, phone, role, register_ip, last_login_ip, last_login_province FROM `user` WHERE username=?', [username]);
    if (users.length === 0) {
      return res.json({ code: 400, msg: '用户名不存在' });
    }

    const user = users[0];
    // 再验证密码（存储的是md5值）
    const [validUser] = await pool.execute('SELECT id FROM `user` WHERE username=? AND password=?', [username, md5(password)]);
    if (validUser.length === 0) {
      return res.json({ code: 400, msg: '密码错误' });
    }

    const clientIp = getClientIp(req);
    const { province: lastLoginProvince } = parseIpToProvince(clientIp);

    await pool.execute('UPDATE `user` SET last_login_time=NOW(), last_login_ip=?, last_login_province=? WHERE id=?', [clientIp, lastLoginProvince, user.id]);

    const token = generateToken(user.id);
    await pool.execute('INSERT INTO token_record (user_id, token, expire_time) VALUES (?,?,DATE_ADD(NOW(),INTERVAL 7 DAY))', [user.id, token]);

    res.json({
      code: 200, msg: '登录成功', token,
      userInfo: {
        id: user.id, username: user.username, gender: user.gender, hometown: user.hometown,
        phone: user.phone || '', role: user.role || 'user',
        registerIp: user.register_ip || '未知', registerProvince: user.register_province || '未知',
        lastLoginIp: clientIp, lastLoginProvince: lastLoginProvince,
        last_profile_update: user.last_profile_update
      }
    });
  } catch (err) {
    console.error(err);
    res.json({ code: 500, msg: '服务器错误' });
  }
});

// 3. Token验证
app.post('/api/verifyToken', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.json({ success:false, msg:'Token为空' });

    const [tokenList] = await pool.execute(
      'SELECT tr.user_id, u.username, u.gender, u.hometown, u.phone, u.role, u.register_ip, u.last_login_ip, u.last_login_province, u.last_profile_update FROM token_record tr JOIN `user` u ON tr.user_id=u.id WHERE tr.token=? AND tr.expire_time>NOW()',
      [token]
    );
    if (tokenList.length === 0) return res.json({ success:false, msg:'Token失效' });

    const user = tokenList[0];
    res.json({
      success:true,
      userInfo:{
        id:user.user_id, username:user.username, gender:user.gender, hometown:user.hometown,
        phone:user.phone||'', role:user.role||'user',
        registerIp:user.register_ip||'未知', registerProvince:user.register_province||'未知',
        lastLoginIp:user.last_login_ip||'未知', lastLoginProvince:user.last_login_province||'未知',
        last_profile_update:user.last_profile_update
      }
    });
  } catch (err) { console.error(err); res.json({ success:false, msg:'服务器错误' }); }
});

// 4. IP解析接口
app.get('/api/getIpProvince', async (req, res) => {
  try {
    const clientIp = getClientIp(req);
    const { province, city } = parseIpToProvince(clientIp);
    res.json({ code:200, ip:clientIp, province, city });
  } catch (err) { res.json({ code:500, ip:'未知', province:'未知省份', city:'未知城市' }); }
});

// 5. 点亮省份
app.post('/api/lightProvince', async (req, res) => {
  try {
    const { userId, province: targetProvince, danmuContent } = req.body;
    if (!userId || !targetProvince) return res.json({ code:400, msg:'参数不全' });

    const [todayLight] = await pool.execute('SELECT id FROM province_light WHERE user_id=? AND light_date=CURDATE()', [userId]);
    if (todayLight.length) return res.json({ code:400, msg:'今日已点亮' });

    const clientIp = getClientIp(req);
    const { province: lightProvince, city: lightCity } = parseIpToProvince(clientIp);

    const [insertResult] = await pool.execute(
      'INSERT INTO province_light (user_id, ip, province, city, light_date, danmu_content, ip_province) VALUES (?, ?, ?, ?, CURDATE(), ?, ?)',
      [userId, clientIp, lightProvince || targetProvince, lightCity, danmuContent||'', lightProvince || targetProvince]
    );

    await pool.execute(
  'INSERT INTO province_statistics (province, light_count) VALUES (?, 1) ON DUPLICATE KEY UPDATE light_count = light_count + 1',
  [targetProvince]
);

    // 更新连续点亮记录
    const today = new Date().toISOString().split('T')[0];
    const [streak] = await pool.execute('SELECT * FROM light_streak WHERE user_id=?', [userId]);
    if (streak.length === 0) {
      await pool.execute('INSERT INTO light_streak (user_id, last_light_date, streak_days) VALUES (?, ?, 1)', [userId, today]);
    } else {
      const lastDate = streak[0].last_light_date;
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      let newStreak = 1;
      if (lastDate === yesterday) {
        newStreak = streak[0].streak_days + 1;
      }
      await pool.execute('UPDATE light_streak SET last_light_date=?, streak_days=? WHERE user_id=?', [today, newStreak, userId]);
    }

    res.json({ code:200, msg:'致敬成功', recordId:insertResult.insertId });
  } catch (err) {
    console.error('点亮省份报错:', err);
    res.json({ code:500, msg:'服务器错误' });
  }
});

// 6. 获取用户点亮记录
app.post('/api/getLightRecords', async (req, res) => {
  try {
    const { userId } = req.body;
    const [records] = await pool.execute('SELECT ip, province, city, light_time, danmu_content FROM province_light WHERE user_id=? ORDER BY light_time DESC', [userId]);
    res.json({ code:200, records:records.map(item=>({
      ip:item.ip||'未知',
      province:item.province||'未知',
      city:item.city||'未知',
      lightTime:formatTime(new Date(item.light_time)),
      danmuContent:item.danmu_content||'无'
    })) });
  } catch (err) { console.error(err); res.json({ code:500, records:[] }); }
});
// 获取指定用户信息（公开）
app.post('/api/getUserInfo', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.json({ code:400, msg:'参数不全' });
    const [users] = await pool.execute(
      'SELECT id, username, gender, hometown, phone, role, register_ip, register_province, last_login_ip, last_login_province, last_profile_update FROM user WHERE id=?',
      [userId]
    );
    if (users.length === 0) return res.json({ code:404, msg:'用户不存在' });
    const user = users[0];
    res.json({
      code:200,
      userInfo: {
        id: user.id,
        username: user.username,
        gender: user.gender,
        hometown: user.hometown,
        phone: user.phone || '',
        role: user.role,
        registerIp: user.register_ip || '未知',
        registerProvince: user.register_province || '未知',
        lastLoginIp: user.last_login_ip || '未知',
        lastLoginProvince: user.last_login_province || '未知',
        last_profile_update: user.last_profile_update
      }
    });
  } catch (err) {
    console.error(err);
    res.json({ code:500, msg:'服务器错误' });
  }
});

// 7. 其他原有接口
app.get('/api/getLightData', async (req, res) => {
  const [data] = await pool.execute('SELECT province, light_count AS value FROM province_statistics WHERE light_count>0', []);
  res.json({ code:200, data });
});
app.post('/api/updateUserInfo', async (req, res) => {
  const { userId, gender, hometown, phone } = req.body;
  await pool.execute('UPDATE `user` SET gender=?, hometown=?, phone=?, last_profile_update=CURDATE() WHERE id=?', [gender, hometown, phone||'', userId]);
  res.json({ code:200, msg:'修改成功' });
});
app.post('/api/checkLightToday', async (req, res) => {
  const [r] = await pool.execute('SELECT id FROM province_light WHERE user_id=? AND light_date=CURDATE()', [req.body.userId]);
  res.json({ code:200, isLightToday:r.length>0 });
});
app.get('/api/getAllDanmu', async (req, res) => {
  const [d] = await pool.execute('SELECT u.username, pl.province, pl.danmu_content, pl.light_time FROM province_light pl JOIN `user` u ON pl.user_id=u.id WHERE pl.danmu_content!="" ORDER BY pl.light_time DESC LIMIT 100', []);
  res.json({ code:200, danmuList:d });
});

// ------------- 答题系统 -------------

// 检查今日是否已答题
app.post('/api/checkQuizToday', async (req, res) => {
  try {
    const { userId } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const [rows] = await pool.execute('SELECT id FROM daily_quiz WHERE user_id=? AND quiz_date=?', [userId, today]);
    res.json({ code:200, hasTaken: rows.length > 0 });
  } catch (err) {
    res.json({ code:500, hasTaken: false });
  }
});

// 获取今日随机30题（从数据库）
app.get('/api/dailyQuiz', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, question, option_a, option_b, option_c, option_d FROM quiz_bank ORDER BY RAND() LIMIT 30'
    );
    const questions = rows.map(q => {
      let options = [q.option_a, q.option_b];
      if (q.option_c && q.option_c.trim() !== '') options.push(q.option_c);
      if (q.option_d && q.option_d.trim() !== '') options.push(q.option_d);
      return {
        id: q.id,
        question: q.question,
        options: options
      };
    });
    res.json({ code:200, questions });
  } catch (err) {
    console.error(err);
    res.json({ code:500, msg:'服务器错误' });
  }
});

// 提交答题结果（支持空答案表示失败）
app.post('/api/submitQuiz', async (req, res) => {
  try {
    const { userId, answers } = req.body;
    if (!userId) return res.json({ code:400, msg:'参数不全' });

    const today = new Date().toISOString().split('T')[0];

    // 如果 answers 为空或长度为0，表示挑战失败
    if (!answers || answers.length === 0) {
      const [existing] = await pool.execute('SELECT id FROM daily_quiz WHERE user_id=? AND quiz_date=?', [userId, today]);
      if (existing.length > 0) {
        return res.json({ code:400, msg:'今日已经答过题，请明天再来' });
      }
      await pool.execute(
        'INSERT INTO daily_quiz (user_id, quiz_date, score, total, is_passed) VALUES (?, ?, ?, ?, ?)',
        [userId, today, 0, 30, 0]
      );
      return res.json({ code:200, msg:'挑战失败，明天再试！' });
    }

    // 正常提交
    const [existing] = await pool.execute('SELECT id FROM daily_quiz WHERE user_id=? AND quiz_date=?', [userId, today]);
    if (existing.length > 0) {
      return res.json({ code:400, msg:'今日已经答过题，请明天再来' });
    }

    const questionIds = answers.map(a => a.questionId);
    const placeholders = questionIds.map(() => '?').join(',');
    const [rows] = await pool.execute(
      `SELECT id, answer FROM quiz_bank WHERE id IN (${placeholders})`,
      questionIds
    );
    const answerMap = {};
    rows.forEach(r => { answerMap[r.id] = r.answer; });

    let correctCount = 0;
    answers.forEach(a => {
      if (answerMap[a.questionId] === a.selectedOptionIndex) correctCount++;
    });

    const isPassed = correctCount === 30;

    await pool.execute(
      'INSERT INTO daily_quiz (user_id, quiz_date, score, total, is_passed) VALUES (?, ?, ?, ?, ?)',
      [userId, today, correctCount, 30, isPassed]
    );

    if (isPassed) {
      const [badge] = await pool.execute('SELECT id FROM user_badge WHERE user_id=? AND badge_type="quiz_pass" AND earned_date=?', [userId, today]);
      if (badge.length === 0) {
        await pool.execute('INSERT INTO user_badge (user_id, badge_type, earned_date) VALUES (?, "quiz_pass", ?)', [userId, today]);
      }
    }

    // 检查连续7天全对且连续7天点亮
    const [sevenDays] = await pool.execute(
      `SELECT COUNT(*) as cnt FROM daily_quiz WHERE user_id=? AND quiz_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND is_passed=1`,
      [userId]
    );
    const [lightStreak] = await pool.execute('SELECT streak_days FROM light_streak WHERE user_id=?', [userId]);
    const lightDays = lightStreak.length ? lightStreak[0].streak_days : 0;

    if (sevenDays[0].cnt >= 7 && lightDays >= 7) {
      const [weekly] = await pool.execute('SELECT id FROM user_badge WHERE user_id=? AND badge_type="weekly_master"', [userId]);
      if (weekly.length === 0) {
        await pool.execute('INSERT INTO user_badge (user_id, badge_type, earned_date) VALUES (?, "weekly_master", ?)', [userId, today]);
      }
    }

    res.json({ code:200, msg: isPassed ? '恭喜！全对！' : `答对${correctCount}题，再接再厉`, correctCount });
  } catch (err) {
    console.error(err);
    res.json({ code:500, msg:'服务器错误' });
  }
});

// 获取用户徽章
app.post('/api/getUserBadges', async (req, res) => {
  try {
    const { userId } = req.body;
    const [badges] = await pool.execute('SELECT badge_type, earned_date FROM user_badge WHERE user_id=? ORDER BY earned_date DESC', [userId]);
    res.json({ code:200, badges });
  } catch (err) {
    res.json({ code:500, badges:[] });
  }
});

// 验证单题答案（逐题验证）
app.post('/api/verifySingleQuiz', async (req, res) => {
  try {
    const { userId, questionId, selectedOptionIndex } = req.body;
    if (!userId || !questionId || selectedOptionIndex === undefined) {
      return res.json({ code: 400, msg: '参数不全' });
    }
    const [rows] = await pool.execute('SELECT answer FROM quiz_bank WHERE id=?', [questionId]);
    if (rows.length === 0) return res.json({ code: 404, msg: '题目不存在' });
    const correct = (rows[0].answer === selectedOptionIndex);
    res.json({ code: 200, correct });
  } catch (err) {
    console.error(err);
    res.json({ code: 500, msg: '服务器错误' });
  }
});

// ------------- 留言墙系统（优化版） -------------

// 发布留言（使用缓存敏感词，带正则转义）
app.post('/api/postMessage', async (req, res) => {
  try {
    const { userId, content } = req.body;
    if (!userId || !content) return res.json({ code:400, msg:'参数不全' });

    // 获取敏感词列表（使用缓存）
    const sensitiveWords = await getSensitiveWords();

    let filteredContent = content;
    let hasSensitive = false;

    for (const word of sensitiveWords) {
      if (!word) continue;
      try {
        const escapedWord = escapeRegExp(word);
        const regex = new RegExp(escapedWord, 'gi');
        if (regex.test(filteredContent)) {
          filteredContent = filteredContent.replace(regex, '***');
          hasSensitive = true;
        }
      } catch (regexErr) {
        console.error(`敏感词 "${word}" 正则错误:`, regexErr.message);
        continue;
      }
    }

    await pool.execute(
      'INSERT INTO message (user_id, content, is_approved) VALUES (?, ?, 0)',
      [userId, filteredContent]
    );

    if (hasSensitive) {
      return res.json({ code:200, msg:'留言已发布，但包含敏感词已自动替换', warning: true });
    }
    res.json({ code:200, msg:'留言成功，等待管理员精选' });
  } catch (err) {
    console.error('发布留言失败:', err);
    res.json({ code:500, msg:'服务器错误' });
  }
});

// 获取留言列表（精选优先）
app.get('/api/getMessages', async (req, res) => {
  try {
    const [messages] = await pool.execute(
      `SELECT m.id, m.content, m.is_approved, m.like_count, m.created_at,
              u.id as user_id, u.username
       FROM message m
       JOIN user u ON m.user_id = u.id
       ORDER BY m.is_approved DESC, m.like_count DESC, m.created_at DESC
       LIMIT 100`
    );
    res.json({ code:200, messages });
  } catch (err) {
    res.json({ code:500, messages:[] });
  }
});

// 点赞/取消点赞
app.post('/api/likeMessage', async (req, res) => {
  try {
    const { userId, messageId } = req.body;
    if (!userId || !messageId) return res.json({ code:400, msg:'参数不全' });

    const [like] = await pool.execute('SELECT id FROM message_like WHERE message_id=? AND user_id=?', [messageId, userId]);
    if (like.length > 0) {
      await pool.execute('DELETE FROM message_like WHERE message_id=? AND user_id=?', [messageId, userId]);
      await pool.execute('UPDATE message SET like_count = like_count - 1 WHERE id=?', [messageId]);
      res.json({ code:200, liked: false });
    } else {
      await pool.execute('INSERT INTO message_like (message_id, user_id) VALUES (?, ?)', [messageId, userId]);
      await pool.execute('UPDATE message SET like_count = like_count + 1 WHERE id=?', [messageId]);
      res.json({ code:200, liked: true });
    }
  } catch (err) {
    res.json({ code:500, msg:'服务器错误' });
  }
});

// 管理员接口：切换精选状态
app.post('/api/admin/toggleApproveMessage', async (req, res) => {
    try {
        const { adminId, messageId } = req.body;
        if (!adminId || !messageId) return res.json({ code: 400, msg: '参数不全' });
        const [admin] = await pool.execute('SELECT role FROM user WHERE id=?', [adminId]);
        if (admin.length === 0 || admin[0].role !== 'admin') {
            return res.json({ code: 403, msg: '无权限' });
        }
        const [msg] = await pool.execute('SELECT is_approved FROM message WHERE id=?', [messageId]);
        if (msg.length === 0) return res.json({ code: 404, msg: '留言不存在' });
        const newStatus = msg[0].is_approved === 1 ? 0 : 1;
        await pool.execute('UPDATE message SET is_approved=? WHERE id=?', [newStatus, messageId]);
        res.json({ code: 200, msg: newStatus === 1 ? '已设为精选' : '已取消精选' });
    } catch (err) {
        console.error(err);
        res.json({ code: 500, msg: '服务器错误' });
    }
});

// 管理员接口：精选留言（保留兼容）
app.post('/api/admin/approveMessage', async (req, res) => {
  try {
    const { adminId, messageId } = req.body;
    const [admin] = await pool.execute('SELECT role FROM user WHERE id=?', [adminId]);
    if (admin.length === 0 || admin[0].role !== 'admin') return res.json({ code:403, msg:'无权限' });
    await pool.execute('UPDATE message SET is_approved=1 WHERE id=?', [messageId]);
    res.json({ code:200, msg:'已设为精选' });
  } catch (err) {
    res.json({ code:500, msg:'服务器错误' });
  }
});

// 管理员接口：删除留言
app.post('/api/admin/deleteMessage', async (req, res) => {
  try {
    const { adminId, messageId } = req.body;
    const [admin] = await pool.execute('SELECT role FROM user WHERE id=?', [adminId]);
    if (admin.length === 0 || admin[0].role !== 'admin') return res.json({ code:403, msg:'无权限' });
    await pool.execute('DELETE FROM message WHERE id=?', [messageId]);
    res.json({ code:200, msg:'删除成功' });
  } catch (err) {
    res.json({ code:500, msg:'服务器错误' });
  }
});
// 用户删除自己的留言（也允许管理员删除任意留言）
app.post('/api/deleteOwnMessage', async (req, res) => {
  try {
    const { token, messageId } = req.body;
    if (!token || !messageId) return res.json({ code: 400, msg: '参数不全' });

    // 验证 token
    const [tokenRows] = await pool.execute(
      'SELECT user_id FROM token_record WHERE token=? AND expire_time>NOW()',
      [token]
    );
    if (tokenRows.length === 0) return res.json({ code: 401, msg: '未登录或登录失效' });
    const userId = tokenRows[0].user_id;

    // 获取留言作者
    const [msgRows] = await pool.execute('SELECT user_id FROM message WHERE id=?', [messageId]);
    if (msgRows.length === 0) return res.json({ code: 404, msg: '留言不存在' });
    const authorId = msgRows[0].user_id;

    // 权限检查：留言作者 或 管理员
    const [userRows] = await pool.execute('SELECT role FROM user WHERE id=?', [userId]);
    const isAdmin = userRows.length && userRows[0].role === 'admin';
    if (authorId !== userId && !isAdmin) {
      return res.json({ code: 403, msg: '无权删除此留言' });
    }

    // 执行删除
    await pool.execute('DELETE FROM message WHERE id=?', [messageId]);
    res.json({ code: 200, msg: '删除成功' });
  } catch (err) {
    console.error(err);
    res.json({ code: 500, msg: '服务器错误' });
  }
});
// 管理员接口：重置密码
app.post('/api/admin/resetPassword', async (req, res) => {
  try {
    const { adminId, targetUserId } = req.body;
    const [admin] = await pool.execute('SELECT role FROM user WHERE id=?', [adminId]);
    if (admin.length === 0 || admin[0].role !== 'admin') return res.json({ code:403, msg:'无权限' });
    const defaultPwd = md5('123456');
    await pool.execute('UPDATE user SET password=? WHERE id=?', [defaultPwd, targetUserId]);
    res.json({ code:200, msg:'密码已重置为123456' });
  } catch (err) {
    res.json({ code:500, msg:'服务器错误' });
  }
});

// 管理员接口：删除用户
app.post('/api/admin/deleteUser', async (req, res) => {
  try {
    const { adminId, targetUserId } = req.body;
    const [admin] = await pool.execute('SELECT role FROM user WHERE id=?', [adminId]);
    if (admin.length === 0 || admin[0].role !== 'admin') return res.json({ code:403, msg:'无权限' });
    await pool.execute('DELETE FROM user WHERE id=?', [targetUserId]);
    res.json({ code:200, msg:'用户已删除' });
  } catch (err) {
    res.json({ code:500, msg:'服务器错误' });
  }
});

// 管理员接口：修改省份点亮次数
app.post('/api/admin/updateProvinceLight', async (req, res) => {
  try {
    const { adminId, province, newCount } = req.body;
    const [admin] = await pool.execute('SELECT role FROM user WHERE id=?', [adminId]);
    if (admin.length === 0 || admin[0].role !== 'admin') return res.json({ code:403, msg:'无权限' });
    await pool.execute('UPDATE province_statistics SET light_count=? WHERE province=?', [newCount, province]);
    res.json({ code:200, msg:'更新成功' });
  } catch (err) {
    res.json({ code:500, msg:'服务器错误' });
  }
});
// 管理员接口：添加敏感词
app.post('/api/admin/addSensitiveWord', async (req, res) => {
    try {
        const { adminId, word } = req.body;
        if (!adminId || !word) return res.json({ code: 400, msg: '参数不全' });

        // 验证管理员权限
        const [admin] = await pool.execute('SELECT role FROM user WHERE id=?', [adminId]);
        if (admin.length === 0 || admin[0].role !== 'admin') {
            return res.json({ code: 403, msg: '无权限' });
        }

        // 插入敏感词（如果已存在则忽略）
        await pool.execute('INSERT IGNORE INTO sensitive_words (word) VALUES (?)', [word]);

        // 更新缓存（可选，也可以依赖定时刷新，这里主动刷新）
        await getSensitiveWords(true); // 强制刷新

        res.json({ code: 200, msg: '敏感词添加成功' });
    } catch (err) {
        console.error(err);
        res.json({ code: 500, msg: '服务器错误' });
    }
});

// 管理员接口：刷新敏感词缓存
app.post('/api/admin/refreshSensitiveCache', async (req, res) => {
    try {
        const { adminId } = req.body;
        if (!adminId) return res.json({ code: 400, msg: '参数不全' });

        const [admin] = await pool.execute('SELECT role FROM user WHERE id=?', [adminId]);
        if (admin.length === 0 || admin[0].role !== 'admin') {
            return res.json({ code: 403, msg: '无权限' });
        }

        // 强制刷新缓存
        await getSensitiveWords(true);
        res.json({ code: 200, msg: '缓存已刷新' });
    } catch (err) {
        console.error(err);
        res.json({ code: 500, msg: '服务器错误' });
    }
});

// 修改 getSensitiveWords 函数，增加 force 参数
async function getSensitiveWords(force = false) {
    const now = Date.now();
    if (!force && sensitiveWordsCache.length && (now - cacheLastUpdate) < CACHE_TTL) {
        return sensitiveWordsCache;
    }
    try {
        const [rows] = await pool.execute('SELECT word FROM sensitive_words');
        sensitiveWordsCache = rows.map(r => r.word);
        cacheLastUpdate = now;
        console.log(`敏感词缓存已更新，共 ${sensitiveWordsCache.length} 条`);
    } catch (err) {
        console.error('加载敏感词失败:', err);
        sensitiveWordsCache = [];
    }
    return sensitiveWordsCache;
}
// 获取当前用户的所有评论（用于“我的评论”页面）
app.post('/api/user/comments', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.json({ code: 400, msg: '参数不全' });
        const [comments] = await pool.execute(
            `SELECT id, content, is_approved, like_count, created_at
             FROM message WHERE user_id=? ORDER BY created_at DESC`,
            [userId]
        );
        res.json({ code: 200, comments });
    } catch (err) {
        console.error(err);
        res.json({ code: 500, msg: '服务器错误' });
    }
});
app.post('/api/private/conversations', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.json({ code: 400, msg: '参数不全' });
        // 找出所有与当前用户有过消息互动的用户
        const [rows] = await pool.execute(`
            SELECT DISTINCT u.id, u.username,
                (SELECT content FROM private_messages
                 WHERE (from_user_id = ? AND to_user_id = u.id) OR (from_user_id = u.id AND to_user_id = ?)
                 ORDER BY created_at DESC LIMIT 1) as last_message,
                (SELECT created_at FROM private_messages
                 WHERE (from_user_id = ? AND to_user_id = u.id) OR (from_user_id = u.id AND to_user_id = ?)
                 ORDER BY created_at DESC LIMIT 1) as last_time
            FROM private_messages pm
            JOIN user u ON (pm.from_user_id = ? AND pm.to_user_id = u.id) OR (pm.to_user_id = ? AND pm.from_user_id = u.id)
            WHERE u.id != ?
            GROUP BY u.id
            ORDER BY last_time DESC
        `, [userId, userId, userId, userId, userId, userId, userId]);
        res.json({ code: 200, conversations: rows });
    } catch (err) {
        console.error(err);
        res.json({ code: 500, msg: '服务器错误' });
    }
});
app.post('/api/private/messages', async (req, res) => {
    try {
        const { userId, targetUserId } = req.body;
        if (!userId || !targetUserId) return res.json({ code: 400, msg: '参数不全' });
        const [messages] = await pool.execute(
            `SELECT id, from_user_id, to_user_id, content, is_read, created_at
             FROM private_messages
             WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)
             ORDER BY created_at ASC`,
            [userId, targetUserId, targetUserId, userId]
        );
        // 将发给当前用户的消息标记为已读
        await pool.execute(
            `UPDATE private_messages SET is_read = 1 WHERE to_user_id = ? AND from_user_id = ?`,
            [userId, targetUserId]
        );
        res.json({ code: 200, messages });
    } catch (err) {
        console.error(err);
        res.json({ code: 500, msg: '服务器错误' });
    }
});
app.post('/api/private/send', async (req, res) => {
    try {
        const { fromUserId, toUserId, content } = req.body;
        if (!fromUserId || !toUserId || !content) return res.json({ code: 400, msg: '参数不全' });
        const [result] = await pool.execute(
            'INSERT INTO private_messages (from_user_id, to_user_id, content) VALUES (?, ?, ?)',
            [fromUserId, toUserId, content]
        );
        res.json({ code: 200, msg: '发送成功', messageId: result.insertId });
    } catch (err) {
        console.error(err);
        res.json({ code: 500, msg: '服务器错误' });
    }
});
app.post('/api/report', async (req, res) => {
    try {
        const { reporterId, targetType, targetId, reason } = req.body;
        if (!reporterId || !targetType || !targetId || !reason) {
            return res.json({ code: 400, msg: '参数不全' });
        }
        // 检查是否重复举报（可选：同一用户对同一目标只能举报一次）
        const [existing] = await pool.execute(
            'SELECT id FROM reports WHERE reporter_id=? AND target_type=? AND target_id=? AND status="pending"',
            [reporterId, targetType, targetId]
        );
        if (existing.length > 0) {
            return res.json({ code: 400, msg: '您已举报过此内容，等待处理' });
        }
        await pool.execute(
            'INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES (?, ?, ?, ?)',
            [reporterId, targetType, targetId, reason]
        );
        res.json({ code: 200, msg: '举报已提交，管理员会尽快处理' });
    } catch (err) {
        console.error(err);
        res.json({ code: 500, msg: '服务器错误' });
    }
});
app.post('/api/user/reports', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.json({ code: 400, msg: '参数不全' });
        const [reports] = await pool.execute(`
            SELECT r.*,
                   CASE WHEN r.target_type='comment' THEN (SELECT content FROM message WHERE id=r.target_id)
                        ELSE (SELECT content FROM private_messages WHERE id=r.target_id)
                   END as target_content
            FROM reports r
            WHERE r.reporter_id = ?
            ORDER BY r.created_at DESC
        `, [userId]);
        res.json({ code: 200, reports });
    } catch (err) {
        console.error(err);
        res.json({ code: 500, msg: '服务器错误' });
    }
});
app.post('/api/admin/reports', async (req, res) => {
    try {
        const { adminId, status = 'pending' } = req.body;
        if (!adminId) return res.json({ code: 400, msg: '参数不全' });
        const [admin] = await pool.execute('SELECT role FROM user WHERE id=?', [adminId]);
        if (admin.length === 0 || admin[0].role !== 'admin') {
            return res.json({ code: 403, msg: '无权限' });
        }
        let sql = `
            SELECT r.id, r.reporter_id, u1.username AS reporter_name,
                   r.target_type, r.target_id, r.reason, r.status, r.created_at,
                   CASE
                       WHEN r.target_type = 'comment' THEN (SELECT content FROM message WHERE id = r.target_id)
                       WHEN r.target_type = 'message' THEN (SELECT content FROM private_messages WHERE id = r.target_id)
                   END AS target_content,
                   CASE
                       WHEN r.target_type = 'comment' THEN (SELECT user_id FROM message WHERE id = r.target_id)
                       WHEN r.target_type = 'message' THEN (SELECT from_user_id FROM private_messages WHERE id = r.target_id)
                   END AS target_author_id,
                   CASE
                       WHEN r.target_type = 'comment' THEN (SELECT username FROM user WHERE id = (SELECT user_id FROM message WHERE id = r.target_id))
                       WHEN r.target_type = 'message' THEN (SELECT username FROM user WHERE id = (SELECT from_user_id FROM private_messages WHERE id = r.target_id))
                   END AS target_author_name
            FROM reports r
            JOIN user u1 ON r.reporter_id = u1.id
        `;
        const params = [];
        if (status !== 'all') {
            sql += ` WHERE r.status = ?`;
            params.push(status);
        }
        sql += ` ORDER BY r.created_at DESC`;
        const [reports] = await pool.execute(sql, params);
        res.json({ code: 200, reports });
    } catch (err) {
        console.error(err);
        res.json({ code: 500, msg: '服务器错误' });
    }
});
app.post('/api/admin/resolveReport', async (req, res) => {
    try {
        const { adminId, reportId, action } = req.body; // action: 'resolve' 或 'dismiss'
        if (!adminId || !reportId || !action) return res.json({ code: 400, msg: '参数不全' });
        const [admin] = await pool.execute('SELECT role FROM user WHERE id=?', [adminId]);
        if (admin.length === 0 || admin[0].role !== 'admin') {
            return res.json({ code: 403, msg: '无权限' });
        }
        let status = action === 'resolve' ? 'resolved' : 'dismissed';
        await pool.execute(
            'UPDATE reports SET status=?, resolved_by=?, resolved_at=NOW() WHERE id=?',
            [status, adminId, reportId]
        );
        res.json({ code: 200, msg: '处理成功' });
    } catch (err) {
        console.error(err);
        res.json({ code: 500, msg: '服务器错误' });
    }
});
app.post('/api/admin/allMessages', async (req, res) => {
    try {
        const { adminId } = req.body;
        if (!adminId) return res.json({ code: 400, msg: '参数不全' });
        const [admin] = await pool.execute('SELECT role FROM user WHERE id=?', [adminId]);
        if (admin.length === 0 || admin[0].role !== 'admin') {
            return res.json({ code: 403, msg: '无权限' });
        }
        // 只返回精选留言 或 点赞超过20且未精选的留言
        const [messages] = await pool.execute(`
            SELECT m.id, m.content, m.is_approved, m.like_count, m.created_at, u.username, u.id as user_id
            FROM message m
            JOIN user u ON m.user_id = u.id
            WHERE m.is_approved = 1 OR (m.like_count >= 20 AND m.is_approved = 0)
            ORDER BY m.is_approved DESC, m.like_count DESC, m.created_at DESC
        `);
        res.json({ code: 200, messages });
    } catch (err) {
        console.error(err);
        res.json({ code: 500, msg: '服务器错误' });
    }
});

app.listen(PORT, () => console.log(`服务启动 http://localhost:${PORT}`));