const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const authMiddleware = require('../middleware/auth');
const verifyToken = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// Получить все чаты пользователя
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT DISTINCT ON (
        CASE
          WHEN sender_id = $1 THEN receiver_id
          ELSE sender_id
        END
      )
      id, sender_id, receiver_id, text, type, file_path, created_at
      FROM messages
      WHERE sender_id = $1 OR receiver_id = $1
      ORDER BY
        CASE
          WHEN sender_id = $1 THEN receiver_id
          ELSE sender_id
        END,
        created_at DESC;
    `, [userId]);

    const chatUsers = new Set();
    const chats = [];

    for (let row of result.rows) {
      const otherUserId = row.sender_id === userId ? row.receiver_id : row.sender_id;
      if (!chatUsers.has(otherUserId)) {
        chatUsers.add(otherUserId);

        const userRes = await pool.query(
          'SELECT id, name FROM users WHERE id = $1',
          [otherUserId]
        );

        chats.push({
          id: otherUserId,
          name: userRes.rows[0]?.name || 'Неизвестный',
          lastMessage: {
            text: row.text,
            type: row.type,
            filePath: row.file_path,
            createdAt: row.created_at,
          },
        });
      }
    }

    res.json(chats);
  } catch (err) {
    console.error('Ошибка получения чатов:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить сообщения с другим пользователем
router.get('/:receiverId', verifyToken, async (req, res) => {
  const { receiverId } = req.params;
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT * FROM messages
       WHERE (sender_id = $1 AND receiver_id = $2)
          OR (sender_id = $2 AND receiver_id = $1)
       ORDER BY created_at ASC`,
      [userId, receiverId]
    );

    const messages = result.rows.map((msg) => ({
      ...msg,
      isMe: msg.sender_id === userId,
    }));

    res.json(messages);
  } catch (err) {
    console.error('Ошибка получения сообщений:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

//  Отправить сообщение
router.post('/:receiverId', verifyToken, upload.single('file'), async (req, res) => {
  const { receiverId } = req.params;
  const { text, type } = req.body;
  const userId = req.user.id;

  try {
    let filePath = null;

    if (req.file) {
      filePath = `/uploads/${req.file.filename}`;
    }

    const result = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, text, type, file_path)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, receiverId, text || null, type, filePath]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка отправки сообщения:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
