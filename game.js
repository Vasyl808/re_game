// ==================== Game Configuration ====================
const CONFIG = {
    canvas: {
        width: 450,
        height: 700,
        maxWidth: window.innerWidth * 0.9,
        maxHeight: window.innerHeight * 0.9
    },
    player: {
        width: 60,
        height: 60,
        jumpVelocity: -15,
        moveSpeed: 8,
        gravity: 0.6,
        maxFallSpeed: 20
    },
    platform: {
        width: 80,
        height: 20,
        minWidth: 50,
        gap: 80,
        minGap: 50,
        maxGap: 120,
        types: {
            STATIC: 'static',
            MOVING: 'moving',
            BREAKABLE: 'breakable'
        }
    },
    difficulty: {
        // At what score difficulty starts increasing
        startScore: 50,
        // Max difficulty reached at this score
        maxScore: 5000 // Extended from 500 to make the game last longer
    },
    game: {
        scrollThreshold: 0.4,
        platformCount: 10
    }
};

// ==================== Game State ====================
const gameState = {
    isPlaying: false,
    score: 0,
    highScore: localStorage.getItem('highScore') || 0,
    canvas: null,
    ctx: null,
    animationId: null,
    keys: {},
    touchDirection: 0
};

// ==================== Player Class ====================
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = CONFIG.player.width;
        this.height = CONFIG.player.height;
        this.velocityX = 0;
        this.velocityY = 0;
        this.direction = 1; // 1 = right, -1 = left
        this.image = new Image();
        this.image.src = 're.jpg';
        this.imageLoaded = false;
        
        this.image.onload = () => {
            this.imageLoaded = true;
        };
    }

    update() {
        // Horizontal movement
        let moveX = 0;
        
        // Keyboard controls
        if (gameState.keys['ArrowLeft'] || gameState.keys['KeyA']) {
            moveX = -CONFIG.player.moveSpeed;
            this.direction = -1;
        }
        if (gameState.keys['ArrowRight'] || gameState.keys['KeyD']) {
            moveX = CONFIG.player.moveSpeed;
            this.direction = 1;
        }
        
        // Touch controls
        if (gameState.touchDirection !== 0) {
            moveX = gameState.touchDirection * CONFIG.player.moveSpeed;
            this.direction = gameState.touchDirection;
        }

        this.velocityX = moveX;
        this.x += this.velocityX;

        // Wrap around screen edges
        if (this.x + this.width < 0) {
            this.x = gameState.canvas.width;
        } else if (this.x > gameState.canvas.width) {
            this.x = -this.width;
        }

        // Apply gravity
        this.velocityY += CONFIG.player.gravity;
        if (this.velocityY > CONFIG.player.maxFallSpeed) {
            this.velocityY = CONFIG.player.maxFallSpeed;
        }
        
        this.y += this.velocityY;
    }

    jump() {
        this.velocityY = CONFIG.player.jumpVelocity;
    }

    draw(ctx) {
        ctx.save();
        
        // Flip image if moving left
        if (this.direction === -1) {
            ctx.translate(this.x + this.width, this.y);
            ctx.scale(-1, 1);
            ctx.drawImage(this.image, 0, 0, this.width, this.height);
        } else {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        }
        
        // Fallback if image not loaded - draw a colorful circle
        if (!this.imageLoaded) {
            ctx.restore();
            const gradient = ctx.createRadialGradient(
                this.x + this.width/2, this.y + this.height/2, 0,
                this.x + this.width/2, this.y + this.height/2, this.width/2
            );
            gradient.addColorStop(0, '#FF6B9D');
            gradient.addColorStop(1, '#FF8C42');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.x + this.width/2, this.y + this.height/2, this.width/2, 0, Math.PI * 2);
            ctx.fill();
            
            // Add simple face
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(this.x + this.width/2 - 10, this.y + this.height/2 - 5, 4, 0, Math.PI * 2);
            ctx.arc(this.x + this.width/2 + 10, this.y + this.height/2 - 5, 4, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.restore();
        }
    }
}

