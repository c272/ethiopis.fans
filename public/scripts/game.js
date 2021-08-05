//Main game script with socket handlers for all events.
//ethiopis.fans (c) C272, 2021

const socket = io();
const DEBUG_ENABLED = true;

////////////////////////
/// GLOBAL VARIABLES ///
////////////////////////

//The current room we're in.
var roomID = null;

////////////////////////
/// HELPER FUNCTIONS ///
////////////////////////

//Debug print helper function.
function debug(msg) {
    if (DEBUG_ENABLED) {
        console.log(msg);
    }
}

//////////////////////
/// INITIALIZATION ///
//////////////////////

//Have we just joined a room, or are we starting a new one?
let roomRegex = /^\/room\/[A-Za-z0-9_]+$/;
if (roomRegex.test(window.location.pathname)) {
    //We are joining a room, request as such from the server.
    var roomName = window.location.pathname.replace('/room/', '');
    debug("Joining room '" + roomName + "'...");
    socket.emit('joinRoom', roomName);
}
else {
    //We're starting a new one.
    debug("Creating new room...");
    socket.emit('createRoom');
}

////////////////////////
/// SOCKET RESPONSES ///
////////////////////////

//Triggered when a new room has been joined.
socket.on("roomJoined", (room) => {

    //Change the URL (and internal room) to reflect where we've joined.
    debug("Joined new room '" + room.name + "'.");
    window.history.replaceState({}, "ethiopis.fans - The Online Drawing Game", "/room/" + room.name);
    roomID = room.name;

    //Show the lobby screen.
    showLayer("lobbyScreen");

    //If we're the room leader, enable the form.
    if (room.owner == socket.id) {
        var lobbySettings = document.getElementById("lobbySettings");
        lobbySettings.removeAttribute("disabled");
    }

    //Set up the form values.
    updateLobbyForm(room.settings);
});

//Triggered when the owner of the current room has changed.
socket.on("ownerChanged", (ownerId) => {

    //Are we the new owner? If so, enable the form.
    if (ownerId == socket.id)
    {
        var lobbySettings = document.getElementById("lobbySettings");
        lobbySettings.removeAttribute("disabled");
    }

});

//Triggered when the server has hit an error.
socket.on("error", (msg) => {
    debug("ERROR: " + msg);
});

////////////////////////
/// HELPER FUNCTIONS ///
////////////////////////

//Hides all other layers and shows the one with the provided ID.
function showLayer(name)
{
    //Get all layers.
    var layers = document.getElementsByClassName("gameLayer");
    for (var i=0; i<layers.length; i++)
    {
        //If the item is the correct layer, on top it.
        //If not, remove the class from it entirely.
        var layer = layers.item(i);
        if (layer.id == name)
        {
            layer.classList.add("onTopLayer");
        }
        else { layer.classList.remove("onTopLayer"); }
    }
}

function updateLobbyForm(settings)
{
    //Get inputs.
    var roundsInput = document.getElementById("amtRounds");
    var drawingTime = document.getElementById("drawingTime");
    var customWords = document.getElementById("customWords");
    var customWordsOnly = document.getElementById("customWordsOnly");

    //Set their values.
    roundsInput.setAttribute("value", settings.rounds);
    drawingTime.setAttribute("value", settings.drawingTime);
    customWords.setAttribute("value", settings.customWords);
    customWordsOnly.setAttribute("value", settings.customWordsOnly);
}

//Triggered when the lead user wants to start the game.
function startGame()
{

}