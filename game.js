const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Canvas setup
canvas.width = 400;
canvas.height = 640;

// Game state
let gameRunning = false;
let score = 0;
let lives = 3;
let highScore = localStorage.getItem('riverRunnerUltimateHighScore') || 0;
let gameSpeed = 2;
let backgroundOffset = 0;
let waveOffset = 0;
let enemiesKilled = 0;

// Player state
const player = {
    x: canvas.width / 2,
    y: canvas.height - 120,
    width: 40,
    height: 60,
    targetX: canvas.width / 2,
    speed: 0.2,
    canShoot: true,
    shootCooldown: 0,
    fireRate: 5, // shots per second
    shieldActive: false,
    shieldTime: 0,
    rapidFireActive: false,
    rapidFireTime: 0,
    superShotCharge: 0,
    superShotReady: false
};

// Game objects arrays
let obstacles = [];
let enemies = [];
let collectibles = [];
let playerBullets = [];
let enemyBullets = [];
let particles = [];
let explosions = [];

// Input handling
let mouseDown = false;
let mouseX = canvas.width / 2;
let mouseY = canvas.height - 120;
let spacePressed = false;

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});

canvas.addEventListener('mousedown', () => {
    mouseDown = true;
});

canvas.addEventListener('mouseup', () => {
    mouseDown = false;
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    mouseDown = true;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    mouseX = touch.clientX - rect.left;
    mouseY = touch.clientY - rect.top;
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    mouseX = touch.clientX - rect.left;
    mouseY = touch.clientY - rect.top;
});

canvas.addEventListener('touchend', () => {
    mouseDown = false;
});

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        spacePressed = true;
        e.preventDefault();
    }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        spacePressed = false;
    }
});

// Create bullet
function createPlayerBullet(x, y, angle = -Math.PI/2, isSuper = false) {
    playerBullets.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * (isSuper ? 15 : 10),
        vy: Math.sin(angle) * (isSuper ? 15 : 10),
        width: isSuper ? 8 : 4,
        height: isSuper ? 16 : 10,
        damage: isSuper ? 3 : 1,
        isSuper: isSuper
    });
}

// Create enemy bullet
function createEnemyBullet(x, y, targetX, targetY) {
    const angle = Math.atan2(targetY - y, targetX - x);
    enemyBullets.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * 4,
        vy: Math.sin(angle) * 4,
        width: 4,
        height: 4
    });
}

// Create particle
function createParticles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * (2 + Math.random() * 3),
            vy: Math.sin(angle) * (2 + Math.random() * 3),
            life: 1,
            color: color,
            size: 2 + Math.random() * 3
        });
    }
}

// Create explosion
function createExplosion(x, y) {
    explosions.push({
        x: x,
        y: y,
        radius: 0,
        maxRadius: 40,
        life: 1
    });
    createParticles(x, y, '#ff6b6b', 20);
    createParticles(x, y, '#ffd93d', 15);
}

// Spawn obstacle
function spawnObstacle() {
    obstacles.push({
        x: Math.random() * (canvas.width - 100) + 50,
        y: -60,
        width: 60 + Math.random() * 40,
        height: 35,
        speed: gameSpeed,
        health: 2
    });
}

// Spawn enemy
function spawnEnemy() {
    const type = Math.random() < 0.7 ? 'basic' : 'shooter';
    enemies.push({
        x: Math.random() * (canvas.width - 60) + 30,
        y: -50,
        width: 35,
        height: 45,
        speed: gameSpeed * 0.8,
        type: type,
        health: type === 'basic' ? 1 : 2,
        shootCooldown: 0,
        movePattern: Math.random() < 0.5 ? 'straight' : 'zigzag',
        zigzagPhase: Math.random() * Math.PI * 2
    });
}

// Spawn collectible
function spawnCollectible() {
    const types = ['star', 'life', 'shield', 'rapidfire'];
    const weights = [60, 15, 15, 10]; // Percentage chances

    let random = Math.random() * 100;
    let type = 'star';
    let sum = 0;

    for (let i = 0; i < weights.length; i++) {
        sum += weights[i];
        if (random < sum) {
            type = types[i];
            break;
        }
    }

    collectibles.push({
        x: Math.random() * (canvas.width - 60) + 30,
        y: -30,
        type: type,
        size: 20,
        speed: gameSpeed,
        rotation: 0,
        pulse: 0
    });
}

