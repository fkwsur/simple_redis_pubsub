const express = require('express');
const http = require('http');
const redis = require('redis');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = 3001;

const redisOptions = {
    retry_strategy: function(options) {
        if (options.error && options.error.code === 'ECONNREFUSED') {
            return new Error('The server refused the connection');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
            return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
            return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
    },
    url: 'redis://127.0.0.1:6379'
};

const subscriber = redis.createClient(redisOptions);
const publisher = redis.createClient(redisOptions);

subscriber.on('connect', () => {
    console.log('Subscriber connected to Redis');
});

publisher.on('connect', () => {
    console.log('Publisher connected to Redis');
});

subscriber.on('error', (err) => {
    console.error('Subscriber error:', err);
});

publisher.on('error', (err) => {
    console.error('Publisher error:', err);
});


app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
    socket.on('chat message', (msg) => {
        publisher.publish('chat', msg);
    });
});

subscriber.subscribe('chat', (message) => {
    io.emit('chat message', message);
});

server.listen(PORT, async () => {
    await Promise.all([
        subscriber.connect(),
        publisher.connect()
    ])
    console.log(`Server is running on port ${PORT}`);
});