// ==================== Platform Class ====================
class Platform {
    constructor(x, y, type = CONFIG.platform.types.STATIC, width = CONFIG.platform.width, moveSpeed = 2) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = CONFIG.platform.height;
        this.type = type;
        this.broken = false;
        
        // Moving platform properties
        if (this.type === CONFIG.platform.types.MOVING) {
            this.moveSpeed = moveSpeed;
            this.moveDirection = Math.random() > 0.5 ? 1 : -1;
        }
    }

    update() {
        if (this.type === CONFIG.platform.types.MOVING && !this.broken) {
            this.x += this.moveSpeed * this.moveDirection;
            
            // Bounce off edges
            if (this.x <= 0 || this.x + this.width >= gameState.canvas.width) {
                this.moveDirection *= -1;
            }
        }
    }

    draw(ctx) {
        if (this.broken) return;

        ctx.save();
        
        // Platform shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 5;

        // Different colors for different types
        let gradient;
        if (this.type === CONFIG.platform.types.STATIC) {
            gradient = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
            gradient.addColorStop(0, '#68D8D6');
            gradient.addColorStop(1, '#427D9D');
        } else if (this.type === CONFIG.platform.types.MOVING) {
            gradient = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
            gradient.addColorStop(0, '#FF8C42');
            gradient.addColorStop(1, '#FF6B9D');
        } else if (this.type === CONFIG.platform.types.BREAKABLE) {
            gradient = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
            gradient.addColorStop(0, '#9BBEC8');
            gradient.addColorStop(1, '#164863');
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(this.x, this.y, this.width, this.height, 10);
        ctx.fill();

        // Add glow effect
        ctx.shadowColor = this.type === CONFIG.platform.types.MOVING ? 'rgba(255, 140, 66, 0.5)' : 'rgba(104, 216, 214, 0.5)';
        ctx.shadowBlur = 15;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }
}

// ==================== Particle System ====================
class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 4 + 2;
        this.velocityX = (Math.random() - 0.5) * 4;
        this.velocityY = (Math.random() - 0.5) * 4;
        this.life = 1;
        this.decay = Math.random() * 0.02 + 0.01;
    }

    update() {
        this.x += this.velocityX;
        this.y += this.velocityY;
        this.life -= this.decay;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
        gradient.addColorStop(0, '#68D8D6');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    isDead() {
        return this.life <= 0;
    }
}

// ==================== Game Manager ====================
class Game {
    constructor() {
        this.player = null;
        this.platforms = [];
        this.particles = [];
        this.cameraY = 0;
        this.maxHeight = 0;
    }

    init() {
        const startY = gameState.canvas.height - 100;
        this.player = new Player(
            gameState.canvas.width / 2 - CONFIG.player.width / 2,
            startY
        );

        // Create initial platforms
        this.platforms = [];
        
        // First platform under player
        this.platforms.push(new Platform(
            gameState.canvas.width / 2 - CONFIG.platform.width / 2,
            startY + CONFIG.player.height + 10,
            CONFIG.platform.types.STATIC
        ));

        // Generate more platforms
        this.generatePlatforms();
        
        this.cameraY = 0;
        this.maxHeight = 0;
    }

