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

io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('joinRoom', (roomId) => {
        console.log(`Client joining room: ${roomId}`);
        socket.join(roomId);
        if (!rooms.has(roomId)) {
            rooms.set(roomId, {
                currentPhaseIndex: 0,
                timeLeft: 0,
                isPaused: true,
                phases: []
            });
        }
        // Send current state to the new user
        socket.emit('timerState', rooms.get(roomId));
    });

    socket.on('updateTimer', (data) => {
        const { roomId, state } = data;
        console.log(`Updating room ${roomId}:`, state);
        
        if (rooms.has(roomId)) {
            // Update the room state
            rooms.set(roomId, state);
            // Broadcast to all clients in the room except the sender
            socket.to(roomId).emit('timerState', state);
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