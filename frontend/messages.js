// ============================================
// messages.js — Система сообщений и уведомлений
// Версия 1.0
// ============================================

// ============================================
// 1. СОСТОЯНИЕ
// ============================================
let messagesState = {
    notifications: [],
    chats: [],
    unreadCount: 0,
    activeTab: 'notifications', // 'notifications', 'chats', 'requests'
    isLoading: false,
    wsConnection: null,
    isWsConnected: false
};

// ============================================
// 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================
function showToastMessage(message, type = 'info') {
    if (window.showToast) window.showToast(message, type);
    else if (window.showToastMessage) window.showToastMessage(message, type);
    else console.log(`[${type}] ${message}`);
}

function goBackToDashboard() {
    if (typeof renderDashboard === 'function') renderDashboard();
    else if (window.renderDashboard) window.renderDashboard();
    else if (typeof window.goToDashboard === 'function') window.goToDashboard();
    else location.reload();
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} д назад`;
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

// ============================================
// 3. API ВЫЗОВЫ
// ============================================
async function apiCall(endpoint, options = {}) {
    const userId = window.CONFIG?.USER_ID || window.USER_ID;
    const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
    
    const url = endpoint.startsWith('http') ? endpoint : `${apiUrl}${endpoint}`;
    
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'X-User-Id': userId,
                ...options.headers
            }
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
        return data;
    } catch (error) {
        console.error(`API Error: ${endpoint}`, error);
        throw error;
    }
}

// ============================================
// 4. ЗАГРУЗКА ДАННЫХ
// ============================================
async function loadNotifications() {
    try {
        const data = await apiCall('/api/notifications');
        if (data.success && data.notifications) {
            messagesState.notifications = data.notifications;
            return messagesState.notifications;
        }
        return [];
    } catch (error) {
        console.error('Failed to load notifications:', error);
        return [];
    }
}

async function loadChats() {
    try {
        const data = await apiCall('/api/chats');
        if (data.success && data.chats) {
            messagesState.chats = data.chats;
            // Подсчитываем непрочитанные
            messagesState.unreadCount = messagesState.chats.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0);
            updateMessagesBadge();
            return messagesState.chats;
        }
        return [];
    } catch (error) {
        console.error('Failed to load chats:', error);
        return [];
    }
}

async function loadMessages(chatId) {
    try {
        const data = await apiCall(`/api/chats/${chatId}/messages`);
        if (data.success && data.messages) {
            return data.messages;
        }
        return [];
    } catch (error) {
        console.error('Failed to load messages:', error);
        return [];
    }
}

async function markChatAsRead(chatId) {
    try {
        await apiCall(`/api/chats/${chatId}/read`, { method: 'PUT' });
        // Обновляем локальное состояние
        const chat = messagesState.chats.find(c => c.id === chatId);
        if (chat) {
            chat.unreadCount = 0;
            messagesState.unreadCount = messagesState.chats.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
            updateMessagesBadge();
        }
    } catch (error) {
        console.error('Failed to mark as read:', error);
    }
}

async function sendMessage(chatId, text) {
    if (!text.trim()) return null;
    
    try {
        const data = await apiCall(`/api/chats/${chatId}/messages`, {
            method: 'POST',
            body: JSON.stringify({ text: text.trim() })
        });
        
        if (data.success && data.message) {
            return data.message;
        }
        return null;
    } catch (error) {
        console.error('Failed to send message:', error);
        showToastMessage('❌ Не удалось отправить сообщение', 'error');
        return null;
    }
}

async function requestContact(chatId) {
    try {
        const data = await apiCall(`/api/chats/${chatId}/contact`, { method: 'POST' });
        if (data.success) {
            showToastMessage('📞 Запрос контактов отправлен', 'success');
            return true;
        }
        return false;
    } catch (error) {
        console.error('Failed to request contact:', error);
        showToastMessage('❌ Не удалось отправить запрос', 'error');
        return false;
    }
}

async function shareContact(chatId) {
    try {
        const data = await apiCall(`/api/chats/${chatId}/share-contact`, { method: 'POST' });
        if (data.success && data.contact) {
            showToastMessage('🔓 Контакты раскрыты!', 'success');
            return data.contact;
        }
        return null;
    } catch (error) {
        console.error('Failed to share contact:', error);
        showToastMessage('❌ Не удалось раскрыть контакты', 'error');
        return null;
    }
}

async function blockUser(chatId) {
    if (!confirm('Вы уверены? Пользователь будет заблокирован, чат закрыт.')) return false;
    
    try {
        const data = await apiCall(`/api/chats/${chatId}/block`, { method: 'POST' });
        if (data.success) {
            showToastMessage('🚫 Пользователь заблокирован', 'success');
            // Удаляем чат из списка
            messagesState.chats = messagesState.chats.filter(c => c.id !== chatId);
            renderMessagesScreen();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Failed to block user:', error);
        showToastMessage('❌ Не удалось заблокировать', 'error');
        return false;
    }
}

async function acceptMatch(matchId, candidateId, candidateName) {
    try {
        const data = await apiCall(`/api/matches/${matchId}/accept`, { method: 'POST' });
        if (data.success && data.chatId) {
            showToastMessage(`✅ Чат с ${candidateName} создан!`, 'success');
            // Переходим в чат
            openChat(data.chatId);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Failed to accept match:', error);
        showToastMessage('❌ Не удалось создать чат', 'error');
        return false;
    }
}

async function declineMatch(matchId, candidateName) {
    try {
        const data = await apiCall(`/api/matches/${matchId}/decline`, { method: 'POST' });
        if (data.success) {
            showToastMessage(`❌ Запрос от ${candidateName} отклонён`, 'info');
            // Обновляем список уведомлений
            await loadNotifications();
            renderNotificationsTab();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Failed to decline match:', error);
        return false;
    }
}

async function markAllNotificationsRead() {
    try {
        await apiCall('/api/notifications/read-all', { method: 'PUT' });
        messagesState.notifications.forEach(n => n.isRead = true);
        renderNotificationsTab();
    } catch (error) {
        console.error('Failed to mark all as read:', error);
    }
}

async function deleteNotification(notificationId) {
    try {
        await apiCall(`/api/notifications/${notificationId}`, { method: 'DELETE' });
        messagesState.notifications = messagesState.notifications.filter(n => n.id !== notificationId);
        renderNotificationsTab();
    } catch (error) {
        console.error('Failed to delete notification:', error);
    }
}

// ============================================
// 5. WEBSOCKET
// ============================================
function initWebSocket() {
    const userId = window.CONFIG?.USER_ID || window.USER_ID;
    const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
    const wsUrl = apiUrl.replace('http', 'ws') + `/ws?user_id=${userId}`;
    
    messagesState.wsConnection = new WebSocket(wsUrl);
    
    messagesState.wsConnection.onopen = () => {
        console.log('🔌 WebSocket connected');
        messagesState.isWsConnected = true;
    };
    
    messagesState.wsConnection.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch (e) {
            console.error('WebSocket message parse error:', e);
        }
    };
    
    messagesState.wsConnection.onerror = (error) => {
        console.error('WebSocket error:', error);
        messagesState.isWsConnected = false;
    };
    
    messagesState.wsConnection.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        messagesState.isWsConnected = false;
        // Пытаемся переподключиться через 5 секунд
        setTimeout(() => initWebSocket(), 5000);
    };
}

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'new_match':
            // Новое совпадение
            showToastMessage(`🎯 Новое совпадение! ${data.candidateName} — ${data.compatibility}%`, 'info');
            loadNotifications();
            loadChats();
            updateMessagesBadge();
            // Если открыт экран сообщений, обновляем
            if (document.getElementById('messagesScreen')) {
                renderNotificationsTab();
            }
            break;
            
        case 'new_message':
            // Новое сообщение
            const chat = messagesState.chats.find(c => c.id === data.chatId);
            if (chat) {
                chat.lastMessage = { text: data.message, fromUserId: data.fromUserId, createdAt: data.createdAt };
                chat.unreadCount = (chat.unreadCount || 0) + 1;
                messagesState.unreadCount++;
                updateMessagesBadge();
                
                // Если открыт этот чат, обновляем
                if (window.currentChatId === data.chatId && window.loadChatMessages) {
                    window.loadChatMessages();
                    // Отмечаем прочитанным
                    markChatAsRead(data.chatId);
                }
                
                // Если открыт экран сообщений, обновляем список чатов
                if (document.getElementById('messagesScreen')) {
                    renderChatsTab();
                }
            }
            showToastMessage(`💬 Новое сообщение от ${data.fromName || 'собеседника'}`, 'info');
            break;
            
        case 'contact_request':
            showToastMessage(`📞 ${data.fromName} запрашивает ваши контакты`, 'warning');
            loadNotifications();
            updateMessagesBadge();
            if (document.getElementById('messagesScreen')) {
                renderNotificationsTab();
            }
            break;
            
        case 'contact_shared':
            showToastMessage(`🔓 ${data.fromName} раскрыл(а) свои контакты!`, 'success');
            if (window.currentChatId === data.chatId && window.showContactShared) {
                window.showContactShared(data.contact);
            }
            break;
            
        case 'message_read':
            // Сообщение прочитано (можно обновить статус в чате)
            if (window.updateMessageStatus) {
                window.updateMessageStatus(data.messageId, 'read');
            }
            break;
            
        default:
            console.log('Unknown websocket message:', data);
    }
}

// ============================================
// 6. UI ФУНКЦИИ
// ============================================
function updateMessagesBadge() {
    const badge = document.getElementById('messagesBadge');
    const count = messagesState.unreadCount + messagesState.notifications.filter(n => !n.isRead).length;
    
    if (badge && count > 0) {
        badge.style.display = 'flex';
        const badgeSpan = badge.querySelector('.badge');
        if (badgeSpan) {
            badgeSpan.textContent = count > 99 ? '99+' : count;
        }
    } else if (badge) {
        badge.style.display = 'none';
    }
}

// Главный экран сообщений
function renderMessagesScreen() {
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="full-content-page" id="messagesScreen">
            <button class="back-btn" id="messagesBackBtn">◀️ НАЗАД</button>
            
            <div class="content-header">
                <div class="content-emoji">💬</div>
                <h1>Сообщения</h1>
            </div>
            
            <div class="messages-tabs">
                <button class="messages-tab ${messagesState.activeTab === 'notifications' ? 'active' : ''}" data-tab="notifications">
                    🔔 Уведомления
                    ${messagesState.notifications.filter(n => !n.isRead).length > 0 ? 
                        `<span class="tab-badge">${messagesState.notifications.filter(n => !n.isRead).length}</span>` : ''}
                </button>
                <button class="messages-tab ${messagesState.activeTab === 'chats' ? 'active' : ''}" data-tab="chats">
                    💬 Чаты
                    ${messagesState.unreadCount > 0 ? 
                        `<span class="tab-badge">${messagesState.unreadCount}</span>` : ''}
                </button>
                <button class="messages-tab ${messagesState.activeTab === 'requests' ? 'active' : ''}" data-tab="requests">
                    🎯 Запросы
                </button>
            </div>
            
            <div class="messages-content" id="messagesContent">
                <div class="loading-screen" style="padding: 40px;">
                    <div class="loading-spinner">⏳</div>
                    <div>Загрузка...</div>
                </div>
            </div>
        </div>
    `;
    
    // Стили для табов
    const style = document.createElement('style');
    style.textContent = `
        .messages-tabs {
            display: flex;
            gap: 8px;
            margin-bottom: 20px;
            background: rgba(224,224,224,0.05);
            border-radius: 50px;
            padding: 4px;
        }
        .messages-tab {
            flex: 1;
            padding: 10px 16px;
            border-radius: 40px;
            border: none;
            background: transparent;
            color: var(--text-secondary);
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            position: relative;
        }
        .messages-tab.active {
            background: linear-gradient(135deg, rgba(255,107,59,0.2), rgba(255,59,59,0.1));
            color: var(--text-primary);
        }
        .tab-badge {
            background: #ff3b3b;
            color: white;
            border-radius: 30px;
            padding: 2px 8px;
            font-size: 10px;
            font-weight: bold;
        }
        .notification-item {
            background: rgba(224,224,224,0.05);
            border-radius: 16px;
            padding: 14px;
            margin-bottom: 10px;
            transition: all 0.2s;
            cursor: pointer;
        }
        .notification-item.unread {
            background: rgba(255,107,59,0.1);
            border-left: 3px solid #ff6b3b;
        }
        .notification-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
        }
        .notification-title {
            font-weight: 600;
            font-size: 14px;
        }
        .notification-time {
            font-size: 10px;
            color: var(--text-secondary);
        }
        .notification-body {
            font-size: 12px;
            color: var(--text-secondary);
            margin-bottom: 10px;
        }
        .notification-actions {
            display: flex;
            gap: 10px;
        }
        .chat-item-messages {
            background: rgba(224,224,224,0.05);
            border-radius: 16px;
            padding: 14px;
            margin-bottom: 10px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .chat-item-messages:hover {
            background: rgba(224,224,224,0.1);
        }
        .chat-item-messages.unread {
            background: rgba(255,107,59,0.1);
        }
        .chat-header-messages {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
        }
        .chat-name-messages {
            font-weight: 600;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .compatibility-badge {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 20px;
            background: rgba(255,107,59,0.2);
        }
        .chat-last-message {
            font-size: 12px;
            color: var(--text-secondary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .empty-state {
            text-align: center;
            padding: 60px 20px;
        }
        .empty-emoji {
            font-size: 48px;
            margin-bottom: 16px;
        }
        .empty-title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        .empty-desc {
            font-size: 12px;
            color: var(--text-secondary);
        }
    `;
    document.head.appendChild(style);
    
    const backBtn = document.getElementById('messagesBackBtn');
    if (backBtn) {
        const newBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBtn, backBtn);
        newBtn.addEventListener('click', () => goBackToDashboard());
    }
    
    document.querySelectorAll('.messages-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            messagesState.activeTab = tab.dataset.tab;
            renderMessagesScreen();
        });
    });
    
    // Загружаем данные и рендерим активную вкладку
    Promise.all([loadNotifications(), loadChats()]).then(() => {
        if (messagesState.activeTab === 'notifications') renderNotificationsTab();
        else if (messagesState.activeTab === 'chats') renderChatsTab();
        else if (messagesState.activeTab === 'requests') renderRequestsTab();
    });
}

