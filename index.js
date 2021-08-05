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
    rooms[roomIndex].players.push(socket.id);
    console.log("User [" + socket.id + "] has joined room '" + name + "'.");
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
    
    //Is the room empty and to be removed?
    var room = rooms[roomIndex];
    room.playerCount--;
    room.players.remove(socket.id);
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
        room.owner = room.players[0];
        console.log("Transferred ownership of room '" + room.name + "' to user [" + room.owner + "].");
        io.to(room.name).emit("ownerChanged", room.owner);
    }
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
        }
    });
    console.log("Created new room with ID '" + id + "'.");
    return id;
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