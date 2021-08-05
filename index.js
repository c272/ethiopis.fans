const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

///////////////
/// GLOBALS ///
///////////////

//The directory that all views and scripts are stored in for the app.
const __views = __dirname + "/views/";

//A list of random words that are assigned as default usernames.
const defaultUsernames = [
    'Merasmus',
    'Count Dinkleberry',
    'Ethiopis',
    'Kelly Snames',
    'Raum',
    'Gunrat',
    'Tardis',
    'Yewtree',
    'Dreams',
    'Nino Lass',
    'Scom Tott',
    'Killer Kingsmill'
]

//A list of rooms active in the current instance.
var rooms = [];

////////////////////////
/// SOCKET RESPONSES ///
////////////////////////

io.on('connection', (socket) => {
    console.log('A new user [' + socket.id + '] has connected.');

    //Triggered when the user is disconnecting from the game.
    socket.on('disconnecting', () => {
        socket.rooms.forEach(x => leaveRoom(socket, x));
    });

    //Triggered when the user disconnects from the game.
    socket.on('disconnect', () => {
        console.log('User [' + socket.id + '] has disconnected.');
    });

    //Triggered when a user wants to create a new room.
    socket.on('createRoom', () => {
        //Make the user leave all the rooms they are currently in.
        socket.rooms.forEach(x => leaveRoom(socket, x));

        //Create a new room, join it for them.
        var roomName = createRoom(socket);
        joinRoom(socket, roomName);

        //Broadcast to them that they've joined a new room.
        socket.emit('roomJoined', rooms.find(x => x.name == roomName));
    });

    //Triggered when the user wants to join a given room.
    socket.on('joinRoom', (name) => {
        //Make the user leave all the rooms they're in.
        socket.rooms.forEach(x => leaveRoom(socket, x));

        //Attempt to join the new room.
        if (joinRoom(socket, name)) {
            socket.emit('roomJoined', rooms.find(x => x.name == name));
        }
        else {
            //Failed to join, broadcast an error.
            socket.emit('error', "Failed to join the room, does not exist.");
        }
    });

    //Triggered when the user requests a change in username.
    socket.on('changeName', (name) => {

        //Does the name contain invalid characters?
        var nameRegex = /^[ A-Za-z0-9\_!\"\+\&\(\)\.]{3,20}$/;
        if (!nameRegex.test(name)) {
            socket.emit('error', "Name contains invalid characters, or is too short/long.");
            return;
        }

        //Find the room that this player is in.
        var roomIndex = rooms.findIndex(x => x.players.findIndex(y => y.id == socket.id) != -1);
        if (roomIndex == -1) { return; }
        var room = rooms[roomIndex];

        //Has the game started?
        if (room.round != 0) {
            socket.emit('error', "The game has already started, you can't change your name.");
            return;
        }

        //Does it conflict with another player in the room?
        if (room.players.findIndex(x => x.name == name) != -1) {
            socket.emit('error', "Another player in the lobby already has that name!");
            return;
        }

        //Change the player's name.
        var player = room.players.find(x => x.id == socket.id);
        player.name = name;
        socket.emit("nameChangeSuccessful", name);
        io.to(room.name).emit("lobbyPlayerUpdate", room.players);
    });

    //Triggered when a user wants to start a game.
    socket.on('startGame', (roomName) => {
        //Is that room name valid?
        var roomIndex = rooms.findIndex(x => x.name == roomName);
        if (roomIndex == -1) { return; }
        var room = rooms[roomIndex];

        //Is the user the lead user of their room?
        if (room.owner != socket.id) { return; }

        //Does the room have 2 or more people?
        if (room.players.length < 2) {
            socket.emit('error', "The room must have 2 or more people to start a game.");
            return;
        }

        //Yes, is the game already started?
        if (room.round != 0) { return; }

        //Start round 1, emit the start game signal!
        console.log("Game starting in room '" + room.name + "', " + room.settings.rounds + " rounds with " + room.players.length + " players.");
        tickGame(room);
        io.to(room.name).emit("gameStarting");
    });
});


//////////////
/// ROUTES ///
//////////////

//Main route for if the user currently has no room.
app.get('/', (req, res) => {
    res.sendFile(__views + "index.html");
});

//Route for if the user is joining a room.
app.get('/room/:roomName', (req, res) => {
    res.sendFile(__views + "index.html");
});

//Route for returning any static files.
app.use(express.static('public'));

//Start the listen server.
server.listen(3000, () => {
  console.log('Server active! Listening on port 3000.');
});

////////////////////////
/// HELPER FUNCTIONS ///
////////////////////////

//Makes the user join the given room.
//Returns whether the operation was successful.
function joinRoom(socket, name) 
{
    //Is the room valid?
    var roomIndex = rooms.findIndex(x => x.name == name);
    if (roomIndex == -1) { return false; }

    //Add the person to the room.
    socket.join(name);
    rooms[roomIndex].playerCount++;
    rooms[roomIndex].players.push({        
        id: socket.id,
        name:  defaultUsernames[Math.floor(Math.random()*defaultUsernames.length)],
        points: 0
    });
    console.log("User [" + socket.id + "] has joined room '" + name + "'.");

    //Emit the player change to all users.
    io.to(name).emit("lobbyPlayerUpdate", rooms[roomIndex].players);
    return true;
}

//Makes the user leave the given room.
//Returns whether the operation was successful.
function leaveRoom(socket, name)
{
    //Ignore invalid rooms.
    var roomIndex = rooms.findIndex(x => x.name == name);
    if (roomIndex == -1) { return false; }
    socket.leave(name);
    console.log("User [" + socket.id + "] has left room '" + name + "'.");
    
    //Remove the player from the internal room representation.
    var room = rooms[roomIndex];
    room.playerCount--;
    var removeIndex = room.players.findIndex(x => x.id == socket.id);
    if (removeIndex != -1) {
        room.players.splice(removeIndex, 1);
    }

    //Is the room empty and to be removed?
    if (room.players.length <= 0)
    {
        //Remove it.
        rooms.splice(roomIndex, 1);
        console.log("Room '" + name + "' was destroyed (empty).");
        return true;
    }

    //Transfer ownership (if required), room still exists.
    if (socket.id == room.owner)
    {
        room.owner = room.players[0].id;
        console.log("Transferred ownership of room '" + room.name + "' to user [" + room.owner + "].");
        io.to(room.name).emit("ownerChanged", room.owner);
    }

    //Emit the player change to all users.
    io.to(name).emit("lobbyPlayerUpdate", rooms[roomIndex].players);
    return true;
}

//Creates a new room and registers it with the game.
//Returns the name of that new room.
function createRoom(socket)
{
    //Generate a unique, 6 character ID.
    var id = '';
    while (id.length < 6 || rooms.findIndex(x => x.name == id) != -1)
    {
        id = (Math.random() + 1).toString(36).substring(7);
    }

    //Register the room with the game.
    rooms.push({ 
        name: id,
        players: [],
        owner: socket.id,
        settings: {
            rounds: 3,
            drawingTime: 60,
            customWords: "",
            customWordsOnly: false
        },
        round: 0,
        playerIndex: Number.MAX_SAFE_INTEGER
    });
    console.log("Created new room with ID '" + id + "'.");
    return id;
}

//Starts a new round for the given room.
function tickGame(roomName)
{
    //Get the room.
    var roomIndex = rooms.findIndex(x => x.name == roomName);
    if (roomIndex == -1) { return; }
    var room = rooms[roomIndex];

    //Have we done all the players yet?
    if (room.playerIndex < room.players.length) {
        room.playerIndex++;
    }
    else {
        //End of the round, tick round and reset index.
        room.round++;
        room.playerIndex = 0;
    }

    //Have we finished the game altogether?
    if (room.round > room.settings.rounds)
    {
        //todo
        console.log("GAME HAS ENDED");
    }

    //todo: round logic
}

/////////////////////////
/// UTILITY FUNCTIONS ///
/////////////////////////

Array.prototype.remove = function() {
    var what, a = arguments, L = a.length, ax;
    while (L && this.length) {
        what = a[--L];
        while ((ax = this.indexOf(what)) !== -1) {
            this.splice(ax, 1);
        }
    }
    return this;
};