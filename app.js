// ===== Хранилище данных =====
const Storage = {
    get(key, defaultValue = []) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch {
            return defaultValue;
        }
    },
    set(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }
};

// ===== Глобальное состояние =====
const state = {
    currentView: 'calendar',
    today: new Date(), // Настоящее сегодня - определяется по устройству
    currentMonth: new Date(), // Месяц для отображения в календаре
    selectedDate: new Date(), // Выбранная дата в календаре
    habitViewDate: new Date(), // Дата для просмотра привычек
    taskFilterDate: null, // Фильтр задач по дате (null = без фильтра)
    timeBlocks: Storage.get('timeBlocks', []),
    habits: Storage.get('habits', [
        { id: 1, title: 'Чтение 30 минут', icon: '📚', frequency: 'daily', customCategory: '', progress: {}, streak: 0 },
        { id: 2, title: 'Пить 2л воды', icon: '💧', frequency: 'daily', customCategory: '', progress: {}, streak: 0 },
        { id: 3, title: 'Пробежка', icon: '🏃', frequency: 'weekdays', customCategory: '', progress: {}, streak: 0 },
        { id: 4, title: 'Медитация', icon: '🧘', frequency: 'daily', customCategory: '', progress: {}, streak: 0 },
    ]),
    tasks: Storage.get('tasks', [
        { id: 1, title: 'Сдать курсовую работу', description: 'Подготовить все файлы', date: '2026-05-21', priority: 'high', completed: false },
        { id: 2, title: 'Купить продукты', description: 'Молоко, хлеб, овощи', date: '2026-05-20', priority: 'medium', completed: false },
        { id: 3, title: 'Позвонить маме', description: '', date: '2026-05-20', priority: 'low', completed: true },
    ]),
    nextId: Storage.get('nextId', 10)
};

// Инициализация today по устройству
state.today = new Date();
state.today.setHours(0, 0, 0, 0);
state.currentMonth = new Date(state.today);
state.selectedDate = new Date(state.today);
state.habitViewDate = new Date(state.today);

// Гарантируем, что у всех привычек есть progress
state.habits.forEach(habit => {
    if (!habit.progress || typeof habit.progress !== 'object') {
        habit.progress = {};
    }
    if (!habit.customCategory) {
        habit.customCategory = '';
    }
});

function saveState() {
    Storage.set('timeBlocks', state.timeBlocks);
    Storage.set('habits', state.habits);
    Storage.set('tasks', state.tasks);
    Storage.set('nextId', state.nextId);
}

function generateId() {
    return state.nextId++;
}

// Вспомогательные функции дат
function formatDate(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateDisplay(date) {
    const d = new Date(date);
    const today = new Date(state.today);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (d.getTime() === today.getTime()) return 'Сегодня';
    if (d.getTime() === tomorrow.getTime()) return 'Завтра';
    if (d.getTime() === yesterday.getTime()) return 'Вчера';
    
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ===== Навигация =====
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentView = btn.dataset.view;
        state.taskFilterDate = null;
        document.getElementById('filterDateLabel').textContent = '';
        
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`${state.currentView}-view`).classList.add('active');
        
        if (state.currentView === 'analytics') renderAnalytics();
        if (state.currentView === 'habits') {
            renderHabits();
            renderRecommendations();
        }
        if (state.currentView === 'tasks') {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('[data-filter="all"]').classList.add('active');
            currentTaskFilter = 'all';
            renderTasks();
        }
    });
});

// ===== Календарь =====
function getMonthData(year, month) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay() || 7;
    const daysInMonth = lastDay.getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    const days = [];
    
    for (let i = startDay - 1; i > 0; i--) {
        days.push({
            day: daysInPrevMonth - i + 1,
            month: month - 1,
            year: month === 0 ? year - 1 : year,
            isOtherMonth: true
        });
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
        days.push({
            day: i,
            month: month,
            year: year,
            isOtherMonth: false
        });
    }
    
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
        days.push({
            day: i,
            month: month + 1,
            year: month === 11 ? year + 1 : year,
            isOtherMonth: true
        });
    }
    
    return days;
}

