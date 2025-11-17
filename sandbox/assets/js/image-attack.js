// ===== Image Attack Simulator =====

const imageUpload = document.getElementById('imageUpload');
const originalCanvas = document.getElementById('originalCanvas');
const attackedCanvas = document.getElementById('attackedCanvas');
const diffCanvas = document.getElementById('diffCanvas');
const originalCtx = originalCanvas.getContext('2d');
const attackedCtx = attackedCanvas.getContext('2d');
const diffCtx = diffCanvas.getContext('2d');

const perturbStrength = document.getElementById('perturbStrength');
const strengthValue = document.getElementById('strengthValue');
const attackType = document.getElementById('attackType');
const targetClass = document.getElementById('targetClass');
const applyAttackBtn = document.getElementById('applyAttack');
const resetBtn = document.getElementById('resetImage');

let currentImage = null;
let originalImageData = null;

// Mock classification model
const classificationModel = {
    'cat': { confidence: 0.95, alternatives: ['dog', 'tiger', 'lion'] },
    'dog': { confidence: 0.92, alternatives: ['cat', 'wolf', 'fox'] },
    'car': { confidence: 0.88, alternatives: ['truck', 'bus', 'vehicle'] },
    'plane': { confidence: 0.90, alternatives: ['bird', 'helicopter', 'jet'] }
};

function loadImage(src, label) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
        currentImage = img;
        drawOriginalImage();
        classifyImage(label, true);
    };
    img.src = src;
}

function drawOriginalImage() {
    originalCtx.clearRect(0, 0, originalCanvas.width, originalCanvas.height);
    originalCtx.drawImage(currentImage, 0, 0, originalCanvas.width, originalCanvas.height);
    originalImageData = originalCtx.getImageData(0, 0, originalCanvas.width, originalCanvas.height);
    
    // Copy to attacked canvas initially
    attackedCtx.clearRect(0, 0, attackedCanvas.width, attackedCanvas.height);
    attackedCtx.drawImage(currentImage, 0, 0, attackedCanvas.width, attackedCanvas.height);
    
    // Clear diff
    diffCtx.clearRect(0, 0, diffCanvas.width, diffCanvas.height);
}

function classifyImage(label, isOriginal) {
    const model = classificationModel[label.toLowerCase()] || { confidence: 0.85, alternatives: ['unknown'] };
    const predictionEl = isOriginal ? document.getElementById('originalPrediction') : document.getElementById('attackedPrediction');
    const confidenceEl = isOriginal ? document.getElementById('originalConfidence') : document.getElementById('attackedConfidence');
    
    predictionEl.textContent = label.charAt(0).toUpperCase() + label.slice(1);
    predictionEl.style.color = 'var(--neon-cyan)';
    confidenceEl.textContent = `Confidence: ${(model.confidence * 100).toFixed(1)}%`;
    confidenceEl.style.color = model.confidence > 0.8 ? '#4ade80' : '#ff6b6b';
}

function applyAdversarialAttack() {
    if (!originalImageData) {
        alert('Please upload or select an image first!');
        return;
    }
    
    const strength = parseInt(perturbStrength.value);
    const attack = attackType.value;
    const target = targetClass.value;
    
    const imageData = originalCtx.getImageData(0, 0, originalCanvas.width, originalCanvas.height);
    const data = imageData.data;
    const diffData = diffCtx.createImageData(diffCanvas.width, diffCanvas.height);
    
    // Apply perturbation
    for (let i = 0; i < data.length; i += 4) {
        let perturbation = 0;
        
        if (attack === 'random') {
            perturbation = (Math.random() - 0.5) * strength * 2;
        } else if (attack === 'targeted') {
            // Simulate targeted attack with directional noise
            perturbation = (Math.sin(i / 1000) * strength);
        } else if (attack === 'gradient') {
            // Simulate gradient-based attack
            perturbation = (Math.cos(i / 500) * strength);
        }
        
        // Apply to RGB channels
        data[i] = Math.max(0, Math.min(255, data[i] + perturbation));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + perturbation));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + perturbation));
        
        // Create difference visualization (amplified)
        diffData.data[i] = Math.abs(perturbation) * 10;
        diffData.data[i + 1] = Math.abs(perturbation) * 10;
        diffData.data[i + 2] = Math.abs(perturbation) * 10;
        diffData.data[i + 3] = 255;
    }
    
    // Draw attacked image
    attackedCtx.putImageData(imageData, 0, 0);
    
    // Draw difference
    diffCtx.putImageData(diffData, 0, 0);
    
    // Simulate misclassification
    const originalLabel = document.getElementById('originalPrediction').textContent.toLowerCase();
    const newLabel = attack === 'targeted' ? target : getRandomMisclassification(originalLabel);
    classifyImage(newLabel, false);
    
    // Update stats
    updateStats(strength, originalLabel, newLabel);
}

function getRandomMisclassification(original) {
    const alternatives = classificationModel[original]?.alternatives || ['unknown', 'object', 'thing'];
    return alternatives[Math.floor(Math.random() * alternatives.length)];
}

function updateStats(strength, original, attacked) {
    document.getElementById('perturbSize').textContent = `${strength * 10} pixels`;
    
    const success = original !== attacked ? 100 : 0;
    document.getElementById('successRate').textContent = `${success}%`;
    document.getElementById('successRate').style.color = success > 0 ? '#4ade80' : '#ff6b6b';
    
    const drop = Math.min(95, strength * 2 + Math.random() * 20);
    document.getElementById('confidenceDrop').textContent = `${drop.toFixed(1)}%`;
}

function resetImage() {
    if (currentImage) {
        drawOriginalImage();
        const label = document.getElementById('originalPrediction').textContent.toLowerCase();
        classifyImage(label, false);
        
        document.getElementById('perturbSize').textContent = '0 pixels';
        document.getElementById('successRate').textContent = '0%';
        document.getElementById('confidenceDrop').textContent = '0%';
    }
}

// Event Listeners
imageUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            loadImage(event.target.result, 'unknown');
        };
        reader.readAsDataURL(file);
    }
});

document.querySelectorAll('.sample-img').forEach(img => {
    img.addEventListener('click', () => {
        const label = img.dataset.label;
        loadImage(img.src, label);
    });
});

perturbStrength.addEventListener('input', () => {
    strengthValue.textContent = perturbStrength.value;
});

applyAttackBtn.addEventListener('click', applyAdversarialAttack);
resetBtn.addEventListener('click', resetImage);

// Create placeholder sample images
function createPlaceholderImages() {
    const samples = document.querySelectorAll('.sample-img');
    samples.forEach((img, index) => {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');
        
        // Create colorful placeholder
        const colors = ['#00E8FF', '#C400FF', '#4ade80', '#ff6b6b'];
        ctx.fillStyle = colors[index];
        ctx.fillRect(0, 0, 100, 100);
        ctx.fillStyle = '#0D0D0D';
        ctx.font = '40px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(['🐱', '🐕', '🚗', '✈️'][index], 50, 50);
        
        img.src = canvas.toDataURL();
    });
}

createPlaceholderImages();

console.log('%c🖼️ Image Attack Simulator Loaded', 'color: #00E8FF; font-size: 16px; font-weight: bold;');
