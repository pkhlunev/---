

//Конфигурация и константы
const CONFIG = {
    STORAGE_KEYS: {
        TIME_BLOCKS: 'timeBlocks',
        HABITS: 'habits',
        TASKS: 'tasks',
        NEXT_ID: 'nextId'
    },
    DEFAULTS: {
        HABITS: [
            { id: 1, title: 'Чтение 30 минут', icon: '📚', frequency: 'daily', customCategory: '', progress: {}, streak: 0 },
            { id: 2, title: 'Пить 2л воды', icon: '💧', frequency: 'daily', customCategory: '', progress: {}, streak: 0 },
            { id: 3, title: 'Пробежка', icon: '🏃', frequency: 'weekdays', customCategory: '', progress: {}, streak: 0 },
            { id: 4, title: 'Медитация', icon: '🧘', frequency: 'daily', customCategory: '', progress: {}, streak: 0 }
        ],
        TASKS: [
            { id: 1, title: 'Сдать курсовую работу', description: 'Подготовить все файлы', date: '2026-05-28', priority: 'high', completed: false },
            { id: 2, title: 'Купить продукты', description: 'Молоко, хлеб, овощи', date: '2026-05-29', priority: 'medium', completed: false },
            { id: 3, title: 'Позвонить маме', description: '', date: '2026-05-30', priority: 'low', completed: false }
        ],
        NEXT_ID: 10
    },
    MONTH_NAMES: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
    DAY_NAMES: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    DRAG_TIMEOUT: 5000,
    TOUCH_HOLD_DURATION: 500,
    NOTIFICATION_DURATION: 3000
};

// Утилиты
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
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('Ошибка сохранения в localStorage:', e);
        }
    }
};

const DOM = {
    get(id) {
        const el = document.getElementById(id);
        if (!el) console.warn(`Элемент #${id} не найден`);
        return el;
    },
    query(selector, parent = document) {
        return parent.querySelector(selector);
    },
    queryAll(selector, parent = document) {
        return parent.querySelectorAll(selector);
    }
};

const DateUtils = {
    format(date) {
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },
    
    formatDisplay(date, today) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const t = new Date(today);
        t.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(t);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const yesterday = new Date(t);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (d.getTime() === t.getTime()) return 'Сегодня';
        if (d.getTime() === tomorrow.getTime()) return 'Завтра';
        if (d.getTime() === yesterday.getTime()) return 'Вчера';
        
        return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    },
    
    getDaysArray(count, fromDate) {
        const days = [];
        for (let i = count - 1; i >= 0; i--) {
            const d = new Date(fromDate);
            d.setDate(d.getDate() - i);
            days.push(DateUtils.format(d));
        }
        return days;
    },
    
    isToday(dateStr, today) {
        return dateStr === DateUtils.format(today);
    }
};

const DeviceDetector = {
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
               || ('ontouchstart' in window) 
               || (navigator.maxTouchPoints > 0);
    }
};

// Состояние приложения
class AppState {
    constructor() {
        this.currentView = 'calendar';
        this.today = new Date();
        this.today.setHours(0, 0, 0, 0);
        this.currentMonth = new Date(this.today);
        this.selectedDate = new Date(this.today);
        this.habitViewDate = new Date(this.today);
        this.taskFilterDate = null;
        this.isDragging = false;
        this.editingTaskId = null;
        this.draggedTaskId = null;
        
        // Загружаем данные
        this.timeBlocks = Storage.get(CONFIG.STORAGE_KEYS.TIME_BLOCKS, []);
        this.habits = Storage.get(CONFIG.STORAGE_KEYS.HABITS, CONFIG.DEFAULTS.HABITS);
        this.tasks = Storage.get(CONFIG.STORAGE_KEYS.TASKS, CONFIG.DEFAULTS.TASKS);
        this.nextId = Storage.get(CONFIG.STORAGE_KEYS.NEXT_ID, CONFIG.DEFAULTS.NEXT_ID);
        
        this._sanitizeHabits();
    }
    
    _sanitizeHabits() {
        this.habits.forEach(habit => {
            if (!habit.progress || typeof habit.progress !== 'object') {
                habit.progress = {};
            }
            if (!habit.customCategory) {
                habit.customCategory = '';
            }
        });
    }
    
    generateId() {
        return this.nextId++;
    }
    
    save() {
        Storage.set(CONFIG.STORAGE_KEYS.TIME_BLOCKS, this.timeBlocks);
        Storage.set(CONFIG.STORAGE_KEYS.HABITS, this.habits);
        Storage.set(CONFIG.STORAGE_KEYS.TASKS, this.tasks);
        Storage.set(CONFIG.STORAGE_KEYS.NEXT_ID, this.nextId);
    }
    
    resetToToday() {
        this.today = new Date();
        this.today.setHours(0, 0, 0, 0);
        this.currentMonth = new Date(this.today);
        this.selectedDate = new Date(this.today);
    }
}

// Глобальный экземпляр состояния
const state = new AppState();

// Навигация
const Navigation = {
    switchTo(viewName) {
        DOM.queryAll('.nav-btn').forEach(b => b.classList.remove('active'));
        const navBtn = DOM.query(`[data-view="${viewName}"]`);
        if (navBtn) navBtn.classList.add('active');
        
        state.currentView = viewName;
        
        DOM.queryAll('.view').forEach(v => v.classList.remove('active'));
        const viewEl = document.getElementById(`${viewName}-view`);
        if (viewEl) viewEl.classList.add('active');
        
        this._onViewActivated(viewName);
    },
    
    _onViewActivated(viewName) {
        switch (viewName) {
            case 'analytics': Analytics.render(); break;
            case 'habits': Habits.render(); Recommendations.render(); break;
            case 'tasks': Tasks.onActivate(); break;
            case 'calendar': Calendar.render(); Calendar.updateDragHint(); break;
        }
    }
};

// Уведомления
const Notifications = {
    show(message, type = 'success') {
        const old = DOM.query('.notification');
        if (old) old.remove();
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, CONFIG.NOTIFICATION_DURATION);
    }
};

//Модальные окна
const Modals = {
    open(modalId) {
        const overlay = DOM.get('modalOverlay');
        if (overlay) overlay.classList.add('active');
        
        DOM.queryAll('.modal').forEach(m => m.style.display = 'none');
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'block';
    },
    
    close() {
        const overlay = DOM.get('modalOverlay');
        if (overlay) overlay.classList.remove('active');
        DOM.queryAll('.modal').forEach(m => m.style.display = 'none');
        
        if (state.editingTaskId) {
            Tasks.resetForm();
        }
    }
};