function renderNotificationsTab() {
    const container = document.getElementById('messagesContent');
    if (!container) return;
    
    const unreadNotifications = messagesState.notifications.filter(n => !n.isRead);
    const readNotifications = messagesState.notifications.filter(n => n.isRead);
    
    if (messagesState.notifications.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-emoji">🔔</div>
                <div class="empty-title">Нет уведомлений</div>
                <div class="empty-desc">Когда появятся новые совпадения или сообщения, вы увидите их здесь</div>
            </div>
        `;
        return;
    }
    
    let html = `
        <div style="margin-bottom: 16px; display: flex; justify-content: flex-end;">
            <button id="markAllReadBtn" style="background: transparent; border: none; color: #ff6b3b; font-size: 12px; cursor: pointer;">✓ Отметить всё прочитанным</button>
        </div>
    `;
    
    if (unreadNotifications.length > 0) {
        html += `<div style="margin-bottom: 16px;"><div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">🔴 НОВЫЕ (${unreadNotifications.length})</div>`;
        unreadNotifications.forEach(n => {
            html += renderNotificationItem(n, true);
        });
        html += `</div>`;
    }
    
    if (readNotifications.length > 0) {
        html += `<div><div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">📖 ПРОЧИТАННЫЕ</div>`;
        readNotifications.forEach(n => {
            html += renderNotificationItem(n, false);
        });
        html += `</div>`;
    }
    
    container.innerHTML = html;
    
    document.getElementById('markAllReadBtn')?.addEventListener('click', () => {
        markAllNotificationsRead();
    });
}