function renderCalendar() {
    const year = state.currentMonth.getFullYear();
    const month = state.currentMonth.getMonth();
    const days = getMonthData(year, month);
    
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                       'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    
    document.getElementById('currentMonth').textContent = `${monthNames[month]} ${year}`;
    
    let html = '';
    dayNames.forEach(day => {
        html += `<div class="calendar-day-header">${day}</div>`;
    });
    
    const todayStr = formatDate(state.today);
    
    days.forEach(d => {
        const dateObj = new Date(d.year, d.month, d.day);
        dateObj.setHours(0, 0, 0, 0);
        const dateStr = formatDate(dateObj);
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === formatDate(state.selectedDate);
        
        const tasksCount = state.tasks.filter(t => t.date === dateStr && !t.completed).length;
        
        html += `
            <div class="calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${d.isOtherMonth ? 'other-month' : ''}"
                 data-date="${dateStr}"
                 onclick="selectDate('${dateStr}', ${d.isOtherMonth})">
                ${d.day}
                ${tasksCount > 0 ? `<span class="day-tasks-count">${tasksCount} 📋</span>` : ''}
            </div>
        `;
    });
    
    document.getElementById('calendarGrid').innerHTML = html;
    updateSelectedDateDisplay();
    renderTimeBlocks();
    updateTasksForDateButton();
}

function selectDate(dateStr, isOtherMonth) {
    if (isOtherMonth) return;
    const [year, month, day] = dateStr.split('-').map(Number);
    state.selectedDate = new Date(year, month - 1, day);
    state.selectedDate.setHours(0, 0, 0, 0);
    renderCalendar();
}

function updateSelectedDateDisplay() {
    document.getElementById('selectedDateDisplay').textContent = formatDateDisplay(state.selectedDate);
}

function updateTasksForDateButton() {
    const dateStr = formatDate(state.selectedDate);
    const tasksForDate = state.tasks.filter(t => t.date === dateStr && !t.completed);
    const btn = document.getElementById('viewTasksForDate');
    
    if (tasksForDate.length > 0) {
        btn.style.display = 'block';
        btn.textContent = `📋 Посмотреть задачи на ${formatDateDisplay(state.selectedDate)} (${tasksForDate.length})`;
    } else {
        btn.style.display = 'none';
    }
}

document.getElementById('prevMonth').addEventListener('click', () => {
    state.currentMonth.setMonth(state.currentMonth.getMonth() - 1);
    renderCalendar();
});

document.getElementById('nextMonth').addEventListener('click', () => {
    state.currentMonth.setMonth(state.currentMonth.getMonth() + 1);
    renderCalendar();
});

document.getElementById('todayBtn').addEventListener('click', () => {
    state.today = new Date();
    state.today.setHours(0, 0, 0, 0);
    state.currentMonth = new Date(state.today);
    state.selectedDate = new Date(state.today);
    renderCalendar();
});

document.getElementById('viewTasksForDate').addEventListener('click', () => {
    state.taskFilterDate = formatDate(state.selectedDate);
    document.getElementById('filterDateLabel').textContent = `📅 ${formatDateDisplay(state.selectedDate)}`;
    
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-view="tasks"]').classList.add('active');
    state.currentView = 'tasks';
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('tasks-view').classList.add('active');
    
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-filter="active"]').classList.add('active');
    currentTaskFilter = 'active';
    renderTasks();
});

// ===== Временные блоки =====
function getSelectedDateStr() {
    return formatDate(state.selectedDate);
}

function renderTimeBlocks() {
    const dateStr = getSelectedDateStr();
    const blocks = state.timeBlocks.filter(b => b.date === dateStr).sort((a, b) => a.start.localeCompare(b.start));
    const container = document.getElementById('timeBlocksList');
    
    if (blocks.length === 0) {
        container.innerHTML = '<p class="empty-state">Нет временных блоков на этот день</p>';
        return;
    }
    
    container.innerHTML = blocks.map(b => `
        <div class="time-block" style="border-left-color: ${b.color}">
            <span class="block-time">${b.start} - ${b.end}</span>
            <span class="block-title">${b.title}</span>
            <button class="block-delete" onclick="deleteTimeBlock(${b.id})">✕</button>
        </div>
    `).join('');
}

document.getElementById('addTimeBlock').addEventListener('click', () => {
    openModal('timeBlockModal');
});

document.getElementById('timeBlockForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const block = {
        id: generateId(),
        date: getSelectedDateStr(),
        title: document.getElementById('blockTitle').value,
        start: document.getElementById('blockStart').value,
        end: document.getElementById('blockEnd').value,
        color: document.getElementById('blockColor').value
    };
    state.timeBlocks.push(block);
    saveState();
    renderTimeBlocks();
    closeModal();
    e.target.reset();
});

function deleteTimeBlock(id) {
    state.timeBlocks = state.timeBlocks.filter(b => b.id !== id);
    saveState();
    renderTimeBlocks();
}

