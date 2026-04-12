// ============================================
// sanitize.js — XSS protection utilities
// ============================================

(function () {
    if (window._sanitizeLoaded) return;
    window._sanitizeLoaded = true;

    /**
     * Escape HTML special characters to prevent XSS.
     * Use this instead of innerHTML when inserting user/API data.
     * @param {string} str - Untrusted string
     * @returns {string} - Safe HTML string
     */
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

    /**
     * Sanitize HTML string — strip all tags except safe ones.
     * Allows: b, i, em, strong, br, p, ul, ol, li, span
     * @param {string} html - Untrusted HTML string
     * @returns {string} - Sanitized HTML
     */
    function sanitizeHtml(html) {
        if (html == null) return '';
        var s = String(html);
        // Remove script tags and event handlers
        s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
        s = s.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
        s = s.replace(/on\w+\s*=\s*[^\s>]+/gi, '');
        s = s.replace(/javascript\s*:/gi, '');
        s = s.replace(/data\s*:[^,]*base64/gi, '');
        // Remove dangerous tags
        s = s.replace(/<(iframe|object|embed|form|input|textarea|select|button|link|meta|style)[\s\S]*?>/gi, '');
        s = s.replace(/<\/(iframe|object|embed|form|input|textarea|select|button|link|meta|style)>/gi, '');
        return s;
    }

    /**
     * Set text content safely (no HTML parsing).
     * @param {Element} el - DOM element
     * @param {string} text - Text to set
     */
    function safeText(el, text) {
        if (el) el.textContent = text != null ? String(text) : '';
    }

    /**
     * Set innerHTML with sanitization.
     * @param {Element} el - DOM element
     * @param {string} html - HTML to sanitize and set
     */
    function safeHtml(el, html) {
        if (el) el.innerHTML = sanitizeHtml(html);
    }

    /**
     * Validate and clamp a numeric input.
     * @param {*} val - Input value
     * @param {number} min - Minimum
     * @param {number} max - Maximum
     * @param {number} fallback - Default value
     * @returns {number}
     */
    function safeNumber(val, min, max, fallback) {
        var n = Number(val);
        if (isNaN(n) || !isFinite(n)) return fallback;
        return Math.max(min, Math.min(max, n));
    }

    /**
     * Truncate string to max length.
     * @param {string} str
     * @param {number} maxLen
     * @returns {string}
     */
    function truncate(str, maxLen) {
        if (str == null) return '';
        var s = String(str);
        return s.length > maxLen ? s.substring(0, maxLen) : s;
    }

    // Public API
    window.FrediSecurity = {
        escapeHtml: escapeHtml,
        sanitizeHtml: sanitizeHtml,
        safeText: safeText,
        safeHtml: safeHtml,
        safeNumber: safeNumber,
        truncate: truncate
    };

    // Short aliases
    window.escapeHtml = escapeHtml;
    window.sanitizeHtml = sanitizeHtml;

    console.log('sanitize.js loaded');
})();
