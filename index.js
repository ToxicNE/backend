const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const authRouter = require('./routes/auth');
const chatsRouter = require('./routes/chats');

app.use('/auth', authRouter);
app.use('/chats', chatsRouter);
app.use('/uploads', express.static('uploads'));

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
