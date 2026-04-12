// test-greeting-patch.js — Patches for Test module
// Loaded AFTER test.js
(function() {
    function patch() {
        if (!window.Test || !window.Test.showIntroScreen) return false;

        // === PATCH 1: Greeting without Meister ===
        window.Test.showIntroScreen = function() {
            var name = (this.context && this.context.name) || (window.CONFIG && window.CONFIG.USER_NAME !== '\u0434\u0440\u0443\u0433' ? window.CONFIG.USER_NAME : '') || '';
            var greeting = name ? name + ', \u043f\u0440\u0438\u0432\u0435\u0442!' : '\u041f\u0440\u0438\u0432\u0435\u0442!';
            this.addBotMessage(greeting + '\n\n\u041d\u0443, \u0437\u0434\u0440\u0430\u0432\u0441\u0442\u0432\u0443\u0439\u0442\u0435, \u0434\u043e\u0440\u043e\u0433\u043e\u0439 \u0447\u0435\u043b\u043e\u0432\u0435\u043a! \uD83D\uDC4B\n\n\uD83E\uDDE0 \u042f \u2014 \u0424\u0440\u0435\u0434\u0438, \u0432\u0438\u0440\u0442\u0443\u0430\u043b\u044c\u043d\u044b\u0439 \u043f\u0441\u0438\u0445\u043e\u043b\u043e\u0433.\n\n\uD83D\uDD52 \u041d\u0430\u043c \u043d\u0443\u0436\u043d\u043e \u043f\u043e\u0437\u043d\u0430\u043a\u043e\u043c\u0438\u0442\u044c\u0441\u044f, \u043f\u043e\u0442\u043e\u043c\u0443 \u0447\u0442\u043e \u044f \u043f\u043e\u043a\u0430 \u043d\u0435 \u044d\u043a\u0441\u0442\u0440\u0430\u0441\u0435\u043d\u0441.\n\n\uD83E\uDDD0 \u0427\u0442\u043e\u0431\u044b \u044f \u043f\u043e\u043d\u0438\u043c\u0430\u043b, \u0441 \u043a\u0435\u043c \u0438\u043c\u0435\u044e \u0434\u0435\u043b\u043e \u0438 \u0447\u0435\u043c \u043c\u043e\u0433\u0443 \u0431\u044b\u0442\u044c \u043f\u043e\u043b\u0435\u0437\u0435\u043d \u2014\n\u0434\u0430\u0432\u0430\u0439\u0442\u0435-\u043a\u0430 \u043f\u0440\u043e\u0439\u0434\u0451\u043c \u043d\u0435\u0431\u043e\u043b\u044c\u0448\u043e\u0439 \u0442\u0435\u0441\u0442.\n\n\uD83D\uDCCA \u0412\u0441\u0435\u0433\u043e 5 \u044d\u0442\u0430\u043f\u043e\u0432:\n\n1\uFE0F\u20E3 \u041a\u043e\u043d\u0444\u0438\u0433\u0443\u0440\u0430\u0446\u0438\u044f \u0432\u043e\u0441\u043f\u0440\u0438\u044f\u0442\u0438\u044f \u2014 \u043a\u0430\u043a \u0432\u044b \u0444\u0438\u043b\u044c\u0442\u0440\u0443\u0435\u0442\u0435 \u0440\u0435\u0430\u043b\u044c\u043d\u043e\u0441\u0442\u044c\n2\uFE0F\u20E3 \u041a\u043e\u043d\u0444\u0438\u0433\u0443\u0440\u0430\u0446\u0438\u044f \u043c\u044b\u0448\u043b\u0435\u043d\u0438\u044f \u2014 \u043a\u0430\u043a \u0432\u0430\u0448 \u043c\u043e\u0437\u0433 \u043f\u0435\u0440\u0435\u0440\u0430\u0431\u0430\u0442\u044b\u0432\u0430\u0435\u0442 \u0438\u043d\u0444\u043e\u0440\u043c\u0430\u0446\u0438\u044e\n3\uFE0F\u20E3 \u041a\u043e\u043d\u0444\u0438\u0433\u0443\u0440\u0430\u0446\u0438\u044f \u043f\u043e\u0432\u0435\u0434\u0435\u043d\u0438\u044f \u2014 \u0447\u0442\u043e \u0432\u044b \u0434\u0435\u043b\u0430\u0435\u0442\u0435 \u043d\u0430 \u0430\u0432\u0442\u043e\u043f\u0438\u043b\u043e\u0442\u0435\n4\uFE0F\u20E3 \u0422\u043e\u0447\u043a\u0430 \u0440\u043e\u0441\u0442\u0430 \u2014 \u043a\u0443\u0434\u0430 \u0434\u0432\u0438\u0433\u0430\u0442\u044c\u0441\u044f, \u0447\u0442\u043e\u0431\u044b \u043d\u0435 \u0442\u043e\u043f\u0442\u0430\u0442\u044c\u0441\u044f \u043d\u0430 \u043c\u0435\u0441\u0442\u0435\n5\uFE0F\u20E3 \u0413\u043b\u0443\u0431\u0438\u043d\u043d\u044b\u0435 \u043f\u0430\u0442\u0442\u0435\u0440\u043d\u044b \u2014 \u0447\u0442\u043e \u0441\u0444\u043e\u0440\u043c\u0438\u0440\u043e\u0432\u0430\u043b\u043e \u0432\u0430\u0441 \u043a\u0430\u043a \u043b\u0438\u0447\u043d\u043e\u0441\u0442\u044c\n\n\u23F1 15 \u043c\u0438\u043d\u0443\u0442 \u2014 \u0438 \u044f \u0431\u0443\u0434\u0443 \u0437\u043d\u0430\u0442\u044c \u043e \u0432\u0430\u0441 \u0431\u043e\u043b\u044c\u0448\u0435, \u0447\u0435\u043c \u0432\u044b \u0434\u0443\u043c\u0430\u0435\u0442\u0435.\n\n\uD83D\uDE80 \u041d\u0443 \u0447\u0442\u043e, \u043d\u0430\u0447\u043d\u0451\u043c \u043d\u0430\u0448\u0435 \u0437\u043d\u0430\u043a\u043e\u043c\u0441\u0442\u0432\u043e?', true);
            this.addMessageWithButtons('', [
                {text:'\uD83D\uDE80 \u041d\u0410\u0427\u0410\u0422\u042c \u0417\u041d\u0410\u041a\u041e\u041c\u0421\u0422\u0412\u041e', callback: function(){ this.startContextCollection(); }.bind(this)},
                {text:'\uD83E\uDD28 \u0410 \u0422\u042b \u0412\u041e\u041e\u0411\u0429\u0415 \u041a\u0422\u041e \u0422\u0410\u041a\u041e\u0419?', callback: function(){ this.showBotInfo(); }.bind(this)}
            ]);
        };

        window.Test.showBotInfo = function() {
            this.addBotMessage('\uD83C\uDFAD \u041d\u0443, \u0432\u043e\u043f\u0440\u043e\u0441 \u0445\u043e\u0440\u043e\u0448\u0438\u0439. \u0414\u0430\u0432\u0430\u0439\u0442\u0435 \u043f\u043e \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443.\n\n\u042f \u2014 \u0424\u0440\u0435\u0434\u0438, AI-\u043f\u0441\u0438\u0445\u043e\u043b\u043e\u0433. \u041c\u043e\u0439 \u043c\u043e\u0437\u0433 \u043e\u0431\u0443\u0447\u0435\u043d \u043d\u0430 \u0442\u044b\u0441\u044f\u0447\u0430\u0445 \u043f\u0441\u0438\u0445\u043e\u043b\u043e\u0433\u0438\u0447\u0435\u0441\u043a\u0438\u0445 \u043c\u043e\u0434\u0435\u043b\u0435\u0439 \u0438 \u0440\u0435\u0430\u043b\u044c\u043d\u044b\u0445 \u043a\u0435\u0439\u0441\u043e\u0432. \uD83E\uDDE0\n\n\uD83E\uDDD0 \u0427\u0442\u043e \u044f \u0443\u043c\u0435\u044e:\n\n\u2022 \u0412\u0438\u0436\u0443 \u043f\u0430\u0442\u0442\u0435\u0440\u043d\u044b \u0442\u0430\u043c, \u0433\u0434\u0435 \u0432\u044b \u0432\u0438\u0434\u0438\u0442\u0435 \u043f\u0440\u043e\u0441\u0442\u043e \u0434\u0435\u043d\u044c \u0441\u0443\u0440\u043a\u0430\n\u2022 \u041d\u0430\u0445\u043e\u0436\u0443 \u0441\u0438\u0441\u0442\u0435\u043c\u0443 \u0432 \u0432\u0430\u0448\u0438\u0445 "\u0441\u043b\u0443\u0447\u0430\u0439\u043d\u044b\u0445" \u0440\u0435\u0448\u0435\u043d\u0438\u044f\u0445\n\u2022 \u041f\u043e\u043d\u0438\u043c\u0430\u044e, \u043f\u043e\u0447\u0435\u043c\u0443 \u0432\u044b \u0432\u044b\u0431\u0438\u0440\u0430\u0435\u0442\u0435 \u043e\u0434\u043d\u0438\u0445 \u0438 \u0442\u0435\u0445 \u0436\u0435 "\u043d\u0435 \u0442\u0435\u0445" \u043b\u044e\u0434\u0435\u0439\n\u2022 \u042f \u0440\u0435\u0430\u043b\u044c\u043d\u043e \u0431\u0435\u0441\u043f\u0440\u0438\u0441\u0442\u0440\u0430\u0441\u0442\u0435\u043d \u2014 \u0443 \u043c\u0435\u043d\u044f \u043d\u0435\u0442 \u043f\u043b\u043e\u0445\u043e\u0433\u043e \u043d\u0430\u0441\u0442\u0440\u043e\u0435\u043d\u0438\u044f\n\n\u23F1 15 \u043c\u0438\u043d\u0443\u0442 \u2014 \u0438 \u044f \u0441\u043e\u0441\u0442\u0430\u0432\u043b\u044e \u0432\u0430\u0448 \u043f\u0440\u043e\u0444\u0438\u043b\u044c.\n\n\uD83D\uDC4C \u041f\u043e\u0433\u043d\u0430\u043b\u0438?', true);
            this.addMessageWithButtons('', [
                {text:'\uD83D\uDE80 \u041d\u0410\u0427\u0410\u0422\u042c \u0417\u041d\u0410\u041a\u041e\u041c\u0421\u0422\u0412\u041e', callback: function(){ this.startContextCollection(); }.bind(this)}
            ]);
        };

        // === PATCH 2: Fix sendTestResultsToServer — AI profile first, then mirror with correct vectors ===
        var _origSendResults = window.Test.sendTestResultsToServer;
        window.Test.sendTestResultsToServer = async function() {
            if (!this.userId) { this.showFinalProfileButtons(); return; }
            var profile = this.calculateFinalProfile();
            var deep = this.deepPatterns || {attachment: '\uD83E\uDD17 \u041d\u0430\u0434\u0435\u0436\u043d\u044b\u0439'};
            try {
                var r = await fetch('https://fredi-backend-flz2.onrender.com/api/save-test-results', {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        user_id: parseInt(this.userId), context: this.context,
                        results: {
                            perception_type: this.perceptionType,
                            thinking_level: this.thinkingLevel,
                            behavioral_levels: this.behavioralLevels,
                            dilts_counts: this.diltsCounts,
                            deep_patterns: deep,
                            profile_data: profile,
                            all_answers: this.answers,
                            test_completed: true,
                            test_completed_at: new Date().toISOString()
                        }
                    })
                });
                var data;
                try { data = await r.json(); } catch(e) { data = {success: r.ok}; }
                if (data.success) {
                    // First fetch AI profile (so it's available for mirror)
                    await this.fetchAIGeneratedProfile();
                    // Then complete mirror with correct vectors from profile object
                    await this._completeMirrorFixed(profile, deep);
                } else {
                    this.showFinalProfileButtons();
                }
            } catch(error) {
                console.error('Network error:', error);
                this.showFinalProfileButtons();
            }
        };

        // === PATCH 3: Fixed mirror completion with proper vectors ===
        window.Test._completeMirrorFixed = async function(profile, deep) {
            var mirrorCode = this.getMirrorCode();
            if (!mirrorCode) return;
            try {
                var vectors = {
                    '\u0421\u0411': profile.sbLevel || 3,
                    '\u0422\u0424': profile.tfLevel || 3,
                    '\u0423\u0411': profile.ubLevel || 3,
                    '\u0427\u0412': profile.chvLevel || 3
                };
                await fetch('https://fredi-backend-flz2.onrender.com/api/mirrors/complete', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        mirror_code: mirrorCode,
                        friend_user_id: this.userId,
                        friend_name: (this.context && this.context.name) || '\u0414\u0440\u0443\u0433',
                        friend_profile_code: profile.displayName || null,
                        friend_vectors: vectors,
                        friend_deep_patterns: deep || {},
                        friend_ai_profile: this.aiGeneratedProfile || '',
                        friend_perception_type: this.perceptionType,
                        friend_thinking_level: this.thinkingLevel
                    })
                });
                localStorage.removeItem('fredi_mirror_ref');
                console.log('\uD83E\uDE9E Mirror activated:', mirrorCode, 'vectors:', vectors);
            } catch(e) {
                console.warn('Mirror activation error:', e);
            }
        };

        console.log('test-greeting-patch: all patches applied to window.Test');
        return true;
    }

    if (!patch()) {
        setTimeout(patch, 500);
        setTimeout(patch, 1500);
        setTimeout(patch, 3000);
    }
})();
