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

const animalNames = [
    "Zorro", "Lobo", "Gato", "Perro", "Oso", "Águila", "Tigre", "León", "Conejo", "Ratón", "Caballo", "Vaca", "Cerdo", "Mono", "Pato", "Pez", "Tortuga", "Serpiente", "Cangrejo", "Pulpo"
];

function getRandomAnimalName(usedNames = []) {
    const available = animalNames.filter(name => !usedNames.includes(name));
    if (available.length === 0) return `Animal${Math.floor(Math.random()*1000)}`;
    return available[Math.floor(Math.random() * available.length)];
}

// Store room states
const rooms = new Map();
const roomClients = new Map(); // roomId -> [{id, name}]
const roomMasters = new Map(); // roomId -> socketId
const roomTimers = new Map();

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
    const clients = roomClients.get(roomId) || [];
    const master = roomMasters.get(roomId) || null;
    io.to(roomId).emit('timerState', state);
    io.to(roomId).emit('roomClients', { clients, master });
}

function startRoomTimer(roomId) {
    if (roomTimers.has(roomId)) clearInterval(roomTimers.get(roomId));
    const interval = setInterval(() => {
        const room = rooms.get(roomId);
        if (!room || room.isPaused || room.phases.length === 0) {
            clearInterval(interval);
            roomTimers.delete(roomId);
            return;
        }
        room.timeLeft = Math.max(0, room.timeLeft - 1);
        if (room.timeLeft === 0) {
            // Move to next phase or pause
            if (room.currentPhaseIndex < room.phases.length - 1) {
                room.currentPhaseIndex++;
                room.timeLeft = room.phases[room.currentPhaseIndex].duration;
            } else {
                room.isPaused = true;
            }
        }
        broadcastRoom(roomId);
        if (room.isPaused) {
            clearInterval(interval);
            roomTimers.delete(roomId);
        }
    }, 1000); // 1 second interval
    roomTimers.set(roomId, interval);
}

io.on('connection', (socket) => {
    let myRoom = null;
    let myName = null;

    socket.on('joinRoom', (roomId) => {
        myRoom = roomId;
        socket.join(roomId);
        if (!rooms.has(roomId)) {
            rooms.set(roomId, getDefaultRoomState());
        }
        // Assign random animal name
        const clients = roomClients.get(roomId) || [];
        myName = getRandomAnimalName(clients.map(c => c.name));
        clients.push({ id: socket.id, name: myName });
        roomClients.set(roomId, clients);
        // Assign master if none
        if (!roomMasters.has(roomId)) {
            roomMasters.set(roomId, socket.id);
        }
        socket.emit('yourName', myName);
        socket.emit('timerState', rooms.get(roomId));
        broadcastRoom(roomId);
    });

    // Only master can control the timer
    function isMaster(roomId, socketId) {
        return roomMasters.get(roomId) === socketId;
    }

    socket.on('addTask', ({ roomId, task }) => {
        if (!isMaster(roomId, socket.id)) return;
        const room = rooms.get(roomId);
        if (room) {
            room.phases.push(task);
            broadcastRoom(roomId);
        }
    });

    socket.on('removeTask', ({ roomId, index }) => {
        if (!isMaster(roomId, socket.id)) return;
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
        if (!isMaster(roomId, socket.id)) return;
        const room = rooms.get(roomId);
        if (room && room.phases[index]) {
            room.phases[index] = task;
            broadcastRoom(roomId);
        }
    });

    socket.on('setPhases', ({ roomId, phases }) => {
        if (!isMaster(roomId, socket.id)) return;
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
        if (!isMaster(roomId, socket.id)) return;
        const room = rooms.get(roomId);
        if (room && room.phases[index]) {
            room.currentPhaseIndex = index;
            room.timeLeft = room.phases[index].duration;
            room.isPaused = false;
            broadcastRoom(roomId);
            startRoomTimer(roomId); // Start the server timer!
        }
    });

    socket.on('pauseTimer', ({ roomId }) => {
        if (!isMaster(roomId, socket.id)) return;
        const room = rooms.get(roomId);
        if (room) {
            room.isPaused = true;
            broadcastRoom(roomId);
            if (roomTimers.has(roomId)) {
                clearInterval(roomTimers.get(roomId));
                roomTimers.delete(roomId);
            }
        }
    });

    socket.on('resetTimer', ({ roomId }) => {
        if (!isMaster(roomId, socket.id)) return;
        const room = rooms.get(roomId);
        if (room && room.phases.length > 0) {
            room.currentPhaseIndex = 0;
            room.timeLeft = room.phases[0].duration;
            room.isPaused = true;
            broadcastRoom(roomId);
        }
    });

    socket.on('skipTask', ({ roomId }) => {
        if (!isMaster(roomId, socket.id)) return;
        const room = rooms.get(roomId);
        if (room && room.currentPhaseIndex < room.phases.length - 1) {
            room.currentPhaseIndex++;
            room.timeLeft = room.phases[room.currentPhaseIndex].duration;
            room.isPaused = true;
            broadcastRoom(roomId);
        }
    });

    socket.on('updateTimeLeft', ({ roomId, timeLeft }) => {
        if (!isMaster(roomId, socket.id)) return;
        const room = rooms.get(roomId);
        if (room) {
            room.timeLeft = timeLeft;
            broadcastRoom(roomId);
        }
    });

    // Pass master
    socket.on('passMaster', ({ roomId, toId }) => {
        if (!isMaster(roomId, socket.id)) return;
        if (roomClients.has(roomId) && roomClients.get(roomId).some(c => c.id === toId)) {
            roomMasters.set(roomId, toId);
            broadcastRoom(roomId);
        }
    });

    socket.on('disconnect', () => {
        if (myRoom && roomClients.has(myRoom)) {
            let clients = roomClients.get(myRoom);
            clients = clients.filter(c => c.id !== socket.id);
            roomClients.set(myRoom, clients);
            // If master left, assign to next client
            if (roomMasters.get(myRoom) === socket.id) {
                if (clients.length > 0) {
                    roomMasters.set(myRoom, clients[0].id);
                } else {
                    roomMasters.delete(myRoom);
                }
            }
            broadcastRoom(myRoom);
        }
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