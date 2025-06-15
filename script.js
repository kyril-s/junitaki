// Socket.io connection
const socket = io();
let roomId = window.location.hash.slice(1) || generateRoomId();
window.location.hash = roomId;

// Generate a random room ID
function generateRoomId() {
    return Math.random().toString(36).substring(2, 8);
}

// DOM Elements
const meetingTypeSelect = document.getElementById('meetingType');
const taskGrid = document.getElementById('taskGrid');
const addTaskBtn = document.getElementById('addTaskBtn');
const timerContainer = document.getElementById('timerContainer');
const timerDisplay = document.getElementById('timerDisplay');
const currentPhaseDisplay = document.getElementById('currentPhase');
const timeDisplay = document.getElementById('timeDisplay');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const resetBtn = document.getElementById('resetBtn');
const skipBtn = document.getElementById('skipBtn');
const alertSound = document.getElementById('alertSound');
const controlsContent = document.querySelector('.controls-content');
const collapseBtn = document.querySelector('.collapse-btn');

// Timer state (only updated from server)
let timer = null;
let timeLeft = 0;
let currentPhaseIndex = 0;
let phases = [];
let isPaused = true;
let startTime = 0;
let lastSentTimeLeft = null;
let lastReceivedState = {};

// Meeting type configurations
const meetingConfigs = {
    critique: [
        { name: 'Context & Goals', duration: 3 * 60 },
        { name: 'Presentation', duration: 5 * 60 },
        { name: 'Clarifying Questions', duration: 2 * 60 },
        { name: 'Constructive Feedback', duration: 8 * 60 },
        { name: "Presenter's Wrap-up", duration: 2 * 60 }
    ],
    design: [
        { name: 'Intro / Context', duration: 1 * 60 },
        { name: 'Showcase', duration: 4 * 60 },
        { name: 'Wrap-up', duration: 2 * 60 },
        { name: 'Q&A', duration: 2 * 60 },
    ],
    custom: [],
    testing: []
};

// Socket event handlers
socket.on('connect', () => {
    console.log('Connected to server');
    socket.emit('joinRoom', roomId);
    // Always display the room ID after joining
    document.getElementById('roomId').textContent = roomId;
});

socket.on('timerState', (state) => {
    // Only update if state is different from last received
    if (JSON.stringify(state) === JSON.stringify(lastReceivedState)) return;
    lastReceivedState = JSON.parse(JSON.stringify(state));

    phases = state.phases;
    currentPhaseIndex = state.currentPhaseIndex;
    timeLeft = state.timeLeft;
    isPaused = state.isPaused;

    if (timer) {
        clearInterval(timer);
        timer = null;
    }
    updateDisplay();
    updateTaskGrid();
    if (!isPaused && phases.length > 0) {
        startTimerInterval();
    }
});

// Action emitters
function emitAddTask(task) {
    socket.emit('addTask', { roomId, task });
}
function emitRemoveTask(index) {
    socket.emit('removeTask', { roomId, index });
}
function emitUpdateTask(index, task) {
    socket.emit('updateTask', { roomId, index, task });
}
function emitSetPhases(phases) {
    socket.emit('setPhases', { roomId, phases });
}
function emitStartTimer(index) {
    socket.emit('startTimer', { roomId, index });
}
function emitPauseTimer() {
    socket.emit('pauseTimer', { roomId });
}
function emitResetTimer() {
    socket.emit('resetTimer', { roomId });
}
function emitSkipTask() {
    socket.emit('skipTask', { roomId });
}
function emitUpdateTimeLeft(timeLeft) {
    socket.emit('updateTimeLeft', { roomId, timeLeft });
}

// Timer interval (only runs if not paused)
function startTimerInterval() {
    if (timer) clearInterval(timer);
    startTime = Date.now() - (phases[currentPhaseIndex].duration - timeLeft) * 1000;
    timer = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000);
        const newTimeLeft = Math.max(0, phases[currentPhaseIndex].duration - elapsed);
        if (newTimeLeft !== timeLeft && newTimeLeft !== lastSentTimeLeft) {
            lastSentTimeLeft = newTimeLeft;
            emitUpdateTimeLeft(newTimeLeft);
        }
        if (newTimeLeft <= 0) {
            clearInterval(timer);
            timer = null;
            playAlert();
            emitSkipTask();
        }
    }, 250);
}

// Toggle controls visibility
function toggleControls() {
    controlsContent.classList.toggle('collapsed');
    collapseBtn.classList.toggle('collapsed');
}

// Format time as MM:SS
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Create task card HTML
function createTaskCard(task, index) {
    const isActive = index === currentPhaseIndex && timer !== null;
    return `
    <div class="task-card ${isActive ? 'active' : ''}" data-index="${index}">
        <div class="task-card-content">
            <div class="task-header">
                <input type="text" class="task-name" id="task-name-${index}" name="task-name-${index}" value="${task.name}" placeholder="Task name">
            </div>
            <div class="time-input">
            <input type="text" class="minutes" id="minutes-${index}" name="minutes-${index}" value="${Math.floor(task.duration / 60)}" maxlength="2" placeholder="00">
            <span>:</span>
            <input type="text" class="seconds" id="seconds-${index}" name="seconds-${index}" value="${task.duration % 60}" maxlength="2" placeholder="00">
            </div>
        </div>
            <div class="task-controls">
                ${isActive ? 
                        `<button class="task-control-btn pause-btn" onclick="pauseTaskTimer(${index})" title="Pause Task">⏸</button>` :
                        `<button class="task-control-btn play-btn" onclick="startTaskTimer(${index})" title="Start Task">▶</button>`
                    }
                    <button class="task-control-btn skip-btn" onclick="skipTask(${index})" title="Skip Task">⏭</button>
                    <button class="task-control-btn delete-btn" onclick="removeTask(${index})" title="Delete Task">×</button>
            </div>
        </div>
    </div>
    `;
}