//Календарь
const Calendar = {
    _currentTaskFilter: 'all',
    
    getMonthData(year, month) {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDay = firstDay.getDay() || 7;
        const daysInMonth = lastDay.getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();
        
        const days = [];
        
        for (let i = startDay - 1; i > 0; i--) {
            days.push({ day: daysInPrevMonth - i + 1, month: month - 1, year: month === 0 ? year - 1 : year, isOtherMonth: true });
        }
        
        for (let i = 1; i <= daysInMonth; i++) {
            days.push({ day: i, month, year, isOtherMonth: false });
        }
        
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            days.push({ day: i, month: month + 1, year: month === 11 ? year + 1 : year, isOtherMonth: true });
        }
        
        return days;
    },
    
    render() {
        const year = state.currentMonth.getFullYear();
        const month = state.currentMonth.getMonth();
        const days = this.getMonthData(year, month);
        
        const currentMonthEl = DOM.get('currentMonth');
        if (currentMonthEl) currentMonthEl.textContent = `${CONFIG.MONTH_NAMES[month]} ${year}`;
        
        this.updateDragHint();
        
        let html = '';
        CONFIG.DAY_NAMES.forEach(day => { html += `<div class="calendar-day-header">${day}</div>`; });
        
        const todayStr = DateUtils.format(state.today);
        
        days.forEach(d => {
            const dateObj = new Date(d.year, d.month, d.day);
            dateObj.setHours(0, 0, 0, 0);
            const dateStr = DateUtils.format(dateObj);
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === DateUtils.format(state.selectedDate);
            const isDropTarget = state.isDragging && !d.isOtherMonth;
            
            const tasksForDay = state.tasks.filter(t => t.date === dateStr);
            const activeTasksCount = tasksForDay.filter(t => !t.completed).length;
            
            const onclickAction = state.isDragging 
                ? `DragDrop.handleMobileDrop('${dateStr}', ${d.isOtherMonth})` 
                : `Calendar.selectDate('${dateStr}', ${d.isOtherMonth})`;
            
            html += `
                <div class="calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${d.isOtherMonth ? 'other-month' : ''} ${isDropTarget ? 'drop-target' : ''}"
                     data-date="${dateStr}" data-other-month="${d.isOtherMonth}"
                     onclick="${onclickAction}"
                     ondragover="DragDrop.handleCalendarDragOver(event)"
                     ondragleave="DragDrop.handleCalendarDragLeave(event)"
                     ondrop="DragDrop.handleCalendarDrop(event, '${dateStr}')">
                    <div class="day-number">${d.day}</div>
                    ${activeTasksCount > 0 ? `<span class="day-tasks-count">${activeTasksCount} 📋</span>` : ''}
                    <div class="day-mini-tasks">
                        ${tasksForDay.filter(t => !t.completed).slice(0, 2).map(t => 
                            `<div class="mini-task priority-${t.priority}" title="${t.title}">${t.title.substring(0, 15)}${t.title.length > 15 ? '...' : ''}</div>`
                        ).join('')}
                    </div>
                    ${isDropTarget ? '<div class="drop-indicator">📥</div>' : ''}
                </div>
            `;
        });
        
        const calendarGrid = DOM.get('calendarGrid');
        if (calendarGrid) calendarGrid.innerHTML = html;
        
        this.updateSelectedDateDisplay();
        this.renderTimeBlocks();
        this.updateTasksForDateButton();
    },
    
    selectDate(dateStr, isOtherMonth) {
        if (state.isDragging || isOtherMonth) return;
        const [year, month, day] = dateStr.split('-').map(Number);
        state.selectedDate = new Date(year, month - 1, day);
        state.selectedDate.setHours(0, 0, 0, 0);
        this.render();
    },
    
    updateSelectedDateDisplay() {
        const el = DOM.get('selectedDateDisplay');
        if (el) el.textContent = DateUtils.formatDisplay(state.selectedDate, state.today);
    },
    
    updateDragHint() {
        const dragHint = DOM.get('dragHint');
        if (!dragHint) return;
        
        if (state.isDragging) {
            dragHint.style.display = 'block';
            dragHint.innerHTML = DeviceDetector.isMobile() 
                ? '👆 <strong>Нажмите на нужный день календаря, чтобы переместить задачу</strong>'
                : '🎯 <strong>Перетащите задачу на нужный день календаря</strong>';
        } else {
            dragHint.style.display = 'none';
        }
    },
    
    updateTasksForDateButton() {
        const dateStr = DateUtils.format(state.selectedDate);
        const tasksForDate = state.tasks.filter(t => t.date === dateStr && !t.completed);
        const btn = DOM.get('viewTasksForDate');
        if (!btn) return;
        
        if (tasksForDate.length > 0) {
            btn.style.display = 'block';
            btn.textContent = `📋 Посмотреть задачи на ${DateUtils.formatDisplay(state.selectedDate, state.today)} (${tasksForDate.length})`;
        } else {
            btn.style.display = 'none';
        }
    },
    
    renderTimeBlocks() {
        const dateStr = DateUtils.format(state.selectedDate);
        const blocks = state.timeBlocks.filter(b => b.date === dateStr).sort((a, b) => a.start.localeCompare(b.start));
        const container = DOM.get('timeBlocksList');
        if (!container) return;
        
        if (blocks.length === 0) {
            container.innerHTML = '<p class="empty-state">Нет временных блоков на этот день</p>';
            return;
        }
        
        container.innerHTML = blocks.map(b => `
            <div class="time-block" style="border-left-color: ${b.color}">
                <span class="block-time">${b.start} - ${b.end}</span>
                <span class="block-title">${b.title}</span>
                <button class="block-delete" onclick="Calendar.deleteTimeBlock(${b.id})">✕</button>
            </div>
        `).join('');
    },
    
    addTimeBlock() {
        Modals.open('timeBlockModal');
    },
    
    saveTimeBlock(e) {
        e.preventDefault();
        const block = {
            id: state.generateId(),
            date: DateUtils.format(state.selectedDate),
            title: document.getElementById('blockTitle').value,
            start: document.getElementById('blockStart').value,
            end: document.getElementById('blockEnd').value,
            color: document.getElementById('blockColor').value
        };
        state.timeBlocks.push(block);
        state.save();
        this.renderTimeBlocks();
        Modals.close();
        e.target.reset();
    },
    
    deleteTimeBlock(id) {
        state.timeBlocks = state.timeBlocks.filter(b => b.id !== id);
        state.save();
        this.renderTimeBlocks();
    },
    
    goToPrevMonth() {
        if (state.isDragging) return;
        state.currentMonth.setMonth(state.currentMonth.getMonth() - 1);
        this.render();
    },
    
    goToNextMonth() {
        if (state.isDragging) return;
        state.currentMonth.setMonth(state.currentMonth.getMonth() + 1);
        this.render();
    },
    
    goToToday() {
        if (state.isDragging) return;
        state.resetToToday();
        this.render();
    },
    
    viewTasksForDate() {
        state.taskFilterDate = DateUtils.format(state.selectedDate);
        const filterLabel = DOM.get('filterDateLabel');
        if (filterLabel) filterLabel.textContent = `📅 ${DateUtils.formatDisplay(state.selectedDate, state.today)}`;
        
        Navigation.switchTo('tasks');
        DOM.queryAll('.filter-btn').forEach(b => b.classList.remove('active'));
        const activeBtn = DOM.query('[data-filter="active"]');
        if (activeBtn) activeBtn.classList.add('active');
        this._currentTaskFilter = 'active';
        Tasks.render();
    }
};

