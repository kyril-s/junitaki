const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

// Serve static files from the current directory
app.use(express.static(__dirname));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Store room states
const rooms = new Map();

function getDefaultRoomState() {
    return {
        currentPhaseIndex: 0,
        timeLeft: 0,
        isPaused: true,
        phases: []
    };
}

function broadcastRoom(roomId) {
    const state = rooms.get(roomId);
    io.to(roomId).emit('timerState', state);
}

io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('joinRoom', (roomId) => {
        console.log(`Client joining room: ${roomId}`);
        socket.join(roomId);
        if (!rooms.has(roomId)) {
            rooms.set(roomId, getDefaultRoomState());
        }
        // Send current state to the new user
        socket.emit('timerState', rooms.get(roomId));
    });

    socket.on('addTask', ({ roomId, task }) => {
        const room = rooms.get(roomId);
        if (room) {
            room.phases.push(task);
            broadcastRoom(roomId);
        }
    });

    socket.on('removeTask', ({ roomId, index }) => {
        const room = rooms.get(roomId);
        if (room && room.phases[index]) {
            room.phases.splice(index, 1);
            if (room.currentPhaseIndex >= room.phases.length) {
                room.currentPhaseIndex = Math.max(0, room.phases.length - 1);
            }
            broadcastRoom(roomId);
        }
    });

    socket.on('updateTask', ({ roomId, index, task }) => {
        const room = rooms.get(roomId);
        if (room && room.phases[index]) {
            room.phases[index] = task;
            broadcastRoom(roomId);
        }
    });

    socket.on('setPhases', ({ roomId, phases }) => {
        const room = rooms.get(roomId);
        if (room) {
            room.phases = phases;
            room.currentPhaseIndex = 0;
            room.timeLeft = phases[0] ? phases[0].duration : 0;
            room.isPaused = true;
            broadcastRoom(roomId);
        }
    });

    socket.on('startTimer', ({ roomId, index }) => {
        const room = rooms.get(roomId);
        if (room && room.phases[index]) {
            room.currentPhaseIndex = index;
            room.timeLeft = room.phases[index].duration;
            room.isPaused = false;
            broadcastRoom(roomId);
        }
    });

    socket.on('pauseTimer', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (room) {
            room.isPaused = true;
            broadcastRoom(roomId);
        }
    });

    socket.on('resetTimer', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (room && room.phases.length > 0) {
            room.currentPhaseIndex = 0;
            room.timeLeft = room.phases[0].duration;
            room.isPaused = true;
            broadcastRoom(roomId);
        }
    });

    socket.on('skipTask', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (room && room.currentPhaseIndex < room.phases.length - 1) {
            room.currentPhaseIndex++;
            room.timeLeft = room.phases[room.currentPhaseIndex].duration;
            room.isPaused = true;
            broadcastRoom(roomId);
        }
    });

    socket.on('updateTimeLeft', ({ roomId, timeLeft }) => {
        const room = rooms.get(roomId);
        if (room) {
            room.timeLeft = timeLeft;
            broadcastRoom(roomId);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 