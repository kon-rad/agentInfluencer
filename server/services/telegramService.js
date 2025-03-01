import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';

dotenv.config();

class TelegramService {
  constructor() {
    this.bots = new Map(); // Store bot instances by token
  }

  async sendMessage(botToken, message, chatId = null) {
    try {
      if (!botToken) {
        throw new Error('Bot token is required');
      }
      
      // Use the provided chat ID or fall back to the environment variable
      const targetChatId = chatId || process.env.TELEGRAM_CHANNEL_ID;
      
      if (!targetChatId) {
        throw new Error('No chat ID provided and no default channel ID set');
      }
      
      // Get or create bot instance
      let bot = this.bots.get(botToken);
      
      if (!bot) {
        bot = new TelegramBot(botToken, { polling: false });
        this.bots.set(botToken, bot);
      }
      
      // Send the message
      const result = await bot.sendMessage(targetChatId, message, { parse_mode: 'Markdown' });
      
      console.log(`Message sent to Telegram chat ${targetChatId}`);
      return result;
    } catch (error) {
      console.error('Error sending Telegram message:', error);
      throw error;
    }
  }
}

const telegramService = new TelegramService();
export default telegramService; 