// Drag & Drop 

const DragDrop = {
    handleCalendarDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        if (!state.isDragging) return;
        e.currentTarget.classList.add('drag-over');
    },
    
    handleCalendarDragLeave(e) {
        e.stopPropagation();
        e.currentTarget.classList.remove('drag-over');
    },
    
    handleCalendarDrop(e, dateStr) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('drag-over');
        this.dropTaskOnDate(dateStr);
    },
    
    handleMobileDrop(dateStr, isOtherMonth) {
        if (!state.isDragging) return;
        if (isOtherMonth) {
            Notifications.show('⚠️ Нельзя переместить задачу на день из другого месяца', 'error');
            return;
        }
        this.dropTaskOnDate(dateStr);
    },
    
    handleTouchMove(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        
        DOM.queryAll('.calendar-day').forEach(day => day.classList.remove('touch-hover'));
        
        if (element) {
            const calendarDay = element.classList.contains('calendar-day') ? element : element.closest('.calendar-day');
            if (calendarDay) calendarDay.classList.add('touch-hover');
        }
    },
    
    dropTaskOnDate(dateStr) {
        if (!state.draggedTaskId) return;
        
        const task = state.tasks.find(t => t.id === state.draggedTaskId);
        if (task) {
            task.date = dateStr;
            state.save();
            
            state.isDragging = false;
            this._cleanup();
            
            Calendar.render();
            if (state.currentView === 'tasks') Tasks.render();
            
            Notifications.show(`✅ Задача "${task.title}" перенесена на ${DateUtils.formatDisplay(new Date(dateStr), state.today)}`, 'success');
        }
        
        state.draggedTaskId = null;
    },
    
    startTaskDrag(taskId, taskElement) {
        state.draggedTaskId = taskId;
        state.isDragging = true;
        
        if (taskElement) taskElement.classList.add('dragging');
        
        setTimeout(() => {
            Navigation.switchTo('calendar');
            Calendar.updateDragHint();
            Notifications.show(
                DeviceDetector.isMobile() ? '👆 Теперь нажмите на нужный день в календаре' : '🎯 Перетащите задачу на нужный день в календаре',
                'success'
            );
        }, 100);
    },
    
    cancelDrag() {
        if (!state.isDragging) return;
        
        state.isDragging = false;
        state.draggedTaskId = null;
        
        this._cleanup();
        Calendar.render();
        Notifications.show('ℹ️ Перемещение отменено', 'error');
    },
    
    _cleanup() {
        DOM.queryAll('.calendar-day').forEach(day => {
            day.classList.remove('drag-over', 'touch-hover', 'drop-target');
        });
        const dragHint = DOM.get('dragHint');
        if (dragHint) dragHint.style.display = 'none';
    },
   
    // Desktop
    handleTaskDragStart(e, taskId) {
        this.startTaskDrag(taskId, e.target.closest('.task-item'));
        e.dataTransfer.effectAllowed = 'move';
    },
    
    handleTaskDragEnd(e) {
        const taskElement = e.target.closest('.task-item');
        if (taskElement) taskElement.classList.remove('dragging');
    },
    
    handleListDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    },
    
    handleListDrop(e) {
        e.preventDefault();
    }
};