    generatePlatforms() {
        const lastPlatform = this.platforms[this.platforms.length - 1];
        let currentY = lastPlatform ? lastPlatform.y : gameState.canvas.height - 100;

        while (this.platforms.length < CONFIG.game.platformCount) {
            // Calculate difficulty factor (0.0 to 1.0)
            const difficultyFactor = this.getDifficultyFactor();
            
            // Dynamic gap based on difficulty
            // Base gap increases slightly with difficulty, but stays safe
            const minGap = CONFIG.platform.minGap + (difficultyFactor * 40); // 50 -> 90
            const maxGap = CONFIG.platform.maxGap + (difficultyFactor * 40); // 120 -> 160
            
            // Ensure platforms are always reachable
            // Physics: v^2 = u^2 + 2as => 0 = 15^2 + 2(-0.6)s => s = 225/1.2 = 187.5
            // We use a safe margin to ensure playability
            const maxPhysicsJump = 187.5;
            const safeMaxGap = 175; // Hard cap below physics limit
            
            // Calculate actual gap for this platform
            // We clamp the calculated maxGap to be within safe limits
            const actualMaxGap = Math.min(maxGap, safeMaxGap);
            const actualMinGap = Math.min(minGap, actualMaxGap - 10); // Ensure min < max
            
            const gap = Math.random() * (actualMaxGap - actualMinGap) + actualMinGap;
            currentY -= gap;
            
            // Dynamic platform width (decreases with difficulty)
            // Can go smaller now for higher difficulty
            const platformWidth = Math.max(
                30, // Minimum width (was CONFIG.platform.minWidth which is 50)
                CONFIG.platform.width - (difficultyFactor * 40) // 80 -> 40
            );
            
            const x = Math.random() * (gameState.canvas.width - platformWidth);
            
            // Determine platform type with difficulty scaling
            let type;
            const rand = Math.random();
            
            // As difficulty increases, significantly more challenging platforms
            // At max difficulty: 30% static, 50% moving, 20% breakable
            const staticChance = 0.8 - (difficultyFactor * 0.5); // 80% -> 30%
            const movingChance = staticChance + 0.15 + (difficultyFactor * 0.35); // +15% -> +50% (total moving probability)
            
            if (rand < staticChance) {
                type = CONFIG.platform.types.STATIC;
            } else if (rand < movingChance) {
                type = CONFIG.platform.types.MOVING;
            } else {
                type = CONFIG.platform.types.BREAKABLE;
            }
            
            // Moving platforms get faster with difficulty
            const moveSpeed = 2 + (difficultyFactor * 3); // 2 -> 5

            this.platforms.push(new Platform(x, currentY, type, platformWidth, moveSpeed));
        }
    }
    
    getDifficultyFactor() {
        // Returns value from 0.0 (easy) to 1.0 (max difficulty)
        if (gameState.score < CONFIG.difficulty.startScore) {
            return 0;
        }
        
        const progress = (gameState.score - CONFIG.difficulty.startScore) / 
                        (CONFIG.difficulty.maxScore - CONFIG.difficulty.startScore);
        
        // Use square root to make difficulty increase faster at first, then taper off
        // or use simple linear. Let's stick to linear for predictable progression
        // but since we extended the range to 5000, it will be very gradual.
        
        return Math.min(1.0, Math.max(0, progress));
    }

    update() {
        if (!gameState.isPlaying) return;

        // Update player
        this.player.update();

        // Update platforms
        this.platforms.forEach(platform => platform.update());

        // Check platform collisions (only when falling)
        if (this.player.velocityY > 0) {
            this.platforms.forEach(platform => {
                if (platform.broken) return;

                if (this.player.x < platform.x + platform.width &&
                    this.player.x + this.player.width > platform.x &&
                    this.player.y + this.player.height > platform.y &&
                    this.player.y + this.player.height < platform.y + platform.height &&
                    this.player.velocityY > 0) {
                    
                    // Bounce on platform
                    this.player.jump();
                    
                    // Create particles
                    this.createParticles(this.player.x + this.player.width / 2, platform.y);

                    // Break platform if breakable
                    if (platform.type === CONFIG.platform.types.BREAKABLE) {
                        platform.broken = true;
                    }
                }
            });
        }

        // Update particles
        this.particles = this.particles.filter(p => {
            p.update();
            return !p.isDead();
        });

        // Camera scroll
        const scrollThreshold = gameState.canvas.height * CONFIG.game.scrollThreshold;
        if (this.player.y < scrollThreshold) {
            const diff = scrollThreshold - this.player.y;
            this.cameraY -= diff;
            this.player.y = scrollThreshold;

            // Move platforms down
            this.platforms.forEach(platform => {
                platform.y += diff;
            });

            // Update score
            this.maxHeight = Math.max(this.maxHeight, -this.cameraY);
            gameState.score = Math.floor(this.maxHeight / 10);
            this.updateScore();
        }

        // Remove off-screen platforms and generate new ones
        this.platforms = this.platforms.filter(p => p.y < gameState.canvas.height + 50);
        if (this.platforms.length < CONFIG.game.platformCount) {
            this.generatePlatforms();
        }

        // Check game over
        if (this.player.y > gameState.canvas.height) {
            this.gameOver();
        }
    }

