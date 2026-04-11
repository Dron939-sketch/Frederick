// ============================================
// subscription.js — Платёжный модуль подписки (YooKassa)
// Встраивается в экран настроек
// ============================================

(function () {
    if (window._subscriptionLoaded) return;
    window._subscriptionLoaded = true;

    function _api() { return window.CONFIG?.API_BASE_URL || 'https://fredi-backend-flz2.onrender.com'; }
    function _uid() { return window.CONFIG?.USER_ID; }
    function _toast(msg, type) { if (window.showToast) window.showToast(msg, type || 'info'); }

    function _injectSubscriptionStyles() {
        if (document.getElementById('subscription-styles')) return;
        const s = document.createElement('style');
        s.id = 'subscription-styles';
        s.textContent = `
            .sub-card { background: linear-gradient(135deg, rgba(59,130,255,0.12) 0%, rgba(255,107,59,0.08) 100%); border: 1px solid rgba(224,224,224,0.15); border-radius: 20px; padding: 24px; margin-bottom: 20px; }
            .sub-card-premium { border-color: rgba(255,183,59,0.4); background: linear-gradient(135deg, rgba(255,183,59,0.1) 0%, rgba(255,107,59,0.08) 100%); }
            .sub-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 12px; }
            .sub-badge-active { background: rgba(16,185,129,0.15); color: rgba(16,185,129,0.95); border: 1px solid rgba(16,185,129,0.3); }
            .sub-badge-inactive { background: rgba(224,224,224,0.07); color: var(--text-secondary); border: 1px solid rgba(224,224,224,0.15); }
            .sub-title { font-size: 20px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px; }
            .sub-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 16px; }
            .sub-price { font-size: 28px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
            .sub-price-period { font-size: 12px; color: var(--text-secondary); margin-bottom: 16px; }
            .sub-features { list-style: none; padding: 0; margin: 0 0 20px 0; }
            .sub-features li { font-size: 13px; color: var(--text-secondary); padding: 6px 0; display: flex; align-items: center; gap: 8px; }
            .sub-features li::before { content: ''; display: none; }
            .sub-feature-icon { flex-shrink: 0; width: 20px; text-align: center; }
            .sub-btn { display: block; width: 100%; padding: 14px; border: none; border-radius: 14px; font-size: 15px; font-weight: 600; font-family: inherit; cursor: pointer; text-align: center; transition: transform 0.15s, opacity 0.15s; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
            .sub-btn:active { transform: scale(0.98); }
            .sub-btn-primary { background: linear-gradient(135deg, #3b82ff 0%, #6366f1 100%); color: #fff; }
            .sub-btn-primary:hover { opacity: 0.9; }
            .sub-btn-secondary { background: rgba(224,224,224,0.07); border: 1px solid rgba(224,224,224,0.18); color: var(--text-secondary); }
            .sub-btn-secondary:hover { background: rgba(224,224,224,0.14); color: var(--text-primary); }
            .sub-btn-danger { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: rgba(239,68,68,0.85); }
            .sub-btn-small { display: inline-flex; padding: 6px 14px; border-radius: 10px; font-size: 12px; font-weight: 500; width: auto; }
            .sub-info-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(224,224,224,0.06); font-size: 13px; }
            .sub-info-label { color: var(--text-secondary); }
            .sub-info-value { color: var(--text-primary); font-weight: 500; }
            .sub-card-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
            .sub-card-icon { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-secondary); background: rgba(224,224,224,0.05); padding: 6px 12px; border-radius: 10px; }
            .sub-divider { height: 1px; background: rgba(224,224,224,0.08); margin: 16px 0; }
            .sub-btn-group { display: flex; flex-direction: column; gap: 10px; }
            .sub-cards-section { background: rgba(224,224,224,0.03); border: 1px solid rgba(224,224,224,0.1); border-radius: 16px; padding: 18px; margin-top: 16px; }
            .sub-cards-title { font-size: 13px; font-weight: 700; color: var(--text-primary); margin-bottom: 12px; }
            .sub-card-item { display: flex; align-items: center; gap: 12px; padding: 12px; background: rgba(224,224,224,0.04); border: 1px solid rgba(224,224,224,0.08); border-radius: 12px; }
            .sub-card-item-check { width: 20px; height: 20px; border-radius: 4px; border: 2px solid rgba(16,185,129,0.6); background: rgba(16,185,129,0.15); display: flex; align-items: center; justify-content: center; font-size: 12px; color: rgba(16,185,129,0.95); flex-shrink: 0; }
            .sub-card-item-info { flex: 1; }
            .sub-card-item-number { font-size: 14px; font-weight: 600; color: var(--text-primary); }
            .sub-card-item-type { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
            .sub-no-cards { font-size: 12px; color: var(--text-secondary); font-style: italic; }
            .sub-loading { text-align: center; padding: 40px 0; color: var(--text-secondary); font-size: 14px; }
            .sub-loading-spinner { font-size: 28px; animation: sub-spin 1.2s linear infinite; margin-bottom: 12px; }
            @keyframes sub-spin { to { transform: rotate(360deg); } }
        `;
        document.head.appendChild(s);
    }

    async function _loadSubscriptionStatus() {
        const uid = _uid();
        if (!uid) return null;
        try {
            const r = await fetch(`${_api()}/api/subscription/status/${uid}`);
            return await r.json();
        } catch (e) { console.error('subscription status error:', e); return null; }
    }

    async function _createPayment() {
        const uid = _uid();
        if (!uid) return;
        _toast('Создаю платёж...', 'info');
        try {
            const r = await fetch(`${_api()}/api/subscription/create-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: uid, return_url: window.location.origin + window.location.pathname })
            });
            const data = await r.json();
            if (data.success && data.confirmation_url) { window.location.href = data.confirmation_url; }
            else { _toast(data.error || 'Не удалось создать платёж', 'error'); }
        } catch (e) { _toast('Ошибка сети', 'error'); }
    }

    async function _toggleAutoRenew(enabled) {
        const uid = _uid();
        if (!uid) return;
        try {
            const r = await fetch(`${_api()}/api/subscription/toggle-auto-renew`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: uid, enabled })
            });
            const data = await r.json();
            if (data.success) { _toast(enabled ? 'Автопродление включено' : 'Автопродление отключено', 'info'); }
            else { _toast('Не удалось изменить настройку', 'error'); }
        } catch (e) { _toast('Ошибка сети', 'error'); }
    }

    async function _deleteCard() {
        const uid = _uid();
        if (!uid) return;
        try {
            const r = await fetch(`${_api()}/api/subscription/delete-card`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: uid })
            });
            const data = await r.json();
            if (data.success) { _toast('Карта удалена. Автопродление отключено.', 'info'); }
            else { _toast('Не удалось удалить карту', 'error'); }
        } catch (e) { _toast('Ошибка сети', 'error'); }
    }

    function _formatDate(dateStr) {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    function _daysLeft(dateStr) {
        if (!dateStr) return 0;
        return Math.max(0, Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24)));
    }

    function _cardTypeIcon(type) {
        const t = (type || '').toLowerCase();
        if (t.includes('visa')) return '&#x1F4B3;';
        if (t.includes('master')) return '&#x1F4B3;';
        if (t.includes('mir')) return '&#x1F4B3;';
        return '&#x1F4B3;';
    }

    function _renderSavedCardsSection(card) {
        if (card) {
            return `
                <div class="sub-cards-section">
                    <div class="sub-cards-title">Привязанные карты</div>
                    <div class="sub-card-item">
                        <div class="sub-card-item-check">&#x2713;</div>
                        <div class="sub-card-item-info">
                            <div class="sub-card-item-number">${_cardTypeIcon(card.type)} **** **** **** ${card.last4}</div>
                            <div class="sub-card-item-type">${(card.type || 'Bank card').toUpperCase()} &middot; Сохранена для автоплатежей</div>
                        </div>
                        <button class="sub-btn sub-btn-danger sub-btn-small" id="subDeleteCard">Удалить</button>
                    </div>
                </div>`;
        }
        return `
            <div class="sub-cards-section">
                <div class="sub-cards-title">Привязанные карты</div>
                <div class="sub-no-cards">Нет привязанных карт. Карта сохранится автоматически при оплате подписки.</div>
            </div>`;
    }

    function _renderActiveSubscription(sub) {
        const days = _daysLeft(sub.expires_at);
        return `
            <div class="sub-card sub-card-premium">
                <div class="sub-badge sub-badge-active">&#x2713; Активна</div>
                <div class="sub-title">Подписка Фреди Premium</div>
                <div class="sub-desc">Полный доступ ко всем возможностям</div>
                <div class="sub-info-row"><span class="sub-info-label">Следующее списание</span><span class="sub-info-value">${_formatDate(sub.expires_at)}</span></div>
                <div class="sub-info-row"><span class="sub-info-label">Осталось дней</span><span class="sub-info-value">${days}</span></div>
                <div class="sub-info-row"><span class="sub-info-label">Стоимость</span><span class="sub-info-value">690 &#8381;/мес</span></div>
                <div class="sub-info-row" style="border-bottom:none"><span class="sub-info-label">Автопродление</span><span class="sub-info-value">${sub.auto_renew ? 'Включено' : 'Выключено'}</span></div>
                <div class="sub-divider"></div>
                <div class="sub-btn-group">
                    ${sub.auto_renew
                        ? '<button class="sub-btn sub-btn-danger" id="subToggleAutoRenew">Отключить автопродление</button>'
                        : '<button class="sub-btn sub-btn-secondary" id="subToggleAutoRenew">Включить автопродление</button>'
                    }
                </div>
            </div>
            ${_renderSavedCardsSection(sub.card)}`;
    }

    function _renderNoSubscription(sub) {
        const isExpired = sub && sub.status === 'expired';
        const card = sub ? sub.card : null;
        return `
            <div class="sub-card">
                <div class="sub-badge sub-badge-inactive">${isExpired ? 'Истекла' : 'Нет подписки'}</div>
                <div class="sub-title">Фреди Premium</div>
                <div class="sub-desc">Разблокируйте полный доступ к виртуальному психологу</div>
                <div class="sub-price">690 &#8381;</div>
                <div class="sub-price-period">в месяц, автопродление</div>
                <ul class="sub-features">
                    <li><span class="sub-feature-icon">&#x1F9E0;</span> Безлимитные сессии с Фреди</li>
                    <li><span class="sub-feature-icon">&#x1F3AF;</span> Персональный план развития</li>
                    <li><span class="sub-feature-icon">&#x1F4D3;</span> AI-дневник с глубокой рефлексией</li>
                    <li><span class="sub-feature-icon">&#x1F319;</span> Гипнотические сессии и практики</li>
                    <li><span class="sub-feature-icon">&#x1FA9E;</span> Зеркало — анализ отношений</li>
                    <li><span class="sub-feature-icon">&#x1F3AD;</span> Транзактный анализ по Берну</li>
                </ul>
                <button class="sub-btn sub-btn-primary" id="subPayBtn">Оформить подписку — 690 &#8381;</button>
                <div style="text-align:center;margin-top:12px;font-size:11px;color:var(--text-secondary)">Безопасная оплата через ЮKassa. Карта сохраняется для автопродления.</div>
            </div>
            ${_renderSavedCardsSection(card)}`;
    }

    async function renderSubscriptionSection(container) {
        _injectSubscriptionStyles();
        container.innerHTML = '<div class="sub-loading"><div class="sub-loading-spinner">&#x2B50;</div><div>Загрузка...</div></div>';
        const sub = await _loadSubscriptionStatus();
        if (sub && sub.has_subscription) {
            container.innerHTML = _renderActiveSubscription(sub);
            const toggleBtn = document.getElementById('subToggleAutoRenew');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', async () => {
                    const newState = !sub.auto_renew;
                    if (!newState && !confirm('Отключить автопродление? Подписка останется активной до конца оплаченного периода.')) return;
                    await _toggleAutoRenew(newState);
                    await renderSubscriptionSection(container);
                });
            }
        } else {
            container.innerHTML = _renderNoSubscription(sub);
            const payBtn = document.getElementById('subPayBtn');
            if (payBtn) { payBtn.addEventListener('click', _createPayment); }
        }
        const deleteBtn = document.getElementById('subDeleteCard');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                if (!confirm('Удалить привязанную карту? Автопродление будет отключено.')) return;
                await _deleteCard();
                await renderSubscriptionSection(container);
            });
        }
    }

    window.renderSubscriptionSection = renderSubscriptionSection;
    console.log('subscription.js loaded');
})();
