// ========== ОБРАБОТЧИКИ БЫСТРЫХ ДЕЙСТВИЙ ==========

async function handleShowProfile() {
    const profile = await getUserProfile();
    navigateTo('profile', { content: profile });
}

async function handleShowThoughts() {
    const thought = await getPsychologistThought();
    if (thought) navigateTo('thoughts', { content: thought });
    else showToast('Мысли психолога появятся после прохождения теста', 'info');
}

async function handleShowNewThought() {
    const newThought = await generateNewThought();
    if (newThought) navigateTo('thoughts', { content: newThought });
    else showToast('Не удалось сгенерировать мысль', 'error');
}

async function handleShowWeekend() {
    const ideas = await getWeekendIdeas();
    if (ideas.length) navigateTo('weekend', { content: ideas.map(i => i.description || i).join('\n\n') });
    else showToast('Идеи скоро появятся', 'info');
}

async function handleShowGoals() {
    const goals = await getUserGoals();
    if (goals.length) navigateTo('goals', { content: goals.map(g => `**${g.name}**\n⏱ ${g.time || '?'}  |  🎯 ${g.difficulty || 'medium'}\n${g.is_priority ? '🔐 Приоритетная цель' : ''}`).join('\n\n') });
    else showToast('Цели появятся после прохождения теста', 'info');
}

async function handleShowQuestions() {
    const questions = await getSmartQuestions();
    if (questions.length) navigateTo('questions', { content: questions.map((q, i) => `${i+1}. ${q}`).join('\n\n') });
    else showToast('Вопросы появятся после прохождения теста', 'info');
}

async function handleShowChallenges() {
    const challenges = await getChallenges();
    if (challenges.length) navigateTo('challenges', { content: challenges.map(c => `**${c.name}**\n${c.description}\n🎁 Награда: ${c.reward} очков`).join('\n\n') });
    else showToast('Челленджи появятся после прохождения теста', 'info');
}

async function handleShowDoubles() {
    const doubles = await findPsychometricDoubles();
    if (doubles.length) navigateTo('doubles', { content: doubles.map(d => `**${d.name}**\nПрофиль: ${d.profile_code}\nСхожесть: ${Math.round(d.similarity * 100)}%`).join('\n\n') });
    else showToast('Двойники появятся после прохождения теста', 'info');
}
