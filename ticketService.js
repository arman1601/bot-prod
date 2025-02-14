export function validateTicketData(ticketData) {
  const { merchantName, description } = ticketData;
  
  if (!merchantName || merchantName.trim().length < 2) {
    return 'Merchant name must be at least 2 characters long';
  }
  
  if (!description || description.trim().length < 10) {
    return 'Problem description must be at least 10 characters long';
  }
  
  return null;
}

export async function createTicket(bot, targetChatId, ticketData) {
  const { merchantName, description, username, media } = ticketData;
  
  try {
    // Send the ticket text first
    const ticketText = formatTicketMessage(merchantName, description, username);
    await bot.sendMessage(targetChatId, ticketText, { parse_mode: 'HTML' });

    // Send media files if they exist
    if (media && media.length > 0) {
      for (const item of media) {
        const caption = `Attachment for ticket from @${username}`;
        try {
          switch (item.type) {
            case 'photo':
              await bot.sendPhoto(targetChatId, item.fileId, { caption });
              break;
            case 'video':
              await bot.sendVideo(targetChatId, item.fileId, { caption });
              break;
          }
        } catch (mediaError) {
          logger.error('Error sending media:', { error: mediaError.message, fileId: item.fileId });
          await bot.sendMessage(
            targetChatId,
            `⚠️ Failed to send ${item.type} attachment for ticket from @${username}`
          );
        }
      }
    }

    return true;
  } catch (error) {
    logger.error('Error creating ticket:', { error: error.message, ticketData });
    throw new Error('Failed to create ticket. Please try again.');
  }
}

function formatTicketMessage(merchantName, description, username) {
  return `🎫 <b>New Support Ticket</b>\n
🏪 <b>Merchant:</b> ${escapeHtml(merchantName)}
👤 <b>Reported by:</b> @${escapeHtml(username)}
📝 <b>Description:</b> ${escapeHtml(description)}
⏰ <b>Created:</b> ${new Date().toISOString()}`;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}