// ===== Методологии на русском =====
const methodologies = {
    timeBlocking: {
        title: 'Тайм-блокинг',
        description: 'Разделите день на блоки времени, каждый из которых посвящён определённой задаче или типу задач. Это помогает сосредоточиться на одном деле и избежать многозадачности. Рекомендуется планировать блоки заранее вечером или утром.'
    },
    pomodoro: {
        title: 'Помидорная техника',
        description: 'Работайте интервалами по 25 минут с 5-минутными перерывами. После 4 циклов сделайте длинный перерыв 15-30 минут. Отлично подходит для концентрации и борьбы с прокрастинацией. Используйте таймер!'
    },
    eisenhower: {
        title: 'Матрица Эйзенхауэра',
        description: 'Разделите задачи на 4 категории:\n• Срочные и важные — делайте немедленно\n• Несрочные, но важные — планируйте\n• Срочные, но неважные — делегируйте\n• Несрочные и неважные — удаляйте'
    },
    gtd: {
        title: 'Доведение дел до конца (GTD)',
        description: 'Методика Дэвида Аллена:\n1. Записывайте все задачи во "входящие"\n2. Обрабатывайте: если задача занимает меньше 2 минут — делайте сразу\n3. Остальные — делегируйте, откладывайте или удаляйте\n4. Регулярно пересматривайте списки'
    }
};

document.getElementById('showMethodInfo').addEventListener('click', () => {
    const method = document.getElementById('methodologySelect').value;
    const info = methodologies[method];
    document.getElementById('methodTitle').textContent = info.title;
    document.getElementById('methodDescription').textContent = info.description;
    openModal('methodInfoModal');
});

// ===== Привычки (исправленная версия) =====
function getDaysArray(daysCount) {
    const days = [];
    for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(state.habitViewDate);
        d.setDate(d.getDate() - i);
        days.push(formatDate(d));
    }
    return days;
}

function getTodayStr() {
    return formatDate(state.today);
}

function calculateStreak(habit) {
    if (!habit.progress || typeof habit.progress !== 'object') {
        return 0;
    }
    
    let streak = 0;
    const checkDate = new Date(state.habitViewDate);
    
    for (let i = 0; i < 365; i++) {
        const d = new Date(checkDate);
        d.setDate(d.getDate() - i);
        const dateStr = formatDate(d);
        
        const progress = habit.progress[dateStr];
        if (progress && progress > 0) {
            streak++;
        } else if (i > 0) {
            break;
        }
    }
    
    return streak;
}

function renderHabits() {
    const viewDateStr = formatDate(state.habitViewDate);
    const isToday = viewDateStr === getTodayStr();
    
    document.getElementById('habitCurrentDate').textContent = isToday ? 'Сегодня' : formatDateDisplay(state.habitViewDate);
    
    const container = document.getElementById('habitsContainer');
    const last30Days = getDaysArray(30);
    
    container.innerHTML = state.habits.map(habit => {
        // Гарантируем, что progress существует
        if (!habit.progress || typeof habit.progress !== 'object') {
            habit.progress = {};
        }
        
        const todayProgress = habit.progress[viewDateStr] || 0;
        const isCompleted = todayProgress >= 100;
        const isOvercompleted = todayProgress > 100;
        const streak = calculateStreak(habit);
        
        // История за 30 дней (безопасная проверка)
        const historyDots = last30Days.map(d => {
            const progress = habit.progress && habit.progress[d] ? habit.progress[d] : 0;
            let cls = '';
            if (progress >= 100) cls = progress > 100 ? 'overdone' : 'done';
            return `<div class="habit-history-dot ${cls}" title="${d}: ${progress}%"></div>`;
        }).join('');
        
        // Статус серии
        let streakBadge = '';
        if (streak >= 30) {
            streakBadge = '<span class="streak-badge long">🔥 ' + streak + ' дней!</span>';
        } else if (streak >= 7) {
            streakBadge = '<span class="streak-badge monthly">⭐ ' + streak + ' дней</span>';
        } else if (streak > 0) {
            streakBadge = '<span class="streak-badge weekly">📅 ' + streak + ' дн.</span>';
        }
        
        // Отображение категории
        const categoryDisplay = habit.customCategory 
            ? `<div style="font-size: 0.8rem; color: var(--text-light); margin-top: 4px;">📂 ${habit.customCategory}</div>`
            : '';
        
        return `
            <div class="habit-card">
                <div class="habit-header">
                    <div class="habit-info">
                        <span class="habit-icon">${habit.icon}</span>
                        <div>
                            <div class="habit-name">${habit.title}</div>
                            ${categoryDisplay}
                        </div>
                    </div>
                    <button class="btn btn-small btn-outline" onclick="deleteHabit(${habit.id})">✕</button>
                </div>
                
                <div class="habit-check-area">
                    <div class="habit-main-check ${isCompleted ? (isOvercompleted ? 'overcompleted' : 'completed') : ''}"
                         onclick="toggleHabitToday(${habit.id})"
                         title="${isOvercompleted ? 'Перевыполнено! Нажмите, чтобы сбросить' : isCompleted ? 'Выполнено. Нажмите, чтобы сбросить' : 'Нажмите, чтобы отметить выполнение'}">
                        ${isOvercompleted ? '★' : isCompleted ? '✓' : ''}
                    </div>
                    <div class="habit-details">
                        <div class="habit-streak-info">
                            ${streakBadge}
                            ${todayProgress > 0 ? `<span>Прогресс: ${todayProgress}%</span>` : ''}
                        </div>
                        <button class="habit-overcomplete-btn" onclick="markHabitOvercomplete(${habit.id})">
                            ⭐ Отметить перевыполнение (сегодня сделано больше обычного)
                        </button>
                    </div>
                </div>
                
                <div class="habit-history">
                    ${historyDots}
                </div>
            </div>
        `;
    }).join('');
    
    // Обновляем streak в состоянии
    state.habits.forEach(h => {
        h.streak = calculateStreak(h);
    });
}

