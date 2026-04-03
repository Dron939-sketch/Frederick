// ============================================
// chat.js — Компонент чата (расширение)
// Версия 1.0
// ============================================

// Дополнительные функции для чата
window.loadChatMessages = async function(chatId) {
    const messages = await loadMessages(chatId);
    const container = document.getElementById('chatMessages');
    if (container && messages) {
        const userId = window.CONFIG?.USER_ID || window.USER_ID;
        const chat = messagesState.chats.find(c => c.id === chatId);
        
        container.innerHTML = renderMessagesList(messages, chat);
        scrollToBottom();
        
        // Отмечаем прочитанным
        await markChatAsRead(chatId);
    }
};

window.updateMessageStatus = function(messageId, status) {
    // Обновление статуса сообщения (можно реализовать при необходимости)
    console.log(`Message ${messageId} status: ${status}`);
};

window.showContactShared = function(contact) {
    const contactInfo = document.getElementById('contactInfo');
    if (contactInfo) {
        contactInfo.style.display = 'block';
        contactInfo.innerHTML = `
            🔓 Контакты раскрыты!<br>
            📞 Телефон: ${contact.phone || 'не указан'}<br>
            📧 Email: ${contact.email || 'не указан'}
        `;
    }
};

console.log('✅ Модуль чата загружен (chat.js v1.0)');
