const socket = io();
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const previewCanvas = document.getElementById('blobPreview');
const previewCtx = previewCanvas.getContext('2d');
let keys = {};
let playerColor = getRandomColor();
let username = generateRandomUsername();
let lastPositions = {}; // Store previous positions for particles
let particles = []; // Array to store all particles
let currentlyPlaying = false; // Flag to check if game is active
let playerAnimations = {}; // Store animation state for each player
let sprays = []; // Array to store all active sprays
let selectedEmoji = null;
let selectedPet = null;

// Preload pet images
const petImages = {
  amongus: new Image(),
  cutecreeper: new Image(),
  ducky: new Image(),
  pusheen: new Image(),
  wheatleyportal2: new Image()
};

// Set image sources
petImages.amongus.src = 'assets/amongus.png';
petImages.cutecreeper.src = 'assets/cutecreeper.png';
petImages.ducky.src = 'assets/ducky.png';
petImages.pusheen.src = 'assets/pusheen.png';
petImages.wheatleyportal2.src = 'assets/wheatleyportal2.png';

// Get DOM elements for customization
const customizeBtn = document.getElementById('customizeBtn');
const customizeMenu = document.getElementById('customizeMenu');
const nameInput = document.getElementById('nameInput');
const namePreview = document.getElementById('namePreview');
const applyCustomization = document.getElementById('applyCustomization');
const closeCustomize = document.getElementById('closeCustomize');
const colorSwatches = document.querySelectorAll('.color-swatch');
const startForm = document.getElementById('startForm');
const sprayBtn = document.getElementById('sprayBtn'); // Added missing reference to sprayBtn
let selectedColor = null;
let newUsername = null;

function getRandomColor() {
  const colors = ['red', 'blue', 'green', 'purple', 'orange', 'pink', 'cyan', 'yellow'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function generateRandomUsername() {
  const prefixes = ['Player', 'User', 'Gamer', 'Blob', 'Guest', 'Casual'];
  const randomNum = Math.floor(1000 + Math.random() * 9000); // 4 digit number
  return `${prefixes[Math.floor(Math.random() * prefixes.length)]}${randomNum}`;
}

// Particle class
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.size = Math.random() * 3 + 2;
    this.color = color;
    this.speedX = Math.random() * 1 - 0.5;
    this.speedY = Math.random() * 1 - 0.5;
    this.life = 30; // How long the particle lives (frames)
  }

  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    this.life--;
    if (this.life > 0) {
      this.size *= 0.95; // Particles get smaller over time
    }
  }

  draw() {
    ctx.fillStyle = this.color;
    ctx.globalAlpha = this.life / 30;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// Create particles when player moves
function createParticles(player, id) {
  if (!lastPositions[id]) {
    lastPositions[id] = { x: player.x, y: player.y };
    return;
  }

  // Only create particles if the player moved a meaningful distance
  const distance = Math.hypot(player.x - lastPositions[id].x, player.y - lastPositions[id].y);
  if (distance > 1) {
    for (let i = 0; i < 2; i++) {
      particles.push(new Particle(player.x, player.y, player.color));
    }
    lastPositions[id] = { x: player.x, y: player.y };
    
    // Initialize animation state if it doesn't exist
    if (!playerAnimations[id]) {
      playerAnimations[id] = {
        pulsating: false,
        scale: 1,
        direction: -1, // Start by getting smaller
        speed: 0.04
      };
    } else {
      // Just enable pulsation but don't reset other properties
      playerAnimations[id].pulsating = false;
      // Only adjust direction if needed, don't reset speed
      // This prevents increased speed when moving rapidly
    }
  } else {
    // Player is not moving, gradually stop pulsating
    if (playerAnimations[id] && playerAnimations[id].pulsating) {
      // Reset scale towards 1 when stopped
      if (Math.abs(playerAnimations[id].scale - 1) < 0.02) {
        playerAnimations[id].scale = 1;
        playerAnimations[id].pulsating = false;
      } else {
        // Move scale back to 1 gradually
        playerAnimations[id].scale += (1 - playerAnimations[id].scale) * 0.1;
      }
    }
  }
}

// Draw blob in preview canvas
function updatePreview() {
  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  
  // Draw blob
  previewCtx.fillStyle = selectedColor || playerColor;
  previewCtx.beginPath();
  previewCtx.arc(previewCanvas.width / 2, previewCanvas.height / 2, 20, 0, Math.PI * 2);
  previewCtx.fill();
  
  // Draw shadow
  /*
  previewCtx.fillStyle = 'rgba(0,0,0,0.3)';
  previewCtx.beginPath();
  previewCtx.ellipse(previewCanvas.width / 2, previewCanvas.height / 2 + 18, 18, 8, 0, 0, Math.PI * 2);
  previewCtx.fill();
  */
  
  // Update name preview
  namePreview.textContent = newUsername || username;
}

// Initialize color swatches
function initializeColorSwatches() {
  // Add click events to color swatches
  colorSwatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      // Remove selected class from all swatches
      colorSwatches.forEach(s => s.classList.remove('selected'));
      // Add selected class to clicked swatch
      swatch.classList.add('selected');
      // Update selected color
      selectedColor = swatch.dataset.color;
      // Update preview
      updatePreview();
    });
    
    // If this swatch matches the current playerColor, select it
    if (swatch.dataset.color === playerColor) {
      swatch.classList.add('selected');
      selectedColor = playerColor;
    }
  });
  
  // Initialize name input events
  nameInput.value = username;
  nameInput.addEventListener('input', () => {
    newUsername = nameInput.value.trim() || username;
    updatePreview();
  });
  
  // Initial preview
  updatePreview();
}

