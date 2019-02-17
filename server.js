// Server stuff goes here
var express = require('express');
var app = express();
var server = require('http').Server(app);

app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

var port = process.env.PORT || 1337;

// Store all players
var players = {};

var stars = []

class Star {
    constructor(id, x, y, display) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.display = display;
    }
}


stars.push(new Star(1, 24, 176, true));
stars.push(new Star(2, 85, 127, true));
stars.push(new Star(3, 185, 73, true));
stars.push(new Star(4, 301, 103, true));
stars.push(new Star(5, 375, 41, true));
stars.push(new Star(6, 419, 208, true));
stars.push(new Star(7, 603, 63, true));
stars.push(new Star(8, 721, 142, true));
stars.push(new Star(9, 37, 349, true));
stars.push(new Star(10, 148, 452, true));
stars.push(new Star(11, 277, 377, true));
stars.push(new Star(12, 359, 484, true));
stars.push(new Star(13, 484, 447, true));
stars.push(new Star(14, 601, 496, true));
stars.push(new Star(15, 738, 465, true));

var starCount = stars.length;

// Socket.io
var io = require('socket.io')(server, {
    wsEngine: 'ws'
});

// Sockets logic goes here
io.on('connection', function (socket) {
    console.log('a user connected');

    // create a new player and add it to our players object
    players[socket.id] = {
        x: Math.floor(Math.random() * 700) + 50,
        y: Math.floor(Math.random() * 500) + 50,
        playerId: socket.id,
    };

    // update all other players of the new player
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // send the players object to the new player
    socket.emit('currentPlayers', players);

    // send the star object to the new player
    socket.emit('starLocation', stars);

    socket.on('disconnect', function () {
        console.log('user disconnected');
        // remove this player from our players object
        delete players[socket.id];
        // emit a message to all players to remove this player
        io.emit('disconnect', socket.id);

    });

    // when a player moves, update the player data
    socket.on('playerMovement', function (movementData) {
        players[socket.id].x = movementData.x;
        players[socket.id].y = movementData.y;
        players[socket.id].keydown = movementData.keydown;
        // emit a message to all players about the player that moved
        socket.broadcast.emit('playerMoved', players[socket.id]);
    });

    // When a star is collected
    socket.on('starCollected', function (id) {

        if (stars[id].display == true) {
            stars[id].display = false;
            io.emit('removeStar', id);
            starCount--;
        }

        if(starCount == 0)
        {
            stars.forEach(element => {
                element.display=true;
            });
            starCount = stars.length;
            io.emit('replenishStars');
            
        }
    });
});



server.listen(port, function () {
    console.log(`Listening on ${server.address().port}`);
});