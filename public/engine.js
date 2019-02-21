var config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: {
                y: 0
            },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

var game = new Phaser.Game(config);

function preload() {

    this.load.image('sky', 'assets/sky.png');
    this.load.image('ground', 'assets/platform.png');
    this.load.image('star', 'assets/star.png');
    this.load.image('bomb', 'assets/bomb.png');
    this.load.spritesheet('dude',
        'assets/dude.png', {
            frameWidth: 32,
            frameHeight: 48
        }
    );
}

var platforms;
var player;
var stars;
var score = 0;
var scoreText;
var leaderScore;

function create() {

    var self = this;

    // Other players
    this.otherPlayers = this.physics.add.group();
    self.physics.add.collider(this.otherPlayers, platforms);

    /* Scene */
    // Sky
    this.add.image(400, 300, 'sky');
    // Ground
    platforms = this.physics.add.staticGroup();
    platforms.create(400, 568, 'ground').setScale(2).refreshBody();
    platforms.create(600, 400, 'ground');
    platforms.create(50, 250, 'ground');
    platforms.create(750, 220, 'ground');


    // Animations for moving
    this.anims.create({
        key: 'left',
        frames: this.anims.generateFrameNumbers('dude', {
            start: 0,
            end: 3
        }),
        frameRate: 10,
        repeat: -1
    });

    this.anims.create({
        key: 'turn',
        frames: [{
            key: 'dude',
            frame: 4
        }],
        frameRate: 20
    });

    this.anims.create({
        key: 'right',
        frames: this.anims.generateFrameNumbers('dude', {
            start: 5,
            end: 8
        }),
        frameRate: 10,
        repeat: -1
    });

    // Keys
    cursors = this.input.keyboard.createCursorKeys();

    // Socket stuff
    this.socket = io();

    // Draw all players upon first joining
    this.socket.on('currentPlayers', function (players) {
        Object.keys(players).forEach(function (id) {
            if (players[id].playerId === self.socket.id) {
                addPlayer(self, players[id]);
            } else {
                addOtherPlayers(self, players[id]);
            }
        });
    });

    // Draw new players that join
    this.socket.on('newPlayer', function (playerInfo) {
        addOtherPlayers(self, playerInfo);
    });

    // Remove any players who disconnect
    this.socket.on('disconnect', function (playerId) {
        self.otherPlayers.getChildren().forEach(function (otherPlayer) {
            if (playerId === otherPlayer.playerId) {
                otherPlayer.destroy();
            }
        });
    });

    // Draw player movements
    this.socket.on('playerMoved', function (playerInfo) {
        self.otherPlayers.getChildren().forEach(function (otherPlayer) {
            if (playerInfo.playerId === otherPlayer.playerId) {
                otherPlayer.anims.play(playerInfo.keydown, true);
                otherPlayer.setPosition(playerInfo.x, playerInfo.y);
            }
        });
    });

    // Create physics group to hold the stars
    stars = this.physics.add.group();


    // Draw the stars on initial connect
    this.socket.on('starLocation', function (starLocations) {

        for (var i = 0; i < starLocations.length; i++) {

            var star = self.physics.add.sprite(starLocations[i].x, starLocations[i].y, 'star');

            star.setGravityY(0);
            star.refID = i;

            if (starLocations[i].display != true) {
                // If star should be hidden, then hide it
                star.disableBody(true, true);
            }
            stars.add(star);

        }

        self.physics.add.collider(stars, platforms);

        self.physics.add.overlap(player, stars, function (player, star) {
            console.log(star.refID);
            score += 10;
            star.disableBody(true, true);
            this.socket.emit('starCollected', star.refID, score);


            scoreText.setText('Points: ' + score);
        }, null, self);


    });

    // Remove stars collecetd by other users
    this.socket.on('removeStar', function (id) {
        stars.children.iterate(function (child) {

            if (child.refID == id)
                child.disableBody(true, true);

        });
    });

    // Replenish stars when the server tells us
    this.socket.on('replenishStars', function () {
        stars.children.iterate(function (child) {

            child.enableBody(true, child.x, child.y, true, true);

        });
    });

    // Update the leader score
    this.socket.on('leaderScore', function (highscore) {
        leaderScore.setText('Leader: ' + highscore);
    });

    //  Initialize Score boards
    scoreText = this.add.text(16, 545, 'Points: 0', {
        fontSize: '20px',
        fill: '#000',
        fill: "#ffffff",
    });

    leaderScore = this.add.text(16, 570, 'Leader: 0', {
        fontSize: '20px',
        fill: '#000',
        fill: "#ffffff",
    });

}

function update() {

    // Debug: write mouse co-ords to screen
    //console.log(this.input.mousePointer.x+","+this.input.mousePointer.y);

    if (player) {
        var direction;
        if (cursors.left.isDown) {
            player.setVelocityX(-160);

            player.anims.play('left', true);

            direction = "left";
        } else if (cursors.right.isDown) {
            player.setVelocityX(160);

            player.anims.play('right', true);

            direction = "right";
        } else {
            player.setVelocityX(0);

            player.anims.play('turn');

            direction = "turn";
        }

        if (cursors.up.isDown && player.body.touching.down) {
            player.setVelocityY(-530);
        }

        // Tell the server about your movement
        var x = player.x;
        var y = player.y;
        if (player.oldPosition && (x !== player.oldPosition.x || y !== player.oldPosition.y)) {
            this.socket.emit('playerMovement', {
                x: player.x,
                y: player.y,
                keydown: direction
            });
        }

        // Save old position
        player.oldPosition = {
            x: player.x,
            y: player.y,
            keydown: direction
        };

    }

}

// Add the player object
function addPlayer(self, playerInfo) {
    player = self.physics.add.sprite(playerInfo.x, playerInfo.y, 'dude');

    player.setBounce(0.2);
    player.setCollideWorldBounds(true);
    player.body.setGravityY(600);

    self.physics.add.collider(player, platforms);
}

// Add any additional players
function addOtherPlayers(self, playerInfo) {
    var otherPlayer = self.add.sprite(playerInfo.x, playerInfo.y, 'dude');

    // Set a tint so we can distinguish ourselves
    otherPlayer.setTint(0x7CC78F);

    otherPlayer.playerId = playerInfo.playerId;
    self.otherPlayers.add(otherPlayer);
}