// Update task grid display
function updateTaskGrid() {
    taskGrid.innerHTML = phases.map((task, index) => createTaskCard(task, index)).join('');
    attachTaskInputListeners();
    updateTimerVisibility();
}

// Update timer visibility
function updateTimerVisibility() {
    if (phases.length > 0) {
        timerContainer.classList.remove('hidden');
        currentPhaseDisplay.textContent = phases[currentPhaseIndex].name;
        timeLeft = phases[currentPhaseIndex].duration;
        updateDisplay();
        scrollToTimer();
    } else {
        timerContainer.classList.add('hidden');
        pauseTimer();
    }
}

// Scroll to timer
function scrollToTimer() {
    timerContainer.scrollIntoView({ behavior: 'smooth' });
}

// Scroll to controls
function scrollToControls() {
    document.querySelector('.controls-container').scrollIntoView({ behavior: 'smooth' });
}

// Attach event listeners to task inputs
function attachTaskInputListeners() {
    document.querySelectorAll('.task-card').forEach(card => {
        const index = parseInt(card.dataset.index);
        const nameInput = card.querySelector('.task-name');
        const minutesInput = card.querySelector('.minutes');
        const secondsInput = card.querySelector('.seconds');

        nameInput.addEventListener('change', (e) => {
            const task = { ...phases[index], name: e.target.value };
            emitUpdateTask(index, task);
            if (index === currentPhaseIndex) {
                currentPhaseDisplay.textContent = e.target.value;
            }
        });

        minutesInput.addEventListener('change', (e) => {
            const minutes = parseInt(e.target.value) || 0;
            const seconds = parseInt(secondsInput.value) || 0;
            const task = { ...phases[index], duration: (minutes * 60) + seconds };
            emitUpdateTask(index, task);
            if (index === currentPhaseIndex) {
                timeLeft = task.duration;
                updateDisplay();
            }
        });

        secondsInput.addEventListener('change', (e) => {
            const minutes = parseInt(minutesInput.value) || 0;
            const seconds = parseInt(e.target.value) || 0;
            const task = { ...phases[index], duration: (minutes * 60) + seconds };
            emitUpdateTask(index, task);
            if (index === currentPhaseIndex) {
                timeLeft = task.duration;
                updateDisplay();
            }
        });
    });
}

// Add new task
function addTask() {
    const task = {
        name: 'New Task',
        duration: 0
    };
    phases.push(task);
    updateTaskGrid();
    emitAddTask(task);
}

// Remove task
function removeTask(index) {
    if (index === currentPhaseIndex && timer) {
        pauseTimer();
    }
    emitRemoveTask(index);
    if (index < currentPhaseIndex) {
        currentPhaseIndex--;
    }
    updateTaskGrid();
}

// Start task timer
function startTaskTimer(index) {
    if (timer) {
        pauseTimer();
    }
    currentPhaseIndex = index;
    timeLeft = phases[index].duration;
    updateDisplay();
    emitStartTimer(index);
    updateTaskGrid();
}

// Skip task
function skipTask(index) {
    if (index === currentPhaseIndex) {
        emitSkipTask();
    }
}

// Update timer display
function updateDisplay() {
    if (phases.length > 0 && typeof currentPhaseIndex === 'number') {
        if (currentPhaseDisplay) currentPhaseDisplay.textContent = phases[currentPhaseIndex].name;
        if (timeDisplay) timeDisplay.textContent = formatTime(timeLeft);
    }
}

// Play alert sound
function playAlert() {
    alertSound.currentTime = 0;
    alertSound.play();
}

// Pause task timer
function pauseTaskTimer(index) {
    if (index === currentPhaseIndex) {
        pauseTimer();
        updateTaskGrid();
    }
}

// Pause timer
function pauseTimer() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
    isPaused = true;
    emitPauseTimer();
}

// Stop timer
function stopTimer() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
    isPaused = true;
    timeLeft = phases[currentPhaseIndex].duration;
    updateDisplay();
    emitResetTimer();
}

// Reset timer
function resetTimer() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
    currentPhaseIndex = 0;
    timeLeft = phases[0].duration;
    isPaused = true;
    updateDisplay();
    updateTaskGrid();
    emitResetTimer();
}

// Handle meeting type change
function handleMeetingTypeChange() {
    const selectedType = meetingTypeSelect.value;
    if (selectedType === 'critique') {
        phases = [...meetingConfigs.critique];
    } else {
        phases = [];
    }
    if (selectedType === 'design') {    
        phases = [...meetingConfigs.design];
    }
    updateTaskGrid();
    emitSetPhases(phases);
}

// Event Listeners
meetingTypeSelect.addEventListener('change', handleMeetingTypeChange);
startBtn.addEventListener('click', () => emitStartTimer(currentPhaseIndex));
pauseBtn.addEventListener('click', pauseTimer);
stopBtn.addEventListener('click', stopTimer);
resetBtn.addEventListener('click', resetTimer);
skipBtn.addEventListener('click', () => skipTask());
addTaskBtn.addEventListener('click', addTask);

// Initialize
handleMeetingTypeChange();

// Copy room link to clipboard
function copyRoomLink() {
    const roomLink = window.location.href;
    navigator.clipboard.writeText(roomLink).then(() => {
        const copyBtn = document.querySelector('.copy-btn');
        if (!copyBtn) return;
        const originalIcon = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => {
            copyBtn.innerHTML = originalIcon;
        }, 2000);
    });
}

// Update room ID display
document.getElementById('roomId').textContent = roomId; 