// Привычки 
const Habits = {
    render() {
        const viewDateStr = DateUtils.format(state.habitViewDate);
        const isToday = DateUtils.isToday(viewDateStr, state.today);
        
        const habitCurrentDate = DOM.get('habitCurrentDate');
        if (habitCurrentDate) {
            habitCurrentDate.textContent = isToday ? 'Сегодня' : DateUtils.formatDisplay(state.habitViewDate, state.today);
        }
        
        const container = DOM.get('habitsContainer');
        if (!container) return;
        
        const last30Days = DateUtils.getDaysArray(30, state.habitViewDate);
        
        container.innerHTML = state.habits.map(habit => this._renderHabitCard(habit, viewDateStr, last30Days)).join('');
        
        state.habits.forEach(h => {
            h.streak = this.calculateStreak(h);
        });
    },
    
    _renderHabitCard(habit, viewDateStr, last30Days) {
        const todayProgress = habit.progress[viewDateStr] || 0;
        const isCompleted = todayProgress >= 100;
        const isOvercompleted = todayProgress > 100;
        const streak = this.calculateStreak(habit);
        
        const historyDots = last30Days.map(d => {
            const progress = habit.progress[d] || 0;
            let cls = progress >= 100 ? (progress > 100 ? 'overdone' : 'done') : '';
            return `<div class="habit-history-dot ${cls}" title="${d}: ${progress}%"></div>`;
        }).join('');
        
        let streakBadge = '';
        if (streak >= 30) streakBadge = `<span class="streak-badge long">🔥 ${streak} дней!</span>`;
        else if (streak >= 7) streakBadge = `<span class="streak-badge monthly">⭐ ${streak} дней</span>`;
        else if (streak > 0) streakBadge = `<span class="streak-badge weekly">📅 ${streak} дн.</span>`;
        
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
                    <button class="btn btn-small btn-outline" onclick="Habits.delete(${habit.id})">✕</button>
                </div>
                <div class="habit-check-area">
                    <div class="habit-main-check ${isCompleted ? (isOvercompleted ? 'overcompleted' : 'completed') : ''}"
                         onclick="Habits.toggleToday(${habit.id})">
                        ${isOvercompleted ? '★' : isCompleted ? '✓' : ''}
                    </div>
                    <div class="habit-details">
                        <div class="habit-streak-info">
                            ${streakBadge}
                            ${todayProgress > 0 ? `<span>Прогресс: ${todayProgress}%</span>` : ''}
                        </div>
                        <button class="habit-overcomplete-btn" onclick="Habits.markOvercomplete(${habit.id})">
                            ⭐ Отметить перевыполнение
                        </button>
                    </div>
                </div>
                <div class="habit-history">${historyDots}</div>
            </div>
        `;
    },
    
    calculateStreak(habit) {
        if (!habit.progress || typeof habit.progress !== 'object') return 0;
        
        let streak = 0;
        const checkDate = new Date(state.habitViewDate);
        
        for (let i = 0; i < 365; i++) {
            const d = new Date(checkDate);
            d.setDate(d.getDate() - i);
            const dateStr = DateUtils.format(d);
            const progress = habit.progress[dateStr];
            if (progress && progress > 0) streak++;
            else if (i > 0) break;
        }
        
        return streak;
    },
    
    toggleToday(habitId) {
        const habit = state.habits.find(h => h.id === habitId);
        if (!habit) return;
        
        const dateStr = DateUtils.format(state.habitViewDate);
        
        if (habit.progress[dateStr] && habit.progress[dateStr] > 0) {
            delete habit.progress[dateStr];
        } else {
            habit.progress[dateStr] = 100;
        }
        
        state.save();
        this.render();
        Recommendations.render();
        Productivity.update();
    },
    
    markOvercomplete(habitId) {
        const habit = state.habits.find(h => h.id === habitId);
        if (!habit) return;
        
        const dateStr = DateUtils.format(state.habitViewDate);
        const currentProgress = habit.progress[dateStr] || 0;
        
        if (currentProgress === 0) habit.progress[dateStr] = 150;
        else if (currentProgress >= 100) habit.progress[dateStr] = currentProgress + 50;
        else habit.progress[dateStr] = 150;
        
        state.save();
        this.render();
        Recommendations.render();
        Productivity.update();
    },
    
    add() { Modals.open('habitModal'); },
    
    save(e) {
        e.preventDefault();
        const habit = {
            id: state.generateId(),
            title: document.getElementById('habitTitle').value,
            icon: document.getElementById('habitIcon').value,
            frequency: document.getElementById('habitFrequency').value,
            customCategory: document.getElementById('habitCustomCategory')?.value || '',
            progress: {},
            streak: 0
        };
        state.habits.push(habit);
        state.save();
        this.render();
        Recommendations.render();
        Modals.close();
        e.target.reset();
    },
    
    delete(id) {
        if (!confirm('Удалить эту привычку?')) return;
        state.habits = state.habits.filter(h => h.id !== id);
        state.save();
        this.render();
        Recommendations.render();
    },
    
    prevDay() {
        state.habitViewDate.setDate(state.habitViewDate.getDate() - 1);
        this.render();
        Recommendations.render();
    },
    
    nextDay() {
        const tomorrow = new Date(state.today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (state.habitViewDate.getTime() >= tomorrow.getTime()) return;
        state.habitViewDate.setDate(state.habitViewDate.getDate() + 1);
        this.render();
        Recommendations.render();
    },
    
    goToToday() {
        state.habitViewDate = new Date(state.today);
        this.render();
        Recommendations.render();
    }
};

// Рекомендации 
const Recommendations = {
    render() {
        const recs = [];
        
        state.habits.forEach(habit => {
            const streak = Habits.calculateStreak(habit);
            const viewDateStr = DateUtils.format(state.habitViewDate);
            const todayProgress = habit.progress[viewDateStr] || 0;
            
            if (streak >= 30) {
                recs.push({ icon: '🏆', text: `<strong>${habit.title}</strong>: Невероятно! Вы выполняете эту привычку уже <strong>${streak} дней</strong> подряд!` });
            } else if (streak >= 21) {
                recs.push({ icon: '🌟', text: `<strong>${habit.title}</strong>: Потрясающая серия — <strong>${streak} день</strong>! Привычка сформирована!` });
            } else if (streak >= 7) {
                recs.push({ icon: '💪', text: `<strong>${habit.title}</strong>: Неделя непрерывных выполнений! <strong>${streak} дней</strong> — отличный результат!` });
            } else if (streak >= 3) {
                recs.push({ icon: '👏', text: `<strong>${habit.title}</strong>: Хорошее начало! <strong>${streak} дня</strong> подряд. Продолжайте!` });
            }
            
            if (todayProgress > 100) {
                recs.push({ icon: '⭐', text: `<strong>${habit.title}</strong>: Сегодня вы перевыполнили норму (${todayProgress}%)!` });
            }
        });
        
        if (recs.length === 0) {
            recs.push({ icon: '🎉', text: 'Вы на верном пути! Продолжайте отмечать свои привычки и следите за прогрессом.' });
        }
        
        const container = DOM.get('recommendationsList');
        if (container) {
            container.innerHTML = recs.map(r => `<div class="recommendation-item">${r.icon} ${r.text}</div>`).join('');
        }
    }
};

// Задачи 
const Tasks = {
    _currentFilter: 'all',
    _touchTimer: null,
    _touchStartTaskId: null,
    _updateDragInstruction() {
        const ins = DOM.query('.drag-instruction');
        if (!ins) return;
        if (DeviceDetector.isMobile()) {
            ins.innerHTML = '👆 <strong>Нажмите и удерживайте задачу, чтобы переместить её в календарь</strong>';
            ins.className = 'drag-instruction mobile';
        } else {
            ins.innerHTML = '💡 <strong>Чтобы запланировать задачу:</strong> захватите её мышкой и перетащите на день в календаре';
            ins.className = 'drag-instruction desktop';
        }
    },
    onActivate() {
        DOM.queryAll('.filter-btn').forEach(b => b.classList.remove('active'));
        const allBtn = DOM.query('[data-filter="all"]');
        if (allBtn) allBtn.classList.add('active');
        this._currentFilter = 'all';
        state.taskFilterDate = null;
        const filterLabel = DOM.get('filterDateLabel');
        if (filterLabel) filterLabel.textContent = '';
        this._updateDragInstruction();
        this.render();
    },
    
    render() {
        const container = DOM.get('tasksList');
        if (!container) return;
        
        let tasks = [...state.tasks];
        
        if (state.taskFilterDate) {
            tasks = tasks.filter(t => t.date === state.taskFilterDate);
            const filterLabel = DOM.get('filterDateLabel');
            if (filterLabel) filterLabel.textContent = `📅 ${DateUtils.formatDisplay(new Date(state.taskFilterDate), state.today)}`;
        } else {
            const filterLabel = DOM.get('filterDateLabel');
            if (filterLabel) filterLabel.textContent = '';
        }
        
        if (this._currentFilter === 'active') tasks = tasks.filter(t => !t.completed);
        else if (this._currentFilter === 'completed') tasks = tasks.filter(t => t.completed);
        else if (this._currentFilter === 'today') {
            const todayStr = DateUtils.format(state.today);
            tasks = tasks.filter(t => t.date === todayStr && !t.completed);
        }
        
        tasks.sort((a, b) => {
            const order = { high: 0, medium: 1, low: 2 };
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            return order[a.priority] - order[b.priority];
        });
        
        if (tasks.length === 0) {
            const msg = DeviceDetector.isMobile() 
                ? 'Нажмите и удерживайте задачу, затем нажмите на день в календаре для планирования.'
                : 'Захватите задачу мышкой и перетащите на день в календаре.';
            container.innerHTML = `<p class="empty-state">Нет задач. ${msg}</p>`;
            return;
        }
        
        container.innerHTML = tasks.map(task => this._renderTaskItem(task)).join('');
        
        if (DeviceDetector.isMobile() && tasks.length > 0) {
            this._addMobileInstruction(container);
        }
    },
    
    _renderTaskItem(task) {
        return `
            <div class="task-item priority-${task.priority} ${task.completed ? 'completed' : ''}"
                 draggable="true" data-task-id="${task.id}"
                 ondragstart="DragDrop.handleTaskDragStart(event, ${task.id})"
                 ondragend="DragDrop.handleTaskDragEnd(event)"
                 ontouchstart="Tasks.handleTouchStart(event, ${task.id})"
                 ontouchend="Tasks.handleTouchEnd(event)">
                <div class="task-checkbox ${task.completed ? 'checked' : ''}" onclick="Tasks.toggle(${task.id})">
                    ${task.completed ? '✓' : ''}
                </div>
                <div class="task-content" ondblclick="Tasks.edit(${task.id})" title="Двойной клик для редактирования">
                    <div class="task-title">${task.title}</div>
                    <div class="task-meta">
                        ${task.date ? '📅 ' + DateUtils.formatDisplay(new Date(task.date), state.today) : '📅 Без даты'}
                        ${task.description ? ' • ' + task.description.substring(0, 50) : ''}
                    </div>
                </div>
                <div class="task-actions">
                    <button class="task-edit" onclick="Tasks.edit(${task.id})" title="Редактировать">✏️</button>
                    <button class="task-delete" onclick="Tasks.remove(${task.id})" title="Удалить">✕</button>
                </div>
            </div>
        `;
    },
    
    _addMobileInstruction(container) {
        if (!container.querySelector('.mobile-instruction')) {
            const div = document.createElement('div');
            div.className = 'mobile-instruction';
            div.style.cssText = 'text-align: center; padding: 8px; color: #6C5CE7; font-size: 0.85rem; margin-top: 12px;';
            div.textContent = '👆 Нажмите и удерживайте задачу, чтобы переместить её в календарь';
            container.appendChild(div);
        }
    },
    
    handleTouchStart(e, taskId) {
        this._touchStartTaskId = taskId;
        const taskElement = e.target.closest('.task-item');
        
        this._touchTimer = setTimeout(() => {
            DragDrop.startTaskDrag(taskId, taskElement);
            if (navigator.vibrate) navigator.vibrate(50);
        }, CONFIG.TOUCH_HOLD_DURATION);
        
        taskElement.addEventListener('touchmove', () => clearTimeout(this._touchTimer), { once: true });
    },
    
    handleTouchEnd() {
        clearTimeout(this._touchTimer);
        this._touchStartTaskId = null;
    },
    
    edit(taskId) {
        const task = state.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        state.editingTaskId = taskId;
        
        const setVal = (id, val) => { const el = DOM.get(id); if (el) el[el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' ? 'value' : 'textContent'] = val; };
        
        setVal('taskModalTitle', '✏️ Редактировать задачу');
        setVal('taskSubmitBtn', 'Сохранить');
        setVal('editTaskId', taskId);
        setVal('taskTitle', task.title);
        setVal('taskDescription', task.description || '');
        setVal('taskDate', task.date || '');
        setVal('taskPriority', task.priority);
        
        Modals.open('taskModal');
    },
    
    resetForm() {
        state.editingTaskId = null;
        const setVal = (id, val) => { const el = DOM.get(id); if (el) el[el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' ? 'value' : 'textContent'] = val; };
        
        setVal('taskModalTitle', 'Новая задача');
        setVal('taskSubmitBtn', 'Добавить');
        setVal('editTaskId', '');
        const form = DOM.get('taskForm');
        if (form) form.reset();
    },
    
    toggle(id) {
        const task = state.tasks.find(t => t.id === id);
        if (!task) return;
        task.completed = !task.completed;
        state.save();
        this.render();
        Calendar.render();
        Productivity.update();
        Notifications.show(`✅ Задача "${task.title}" обновлена`, 'success');
    },
    
    remove(id) {
        const task = state.tasks.find(t => t.id === id);
        if (!task || !confirm(`Удалить задачу "${task.title}"?`)) return;
        state.tasks = state.tasks.filter(t => t.id !== id);
        state.save();
        this.render();
        Calendar.render();
        Productivity.update();
        Notifications.show('🗑️ Задача удалена', 'error');
    },
    
    addNew() {
        this.resetForm();
        Modals.open('taskModal');
    },
    
    save(e) {
        e.preventDefault();
        
        const getVal = (id) => document.getElementById(id)?.value || '';
        const editId = getVal('editTaskId');
        
        if (editId) {
            const task = state.tasks.find(t => t.id === parseInt(editId));
            if (task) {
                task.title = getVal('taskTitle');
                task.description = getVal('taskDescription');
                task.date = getVal('taskDate');
                task.priority = getVal('taskPriority');
                state.save();
                this.render();
                Calendar.render();
                Modals.close();
                this.resetForm();
                Notifications.show('✏️ Задача обновлена', 'success');
            }
        } else {
            const task = {
                id: state.generateId(),
                title: getVal('taskTitle'),
                description: getVal('taskDescription'),
                date: getVal('taskDate'),
                priority: getVal('taskPriority'),
                completed: false
            };
            state.tasks.push(task);
            state.save();
            this.render();
            Calendar.render();
            Modals.close();
            e.target.reset();
            Notifications.show('✅ Задача создана', 'success');
        }
    },
    
    setFilter(filter) {
        DOM.queryAll('.filter-btn').forEach(b => b.classList.remove('active'));
        const btn = DOM.query(`[data-filter="${filter}"]`);
        if (btn) btn.classList.add('active');
        this._currentFilter = filter;
        state.taskFilterDate = null;
        this.render();
    }
};

//  Методологии
const Methodologies = {
    data: {
        timeBlocking: {
            title: 'Тайм-блокинг',
            description: 'Разделите день на блоки времени, каждый из которых посвящён определённой задаче или типу задач.'
        },
        pomodoro: {
            title: 'Помидорная техника',
            description: 'Работайте интервалами по 25 минут с 5-минутными перерывами. После 4 циклов сделайте длинный перерыв 15-30 минут.'
        },
        eisenhower: {
            title: 'Матрица Эйзенхауэра',
            description: 'Разделите задачи на 4 категории:\n• Срочные и важные — делайте немедленно\n• Несрочные, но важные — планируйте\n• Срочные, но неважные — делегируйте\n• Несрочные и неважные — удаляйте'
        },
        gtd: {
            title: 'Доведение дел до конца (GTD)',
            description: 'Методика Дэвида Аллена:\n1. Записывайте все задачи во "входящие"\n2. Обрабатывайте: если задача занимает меньше 2 минут — делайте сразу\n3. Остальные — делегируйте, откладывайте или удаляйте'
        }
    },
    
    showInfo() {
        const method = document.getElementById('methodologySelect')?.value || 'timeBlocking';
        const info = this.data[method];
        const titleEl = DOM.get('methodTitle');
        const descEl = DOM.get('methodDescription');
        if (titleEl) titleEl.textContent = info.title;
        if (descEl) descEl.textContent = info.description;
        Modals.open('methodInfoModal');
    }
};

// Аналитика
const Analytics = {
    render() {
        this.renderHabitsChart();
        this.renderTasksChart();
        this.renderHeatmap();
        this.renderStats();
    },
    
    renderHabitsChart() {
        const canvas = DOM.get('habitsChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const last30Days = DateUtils.getDaysArray(30, state.today);
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const { width, height } = canvas;
        const pad = { top: 20, right: 20, bottom: 45, left: 55 };
        const cw = width - pad.left - pad.right;
        const ch = height - pad.top - pad.bottom;
        
        const totalPerDay = last30Days.map(d => 
            state.habits.reduce((sum, h) => sum + ((h.progress?.[d] || 0) >= 100 ? 1 : (h.progress?.[d] || 0) / 100), 0)
        );
        
        const yMax = Math.max(state.habits.length || 5, Math.ceil(Math.max(...totalPerDay, 1)));
        
        // Сетка
        ctx.strokeStyle = '#E8ECF0';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#636E72';
        ctx.font = '10px Inter';
        ctx.textAlign = 'right';
        for (let i = 0; i <= yMax; i++) {
            const y = pad.top + ch - (i / yMax) * ch;
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(width - pad.right, y);
            ctx.stroke();
            ctx.fillText(i, pad.left - 8, y + 4);
        }
        
        // График
        ctx.strokeStyle = '#6C5CE7';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        totalPerDay.forEach((val, i) => {
            const x = pad.left + (cw / (last30Days.length - 1)) * i;
            const y = pad.top + ch - (val / yMax) * ch;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
        
        // Подписи дат
        ctx.fillStyle = '#636E72';
        ctx.font = '9px Inter';
        ctx.textAlign = 'center';
        last30Days.forEach((d, i) => {
            if (i % 5 === 0 || i === last30Days.length - 1) {
                const x = pad.left + (cw / (last30Days.length - 1)) * i;
                const date = new Date(d);
                ctx.fillText(`${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}`, x, height - pad.bottom + 18);
            }
        });
    },
    
    renderTasksChart() {
        const canvas = DOM.get('tasksChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const completed = state.tasks.filter(t => t.completed).length;
        const total = state.tasks.length || 1;
        const { width, height } = canvas;
        const cx = width / 2, cy = height / 2;
        const radius = Math.min(cx, cy) - 25;
        
        if (completed > 0) {
            ctx.fillStyle = '#00B894';
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + (completed / total) * Math.PI * 2);
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
    },
    
    renderHeatmap() {
        const heatmap = DOM.get('heatmap');
        if (!heatmap) return;
        
        const last28Days = DateUtils.getDaysArray(28, state.today);
        
        heatmap.innerHTML = last28Days.map(dateStr => {
            let count = 0;
            state.habits.forEach(h => { if ((h.progress?.[dateStr] || 0) >= 100) count++; });
            const level = Math.min(5, count);
            return `<div class="heatmap-cell ${level > 0 ? 'level-' + level : ''}" title="${dateStr}: ${count}"></div>`;
        }).join('');
    },
    
    renderStats() {
        const container = DOM.get('statsList');
        if (!container) return;
        
        const completed = state.tasks.filter(t => t.completed).length;
        const total = state.tasks.length;
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        const last7Days = DateUtils.getDaysArray(7, state.today);
        let habitCount = 0;
        state.habits.forEach(h => last7Days.forEach(d => { if ((h.progress?.[d] || 0) >= 100) habitCount++; }));
        
        const bestStreak = Math.max(...state.habits.map(h => Habits.calculateStreak(h)), 0);
        
        container.innerHTML = [
            { l: 'Задач выполнено', v: `${completed} из ${total} (${rate}%)` },
            { l: 'Привычек за неделю', v: `${habitCount} выполнений` },
            { l: 'Лучшая серия', v: `${bestStreak} дней подряд` }
        ].map(s => `<div class="stat-item"><span class="stat-label">${s.l}</span><span class="stat-value">${s.v}</span></div>`).join('');
    }
};

// Продуктивность
const Productivity = {
    update() {
        const last7Days = DateUtils.getDaysArray(7, state.today);
        
        // ЗАДАЧНЫЙ ВКЛАД (40%)
        const tasksInWeek = state.tasks.filter(t => last7Days.includes(t.date));
        const completedTasks = tasksInWeek.filter(t => t.completed).length;
        const totalTasks = tasksInWeek.length || 1;
        const taskScore = (completedTasks / totalTasks) * 100;
        
        // ПРИВЫЧКОВЫЙ ВКЛАД (50%)
        let completedCount = 0;
        let totalPossible = 0;
        let totalOverPercent = 0;
        
        state.habits.forEach(habit => {
            last7Days.forEach(date => {
                totalPossible++;
                const progress = habit.progress?.[date] || 0;
                if (progress >= 100) {
                    completedCount++;
                    if (progress > 100) {
                        totalOverPercent += (progress - 100);
                    }
                }
            });
        });
        
        const habitScore = totalPossible > 0 ? (completedCount / totalPossible) * 100 : 0;
        
        // БОНУС ЗА ПЕРЕВЫПОЛНЕНИЕ (каждые лишние 50% = +2%, не более 10%)
        let overBonus = 0;
        if (totalOverPercent > 0) {
            // Суммируем все перевыполнения, каждые 50% дают +2%
            const bonusSteps = Math.floor(totalOverPercent / 50);
            overBonus = Math.min(10, bonusSteps * 2);
        }
        
        // ИТОГО
        let baseScore = (taskScore * 0.4) + (habitScore * 0.5);
        let finalScore = Math.min(100, baseScore + overBonus);
        finalScore = Math.round(finalScore);
        
        // ОТОБРАЖЕНИЕ
        const scoreEl = DOM.get('productivityScore');
        const barEl = DOM.get('productivityBar');
        
        if (scoreEl) {
            scoreEl.textContent = finalScore >= 100 ? `${finalScore}% 🔥` : `${finalScore}%`;
            scoreEl.style.color = finalScore >= 80 ? '#00B894' : 
                                  finalScore >= 60 ? '#FDCB6E' : '#E17055';
        }
        
        if (barEl) {
            barEl.style.width = `${finalScore}%`;
            barEl.style.background = finalScore >= 80 ? 'linear-gradient(90deg, #00B894, #00CEC9)' :
                                     finalScore >= 60 ? 'linear-gradient(90deg, #FDCB6E, #00B894)' :
                                     'linear-gradient(90deg, #E17055, #FDCB6E)';
        }
    }
};
// Привязка событий
function bindEvents() {
    // Навигация
    DOM.queryAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            Navigation.switchTo(btn.dataset.view);
            if (state.isDragging) DragDrop.cancelDrag();
        });
    });
    
    // Календарь
    DOM.get('prevMonth')?.addEventListener('click', () => Calendar.goToPrevMonth());
    DOM.get('nextMonth')?.addEventListener('click', () => Calendar.goToNextMonth());
    DOM.get('todayBtn')?.addEventListener('click', () => Calendar.goToToday());
    DOM.get('viewTasksForDate')?.addEventListener('click', () => Calendar.viewTasksForDate());
    DOM.get('addTimeBlock')?.addEventListener('click', () => Calendar.addTimeBlock());
    DOM.get('timeBlockForm')?.addEventListener('submit', (e) => Calendar.saveTimeBlock(e));
    
    // Привычки
    DOM.get('habitPrevDay')?.addEventListener('click', () => Habits.prevDay());
    DOM.get('habitNextDay')?.addEventListener('click', () => Habits.nextDay());
    DOM.get('habitTodayBtn')?.addEventListener('click', () => Habits.goToToday());
    DOM.get('addHabitBtn')?.addEventListener('click', () => Habits.add());
    DOM.get('habitForm')?.addEventListener('submit', (e) => Habits.save(e));
    
    // Задачи
    DOM.get('addTaskBtn')?.addEventListener('click', () => Tasks.addNew());
    DOM.get('taskForm')?.addEventListener('submit', (e) => Tasks.save(e));
    DOM.queryAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => Tasks.setFilter(btn.dataset.filter));
    });
    
    // Методологии
    DOM.get('showMethodInfo')?.addEventListener('click', () => Methodologies.showInfo());
    
    // Модальные окна
    DOM.queryAll('.close-modal').forEach(btn => btn.addEventListener('click', Modals.close));
    DOM.get('modalOverlay')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) Modals.close();
    });
    
    // Глобальная отмена перетаскивания
    document.addEventListener('click', (e) => {
        if (state.isDragging && !e.target.closest('.calendar-day') && !e.target.closest('.task-item')) {
            DragDrop.cancelDrag();
        }
    });
    
    // Автоотмена перетаскивания по таймауту
    document.addEventListener('dragend', () => {
        setTimeout(() => { if (state.isDragging) DragDrop.cancelDrag(); }, CONFIG.DRAG_TIMEOUT);
    });
}

// Инициализация 
function init() {
    state.resetToToday();
    state._sanitizeHabits();
    Calendar.render();
    Habits.render();
    Tasks.render();
    Recommendations.render();
    Productivity.update();
    Tasks._updateDragInstruction();
    
    if (DeviceDetector.isMobile()) {
        console.log('📱 Мобильное устройство обнаружено - активированы touch-события');
    } else {
        console.log('💻 Десктоп - активированы drag & drop события');
    }
    
    console.log('🚀 Life Organizer v3.2 успешно запущен!');
    console.log('📋 Модульная архитектура с оптимизированным кодом');
}

const DevTools = {
    _holdTimer: null,
    _holdStartTime: null,
    _requiredHoldDuration: 5000, // 5 секунд
    _progressElement: null,
    _overlayElement: null,
    _isResetting: false,
    _isHolding: false,
    
    init() {
        console.log('🛠️ DevTools: Для сброса удерживайте ПРОБЕЛ 5 секунд');
        this._createResetHint();
        this._createProgressIndicator();
        
        // Для десктопа: удержание пробела
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !this._isHolding && !this._isResetting) {
                e.preventDefault();
                e.stopPropagation();
                this._isHolding = true;
                this._startHold();
                console.log('⏳ Пробел зажат... начат отсчёт сброса');
            }
        });
        
        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space' && this._isHolding) {
                this._isHolding = false;
                this._cancelHold();
                console.log('❌ Пробел отпущен — сброс отменён');
            }
        });
        
        // Для мобильных: долгое нажатие на текст подсказки
        const footerHint = document.getElementById('resetHint');
        if (footerHint) {
            // Touch события
            footerHint.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!this._isHolding && !this._isResetting) {
                    this._isHolding = true;
                    this._startHold();
                }
            });
            
            footerHint.addEventListener('touchend', (e) => {
                e.preventDefault();
                if (this._isHolding) {
                    this._isHolding = false;
                    this._cancelHold();
                }
            });
            
            footerHint.addEventListener('touchcancel', () => {
                if (this._isHolding) {
                    this._isHolding = false;
                    this._cancelHold();
                }
            });
            
            // Мышь для десктопа (запасной вариант)
            footerHint.addEventListener('mousedown', (e) => {
                e.preventDefault();
                if (!this._isHolding && !this._isResetting) {
                    this._isHolding = true;
                    this._startHold();
                }
            });
            
            footerHint.addEventListener('mouseup', (e) => {
                e.preventDefault();
                if (this._isHolding) {
                    this._isHolding = false;
                    this._cancelHold();
                }
            });
            
            footerHint.addEventListener('mouseleave', () => {
                if (this._isHolding) {
                    this._isHolding = false;
                    this._cancelHold();
                }
            });
        }
        
        // Предотвращаем скролл при удержании пробела
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && this._isHolding) {
                e.preventDefault();
            }
        }, { passive: false });
    },
    
    _createResetHint() {
        const mainContent = document.querySelector('.main-content');
        if (!mainContent) return;
        
        // Удаляем старую подсказку если есть
        const oldHint = document.getElementById('resetHint');
        if (oldHint) oldHint.remove();
        
        const hint = document.createElement('div');
        hint.id = 'resetHint';
        hint.style.cssText = `
            text-align: center;
            padding: 15px 20px;
            margin-top: 40px;
            color:rgb(255, 0, 0);
            font-size: 0.9rem;
            font-weight: bold;
            cursor: pointer;
            user-select: none;
            -webkit-user-select: none;
            border-top: 2px solidrgb(194, 39, 39);
            background: rgba(255, 0, 0, 0.05);
            border-radius: 0 0 8px 8px;
            letter-spacing: 0.5px;
            transition: all 0.3s ease;
        `;
        
        if (DeviceDetector.isMobile()) {
            hint.innerHTML = '🔴 НАЖМИТЕ И УДЕРЖИВАЙТЕ ЗДЕСЬ 5 СЕКУНД ДЛЯ СБРОСА ВСЕХ ДАННЫХ';
        } else {
            hint.innerHTML = '🔴 ЗАЖМИТЕ ПРОБЕЛ НА 5 СЕКУНД ДЛЯ СБРОСА ВСЕХ ДАННЫХ';
        }
        
        hint.title = 'Удерживайте 5 секунд для полного сброса';
        
        hint.addEventListener('mouseenter', () => {
            hint.style.background = 'rgba(255, 0, 0, 0.1)';
            hint.style.transform = 'scale(1.02)';
        });
        
        hint.addEventListener('mouseleave', () => {
            hint.style.background = 'rgba(255, 0, 0, 0.05)';
            hint.style.transform = 'scale(1)';
        });
        
        mainContent.appendChild(hint);
    },
    
    _createProgressIndicator() {
        const oldOverlay = document.getElementById('resetProgress');
        if (oldOverlay) oldOverlay.remove();
        
        const overlay = document.createElement('div');
        overlay.id = 'resetProgress';
        overlay.style.cssText = `
            display: none;
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(26, 29, 31, 0.95);
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            z-index: 9998;
            font-family: 'Inter', sans-serif;
            font-size: 0.9rem;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            text-align: center;
            min-width: 280px;
            border: 2px solid #E17055;
        `;
        
        overlay.innerHTML = `
            <div style="margin-bottom: 12px; font-weight: 600;">
                <span id="resetProgressText">Удерживайте для сброса...</span>
            </div>
            <div style="
                width: 100%;
                height: 6px;
                background: rgba(255,255,255,0.15);
                border-radius: 3px;
                overflow: hidden;
            ">
                <div id="resetProgressBar" style="
                    width: 0%;
                    height: 100%;
                    background: linear-gradient(90deg, #FDCB6E, #E17055, #ff0000);
                    border-radius: 3px;
                    transition: width 0.1s linear;
                "></div>
            </div>
            <div style="
                margin-top: 8px;
                font-size: 2.5rem;
            " id="resetProgressIcon">⏳</div>
        `;
        
        document.body.appendChild(overlay);
        this._overlayElement = overlay;
        this._progressElement = document.getElementById('resetProgressBar');
    },
    
    _startHold() {
        if (this._isResetting) return;
        
        this._holdStartTime = Date.now();
        
        if (this._overlayElement) {
            this._overlayElement.style.display = 'block';
        }
        
        const iconEl = document.getElementById('resetProgressIcon');
        const textEl = document.getElementById('resetProgressText');
        
        if (iconEl) iconEl.textContent = '⏳';
        if (textEl) textEl.textContent = 'Удерживайте для сброса...';
        if (this._progressElement) this._progressElement.style.width = '0%';
        
        this._updateProgress();
    },
    
    _updateProgress() {
        if (!this._holdStartTime) return;
        
        const elapsed = Date.now() - this._holdStartTime;
        const progress = Math.min(100, (elapsed / this._requiredHoldDuration) * 100);
        
        if (this._progressElement) {
            this._progressElement.style.width = progress + '%';
        }
        
        const iconEl = document.getElementById('resetProgressIcon');
        const textEl = document.getElementById('resetProgressText');
        
        if (progress < 25) {
            if (iconEl) iconEl.textContent = '⏳';
            if (textEl) textEl.textContent = 'Удерживайте для сброса...';
        } else if (progress < 50) {
            if (iconEl) iconEl.textContent = '⚠️';
            if (textEl) textEl.textContent = 'ВНИМАНИЕ! Данные будут удалены...';
        } 
        
        if (progress >= 100) {
            this._performReset();
        } else {
            this._holdTimer = requestAnimationFrame(() => this._updateProgress());
        }
    },
    
    _cancelHold() {
        if (this._holdTimer) {
            cancelAnimationFrame(this._holdTimer);
            this._holdTimer = null;
        }
        
        this._holdStartTime = null;
        
        if (this._overlayElement) {
            this._overlayElement.style.display = 'none';
        }
        
        if (this._progressElement) {
            this._progressElement.style.width = '0%';
        }
    },
    
    _performReset() {
        this._isResetting = true;
        this._cancelHold();
        
        console.log('🔄 [DevTools] ВЫПОЛНЯЕТСЯ ПОЛНЫЙ СБРОС!');
        
        // Показываем сообщение о сбросе
        if (this._overlayElement) {
            this._overlayElement.style.display = 'block';
            this._overlayElement.innerHTML = `
                <div style="font-size: 3rem; margin-bottom: 12px;">🔄</div>
                <div style="margin-bottom: 12px; color: #00B894; font-weight: 600;">Сброс выполнен!</div>
                <div style="font-size: 0.8rem; color: #b2bec3;">Сайт будет перезагружен через 2 секунды...</div>
            `;
        }
        
        // Полностью очищаем localStorage
        localStorage.clear();
        console.log('🗑️ localStorage очищен');
        
        // Сбрасываем состояние в памяти
        state.timeBlocks = [];
        state.habits = CONFIG.DEFAULTS.HABITS.map(h => ({
            ...h,
            progress: {},
            streak: 0
        }));
        state.tasks = CONFIG.DEFAULTS.TASKS.map(t => ({...t}));
        state.nextId = CONFIG.DEFAULTS.NEXT_ID;
        state.isDragging = false;
        state.draggedTaskId = null;
        state.editingTaskId = null;
        state.taskFilterDate = null;
        
        // Сохраняем дефолтные данные
        state.save();
        console.log('💾 Дефолтные данные сохранены');
        
        // Перезагружаем страницу
        setTimeout(() => {
            console.log('🔄 Перезагрузка страницы...');
            location.reload();
        }, 2000);
    }
};


DevTools.init();
// Привязка событий и запуск
document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    init();
});
