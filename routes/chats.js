const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/user/:userId/chats', async (req, res) => {
  const userId = parseInt(req.params.userId);
  try {
    const chatsResult = await pool.query(`
      SELECT c.id, c.created_at,
        (SELECT json_agg(json_build_object(
            'id', m.id,
            'sender_id', m.sender_id,
            'text', m.text,
            'type', m.type,
            'file_path', m.file_path,
            'created_at', m.created_at
          ) ORDER BY m.created_at DESC)
         FROM messages m WHERE m.chat_id = c.id LIMIT 20) as messages
      FROM chats c
      JOIN chat_participants cp ON cp.chat_id = c.id
      WHERE cp.user_id = $1
      ORDER BY c.created_at DESC
    `, [userId]);

    res.json(chatsResult.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/create', async (req, res) => {
  const { userId1, userId2 } = req.body;
  try {
    const existingChat = await pool.query(`
      SELECT c.id FROM chats c
      JOIN chat_participants cp1 ON cp1.chat_id = c.id AND cp1.user_id = $1
      JOIN chat_participants cp2 ON cp2.chat_id = c.id AND cp2.user_id = $2
      GROUP BY c.id
      HAVING COUNT(*) = 2
    `, [userId1, userId2]);

    if (existingChat.rows.length > 0) {
      return res.json({ chatId: existingChat.rows[0].id, message: 'Chat already exists' });
    }

    const chatResult = await pool.query('INSERT INTO chats DEFAULT VALUES RETURNING id');
    const chatId = chatResult.rows[0].id;

    await pool.query('INSERT INTO chat_participants (chat_id, user_id) VALUES ($1, $2), ($1, $3)', [chatId, userId1, userId2]);

    res.json({ chatId, message: 'Chat created' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:chatId/messages', async (req, res) => {
  const chatId = parseInt(req.params.chatId);
  try {
    const messagesResult = await pool.query(`
      SELECT * FROM messages WHERE chat_id = $1 ORDER BY created_at ASC
    `, [chatId]);
    res.json(messagesResult.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:chatId/message', async (req, res) => {
  const chatId = parseInt(req.params.chatId);
  const { sender_id, text, type, file_path } = req.body;
  try {
    const insertResult = await pool.query(`
      INSERT INTO messages (chat_id, sender_id, text, type, file_path) 
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [chatId, sender_id, text, type, file_path]);
    res.json(insertResult.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
