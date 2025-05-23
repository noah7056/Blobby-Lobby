const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

const players = {};
const chatHistory = [];
const sprays = [];

// Canvas dimensions and player size
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_RADIUS = 20;

// Define the petSpeed variable (this was missing)
const petSpeed = 1.5;

function generateRandomUsername() {
  const prefixes = ['Player', 'User', 'Gamer', 'Blob', 'Guest', 'Casual'];
  const randomNum = Math.floor(1000 + Math.random() * 9000); // 4 digit number
  return `${prefixes[Math.floor(Math.random() * prefixes.length)]}${randomNum}`;
}

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('newPlayer', (data) => {
    // Use provided username or generate a random one
    const username = data.username || generateRandomUsername();
    
    players[socket.id] = {
      x: Math.floor(Math.random() * (CANVAS_WIDTH - 2 * PLAYER_RADIUS)) + PLAYER_RADIUS,
      y: Math.floor(Math.random() * (CANVAS_HEIGHT - 2 * PLAYER_RADIUS)) + PLAYER_RADIUS,
      color: data.color,
      username: username,
      lastDirection: 'right', // Default direction
      pet: data.pet || null, // Pet info
      petPosition: {
        x: Math.floor(Math.random() * (CANVAS_WIDTH - 2 * PLAYER_RADIUS)) + PLAYER_RADIUS,
        y: Math.floor(Math.random() * (CANVAS_HEIGHT - 2 * PLAYER_RADIUS)) + PLAYER_RADIUS
      }
    };
    console.log(`New player joined: ${username} (${data.color})`);
    socket.emit('chatHistory', chatHistory);
    
    socket.emit('allSprays', sprays.filter(spray => {
      // Only send sprays that haven't expired
      return Date.now() - spray.timestamp < 10000;
    }));
  });

  socket.on('updatePlayer', (data) => {
    if (players[socket.id]) {
      let changes = [];
      
      if (data.color) {
        players[socket.id].color = data.color;
        changes.push(`color to ${data.color}`);
      }
      
      if (data.username) {
        players[socket.id].username = data.username;
        changes.push(`name to ${data.username}`);
      }
      
      if (data.pet !== undefined) {
        players[socket.id].pet = data.pet;
        changes.push(`pet to ${data.pet ? data.pet : 'none'}`);
      }
      
      console.log(`Player ${socket.id} updated: ${changes.join(', ')}`);
    }
  });

  socket.on('move', (dir) => {
    const speed = 3;
    if (players[socket.id]) {
      let newX = players[socket.id].x;
      let newY = players[socket.id].y;
      
      if (dir === 'left') {
        newX -= speed;
        players[socket.id].lastDirection = 'left';
      }
      if (dir === 'right') {
        newX += speed;
        players[socket.id].lastDirection = 'right';
      }
      if (dir === 'up') newY -= speed;
      if (dir === 'down') newY += speed;

      // Fixed boundary checking accounting for player radius
      newX = Math.max(PLAYER_RADIUS, Math.min(newX, CANVAS_WIDTH - PLAYER_RADIUS));
      newY = Math.max(PLAYER_RADIUS, Math.min(newY, CANVAS_HEIGHT - PLAYER_RADIUS));
      
      // Check for collisions with other players
      let canMove = true;
      const COLLISION_THRESHOLD = PLAYER_RADIUS * 1.2; // Allow some overlap
      
      for (let id in players) {
        if (id !== socket.id) {
          const otherPlayer = players[id];
          const distance = Math.hypot(newX - otherPlayer.x, newY - otherPlayer.y);
          
          if (distance < COLLISION_THRESHOLD) {
            // Allow some overlap but still push players apart
            const pushFactor = 0.3;
            const angle = Math.atan2(newY - otherPlayer.y, newX - otherPlayer.x);
            
            // Move both players slightly
            newX = players[socket.id].x + Math.cos(angle) * pushFactor;
            newY = players[socket.id].y + Math.sin(angle) * pushFactor;
            
            otherPlayer.x -= Math.cos(angle) * pushFactor;
            otherPlayer.y -= Math.sin(angle) * pushFactor;
            
            // Apply boundary check to other player too
            otherPlayer.x = Math.max(PLAYER_RADIUS, Math.min(otherPlayer.x, CANVAS_WIDTH - PLAYER_RADIUS));
            otherPlayer.y = Math.max(PLAYER_RADIUS, Math.min(otherPlayer.y, CANVAS_HEIGHT - PLAYER_RADIUS));
            
            break;
          }
        }
      }
      
      players[socket.id].x = newX;
      players[socket.id].y = newY;
      
      // Update pet position with lag
if (players[socket.id].pet) {
  const playerPos = { x: players[socket.id].x, y: players[socket.id].y };
  const petPos = players[socket.id].petPosition;
  
  // Calculate direction from pet to player
  const dx = playerPos.x - petPos.x;
  const dy = playerPos.y - petPos.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Only move pet if it's far enough from player
  if (distance > 50) {
    // Normalize direction and apply pet speed
    const normalizedDx = dx / distance;
    const normalizedDy = dy / distance;
    
    petPos.x += normalizedDx * petSpeed;
    petPos.y += normalizedDy * petSpeed;
  }
}
    }
  });

  socket.on('chatMessage', (msg) => {
    let username = players[socket.id]?.username;
    if (!username) username = 'Anonymous';
    const message = { username, text: msg };
    chatHistory.push(message);
    if (chatHistory.length > 50) chatHistory.shift();
    io.emit('chatMessage', message);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    delete players[socket.id];
  });

  setInterval(() => {
    io.emit('state', players);
  }, 1000 / 60);
  
  // Add this after the other setInterval for state updates
setInterval(() => {
  // Update all pets' positions
  for (let id in players) {
    const player = players[id];
    if (player.pet) {
      const playerPos = { x: player.x, y: player.y };
      const petPos = player.petPosition;
      
      // Calculate direction from pet to player
      const dx = playerPos.x - petPos.x;
      const dy = playerPos.y - petPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Always move pet towards player until it's within 40 units
      if (distance > 40) {
        // Normalize direction and apply pet speed
        const normalizedDx = dx / distance;
        const normalizedDy = dy / distance;
        
        petPos.x += normalizedDx * petSpeed;
        petPos.y += normalizedDy * petSpeed;
      }
    }
  }
}, 1000 / 30); // Update pet positions 30 times per second
  
  socket.on('addSpray', (data) => {
    if (players[socket.id]) {
      const spray = {
        x: players[socket.id].x,
        y: players[socket.id].y,
        emoji: data.emoji,
        playerId: socket.id,
        timestamp: Date.now()
      };
      
      sprays.push(spray);
      io.emit('newSpray', spray);
      
      // Remove spray after 10 seconds
      setTimeout(() => {
        const index = sprays.findIndex(s => 
          s.playerId === spray.playerId && 
          s.timestamp === spray.timestamp
        );
        
        if (index !== -1) {
          sprays.splice(index, 1);
        }
      }, 10000);
    }
  });
});

http.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