// Initialize customization menu
function initializeCustomizationMenu() {
  // Show customize button when game starts
  customizeBtn.addEventListener('click', () => {
    customizeMenu.style.display = 'block';
    
    // Ensure the correct color is selected
    colorSwatches.forEach(s => s.classList.remove('selected'));
    const currentSwatch = Array.from(colorSwatches).find(s => s.dataset.color === playerColor);
    if (currentSwatch) {
      currentSwatch.classList.add('selected');
    }
    
	// pet selection
const petItems = document.querySelectorAll('.pet-item');
petItems.forEach(item => {
  item.addEventListener('click', () => {
    // Remove selected class from all pet items
    petItems.forEach(p => p.classList.remove('selected'));
    // Add selected class to clicked item
    item.classList.add('selected');
    // Update selected pet
    selectedPet = item.dataset.pet === 'none' ? null : item.dataset.pet;
    // Update preview to show the pet
    updatePreview();
  });
});
if (currentPet) {
      currentPet.classList.add('selected');
    }
    
    // Update name input
    nameInput.value = username;
    newUsername = username;
    selectedColor = playerColor;
    updatePreview();
  });
  
  // Close button functionality
  closeCustomize.addEventListener('click', () => {
    customizeMenu.style.display = 'none';
  });
  
  // Apply changes button
  applyCustomization.addEventListener('click', () => {
    let changed = false;
    
    if (selectedColor && selectedColor !== playerColor) {
      playerColor = selectedColor;
      changed = true;
    }
    
    if (newUsername && newUsername !== username && newUsername.trim() !== '') {
      username = newUsername;
      changed = true;
    }
    
    // Check if pet changed
    if (selectedPet !== undefined) {
      changed = true;
    }
    
    if (changed) {
      socket.emit('updatePlayer', { color: playerColor, username: username, pet: selectedPet });
    }
    
    customizeMenu.style.display = 'none';
  });
  
  // Add pet selection
  const petItems = document.querySelectorAll('.pet-item');
  petItems.forEach(item => {
    item.addEventListener('click', () => {
      // Remove selected class from all pet items
      petItems.forEach(p => p.classList.remove('selected'));
      // Add selected class to clicked item
      item.classList.add('selected');
      // Update selected pet
      selectedPet = item.dataset.pet === 'none' ? null : item.dataset.pet;
    });
  });
}

