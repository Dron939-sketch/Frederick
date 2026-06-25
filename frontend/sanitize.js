// ============================================
// sanitize.js — XSS protection utilities
// ============================================

(function () {
    if (window._sanitizeLoaded) return;
    window._sanitizeLoaded = true;

    function escapeHtml(str) {
        if (str == null) return '';
        var s = String(str);
        return s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }

    function sanitizeHtml(html) {
        if (html == null) return '';
        var s = String(html);
        s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
        s = s.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
        s = s.replace(/on\w+\s*=\s*[^\s>]+/gi, '');
        s = s.replace(/javascript\s*:/gi, '');
        s = s.replace(/data\s*:[^,]*base64/gi, '');
        s = s.replace(/<(iframe|object|embed|form|input|textarea|select|button|link|meta|style)[\s\S]*?>/gi, '');
        s = s.replace(/<\/(iframe|object|embed|form|input|textarea|select|button|link|meta|style)>/gi, '');
        return s;
    }

    function safeText(el, text) {
        if (el) el.textContent = text != null ? String(text) : '';
    }

    function safeHtml(el, html) {
        if (el) el.innerHTML = sanitizeHtml(html);
    }

    function safeNumber(val, min, max, fallback) {
        var n = Number(val);
        if (isNaN(n) || !isFinite(n)) return fallback;
        return Math.max(min, Math.min(max, n));
    }

    function truncate(str, maxLen) {
        if (str == null) return '';
        var s = String(str);
        return s.length > maxLen ? s.substring(0, maxLen) : s;
    }

    window.FrediSecurity = {
        escapeHtml: escapeHtml,
        sanitizeHtml: sanitizeHtml,
        safeText: safeText,
        safeHtml: safeHtml,
        safeNumber: safeNumber,
        truncate: truncate
    };

    window.escapeHtml = escapeHtml;
    window.sanitizeHtml = sanitizeHtml;

    console.log('sanitize.js loaded');
})();
