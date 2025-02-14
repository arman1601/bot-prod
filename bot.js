import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { ticketStates } from './ticketStates.js';
import { createTicket, validateTicketData } from './ticketService.js';

dotenv.config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { 
    polling: true,
    onlyFirstMatch: true,
    request: {
        timeout: 30000
    }
});

const targetChatId = process.env.TARGET_CHAT_ID;

const userStates = new Map();

const cleanupExpiredStates = () => {
    const now = Date.now();
    for (const [userId, state] of userStates.entries()) {
        if (now - state.lastUpdated > 30 * 60 * 1000) { 
            userStates.delete(userId);
            lconsole.log(`Cleaned up expired state for user ${userId}`);
        }
    }
};

setInterval(cleanupExpiredStates, 5 * 60 * 1000);

const updateUserState = (userId, updates) => {
    const currentState = userStates.get(userId) || {};
    userStates.set(userId, {
        ...currentState,
        ...updates,
        lastUpdated: Date.now()
    });
    console.log(`Updated state for user ${userId}`, { state: updates.state });
};

// Helper function to send error message
const sendErrorMessage = async (chatId, error) => {
    try {
        await bot.sendMessage(
          chatId,
          `❌ Error: ${error.message}\n\nPlease try again with /newticket`
        );
        console.error(`Error sent to user ${chatId}: ${error.message}`);
    } catch (err) {
        console.error('Failed to send error message:', err);
    }
};

// Command handlers
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
        await bot.sendMessage(
            chatId,
            'Welcome to the Support Ticket Bot! 🎫\n\n' +
            'Available commands:\n' +
            '/newticket - Create a new support ticket\n' +
            '/cancel - Cancel ticket creation\n' +
            '/help - Show this help message'
        );
        console.log(`Start command received from user ${msg.from.id}`);
    } catch (error) {
        console.error('Error sending welcome message:', error);
        await sendErrorMessage(chatId, new Error('Failed to start bot. Please try again.'));
    }
});

bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        await bot.sendMessage(
            chatId,
            '🔍 Help Guide:\n\n' +
            '1. Use /newticket to start creating a ticket\n' +
            '2. Enter the merchant name when prompted\n' +
            '3. Describe your problem\n' +
            '4. Optionally add photos or videos\n' +
            '5. Type "done" to submit the ticket\n\n' +
            'Use /cancel at any time to cancel ticket creation'
        );
        console.log(`Help command received from user ${msg.from.id}`);
    } catch (error) {
        console.error('Error sending help message:', error);
        await sendErrorMessage(chatId, new Error('Failed to show help. Please try again.'));
    }
});

bot.onText(/\/newticket/, async (msg) => {
      const chatId = msg.chat.id;
      try {
          updateUserState(msg.from.id, {
              state: ticketStates.AWAITING_MERCHANT,
              ticketData: {
                media: []
              }
          });
        
          await bot.sendMessage(
              chatId,
              '📝 Please enter the merchant name:'
          );
        console.log(`New ticket started by user ${msg.from.id}`);
      } catch (error) {
          console.error('Error starting new ticket:', error);
          await sendErrorMessage(chatId, new Error('Failed to start new ticket. Please try again.'));
      }
  });

