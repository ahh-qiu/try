const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const DB_CONFIG = {
    host: 'localhost',
    user: 'root',
    password: '123456',   // 请修改为你的MySQL密码
    database: 'yangjingyu_db'
};

async function importWords() {
    const vocabularyDir = path.join(__dirname, 'Vocabulary');
    let allWords = [];

    if (!fs.existsSync(vocabularyDir)) {
        console.error('❌ Vocabulary目录不存在，请确认路径');
        return;
    }

    // 读取所有 .txt 文件
    const files = fs.readdirSync(vocabularyDir).filter(f => f.endsWith('.txt'));
    if (files.length === 0) {
        console.log('未找到任何敏感词文件');
        return;
    }

    for (const file of files) {
        const filePath = path.join(vocabularyDir, file);
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const words = content.split('\n')
                .map(line => line.trim().toLowerCase()) // 清洗：去空格、转小写
                .filter(word => word.length > 0 && !word.startsWith('#'));
            allWords.push(...words);
            console.log(`✅ 读取 ${file}：${words.length} 条`);
        } catch (err) {
            console.error(`读取文件 ${file} 失败:`, err.message);
        }
    }

    // 去重
    const uniqueWords = [...new Set(allWords)];
    console.log(`📊 总计：${files.length} 个文件，去重后敏感词数量：${uniqueWords.length}`);

    const connection = await mysql.createConnection(DB_CONFIG);

    // 清空表（确保全新导入）
    await connection.execute('TRUNCATE TABLE sensitive_words');
    console.log('🗑️ 已清空敏感词表');

    // 分批插入，使用 INSERT IGNORE 避免重复错误
    const batchSize = 500;
    let insertedCount = 0;
    for (let i = 0; i < uniqueWords.length; i += batchSize) {
        const batch = uniqueWords.slice(i, i + batchSize);
        const placeholders = batch.map(() => '(?)').join(',');
        const sql = `INSERT IGNORE INTO sensitive_words (word) VALUES ${placeholders}`;
        const [result] = await connection.execute(sql, batch);
        insertedCount += result.affectedRows;
        console.log(`已处理 ${Math.min(i + batchSize, uniqueWords.length)} / ${uniqueWords.length} 条 (本次插入 ${result.affectedRows} 条)`);
    }

    console.log(`🎉 敏感词导入完成！实际新增 ${insertedCount} 条（去重后共 ${uniqueWords.length} 条）`);
    await connection.end();
}

importWords().catch(console.error);