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

// Timer state
let timer = null;
let timeLeft = 0;
let currentPhaseIndex = 0;
let phases = [];
let isPaused = true;
let startTime = 0;
let isLocalUpdate = false;

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
});

socket.on('timerState', (state) => {
    console.log('Received timer state:', state);
    
    // Ignore updates if this is a local update
    if (isLocalUpdate) {
        isLocalUpdate = false;
        return;
    }

    if (state.phases.length > 0) {
        // Clear existing timer
        if (timer) {
            clearInterval(timer);
            timer = null;
        }

        // Update local state
        phases = state.phases;
        currentPhaseIndex = state.currentPhaseIndex;
        timeLeft = state.timeLeft;
        isPaused = state.isPaused;
        
        // Update UI
        updateDisplay();
        updateTaskGrid();
        
        // Start timer if not paused
        if (!isPaused && timeLeft > 0) {
            startTimer();
        }
    }
});

// Emit timer state updates
function emitTimerState() {
    isLocalUpdate = true;
    const state = {
        currentPhaseIndex,
        timeLeft,
        isPaused,
        phases
    };
    console.log('Emitting timer state:', state);
    socket.emit('updateTimer', {
        roomId,
        state
    });
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
                <input type="text" class="task-name" value="${task.name}" placeholder="Task name">
            </div>
            <div class="time-input">
            <input type="text" class="minutes" value="${Math.floor(task.duration / 60)}" maxlength="2" placeholder="00">
            <span>:</span>
            <input type="text" class="seconds" value="${task.duration % 60}" maxlength="2" placeholder="00">
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
            phases[index].name = e.target.value;
            if (index === currentPhaseIndex) {
                currentPhaseDisplay.textContent = e.target.value;
            }
        });

        minutesInput.addEventListener('change', (e) => {
            const minutes = parseInt(e.target.value) || 0;
            const seconds = parseInt(secondsInput.value) || 0;
            phases[index].duration = (minutes * 60) + seconds;
            if (index === currentPhaseIndex) {
                timeLeft = phases[index].duration;
                updateDisplay();
            }
        });

        secondsInput.addEventListener('change', (e) => {
            const minutes = parseInt(minutesInput.value) || 0;
            const seconds = parseInt(e.target.value) || 0;
            phases[index].duration = (minutes * 60) + seconds;
            if (index === currentPhaseIndex) {
                timeLeft = phases[index].duration;
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
    emitTimerState();
}

// Remove task
function removeTask(index) {
    if (index === currentPhaseIndex && timer) {
        pauseTimer();
    }
    phases.splice(index, 1);
    if (index < currentPhaseIndex) {
        currentPhaseIndex--;
    }
    updateTaskGrid();
    emitTimerState();
}

// Start task timer
function startTaskTimer(index) {
    if (timer) {
        pauseTimer();
    }
    currentPhaseIndex = index;
    timeLeft = phases[index].duration;
    updateDisplay();
    startTimer();
    updateTaskGrid();
}

// Skip task
function skipTask(index) {
    if (index === currentPhaseIndex) {
        moveToNextPhase();
    }
}

// Update timer display
function updateDisplay() {
    timeDisplay.textContent = formatTime(timeLeft);
    if (phases.length > 0) {
        currentPhaseDisplay.textContent = phases[currentPhaseIndex].name;
    }
    emitTimerState();
}

// Play alert sound
function playAlert() {
    alertSound.currentTime = 0;
    alertSound.play();
}

// Start timer
function startTimer() {
    if (timer) {
        clearInterval(timer);
    }
    
    isPaused = false;
    startTime = Date.now() - (phases[currentPhaseIndex].duration - timeLeft) * 1000;
    
    timer = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000);
        timeLeft = Math.max(0, phases[currentPhaseIndex].duration - elapsed);
        
        if (timeLeft <= 0) {
            clearInterval(timer);
            timer = null;
            playAlert();
            moveToNextPhase();
        }
        
        updateDisplay();
        emitTimerState();
    }, 100);
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
    emitTimerState();
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
    emitTimerState();
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
    emitTimerState();
}

// Move to next phase
function moveToNextPhase() {
    if (currentPhaseIndex < phases.length - 1) {
        currentPhaseIndex++;
        timeLeft = phases[currentPhaseIndex].duration;
        updateDisplay();
        updateTaskGrid();
        startTimer();
        emitTimerState();
    } else {
        stopTimer();
    }
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
}

// Event Listeners
meetingTypeSelect.addEventListener('change', handleMeetingTypeChange);
startBtn.addEventListener('click', startTimer);
pauseBtn.addEventListener('click', pauseTimer);
stopBtn.addEventListener('click', stopTimer);
resetBtn.addEventListener('click', resetTimer);
skipBtn.addEventListener('click', () => moveToNextPhase());
addTaskBtn.addEventListener('click', addTask);

// Initialize
handleMeetingTypeChange();

// Copy room link to clipboard
function copyRoomLink() {
    const roomLink = window.location.href;
    navigator.clipboard.writeText(roomLink).then(() => {
        const copyBtn = document.querySelector('.copy-btn');
        const originalIcon = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => {
            copyBtn.innerHTML = originalIcon;
        }, 2000);
    });
}

// Update room ID display
document.getElementById('roomId').textContent = roomId; 