function toggleHabitToday(habitId) {
    const habit = state.habits.find(h => h.id === habitId);
    if (!habit) return;
    
    // Гарантируем, что progress существует
    if (!habit.progress || typeof habit.progress !== 'object') {
        habit.progress = {};
    }
    
    const dateStr = formatDate(state.habitViewDate);
    
    if (habit.progress[dateStr] && habit.progress[dateStr] > 0) {
        // Сброс
        delete habit.progress[dateStr];
    } else {
        // Отметить выполненным (100%)
        habit.progress[dateStr] = 100;
    }
    
    saveState();
    renderHabits();
    renderRecommendations();
    updateProductivity();
}

function markHabitOvercomplete(habitId) {
    const habit = state.habits.find(h => h.id === habitId);
    if (!habit) return;
    
    // Гарантируем, что progress существует
    if (!habit.progress || typeof habit.progress !== 'object') {
        habit.progress = {};
    }
    
    const dateStr = formatDate(state.habitViewDate);
    const currentProgress = habit.progress[dateStr] || 0;
    
    if (currentProgress === 0) {
        habit.progress[dateStr] = 150;
    } else if (currentProgress >= 100) {
        habit.progress[dateStr] = currentProgress + 50;
    } else {
        habit.progress[dateStr] = 150;
    }
    
    saveState();
    renderHabits();
    renderRecommendations();
    updateProductivity();
}

document.getElementById('habitPrevDay').addEventListener('click', () => {
    state.habitViewDate.setDate(state.habitViewDate.getDate() - 1);
    renderHabits();
    renderRecommendations();
});

document.getElementById('habitNextDay').addEventListener('click', () => {
    const tomorrow = new Date(state.today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (state.habitViewDate.getTime() >= tomorrow.getTime()) return;
    
    state.habitViewDate.setDate(state.habitViewDate.getDate() + 1);
    renderHabits();
    renderRecommendations();
});

document.getElementById('habitTodayBtn').addEventListener('click', () => {
    state.habitViewDate = new Date(state.today);
    renderHabits();
    renderRecommendations();
});

document.getElementById('addHabitBtn').addEventListener('click', () => {
    openModal('habitModal');
});

document.getElementById('habitForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const habit = {
        id: generateId(),
        title: document.getElementById('habitTitle').value,
        icon: document.getElementById('habitIcon').value,
        frequency: document.getElementById('habitFrequency').value,
        customCategory: document.getElementById('habitCustomCategory')?.value || '',
        progress: {},
        streak: 0
    };
    
    state.habits.push(habit);
    saveState();
    renderHabits();
    renderRecommendations();
    closeModal();
    e.target.reset();
});

function deleteHabit(id) {
    if (!confirm('Удалить эту привычку? Действие нельзя отменить.')) return;
    state.habits = state.habits.filter(h => h.id !== id);
    saveState();
    renderHabits();
    renderRecommendations();
}

