import dotenv from 'dotenv';
dotenv.config();

import { createServer } from 'http';
import { Server } from 'socket.io';

const http = createServer();

const io = new Server(http, {
    cors: { 
        origin: "http://127.0.0.1:5500",
        methods: ["GET", "POST"],
    }
});

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('message', (message) => {
        console.log('Received message:', message)
        io.emit('message', message)
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

http.listen(7070, () => console.log('Listening on http://localhost:7070'));




