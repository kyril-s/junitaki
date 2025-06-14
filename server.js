const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, './')));

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Store room states
const rooms = new Map();

io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
        if (!rooms.has(roomId)) {
            rooms.set(roomId, {
                currentPhaseIndex: 0,
                timeLeft: 0,
                isPaused: false,
                phases: []
            });
        }
        // Send current state to the new user
        socket.emit('timerState', rooms.get(roomId));
    });

    socket.on('updateTimer', (data) => {
        const { roomId, state } = data;
        if (rooms.has(roomId)) {
            rooms.set(roomId, state);
            socket.to(roomId).emit('timerState', state);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 