// ===== Рекомендации =====
function renderRecommendations() {
    const recs = [];
    
    state.habits.forEach(habit => {
        if (!habit.progress || typeof habit.progress !== 'object') {
            habit.progress = {};
        }
        
        const streak = calculateStreak(habit);
        const viewDateStr = formatDate(state.habitViewDate);
        const todayProgress = habit.progress[viewDateStr] || 0;
        
        if (streak >= 30) {
            recs.push({
                icon: '🏆',
                text: `<strong>${habit.title}</strong>: Невероятно! Вы выполняете эту привычку уже <strong>${streak} дней</strong> подряд! Это уровень мастерства!`
            });
        } else if (streak >= 21) {
            recs.push({
                icon: '🌟',
                text: `<strong>${habit.title}</strong>: Потрясающая серия — <strong>${streak} день</strong>! Говорят, что привычка формируется за 21 день. У вас получилось!`
            });
        } else if (streak >= 14) {
            recs.push({
                icon: '🎯',
                text: `<strong>${habit.title}</strong>: Отличная работа! Уже <strong>${streak} дней</strong> подряд. Вы на правильном пути!`
            });
        } else if (streak >= 7) {
            recs.push({
                icon: '💪',
                text: `<strong>${habit.title}</strong>: Неделя непрерывных выполнений! <strong>${streak} дней</strong> — это серьёзное достижение.`
            });
        } else if (streak >= 3) {
            recs.push({
                icon: '👏',
                text: `<strong>${habit.title}</strong>: Хорошее начало! <strong>${streak} дня</strong> подряд. Продолжайте!`
            });
        }
        
        if (todayProgress > 100) {
            recs.push({
                icon: '⭐',
                text: `<strong>${habit.title}</strong>: Сегодня вы перевыполнили норму (${todayProgress}%)! Отличная мотивация!`
            });
        }
        
        const last7Days = getDaysArray(7);
        const completedInWeek = last7Days.filter(d => (habit.progress[d] || 0) >= 100).length;
        
        if (completedInWeek === 0 && streak === 0) {
            recs.push({
                icon: '💡',
                text: `<strong>${habit.title}</strong>: Попробуйте начать с малого. Даже 5 минут в день помогут сформировать привычку.`
            });
        }
    });
    
    recs.sort((a, b) => {
        const priority = { '🏆': 0, '🌟': 1, '🎯': 2, '💪': 3, '⭐': 4, '👏': 5, '💡': 6 };
        return (priority[a.icon] || 10) - (priority[b.icon] || 10);
    });
    
    if (recs.length === 0) {
        recs.push({
            icon: '🎉',
            text: 'Вы на верном пути! Продолжайте отмечать свои привычки и следите за прогрессом.'
        });
    }
    
    document.getElementById('recommendationsList').innerHTML = recs.map(r => `
        <div class="recommendation-item">${r.icon} ${r.text}</div>
    `).join('');
}

// ===== Задачи =====
let currentTaskFilter = 'all';

function renderTasks() {
    const container = document.getElementById('tasksList');
    let tasks = [...state.tasks];
    
    if (state.taskFilterDate) {
        tasks = tasks.filter(t => t.date === state.taskFilterDate);
        document.getElementById('filterDateLabel').textContent = `📅 ${formatDateDisplay(new Date(state.taskFilterDate))}`;
    } else {
        document.getElementById('filterDateLabel').textContent = '';
    }
    
    if (currentTaskFilter === 'active') {
        tasks = tasks.filter(t => !t.completed);
    } else if (currentTaskFilter === 'completed') {
        tasks = tasks.filter(t => t.completed);
    } else if (currentTaskFilter === 'today') {
        const todayStr = formatDate(state.today);
        tasks = tasks.filter(t => t.date === todayStr && !t.completed);
    }
    
    tasks.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    
    if (tasks.length === 0) {
        container.innerHTML = '<p class="empty-state">Нет задач</p>';
        return;
    }
    
    container.innerHTML = tasks.map(task => `
        <div class="task-item priority-${task.priority} ${task.completed ? 'completed' : ''}"
             draggable="true"
             data-task-id="${task.id}"
             ondragstart="handleDragStart(event, ${task.id})"
             ondragend="handleDragEnd(event)">
            <div class="task-checkbox ${task.completed ? 'checked' : ''}" 
                 onclick="toggleTask(${task.id})">
                ${task.completed ? '✓' : ''}
            </div>
            <div class="task-content">
                <div class="task-title">${task.title}</div>
                <div class="task-meta">
                    ${task.date ? '📅 ' + formatDateDisplay(new Date(task.date)) : ''}
                    ${task.description ? ' • ' + task.description.substring(0, 50) : ''}
                </div>
            </div>
            <button class="task-delete" onclick="deleteTask(${task.id})">✕</button>
        </div>
    `).join('');
}

function toggleTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (task) {
        task.completed = !task.completed;
        saveState();
        renderTasks();
        renderCalendar();
        updateProductivity();
    }
}

function deleteTask(id) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveState();
    renderTasks();
    renderCalendar();
    updateProductivity();
}

document.getElementById('addTaskBtn').addEventListener('click', () => {
    openModal('taskModal');
});

document.getElementById('taskForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const task = {
        id: generateId(),
        title: document.getElementById('taskTitle').value,
        description: document.getElementById('taskDescription').value,
        date: document.getElementById('taskDate').value,
        priority: document.getElementById('taskPriority').value,
        completed: false
    };
    state.tasks.push(task);
    saveState();
    renderTasks();
    renderCalendar();
    closeModal();
    e.target.reset();
});

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTaskFilter = btn.dataset.filter;
        state.taskFilterDate = null;
        renderTasks();
    });
});

// ===== Drag & Drop задач =====
let draggedTaskId = null;

function handleDragStart(e, taskId) {
    draggedTaskId = taskId;
    e.target.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    e.target.style.opacity = '1';
    draggedTaskId = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDrop(e) {
    e.preventDefault();
    
    const dropTarget = e.target.closest('.calendar-day');
    if (!dropTarget || !draggedTaskId) return;
    
    const dateStr = dropTarget.dataset.date;
    if (!dateStr || dropTarget.classList.contains('other-month')) return;
    
    const task = state.tasks.find(t => t.id === draggedTaskId);
    if (task) {
        task.date = dateStr;
        saveState();
        renderTasks();
        renderCalendar();
    }
    
    draggedTaskId = null;
}

// ===== Аналитика =====
function renderAnalytics() {
    renderHabitsChart();
    renderTasksChart();
    renderHeatmap();
    renderStats();
}

function renderHabitsChart() {
    const canvas = document.getElementById('habitsChart');
    const ctx = canvas.getContext('2d');
    const last30Days = getDaysArray(30);
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const width = canvas.width;
    const height = canvas.height;
    const padding = { top: 20, right: 20, bottom: 45, left: 55 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    // Безопасный подсчёт данных — сколько привычек выполнено в каждый день
    const totalPerDay = last30Days.map(d => {
        return state.habits.reduce((sum, h) => {
            const progress = (h.progress && h.progress[d]) ? h.progress[d] : 0;
            return sum + (progress >= 100 ? 1 : progress / 100);
        }, 0);
    });
    
    // Максимальное значение для оси Y
    const maxY = state.habits.length || 5;
    const yMax = Math.max(maxY, Math.ceil(Math.max(...totalPerDay, 1)));
    const ySteps = yMax;
    
    // Фон графика
    ctx.fillStyle = '#FAFBFC';
    ctx.fillRect(padding.left, padding.top, chartWidth, chartHeight);
    
    // Горизонтальные линии сетки и подписи оси Y
    ctx.strokeStyle = '#E8ECF0';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#636E72';
    ctx.font = '10px Inter';
    ctx.textAlign = 'right';
    
    for (let i = 0; i <= ySteps; i++) {
        const y = padding.top + chartHeight - (i / ySteps) * chartHeight;
        
        // Линия сетки
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
        
        // Подпись значения
        ctx.fillText(i, padding.left - 8, y + 4);
    }
    
    // Подпись оси Y
    ctx.save();
    ctx.translate(14, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#636E72';
    ctx.font = '10px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('Выполнено привычек', 0, 0);
    ctx.restore();
    
    // Заливка под графиком
    ctx.fillStyle = 'rgba(108, 92, 231, 0.12)';
    ctx.beginPath();
    totalPerDay.forEach((val, i) => {
        const x = padding.left + (chartWidth / (last30Days.length - 1)) * i;
        const y = padding.top + chartHeight - (val / ySteps) * chartHeight;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
    ctx.lineTo(padding.left, padding.top + chartHeight);
    ctx.closePath();
    ctx.fill();
    
    // Линия графика
    ctx.strokeStyle = '#6C5CE7';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    totalPerDay.forEach((val, i) => {
        const x = padding.left + (chartWidth / (last30Days.length - 1)) * i;
        const y = padding.top + chartHeight - (val / ySteps) * chartHeight;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // Точки на графике (только для значимых дней)
    totalPerDay.forEach((val, i) => {
        if (val > 0 || i % 5 === 0) {
            const x = padding.left + (chartWidth / (last30Days.length - 1)) * i;
            const y = padding.top + chartHeight - (val / ySteps) * chartHeight;
            
            // Точка
            ctx.fillStyle = val > 0 ? '#6C5CE7' : '#B2BEC3';
            ctx.beginPath();
            ctx.arc(x, y, val > 0 ? 4 : 2, 0, Math.PI * 2);
            ctx.fill();
            
            // Подпись значения над точкой (только если > 0)
            if (val > 0) {
                ctx.fillStyle = '#2D3436';
                ctx.font = 'bold 9px Inter';
                ctx.textAlign = 'center';
                ctx.fillText(Math.round(val * 10) / 10, x, y - 10);
            }
        }
    });
    
    // Подписи дат по оси X (каждые 5 дней) — ТЕПЕРЬ В ФОРМАТЕ ДД.ММ.ГГ
    ctx.fillStyle = '#636E72';
    ctx.font = '9px Inter';
    ctx.textAlign = 'center';
    
    last30Days.forEach((d, i) => {
        if (i % 5 === 0 || i === last30Days.length - 1) {
            const x = padding.left + (chartWidth / (last30Days.length - 1)) * i;
            const date = new Date(d);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = String(date.getFullYear()).slice(-2);
            const label = `${day}.${month}.${year}`;
            
            // Чередуем подписи по высоте, чтобы не налезали друг на друга
            const labelY = i % 10 === 0 ? height - padding.bottom + 18 : height - padding.bottom + 30;
            
            ctx.fillText(label, x, labelY);
            
            // Маленькая вертикальная метка
            ctx.strokeStyle = '#E8ECF0';
            ctx.beginPath();
            ctx.moveTo(x, padding.top + chartHeight);
            ctx.lineTo(x, padding.top + chartHeight + 5);
            ctx.stroke();
        }
    });
    
    // Подпись оси X
    ctx.fillStyle = '#636E72';
    ctx.font = '10px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('Дата', width / 2, height - 4);
    
    // Заголовок графика
    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 11px Inter';
    ctx.textAlign = 'left';
    ctx.fillText('📈 Прогресс привычек за 30 дней', padding.left, 14);
    
    // Легенда
    const legendY = height - padding.bottom + 38;
    
    // Линия
    ctx.strokeStyle = '#6C5CE7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding.left, legendY);
    ctx.lineTo(padding.left + 25, legendY);
    ctx.stroke();
    
    // Точка
    ctx.fillStyle = '#6C5CE7';
    ctx.beginPath();
    ctx.arc(padding.left + 12, legendY, 3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#636E72';
    ctx.font = '9px Inter';
    ctx.textAlign = 'left';
    ctx.fillText('— За день', padding.left + 32, legendY + 3);
}
function renderTasksChart() {
    const canvas = document.getElementById('tasksChart');
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const completed = state.tasks.filter(t => t.completed).length;
    const active = state.tasks.filter(t => !t.completed).length;
    const total = state.tasks.length || 1;
    
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = Math.min(cx, cy) - 25;
    
    if (completed > 0) {
        ctx.fillStyle = '#00B894';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + (completed / total) * Math.PI * 2);
        ctx.closePath();
        ctx.fill();
    }
    if (active > 0) {
        ctx.fillStyle = '#DFE6E9';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, -Math.PI / 2 + (completed / total) * Math.PI * 2, -Math.PI / 2 + Math.PI * 2);
        ctx.closePath();
        ctx.fill();
    }
    
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.6, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 20px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(`${completed}/${total}`, cx, cy + 2);
    ctx.font = '11px Inter';
    ctx.fillText('выполнено', cx, cy + 20);
    
    ctx.fillStyle = '#00B894';
    ctx.fillRect(20, canvas.height - 30, 12, 12);
    ctx.fillStyle = '#2D3436';
    ctx.font = '11px Inter';
    ctx.textAlign = 'left';
    ctx.fillText('Выполнено', 38, canvas.height - 20);
    
    ctx.fillStyle = '#DFE6E9';
    ctx.fillRect(115, canvas.height - 30, 12, 12);
    ctx.fillText('Активные', 133, canvas.height - 20);
}

function renderHeatmap() {
    const heatmap = document.getElementById('heatmap');
    const last28Days = [];
    
    for (let i = 27; i >= 0; i--) {
        const d = new Date(state.today);
        d.setDate(d.getDate() - i);
        last28Days.push(formatDate(d));
    }
    
    heatmap.innerHTML = last28Days.map(dateStr => {
        let completedCount = 0;
        
        state.habits.forEach(habit => {
            const progress = (habit.progress && habit.progress[dateStr]) ? habit.progress[dateStr] : 0;
            if (progress >= 100) completedCount += 1 + Math.floor((progress - 100) / 50);
            else if (progress > 0) completedCount += 0.5;
        });
        
        state.tasks.forEach(task => {
            if (task.date === dateStr && task.completed) completedCount++;
        });
        
        const level = Math.min(5, Math.ceil(completedCount));
        
        return `<div class="heatmap-cell ${level > 0 ? 'level-' + level : ''}" 
                     title="${dateStr}: ${completedCount} баллов активности"></div>`;
    }).join('');
}

function renderStats() {
    const completedTasks = state.tasks.filter(t => t.completed).length;
    const totalTasks = state.tasks.length;
    const taskRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    const last7Days = getDaysArray(7);
    let totalCompletions = 0;
    let totalOvercompletions = 0;
    state.habits.forEach(habit => {
        last7Days.forEach(d => {
            const progress = (habit.progress && habit.progress[d]) ? habit.progress[d] : 0;
            if (progress >= 100) {
                totalCompletions++;
                if (progress > 100) totalOvercompletions++;
            }
        });
    });
    
    const bestStreak = Math.max(...state.habits.map(h => calculateStreak(h)), 0);
    
    const todayStr = getTodayStr();
    const todayCompletions = state.habits.filter(h => {
        const progress = (h.progress && h.progress[todayStr]) ? h.progress[todayStr] : 0;
        return progress >= 100;
    }).length;
    
    const stats = [
        { label: 'Задач выполнено', value: `${completedTasks} из ${totalTasks} (${taskRate}%)` },
        { label: 'Привычек за неделю', value: `${totalCompletions} выполнено (${totalOvercompletions} перевыполнено)` },
        { label: 'Привычек сегодня', value: `${todayCompletions} из ${state.habits.length}` },
        { label: 'Лучшая серия', value: `${bestStreak} дней подряд` },
        { label: 'Текущая методика', value: methodologies[document.getElementById('methodologySelect')?.value || 'timeBlocking'].title },
    ];
    
    document.getElementById('statsList').innerHTML = stats.map(s => `
        <div class="stat-item">
            <span class="stat-label">${s.label}</span>
            <span class="stat-value">${s.value}</span>
        </div>
    `).join('');
}

// ===== Продуктивность =====
function updateProductivity() {
    const completedTasks = state.tasks.filter(t => t.completed).length;
    const totalTasks = state.tasks.length;
    const taskScore = totalTasks > 0 ? (completedTasks / totalTasks) * 40 : 0;
    
    const last7Days = getDaysArray(7);
    let totalPossible = state.habits.length * 7;
    let totalDone = 0;
    let totalOver = 0;
    state.habits.forEach(habit => {
        last7Days.forEach(d => {
            const progress = (habit.progress && habit.progress[d]) ? habit.progress[d] : 0;
            if (progress >= 100) {
                totalDone++;
                if (progress > 100) totalOver += (progress - 100) / 100;
            }
        });
    });
    const habitScore = totalPossible > 0 ? (totalDone / totalPossible) * 50 : 0;
    const overBonus = Math.min(10, totalOver * 2);
    
    const score = Math.round(Math.min(100, taskScore + habitScore + overBonus));
    
    document.getElementById('productivityScore').textContent = `${score}%`;
    document.getElementById('productivityBar').style.width = `${score}%`;
}

// ===== Модальные окна =====
function openModal(modalId) {
    document.getElementById('modalOverlay').classList.add('active');
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    document.getElementById(modalId).style.display = 'block';
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
}

document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', closeModal);
});

document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalOverlay')) {
        closeModal();
    }
});

// ===== Инициализация =====
function init() {
    state.today = new Date();
    state.today.setHours(0, 0, 0, 0);
    state.currentMonth = new Date(state.today);
    state.selectedDate = new Date(state.today);
    state.habitViewDate = new Date(state.today);
    
    // Гарантируем, что у всех привычек есть progress
    state.habits.forEach(habit => {
        if (!habit.progress || typeof habit.progress !== 'object') {
            habit.progress = {};
        }
        if (!habit.customCategory) {
            habit.customCategory = '';
        }
    });
    
    renderCalendar();
    renderHabits();
    renderTasks();
    renderRecommendations();
    updateProductivity();
    

}

init();