    createParticles(x, y) {
        for (let i = 0; i < 8; i++) {
            this.particles.push(new Particle(x, y));
        }
    }

    draw() {
        const ctx = gameState.ctx;
        
        // Clear canvas
        ctx.clearRect(0, 0, gameState.canvas.width, gameState.canvas.height);

        // Draw platforms
        this.platforms.forEach(platform => platform.draw(ctx));

        // Draw particles
        this.particles.forEach(particle => particle.draw(ctx));

        // Draw player
        this.player.draw(ctx);
    }

    updateScore() {
        document.getElementById('scoreValue').textContent = gameState.score;
    }

    gameOver() {
        gameState.isPlaying = false;
        
        // Update high score
        if (gameState.score > gameState.highScore) {
            gameState.highScore = gameState.score;
            localStorage.setItem('highScore', gameState.highScore);
            document.getElementById('bestScore').classList.remove('hidden');
        } else {
            document.getElementById('bestScore').classList.add('hidden');
        }

        // Show game over screen
        document.getElementById('finalScore').textContent = gameState.score;
        document.getElementById('gameOverScreen').classList.remove('hidden');
        
        if (gameState.animationId) {
            cancelAnimationFrame(gameState.animationId);
        }
    }
}

// ==================== Game Instance ====================
let game = new Game();

// ==================== Game Loop ====================
function gameLoop() {
    game.update();
    game.draw();
    
    if (gameState.isPlaying) {
        gameState.animationId = requestAnimationFrame(gameLoop);
    }
}

// ==================== Initialize Canvas ====================
function initCanvas() {
    gameState.canvas = document.getElementById('gameCanvas');
    gameState.ctx = gameState.canvas.getContext('2d');

    // Set canvas size
    const width = Math.min(CONFIG.canvas.width, CONFIG.canvas.maxWidth);
    const height = Math.min(CONFIG.canvas.height, CONFIG.canvas.maxHeight);
    
    gameState.canvas.width = width;
    gameState.canvas.height = height;

    // Update config based on actual canvas size
    CONFIG.canvas.width = width;
    CONFIG.canvas.height = height;
}

// ==================== Start Game ====================
function startGame() {
    gameState.score = 0;
    gameState.isPlaying = true;
    
    game = new Game();
    game.init();
    
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    
    game.updateScore();
    gameLoop();
}

// ==================== Event Listeners ====================
function initEventListeners() {
    // Start button
    document.getElementById('startButton').addEventListener('click', startGame);
    
    // Restart button
    document.getElementById('restartButton').addEventListener('click', startGame);

    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space'].includes(e.code)) {
            e.preventDefault();
        }
        gameState.keys[e.code] = true;
    });

    document.addEventListener('keyup', (e) => {
        gameState.keys[e.code] = false;
    });

    // Mobile controls
    const leftBtn = document.getElementById('leftBtn');
    const rightBtn = document.getElementById('rightBtn');

    leftBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        gameState.touchDirection = -1;
    });

    leftBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        gameState.touchDirection = 0;
    });

    rightBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        gameState.touchDirection = 1;
    });

    rightBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        gameState.touchDirection = 0;
    });

    // Mouse events for mobile buttons (for testing on desktop)
    leftBtn.addEventListener('mousedown', () => gameState.touchDirection = -1);
    leftBtn.addEventListener('mouseup', () => gameState.touchDirection = 0);
    leftBtn.addEventListener('mouseleave', () => gameState.touchDirection = 0);
    
    rightBtn.addEventListener('mousedown', () => gameState.touchDirection = 1);
    rightBtn.addEventListener('mouseup', () => gameState.touchDirection = 0);
    rightBtn.addEventListener('mouseleave', () => gameState.touchDirection = 0);

    // Window resize
    window.addEventListener('resize', () => {
        initCanvas();
    });
}

window.addEventListener('load', () => {
    initCanvas();
    initEventListeners();
    
    // Update high score display
    document.getElementById('highScore').textContent = `High Score: ${gameState.highScore}`;
});
