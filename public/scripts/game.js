//Main game script with socket handlers for all events.
//ethiopis.fans (c) C272, 2021

const socket = io();
const DEBUG_ENABLED = true;

////////////////////////
/// GLOBAL VARIABLES ///
////////////////////////

//The current room we're in.
var roomID = null;

//The players in the current room.
var players = null;

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

// SECTION 1
// LOBBY SOCKET RESPONSES

//Triggered when a new room has been joined.
socket.on("roomJoined", (room) => {

    //Change the URL (and internal room) to reflect where we've joined.
    debug("Joined new room '" + room.name + "'.");
    window.history.replaceState({}, "ethiopis.fans - The Online Drawing Game", "/room/" + room.name);
    roomID = room.name;
    players = room.players;

    //Show the lobby screen.
    showLayer("lobbyScreen");

    //If we're the room leader, enable the form.
    if (room.owner == socket.id) {
        var lobbySettings = document.getElementById("lobbySettings");
        lobbySettings.removeAttribute("disabled");
    }

    //Set up the form values, player list.
    updateLobbySettings(room.settings);
    updateLobbyPlayers(room.players);
});

//Triggered when the owner of the current room has changed.
socket.on("ownerChanged", (ownerId) => {

    //Are we the new owner? If so, enable the form.
    if (ownerId == socket.id)
    {
        debug("Inherited lobby owner status.");
        var lobbySettings = document.getElementById("lobbySettings");
        lobbySettings.removeAttribute("disabled");
    }
});

//Triggered when settings/players change in the lobby.
socket.on("lobbySettingsUpdate", (settings) => {
    updateLobbySettings(settings);
});
socket.on("lobbyPlayerUpdate", (players) => {
    debug("Updating lobby players...");
    updateLobbyPlayers(players);
});

//Triggered when the user has successfully changed their name.
socket.on("nameChangeSuccessful", (name) => {
    //Set a browser-session cookie to save this name.
    document.cookie = name;
});

//Triggered when transitioning from the lobby state to the game state.
socket.on("gameStarting", () => {

    //Switch layers to the main game.
    debug("Starting main game! Transitioning to main layer.");
    showLayer("mainScreen");
});

// SECTION 2
// MAIN GAME SOCKET RESPONSES

//todo

// DEBUG SECTION
// ERROR RESPONSES & ANALYSIS

//Triggered when the server has hit an error.
socket.on("error", (msg) => {
    var errorDiv = document.getElementById("errorContents");
    errorDiv.innerHTML = "<p>" + msg + "</p>";
    var openError = document.getElementById("openErrorButton");
    openError.click();
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

//Updates the displayed lobby settings values with data from the given room object.
function updateLobbySettings(settings)
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

//Updates the state of all players in the lobby phase.
function updateLobbyPlayers(players)
{
    //Get and set username box.
    var usernameInput = document.getElementById("usernameInput");
    usernameInput.setAttribute("value", players.find(x => x.id == socket.id).name);

    //Clear all players from the player div.
    var playerDiv = document.getElementById("playerDiv");
    playerDiv.innerHTML = '';

    //Add players.
    for (var i=0; i<players.length; i++) {
        var player = players[i];
        var playerHTML = "<div class='playerPortrait'>";
        playerHTML += "<img src='/images/player.png' style='width: 100px;'>";
        playerHTML += "<p>" + player.name + "</p></div>";

        //Push HTML.
        playerDiv.innerHTML += playerHTML;
    }
}

//Triggered when the lead user wants to start the game.
function startGame()
{
    socket.emit("startGame", roomID);
}

//Triggered when the user wants to change their in-game name.
function changeName()
{
    //Get the username from the input box, request it.
    var username = document.getElementById("usernameInput").value.toString();
    socket.emit("changeName", username);
}