bot.onText(/\/cancel/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
        if (userStates.has(userId)) {
            userStates.delete(userId);
            await bot.sendMessage(
                chatId,
                '❌ Ticket creation cancelled.\nUse /newticket to start again.'
            );
            console.log(`Ticket creation cancelled by user ${userId}`);
        } else {
            await bot.sendMessage(
                chatId,
                '⚠️ No active ticket creation to cancel.\nUse /newticket to start a new ticket.'
            );
        }
    } catch (error) {
        console.error('Error cancelling ticket:', error);
        await sendErrorMessage(chatId, new Error('Failed to cancel ticket. Please try again.'));
    }
  });

  // Handle media messages
  bot.on('photo', handleMedia);
  bot.on('video', handleMedia);

  async function handleMedia(msg) {
      const userId = msg.from.id;
      const chatId = msg.chat.id;
      const userState = userStates.get(userId);

      if (!userState) {
          await bot.sendMessage(
              chatId,
              '⚠️ No active ticket creation found.\nUse /newticket to start a new ticket.'
          );
          return;
      }

      if (userState.state !== ticketStates.AWAITING_MEDIA) {
          await bot.sendMessage(
              chatId,
              '⚠️ Media not expected at this stage.\nPlease follow the prompts.'
          );
          return;
      }

      try {
          const mediaType = msg.photo ? 'photo' : 'video';
          const fileId = msg.photo ? msg.photo[msg.photo.length - 1].file_id : msg.video.file_id;

          userState.ticketData.media.push({
              type: mediaType,
              fileId: fileId
          });
      
          updateUserState(userId, userState);

          await bot.sendMessage(
              chatId,
              '✅ Media attached successfully!\n\n' +
              'You can:\n' +
              '📎 Send more photos or videos\n' +
              '✍️ Type "done" to submit the ticket\n' +
              '❌ Use /cancel to cancel ticket creation'
          );
          console.log(`Media ${mediaType} received from user ${userId}`);
      } catch (error) {
          console.error('Error handling media:', error);
          await sendErrorMessage(chatId, new Error('Failed to process media. Please try again or type "done" to submit without it.'));
      }
  }

  // Message handler
    bot.on('message', async (msg) => {
        const userId = msg.from.id;
        const chatId = msg.chat.id;
    
        if (msg.text?.startsWith('/') || msg.photo || msg.video) return;
    
        const userState = userStates.get(userId);
        if (!userState) return;

    try {
        switch (userState.state) {
            case ticketStates.AWAITING_MERCHANT:
                userState.ticketData.merchantName = msg.text;
                userState.state = ticketStates.AWAITING_DESCRIPTION;
                updateUserState(userId, userState);
          
            await bot.sendMessage(
                chatId,
                '📝 Please describe the problem in detail:'
            );
            console.log(`Merchant name received from user ${userId}`);
            break;

          case ticketStates.AWAITING_DESCRIPTION:
              userState.ticketData.description = msg.text;
              userState.ticketData.username = msg.from.username || 'No username';
              userState.state = ticketStates.AWAITING_MEDIA;
              
              const validationError = validateTicketData(userState.ticketData);
              if (validationError) {
                  throw new Error(validationError);
              }

              updateUserState(userId, userState);

              await bot.sendMessage(
                chatId,
                '✅ Information received!\n\n' +
                'Now you can:\n' +
                '📎 Send photos or videos related to the issue (optional)\n' +
                '✍️ Type "done" to submit the ticket without media\n' +
                '❌ Use /cancel to cancel ticket creation'
              );
              console.log(`Description received from user ${userId}`);
              break;

          case ticketStates.AWAITING_MEDIA:
              if (msg.text.toLowerCase() === 'done') {
                  await createTicket(bot, targetChatId, userState.ticketData);
                  
                  await bot.sendMessage(
                      chatId,
                      '🎉 Success! Your ticket has been created and sent to our administrators.\n\n' +
                      'Use /newticket to create another ticket.'
                    );
                  
                  userStates.delete(userId);
                  console.log(`Ticket completed and sent for user ${userId}`);
              } else {
                  await bot.sendMessage(
                    chatId,
                    '⚠️ Please either:\n' +
                    '📎 Send photos/videos\n' +
                    '✍️ Type "done" to submit\n' +
                    '❌ Use /cancel to cancel'
                  );
                }
          break;
      }
    } catch (error) {
          console.error('Error processing message:', { error: error.message, userId, state: userState.state });
          await sendErrorMessage(chatId, error);
          userStates.delete(userId);
    }
});

bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

export { bot }