function renderNotificationItem(notification, isUnread) {
    let actionButtons = '';
    
    if (notification.type === 'new_match' && notification.data) {
        actionButtons = `
            <div class="notification-actions">
                <button class="notification-accept-btn" data-match-id="${notification.data.matchId}" data-user-id="${notification.data.candidateId}" data-user-name="${notification.data.candidateName}" style="background: rgba(16,185,129,0.2); border: 1px solid rgba(16,185,129,0.3); border-radius: 30px; padding: 6px 12px; font-size: 11px; color: white; cursor: pointer;">✅ Написать</button>
                <button class="notification-decline-btn" data-match-id="${notification.data.matchId}" data-user-name="${notification.data.candidateName}" style="background: rgba(239,68,68,0.2); border: 1px solid rgba(239,68,68,0.3); border-radius: 30px; padding: 6px 12px; font-size: 11px; color: white; cursor: pointer;">❌ Отклонить</button>
            </div>
        `;
    } else if (notification.type === 'contact_request' && notification.data) {
        actionButtons = `
            <div class="notification-actions">
                <button class="contact-share-btn" data-chat-id="${notification.data.chatId}" style="background: rgba(16,185,129,0.2); border: 1px solid rgba(16,185,129,0.3); border-radius: 30px; padding: 6px 12px; font-size: 11px; color: white; cursor: pointer;">🔓 Раскрыть контакты</button>
                <button class="contact-decline-btn" data-notif-id="${notification.id}" style="background: rgba(239,68,68,0.2); border: 1px solid rgba(239,68,68,0.3); border-radius: 30px; padding: 6px 12px; font-size: 11px; color: white; cursor: pointer;">❌ Отказать</button>
            </div>
        `;
    }
    
    return `
        <div class="notification-item ${isUnread ? 'unread' : ''}" data-notif-id="${notification.id}">
            <div class="notification-header">
                <div class="notification-title">${notification.title}</div>
                <div class="notification-time">${formatDate(notification.createdAt)}</div>
            </div>
            <div class="notification-body">${notification.body}</div>
            ${actionButtons}
        </div>
    `;
}