// Check collision
function checkCollision(a, b) {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
}

// Check circle collision
function checkCircleCollision(rect, circle) {
    const circleX = circle.x;
    const circleY = circle.y;
    const closestX = Math.max(rect.x, Math.min(circleX, rect.x + rect.width));
    const closestY = Math.max(rect.y, Math.min(circleY, rect.y + rect.height));
    const distance = Math.sqrt(Math.pow(circleX - closestX, 2) + Math.pow(circleY - closestY, 2));
    return distance < circle.size;
}

// Draw enhanced boat
function drawBoat(x, y, isPlayer = true) {
    ctx.save();
    ctx.translate(x + 20, y + 30);

    // Add tilt based on movement
    if (isPlayer) {
        const tilt = (player.targetX - player.x) * 0.01;
        ctx.rotate(tilt);
    }

    // Boat hull (better design)
    ctx.fillStyle = isPlayer ? '#8B4513' : '#4a4a4a';
    ctx.beginPath();
    ctx.moveTo(-20, -20);
    ctx.lineTo(20, -20);
    ctx.lineTo(15, 25);
    ctx.lineTo(-15, 25);
    ctx.closePath();
    ctx.fill();

    // Hull detail
    ctx.strokeStyle = isPlayer ? '#654321' : '#333';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Deck
    ctx.fillStyle = isPlayer ? '#A0522D' : '#5a5a5a';
    ctx.fillRect(-18, -18, 36, 20);

    // Cabin
    ctx.fillStyle = isPlayer ? '#FFF' : '#888';
    ctx.fillRect(-12, -15, 24, 18);

    // Windows
    ctx.fillStyle = isPlayer ? '#4A90E2' : '#333';
    ctx.fillRect(-8, -12, 7, 8);
    ctx.fillRect(1, -12, 7, 8);

    // Cannons
    ctx.fillStyle = '#333';
    ctx.fillRect(-20, -5, 8, 3);
    ctx.fillRect(12, -5, 8, 3);

    // Flag
    if (isPlayer) {
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -15);
        ctx.lineTo(0, -25);
        ctx.stroke();

        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.moveTo(0, -25);
        ctx.lineTo(10, -22);
        ctx.lineTo(0, -19);
        ctx.closePath();
        ctx.fill();
    }

    // Shield effect
    if (isPlayer && player.shieldActive) {
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 35, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.restore();
}