startForm.addEventListener('submit', (e) => {
  e.preventDefault();
  socket.emit('newPlayer', { username, color: playerColor, pet: selectedPet });
  startForm.style.display = 'none';
  
  // Show the customize button when the game starts
  customizeBtn.style.display = 'block';
  sprayBtn.style.display = 'block';
  currentlyPlaying = true;
});

window.addEventListener('keydown', (e) => keys[e.key] = true);
window.addEventListener('keyup', (e) => keys[e.key] = false);

function gameLoop() {
  if (currentlyPlaying) {
    if (keys['a'] || keys['ArrowLeft']) socket.emit('move', 'left');
    if (keys['d'] || keys['ArrowRight']) socket.emit('move', 'right');
    if (keys['w'] || keys['ArrowUp']) socket.emit('move', 'up');
    if (keys['s'] || keys['ArrowDown']) socket.emit('move', 'down');
  }
  
  // Update and remove dead particles
  particles.forEach((particle, index) => {
    particle.update();
    if (particle.life <= 0) {
      particles.splice(index, 1);
    }
  });
  
  requestAnimationFrame(gameLoop);
}

socket.on('state', (players) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw particles behind players
  particles.forEach(particle => {
    particle.draw();
  });
  
  // Draw sprays before players
  sprays.forEach((spray, index) => {
    if (spray.isExpired()) {
      sprays.splice(index, 1);
    } else {
      spray.draw();
    }
  });
  
  for (let id in players) {
    const p = players[id];
    
    // Draw pet if player has one
    if (p.pet && p.pet !== 'none') {
      // Calculate pet position - use server-provided position
      let petX = p.petPosition ? p.petPosition.x : p.x - 30;
      let petY = p.petPosition ? p.petPosition.y : p.y;
      
      // Draw pet image
      const petImg = petImages[p.pet];
      if (petImg && petImg.complete) {
        // Calculate size - make it proportional but smaller than player
        const petSize = 30; // base size
        const aspectRatio = petImg.width / petImg.height;
        let petWidth, petHeight;
        
        if (aspectRatio > 1) {
          // Image is wider than tall
          petWidth = petSize;
          petHeight = petSize / aspectRatio;
        } else {
          // Image is taller than wide
          petWidth = petSize * aspectRatio;
          petHeight = petSize;
        }
        
        // Draw the image centered on the pet position
        ctx.drawImage(
          petImg,
          petX - petWidth / 2,
          petY - petHeight / 2,
          petWidth,
          petHeight
        );
      }
    }
	
	// show preview of the pet
function updatePetPreview() {
  // Only show pet if one is selected
  if (selectedPet) {
    const petImg = petImages[selectedPet];
    if (petImg && petImg.complete) {
      // Calculate size - make it proportional but smaller than player
      const petSize = 20; // smaller for preview
      const aspectRatio = petImg.width / petImg.height;
      let petWidth, petHeight;
      
      if (aspectRatio > 1) {
        // Image is wider than tall
        petWidth = petSize;
        petHeight = petSize / aspectRatio;
      } else {
        // Image is taller than wide
        petWidth = petSize * aspectRatio;
        petHeight = petSize;
      }
      
      // Draw the pet to the left of the player
      previewCtx.drawImage(
        petImg,
        (previewCanvas.width / 2) - 30 - petWidth / 2,
        (previewCanvas.height / 2) - petHeight / 2,
        petWidth,
        petHeight
      );
    }
  }
}
    
    // Create particles
    createParticles(p, id);
    
    // Get animation state for this player
    const anim = playerAnimations[id] || { scale: 1, pulsating: false };
    
    // Update pulsation if player is moving
	/*
    if (anim.pulsating) {
      anim.scale += anim.direction * anim.speed;
      
      // Reverse direction when reaching scale limits
      if (anim.scale <= 0.85) {
        anim.scale = 0.85;
        anim.direction = 1;
      } else if (anim.scale >= 1.1) {
        anim.scale = 1.1;
        anim.direction = -1;
      }
    }
	*/
    
    // Draw isometric blob
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(anim.scale, anim.scale * 0.75); // Scale Y less for isometric effect
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
    
    // Remove shadow and simplify eye
	/*
    ctx.fillStyle = 'black';
    ctx.beginPath();
    const eyeX = p.lastDirection === 'right' ? 8 : -8;
    ctx.arc(eyeX, -5, 4, 0, Math.PI * 2);
    ctx.fill();
	*/
    
    ctx.restore();
    
    // Draw player name (not affected by scale)
    ctx.fillStyle = 'white';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.username || 'Anonymous', p.x, p.y - 30);
  }
});