function renderChatsTab() {
    const container = document.getElementById('messagesContent');
    if (!container) return;
    
    if (messagesState.chats.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-emoji">💬</div>
                <div class="empty-title">Нет активных чатов</div>
                <div class="empty-desc">Начните общение с кем-то из найденных кандидатов</div>
            </div>
        `;
        return;
    }
    
    let html = '';
    messagesState.chats.forEach(chat => {
        const isUnread = chat.unreadCount > 0;
        const compatibilityClass = chat.compatibility >= 90 ? '🔥' : chat.compatibility >= 75 ? '💕' : '👍';
        
        html += `
            <div class="chat-item-messages ${isUnread ? 'unread' : ''}" data-chat-id="${chat.id}">
                <div class="chat-header-messages">
                    <div class="chat-name-messages">
                        👤 ${chat.partnerName}, ${chat.partnerAge || '?'} лет
                        <span class="compatibility-badge">${compatibilityClass} ${chat.compatibility}%</span>
                    </div>
                    <div class="notification-time">${formatDate(chat.lastMessageAt)}</div>
                </div>
                <div class="chat-last-message">
                    ${chat.lastMessage?.text || 'Начните диалог'}
                </div>
                ${isUnread ? `<div style="margin-top: 8px;"><span class="tab-badge">${chat.unreadCount} новых</span></div>` : ''}
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    document.querySelectorAll('.chat-item-messages').forEach(el => {
        el.addEventListener('click', () => {
            const chatId = el.dataset.chatId;
            openChat(chatId);
        });
    });
}

function renderRequestsTab() {
    const container = document.getElementById('messagesContent');
    if (!container) return;
    
    // Здесь можно показывать активные поисковые запросы пользователя
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-emoji">🎯</div>
            <div class="empty-title">Активные запросы</div>
            <div class="empty-desc">Здесь будут отображаться ваши активные поиски</div>
        </div>
    `;
}

// ============================================
// 7. ЧАТ
// ============================================
async function openChat(chatId) {
    const container = document.getElementById('screenContainer');
    if (!container) return;
    
    window.currentChatId = chatId;
    const chat = messagesState.chats.find(c => c.id === chatId);
    
    // Отмечаем прочитанным
    await markChatAsRead(chatId);
    
    // Загружаем сообщения
    const messages = await loadMessages(chatId);
    
    container.innerHTML = `
        <div class="chat-screen" id="chatScreen">
            <div class="chat-screen-header">
                <button class="back-btn" id="chatBackBtn">◀️ НАЗАД</button>
                <div class="chat-screen-info">
                    <div class="chat-screen-name">👤 ${chat?.partnerName || 'Собеседник'}, ${chat?.partnerAge || '?'} лет</div>
                    <div class="chat-screen-status" id="chatStatus">
                        <span class="online-indicator" style="width: 8px; height: 8px; border-radius: 50%; background: #10b981; display: inline-block;"></span>
                        <span>онлайн</span>
                    </div>
                </div>
                <button class="chat-menu-btn" id="chatMenuBtn">⋮</button>
            </div>
            
            <div class="chat-messages-container" id="chatMessagesContainer">
                <div class="chat-messages" id="chatMessages">
                    ${renderMessagesList(messages, chat)}
                </div>
            </div>
            
            <div class="chat-input-container">
                <div class="chat-contact-info" id="contactInfo" style="display: none;"></div>
                <div class="chat-input-wrapper">
                    <input type="text" class="chat-input" id="chatInput" placeholder="Сообщение..." autocomplete="off">
                    <button class="chat-send-btn" id="chatSendBtn">➡️</button>
                </div>
                <div class="chat-actions">
                    <button class="chat-action-btn" id="contactRequestBtn" style="background: transparent; border: none; color: #ff6b3b; font-size: 12px; cursor: pointer;">📞 Запросить контакты</button>
                    <button class="chat-action-btn" id="shareContactBtn" style="background: transparent; border: none; color: #10b981; font-size: 12px; cursor: pointer;">🔓 Раскрыть мои контакты</button>
                </div>
            </div>
        </div>
    `;
    
    // Стили для чата
    const style = document.createElement('style');
    style.textContent = `
        .chat-screen {
            display: flex;
            flex-direction: column;
            height: 100%;
            background: rgba(10,10,10,0.95);
        }
        .chat-screen-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            background: rgba(10,10,10,0.9);
            border-bottom: 1px solid rgba(224,224,224,0.1);
            flex-shrink: 0;
        }
        .chat-screen-info {
            text-align: center;
        }
        .chat-screen-name {
            font-weight: 600;
            font-size: 16px;
        }
        .chat-screen-status {
            font-size: 11px;
            color: var(--text-secondary);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
        }
        .chat-messages-container {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
        }
        .chat-messages {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .chat-message {
            display: flex;
            max-width: 80%;
        }
        .chat-message-own {
            justify-content: flex-end;
            align-self: flex-end;
        }
        .chat-message-other {
            justify-content: flex-start;
            align-self: flex-start;
        }
        .chat-message-bubble {
            padding: 10px 14px;
            border-radius: 20px;
            font-size: 14px;
            line-height: 1.4;
            word-wrap: break-word;
        }
        .chat-message-own .chat-message-bubble {
            background: linear-gradient(135deg, #ff6b3b, #ff3b3b);
            border-bottom-right-radius: 4px;
        }
        .chat-message-other .chat-message-bubble {
            background: rgba(224,224,224,0.1);
            border-bottom-left-radius: 4px;
        }
        .chat-message-system {
            justify-content: center;
            max-width: 100%;
        }
        .chat-message-system .chat-message-bubble {
            background: rgba(255,107,59,0.1);
            color: var(--text-secondary);
            font-size: 11px;
            text-align: center;
        }
        .chat-message-time {
            font-size: 9px;
            color: var(--text-secondary);
            margin-top: 4px;
            text-align: right;
        }
        .chat-input-container {
            flex-shrink: 0;
            padding: 12px 16px;
            background: rgba(10,10,10,0.9);
            border-top: 1px solid rgba(224,224,224,0.1);
        }
        .chat-input-wrapper {
            display: flex;
            gap: 8px;
            margin-bottom: 8px;
        }
        .chat-input {
            flex: 1;
            padding: 12px 16px;
            background: rgba(224,224,224,0.1);
            border: 1px solid rgba(224,224,224,0.2);
            border-radius: 30px;
            color: white;
            font-size: 14px;
        }
        .chat-input:focus {
            outline: none;
            border-color: #ff6b3b;
        }
        .chat-send-btn {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: linear-gradient(135deg, #ff6b3b, #ff3b3b);
            border: none;
            font-size: 20px;
            cursor: pointer;
        }
        .chat-actions {
            display: flex;
            gap: 16px;
            justify-content: center;
        }
        .chat-contact-info {
            background: rgba(16,185,129,0.1);
            border-radius: 12px;
            padding: 10px;
            margin-bottom: 10px;
            font-size: 12px;
            text-align: center;
        }
        .chat-menu-popup {
            position: absolute;
            right: 16px;
            top: 60px;
            background: rgba(26,26,26,0.95);
            backdrop-filter: blur(20px);
            border-radius: 16px;
            padding: 8px;
            border: 1px solid rgba(224,224,224,0.2);
            z-index: 100;
        }
        .chat-menu-popup button {
            display: block;
            width: 100%;
            padding: 10px 20px;
            background: transparent;
            border: none;
            color: white;
            text-align: left;
            cursor: pointer;
            border-radius: 8px;
        }
        .chat-menu-popup button:hover {
            background: rgba(239,68,68,0.2);
        }
        .typing-indicator {
            font-size: 11px;
            color: var(--text-secondary);
            margin-left: 12px;
            margin-bottom: 8px;
        }
    `;
    document.head.appendChild(style);
    
    const backBtn = document.getElementById('chatBackBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => renderMessagesScreen());
    }
    
    const sendBtn = document.getElementById('chatSendBtn');
    const input = document.getElementById('chatInput');
    
    const sendMessageHandler = async () => {
        const text = input.value.trim();
        if (!text) return;
        
        input.value = '';
        const message = await sendMessage(chatId, text);
        if (message) {
            appendMessage(message, true);
            scrollToBottom();
        }
    };
    
    sendBtn?.addEventListener('click', sendMessageHandler);
    input?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessageHandler();
    });
    
    document.getElementById('contactRequestBtn')?.addEventListener('click', () => {
        requestContact(chatId);
    });
    
    document.getElementById('shareContactBtn')?.addEventListener('click', async () => {
        const contact = await shareContact(chatId);
        if (contact) {
            showContactShared(contact);
        }
    });
    
    document.getElementById('chatMenuBtn')?.addEventListener('click', () => {
        const existingPopup = document.querySelector('.chat-menu-popup');
        if (existingPopup) {
            existingPopup.remove();
            return;
        }
        
        const popup = document.createElement('div');
        popup.className = 'chat-menu-popup';
        popup.innerHTML = `
            <button id="blockUserBtn">🚫 Заблокировать пользователя</button>
            <button id="deleteChatBtn">🗑️ Удалить чат</button>
        `;
        document.querySelector('.chat-screen').appendChild(popup);
        
        document.getElementById('blockUserBtn')?.addEventListener('click', async () => {
            popup.remove();
            await blockUser(chatId);
            renderMessagesScreen();
        });
        
        document.getElementById('deleteChatBtn')?.addEventListener('click', () => {
            popup.remove();
            showToastMessage('Удаление чата будет доступно в следующей версии', 'info');
        });
        
        document.addEventListener('click', function onClickOutside(e) {
            if (!popup.contains(e.target) && e.target !== document.getElementById('chatMenuBtn')) {
                popup.remove();
                document.removeEventListener('click', onClickOutside);
            }
        });
    });
    
    // Прокрутка вниз
    setTimeout(scrollToBottom, 100);
}

function renderMessagesList(messages, chat) {
    if (!messages || messages.length === 0) {
        return `
            <div class="chat-message chat-message-system">
                <div class="chat-message-bubble">
                    💬 Начните общение! Ваш первый шаг к новым отношениям.
                </div>
            </div>
            <div class="chat-message chat-message-system">
                <div class="chat-message-bubble">
                    🔒 Чат анонимный. Контакты раскрываются только по взаимному согласию.
                </div>
            </div>
            <div class="chat-message chat-message-system">
                <div class="chat-message-bubble">
                    🔥 Совместимость с собеседником: ${chat?.compatibility || '?'}%
                </div>
            </div>
        `;
    }
    
    const userId = window.CONFIG?.USER_ID || window.USER_ID;
    
    return messages.map(msg => {
        const isOwn = msg.fromUserId == userId;
        const isSystem = msg.type === 'system';
        
        if (isSystem) {
            return `
                <div class="chat-message chat-message-system">
                    <div class="chat-message-bubble">
                        ${msg.text}
                    </div>
                    <div class="chat-message-time">${formatDate(msg.createdAt)}</div>
                </div>
            `;
        }
        
        return `
            <div class="chat-message ${isOwn ? 'chat-message-own' : 'chat-message-other'}">
                <div class="chat-message-bubble">
                    ${escapeHtml(msg.text)}
                    <div class="chat-message-time">${formatDate(msg.createdAt)} ${isOwn && msg.isRead ? '✓✓' : isOwn ? '✓' : ''}</div>
                </div>
            </div>
        `;
    }).join('');
}

function appendMessage(message, isOwn) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    const isSystem = message.type === 'system';
    
    let html = '';
    if (isSystem) {
        html = `
            <div class="chat-message chat-message-system">
                <div class="chat-message-bubble">
                    ${escapeHtml(message.text)}
                </div>
                <div class="chat-message-time">${formatDate(message.createdAt)}</div>
            </div>
        `;
    } else {
        html = `
            <div class="chat-message ${isOwn ? 'chat-message-own' : 'chat-message-other'}">
                <div class="chat-message-bubble">
                    ${escapeHtml(message.text)}
                    <div class="chat-message-time">${formatDate(message.createdAt)} ${isOwn ? '✓' : ''}</div>
                </div>
            </div>
        `;
    }
    
    container.insertAdjacentHTML('beforeend', html);
    scrollToBottom();
}

function scrollToBottom() {
    setTimeout(() => {
        const container = document.getElementById('chatMessagesContainer');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }, 50);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showContactShared(contact) {
    const contactInfo = document.getElementById('contactInfo');
    if (contactInfo) {
        contactInfo.style.display = 'block';
        contactInfo.innerHTML = `
            🔓 Контакты раскрыты!<br>
            📞 Телефон: ${contact.phone || 'не указан'}<br>
            📧 Email: ${contact.email || 'не указан'}
        `;
        document.getElementById('contactRequestBtn')?.remove();
        document.getElementById('shareContactBtn')?.remove();
    }
}

// ============================================
// 8. ИНИЦИАЛИЗАЦИЯ
// ============================================
let wsInitialized = false;

function initMessagesSystem() {
    if (!wsInitialized) {
        initWebSocket();
        wsInitialized = true;
    }
    
    // Загружаем начальные данные
    loadNotifications();
    loadChats();
    
    // Обновляем бейдж каждые 30 секунд
    setInterval(() => {
        loadChats();
    }, 30000);
}

async function showMessagesScreen() {
    // Проверяем, прошёл ли пользователь тест
    const completed = await checkTestCompleted();
    if (!completed) {
        showToastMessage('📊 Сначала пройдите психологический тест', 'info');
        return;
    }
    
    initMessagesSystem();
    renderMessagesScreen();
}

async function checkTestCompleted() {
    try {
        const userId = window.CONFIG?.USER_ID || window.USER_ID;
        const apiUrl = window.CONFIG?.API_BASE_URL || window.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com';
        const response = await fetch(`${apiUrl}/api/user-status?user_id=${userId}`);
        const data = await response.json();
        return data.has_profile === true;
    } catch (e) {
        return false;
    }
}

// ============================================
// 9. ЭКСПОРТ
// ============================================
window.showMessagesScreen = showMessagesScreen;
window.messagesState = messagesState;
window.loadChats = loadChats;
window.loadNotifications = loadNotifications;
window.updateMessagesBadge = updateMessagesBadge;
window.openChat = openChat;

console.log('✅ Модуль сообщений загружен (messages.js v1.0)');