// Update game
function update(deltaTime) {
    if (!gameRunning) return;

    // Update player
    player.targetX = mouseX - player.width / 2;
    player.x += (player.targetX - player.x) * player.speed;
    player.x = Math.max(30, Math.min(canvas.width - player.width - 30, player.x));

    // Update shooting
    if (player.shootCooldown > 0) {
        player.shootCooldown -= deltaTime;
    }

    const currentFireRate = player.rapidFireActive ? player.fireRate * 3 : player.fireRate;

    if (mouseDown && player.shootCooldown <= 0) {
        createPlayerBullet(player.x + player.width / 2 - 2, player.y);
        player.shootCooldown = 1000 / currentFireRate;

        // Dual shot when rapid fire
        if (player.rapidFireActive) {
            createPlayerBullet(player.x + 5, player.y + 10, -Math.PI/2 - 0.2);
            createPlayerBullet(player.x + player.width - 5, player.y + 10, -Math.PI/2 + 0.2);
        }
    }

    // Super shot charge
    if (!spacePressed) {
        player.superShotCharge = Math.min(player.superShotCharge + deltaTime / 1000, 1);
        player.superShotReady = player.superShotCharge >= 1;
    } else if (player.superShotReady) {
        // Fire super shot
        for (let i = -2; i <= 2; i++) {
            createPlayerBullet(
                player.x + player.width / 2,
                player.y,
                -Math.PI/2 + (i * 0.15),
                true
            );
        }
        player.superShotCharge = 0;
        player.superShotReady = false;
        createParticles(player.x + player.width / 2, player.y, '#00ffff', 30);
    }

    // Update power-up timers
    if (player.shieldActive) {
        player.shieldTime -= deltaTime;
        if (player.shieldTime <= 0) {
            player.shieldActive = false;
        }
    }

    if (player.rapidFireActive) {
        player.rapidFireTime -= deltaTime;
        if (player.rapidFireTime <= 0) {
            player.rapidFireActive = false;
        }
    }

    // Update background
    backgroundOffset += gameSpeed;
    waveOffset += 0.02;

    // Update bullets
    playerBullets = playerBullets.filter(bullet => {
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        return bullet.y > -20 && bullet.y < canvas.height + 20 &&
               bullet.x > -20 && bullet.x < canvas.width + 20;
    });

    enemyBullets = enemyBullets.filter(bullet => {
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;

        // Check collision with player
        if (!player.shieldActive && checkCollision(player, bullet)) {
            lives--;
            createExplosion(player.x + player.width / 2, player.y + player.height / 2);

            if (lives <= 0) {
                gameOver();
            }
            return false;
        } else if (player.shieldActive && checkCollision(player, bullet)) {
            createParticles(bullet.x, bullet.y, '#00ffff', 5);
            return false;
        }

        return bullet.y < canvas.height + 20;
    });

    // Update obstacles
    obstacles = obstacles.filter(obstacle => {
        obstacle.y += obstacle.speed;

        // Check collision with player bullets
        for (let i = playerBullets.length - 1; i >= 0; i--) {
            if (checkCollision(playerBullets[i], obstacle)) {
                obstacle.health--;
                createParticles(playerBullets[i].x, playerBullets[i].y, '#8B4513', 5);

                if (obstacle.health <= 0) {
                    createExplosion(obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2);
                    score += 5;
                    playerBullets.splice(i, 1);
                    return false;
                }
                playerBullets.splice(i, 1);
            }
        }

        // Check collision with player
        if (!player.shieldActive && checkCollision(player, obstacle)) {
            lives--;
            createExplosion(obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2);

            if (lives <= 0) {
                gameOver();
            }
            return false;
        }

        return obstacle.y < canvas.height + 100;
    });

    // Update enemies
    enemies = enemies.filter(enemy => {
        // Movement
        enemy.y += enemy.speed;

        if (enemy.movePattern === 'zigzag') {
            enemy.zigzagPhase += 0.05;
            enemy.x += Math.sin(enemy.zigzagPhase) * 2;
        }

        // Shooting
        if (enemy.type === 'shooter' && enemy.y > 50 && enemy.y < canvas.height - 200) {
            enemy.shootCooldown -= deltaTime;
            if (enemy.shootCooldown <= 0) {
                createEnemyBullet(enemy.x + enemy.width / 2, enemy.y + enemy.height,
                                player.x + player.width / 2, player.y + player.height / 2);
                enemy.shootCooldown = 2000 + Math.random() * 2000;
            }
        }

        // Check collision with player bullets
        for (let i = playerBullets.length - 1; i >= 0; i--) {
            if (checkCollision(playerBullets[i], enemy)) {
                enemy.health -= playerBullets[i].damage;
                createParticles(playerBullets[i].x, playerBullets[i].y, '#ff6b6b', 8);

                if (enemy.health <= 0) {
                    createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
                    score += enemy.type === 'shooter' ? 20 : 10;
                    enemiesKilled++;
                    playerBullets.splice(i, 1);

                    // Chance to drop power-up
                    if (Math.random() < 0.2) {
                        spawnCollectible();
                    }
                    return false;
                }
                playerBullets.splice(i, 1);
            }
        }

        // Check collision with player
        if (!player.shieldActive && checkCollision(player, enemy)) {
            lives--;
            createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
            enemiesKilled++;

            if (lives <= 0) {
                gameOver();
            }
            return false;
        }

        return enemy.y < canvas.height + 100;
    });

    // Update collectibles
    collectibles = collectibles.filter(item => {
        item.y += item.speed;
        item.rotation += 0.05;
        item.pulse += 0.1;

        // Check collection
        if (checkCircleCollision(player, item)) {
            switch(item.type) {
                case 'star':
                    score += 10;
                    createParticles(item.x, item.y, '#ffd93d', 10);
                    break;
                case 'life':
                    lives = Math.min(lives + 1, 5);
                    createParticles(item.x, item.y, '#ff6b6b', 15);
                    break;
                case 'shield':
                    player.shieldActive = true;
                    player.shieldTime = 5000;
                    createParticles(item.x, item.y, '#00ffff', 20);
                    break;
                case 'rapidfire':
                    player.rapidFireActive = true;
                    player.rapidFireTime = 8000;
                    createParticles(item.x, item.y, '#ffaa00', 20);
                    break;
            }
            return false;
        }

        return item.y < canvas.height + 50;
    });

    // Update particles
    particles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.life -= 0.02;
        p.size *= 0.98;
        return p.life > 0;
    });

    // Update explosions
    explosions = explosions.filter(e => {
        e.radius += 2;
        e.life -= 0.05;
        return e.life > 0;
    });

    // Increase difficulty
    if (score > 0 && score % 50 === 0) {
        gameSpeed = Math.min(gameSpeed + 0.1, 8);
    }
}