// Spray class to manage sprays
class Spray {
  constructor(x, y, emoji, playerId) {
    this.x = x;
    this.y = y;
    this.emoji = emoji;
    this.playerId = playerId;
    this.createdAt = Date.now();
    this.lifespan = 10000; // 10 seconds in milliseconds
  }
  
  isExpired() {
    return Date.now() - this.createdAt > this.lifespan;
  }
  
  draw() {
    // Calculate opacity based on remaining life
    const remainingLife = 1 - (Date.now() - this.createdAt) / this.lifespan;
    
    ctx.save();
    ctx.globalAlpha = remainingLife;
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.emoji, this.x, this.y + 30); // Position below player
    ctx.restore();
  }
}

// initialize spray functionality
function initializeSprayFeature() {
  const sprayBtn = document.getElementById('sprayBtn');
  const sprayMenu = document.getElementById('sprayMenu');
  const closeSprayMenu = document.getElementById('closeSprayMenu');
  const sprayItems = document.querySelectorAll('.spray-item');
  
  // Show spray menu when button is clicked
  sprayBtn.addEventListener('click', () => {
    sprayMenu.style.display = 'block';
  });
  
  // Close spray menu when close button is clicked
  closeSprayMenu.addEventListener('click', () => {
    sprayMenu.style.display = 'none';
  });
  
  // Handle spray item selection
  sprayItems.forEach(item => {
    item.addEventListener('click', () => {
      selectedEmoji = item.dataset.emoji;
      sprayMenu.style.display = 'none';
      
      // Emit spray action to server
      socket.emit('addSpray', { emoji: selectedEmoji });
    });
  });
}

// socket event listeners for sprays
socket.on('newSpray', (data) => {
  sprays.push(new Spray(data.x, data.y, data.emoji, data.playerId));
});

socket.on('allSprays', (sprayData) => {
  sprays = [];
  sprayData.forEach(data => {
    sprays.push(new Spray(data.x, data.y, data.emoji, data.playerId));
  });
});

// Chat logic
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const messages = document.getElementById('messages');

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (chatInput.value.trim()) {
    socket.emit('chatMessage', chatInput.value);
    chatInput.value = '';
  }
});

socket.on('chatMessage', (msg) => {
  const div = document.createElement('div');
  div.textContent = `${msg.username}: ${msg.text}`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
});

socket.on('chatHistory', (history) => {
  messages.innerHTML = '';
  history.forEach((msg) => {
    const div = document.createElement('div');
    div.textContent = `${msg.username}: ${msg.text}`;
    messages.appendChild(div);
  });
  messages.scrollTop = messages.scrollHeight;
});

// Initialize the game
function init() {
  initializeColorSwatches();
  initializeCustomizationMenu();
  initializeSprayFeature();
  requestAnimationFrame(gameLoop);
}

// Start everything when the page loads
window.addEventListener('load', init);
