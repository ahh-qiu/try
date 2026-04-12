const mysql = require('mysql2/promise');
const fs = require('fs');

// 数据库配置（请修改为你的密码）
const DB_CONFIG = {
  host: 'localhost',
  user: 'root',
  password: '123456', // 请修改为你的MySQL密码
  database: 'yangjingyu_db'
};

async function importQuiz() {
  const connection = await mysql.createConnection(DB_CONFIG);

  // 读取题库 JSON 文件（假设文件名为 quiz_questions.json）
  const quizData = JSON.parse(fs.readFileSync('quiz_questions.json', 'utf8'));

  // 清空原有数据（可选，根据需要决定是否执行）
  // await connection.execute('DELETE FROM quiz_bank');

  for (const q of quizData) {
    await connection.execute(
      'INSERT INTO quiz_bank (id, question, option_a, option_b, option_c, option_d, answer) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [q.id, q.question, q.options[0], q.options[1], q.options[2], q.options[3], q.answer]
    );
  }
  console.log(`题库导入完成，共导入 ${quizData.length} 题`);
  await connection.end();
}

importQuiz().catch(console.error);