// Draw everything
function draw() {
    // Clear and draw background
    ctx.fillStyle = '#1a3d5c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Animated water
    ctx.fillStyle = '#235280';
    for (let i = 0; i < 12; i++) {
        const waveY = (i * 60 + backgroundOffset) % canvas.height;
        const waveHeight = Math.sin(waveOffset + i) * 15;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(0, waveY + waveHeight, canvas.width, 35);
    }
    ctx.globalAlpha = 1;

    // Riverbanks with texture
    const gradient = ctx.createLinearGradient(0, 0, 30, 0);
    gradient.addColorStop(0, '#8B7355');
    gradient.addColorStop(1, '#6B5345');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 30, canvas.height);

    const gradient2 = ctx.createLinearGradient(canvas.width - 30, 0, canvas.width, 0);
    gradient2.addColorStop(0, '#6B5345');
    gradient2.addColorStop(1, '#8B7355');
    ctx.fillStyle = gradient2;
    ctx.fillRect(canvas.width - 30, 0, 30, canvas.height);

    // Draw explosions
    explosions.forEach(explosion => {
        ctx.globalAlpha = explosion.life;
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, explosion.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#ffd93d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, explosion.radius * 0.7, 0, Math.PI * 2);
        ctx.stroke();
    });
    ctx.globalAlpha = 1;

    // Draw particles
    particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
    });
    ctx.globalAlpha = 1;

    // Draw obstacles
    obstacles.forEach(obstacle => {
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(obstacle.x + 5, obstacle.y + 5, obstacle.width, obstacle.height);

        // Main body
        ctx.fillStyle = obstacle.health > 1 ? '#333' : '#555';
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

        // Damage indicator
        if (obstacle.health === 1) {
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 2;
            ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        }

        // Warning stripes
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(obstacle.x, obstacle.y, 5, obstacle.height);
        ctx.fillRect(obstacle.x + obstacle.width - 5, obstacle.y, 5, obstacle.height);
    });

    // Draw enemies
    enemies.forEach(enemy => {
        drawBoat(enemy.x, enemy.y, false);

        // Health bar
        if (enemy.health < (enemy.type === 'shooter' ? 2 : 1)) {
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(enemy.x, enemy.y - 10, enemy.width, 3);
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(enemy.x, enemy.y - 10, enemy.width * (enemy.health / (enemy.type === 'shooter' ? 2 : 1)), 3);
        }
    });

    // Draw collectibles
    collectibles.forEach(item => {
        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.rotate(item.rotation);

        const scale = 1 + Math.sin(item.pulse) * 0.1;
        ctx.scale(scale, scale);

        switch(item.type) {
            case 'star':
                ctx.fillStyle = '#ffd93d';
                ctx.font = '24px Arial';
                ctx.fillText('⭐', -12, 8);
                break;
            case 'life':
                ctx.fillStyle = '#ff6b6b';
                ctx.font = '24px Arial';
                ctx.fillText('❤️', -12, 8);
                break;
            case 'shield':
                ctx.fillStyle = '#00ffff';
                ctx.font = '24px Arial';
                ctx.fillText('🛡️', -12, 8);
                break;
            case 'rapidfire':
                ctx.fillStyle = '#ffaa00';
                ctx.font = '24px Arial';
                ctx.fillText('⚡', -12, 8);
                break;
        }
        ctx.restore();
    });

    // Draw bullets
    playerBullets.forEach(bullet => {
        if (bullet.isSuper) {
            // Super bullet glow
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00ffff';
        }

        ctx.fillStyle = bullet.isSuper ? '#00ffff' : '#ffff00';
        ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);

        ctx.shadowBlur = 0;
    });

    enemyBullets.forEach(bullet => {
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(bullet.x + bullet.width/2, bullet.y + bullet.height/2, bullet.width/2, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw player
    drawBoat(player.x, player.y, true);

    // Draw wake
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(player.x + player.width / 2, player.y + player.height);
    ctx.lineTo(player.x + player.width / 2 - 20, player.y + player.height + 40);
    ctx.moveTo(player.x + player.width / 2, player.y + player.height);
    ctx.lineTo(player.x + player.width / 2 + 20, player.y + player.height + 40);
    ctx.stroke();

    // Draw UI
    // Score background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(10, 10, 180, 90);

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`Score: ${score}`, 20, 38);

    // Lives
    ctx.font = '20px Arial';
    ctx.fillText('Lives: ', 20, 65);
    for (let i = 0; i < lives; i++) {
        ctx.fillText('❤️', 80 + i * 25, 65);
    }

    // Power-up indicators
    ctx.font = '16px Arial';
    if (player.shieldActive) {
        ctx.fillStyle = '#00ffff';
        ctx.fillText(`🛡️ ${Math.ceil(player.shieldTime / 1000)}s`, 20, 88);
    }
    if (player.rapidFireActive) {
        ctx.fillStyle = '#ffaa00';
        ctx.fillText(`⚡ ${Math.ceil(player.rapidFireTime / 1000)}s`, 90, 88);
    }

    // Super shot charge bar
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(canvas.width - 160, 10, 150, 30);

    ctx.fillStyle = '#666';
    ctx.fillRect(canvas.width - 155, 15, 140, 20);

    const chargeColor = player.superShotReady ? '#00ffff' : '#ffaa00';
    ctx.fillStyle = chargeColor;
    ctx.fillRect(canvas.width - 155, 15, 140 * player.superShotCharge, 20);

    ctx.fillStyle = '#FFF';
    ctx.font = '14px Arial';
    ctx.fillText('SUPER SHOT', canvas.width - 145, 30);

    // Speed indicator
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(canvas.width - 160, 50, 150, 30);

    ctx.fillStyle = '#FFF';
    ctx.font = '16px Arial';
    ctx.fillText(`Speed: ${Math.round(gameSpeed)}`, canvas.width - 150, 70);
}

// Spawn timers
let obstacleSpawnTimer = 0;
let enemySpawnTimer = 0;
let collectibleSpawnTimer = 0;

// Game loop
let lastTime = 0;
function gameLoop(currentTime) {
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    if (gameRunning) {
        // Update spawn timers
        obstacleSpawnTimer += deltaTime;
        enemySpawnTimer += deltaTime;
        collectibleSpawnTimer += deltaTime;

        // Spawn objects
        if (obstacleSpawnTimer > 2000 - Math.min(score * 2, 1000)) {
            spawnObstacle();
            obstacleSpawnTimer = 0;
        }

        if (enemySpawnTimer > 3000 - Math.min(score * 3, 1500)) {
            spawnEnemy();
            enemySpawnTimer = 0;
        }

        if (collectibleSpawnTimer > 2500) {
            spawnCollectible();
            collectibleSpawnTimer = 0;
        }

        update(deltaTime);
        draw();
    }

    requestAnimationFrame(gameLoop);
}

// Start game
function startGame() {
    document.getElementById('startScreen').style.display = 'none';
    gameRunning = true;
    score = 0;
    lives = 3;
    enemiesKilled = 0;
    gameSpeed = 2;
    obstacles = [];
    enemies = [];
    collectibles = [];
    playerBullets = [];
    enemyBullets = [];
    particles = [];
    explosions = [];
    player.x = canvas.width / 2 - player.width / 2;
    player.shieldActive = false;
    player.rapidFireActive = false;
    player.superShotCharge = 0;
    lastTime = performance.now();
    gameLoop(performance.now());
}

// Game over
function gameOver() {
    gameRunning = false;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('riverRunnerUltimateHighScore', highScore);
    }
    document.getElementById('finalScore').textContent = score;
    document.getElementById('bestScore').textContent = highScore;
    document.getElementById('enemiesDestroyed').textContent = enemiesKilled;
    document.getElementById('gameOverScreen').style.display = 'flex';
}

// Restart game
function restartGame() {
    document.getElementById('gameOverScreen').style.display = 'none';
    startGame();
}

// Initialize
draw();
