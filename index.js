import express from 'express';
import { bot } from './bot.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.post(`/webhook/${process.env.BOT_TOKEN}`, (req, res) => {
  bot.handleUpdate(req.body);
  res.sendStatus(200);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

const startServer = async () => {
  try {
    app.listen(port, async () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();