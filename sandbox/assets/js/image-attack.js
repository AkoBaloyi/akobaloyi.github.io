// ===== Image Attack Simulator with Gemini Vision =====

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
let originalClassification = null;

// API Configuration - DO NOT commit API keys to GitHub!
// For local development, create a config.js file (gitignored)
// For production, use a backend proxy or environment variables
const GEMINI_API_KEY = window.GEMINI_API_KEY || '';
const GEMINI_VISION_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent';

// Check if API key is configured
if (!GEMINI_API_KEY) {
    console.error('%c⚠️ API Key Not Configured', 'color: #ff6b6b; font-size: 14px; font-weight: bold;');
    console.log('%cTo use this feature:', 'color: #00E8FF; font-size: 12px;');
    console.log('%c1. Create sandbox/config.js with: window.GEMINI_API_KEY = "your-key-here";', 'color: #A0A0A0;');
    console.log('%c2. Or set up a backend proxy (see DEPLOYMENT.md)', 'color: #A0A0A0;');
}

async function classifyImageWithGemini(imageDataUrl) {
    // Check if API key is configured
    if (!GEMINI_API_KEY) {
        return {
            label: 'API Key Not Configured',
            confidence: 0.0,
            error: true
        };
    }
    
    try {
        // Remove data URL prefix
        const base64Image = imageDataUrl.split(',')[1];
        
        const response = await fetch(`${GEMINI_VISION_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        {
                            text: "Classify this image in one or two words. What is the main object or subject? Be specific and concise. Format: 'Object (confidence: X%)'"
                        },
                        {
                            inline_data: {
                                mime_type: "image/jpeg",
                                data: base64Image
                            }
                        }
                    ]
                }],
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 100,
                }
            })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        const result = data.candidates[0].content.parts[0].text;
        
        // Parse the result
        const match = result.match(/(.+?)\s*\(confidence:\s*(\d+)%\)/i);
        if (match) {
            return {
                label: match[1].trim(),
                confidence: parseInt(match[2]) / 100
            };
        }
        
        // Fallback parsing
        return {
            label: result.split('\n')[0].trim(),
            confidence: 0.85
        };
    } catch (error) {
        console.error('Gemini Vision API Error:', error);
        return {
            label: 'Unknown',
            confidence: 0.0,
            error: true
        };
    }
}

async function loadImage(src, label = null) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async function() {
        currentImage = img;
        drawOriginalImage();
        
        // Show loading state
        document.getElementById('originalPrediction').textContent = 'Analyzing...';
        document.getElementById('originalConfidence').textContent = 'Please wait...';
        
        // Get canvas data URL for API
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = originalCanvas.width;
        tempCanvas.height = originalCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
        const imageDataUrl = tempCanvas.toDataURL('image/jpeg', 0.8);
        
        // Classify with Gemini
        const classification = await classifyImageWithGemini(imageDataUrl);
        originalClassification = classification;
        
        displayClassification(classification, true);
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

function displayClassification(classification, isOriginal) {
    const predictionEl = isOriginal ? document.getElementById('originalPrediction') : document.getElementById('attackedPrediction');
    const confidenceEl = isOriginal ? document.getElementById('originalConfidence') : document.getElementById('attackedConfidence');
    
    if (classification.error) {
        predictionEl.textContent = 'Error analyzing image';
        predictionEl.style.color = '#ff6b6b';
        confidenceEl.textContent = 'Please try again';
        return;
    }
    
    predictionEl.textContent = classification.label;
    predictionEl.style.color = isOriginal ? 'var(--neon-cyan)' : 'var(--neon-purple)';
    confidenceEl.textContent = `Confidence: ${(classification.confidence * 100).toFixed(1)}%`;
    confidenceEl.style.color = classification.confidence > 0.7 ? '#4ade80' : '#ff6b6b';
}

async function applyAdversarialAttack() {
    if (!originalImageData) {
        alert('Please upload or select an image first!');
        return;
    }
    
    // Disable button
    applyAttackBtn.disabled = true;
    applyAttackBtn.textContent = '⏳ Attacking...';
    
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
    
    // Show analyzing state
    document.getElementById('attackedPrediction').textContent = 'Analyzing attacked image...';
    document.getElementById('attackedConfidence').textContent = 'Please wait...';
    
    // Get attacked image data URL
    const attackedDataUrl = attackedCanvas.toDataURL('image/jpeg', 0.8);
    
    // Classify attacked image with Gemini
    const attackedClassification = await classifyImageWithGemini(attackedDataUrl);
    displayClassification(attackedClassification, false);
    
    // Update stats
    updateStats(strength, originalClassification, attackedClassification);
    
    // Re-enable button
    applyAttackBtn.disabled = false;
    applyAttackBtn.textContent = '🚀 Apply Attack';
}

function updateStats(strength, originalClass, attackedClass) {
    document.getElementById('perturbSize').textContent = `${strength * 10} pixels`;
    
    // Check if attack was successful (different classification)
    const success = originalClass.label.toLowerCase() !== attackedClass.label.toLowerCase();
    document.getElementById('successRate').textContent = success ? '100%' : '0%';
    document.getElementById('successRate').style.color = success ? '#4ade80' : '#ff6b6b';
    
    // Calculate confidence drop
    const confidenceDrop = Math.abs(originalClass.confidence - attackedClass.confidence) * 100;
    document.getElementById('confidenceDrop').textContent = `${confidenceDrop.toFixed(1)}%`;
    
    // Show success message
    if (success) {
        const msg = document.createElement('div');
        msg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0, 232, 255, 0.9); color: #0D0D0D; padding: 2rem; border-radius: 12px; font-size: 1.5rem; font-weight: bold; z-index: 10000; animation: slideIn 0.3s ease;';
        msg.textContent = `🎯 Attack Successful! ${originalClass.label} → ${attackedClass.label}`;
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 3000);
    }
}

function resetImage() {
    if (currentImage && originalClassification) {
        drawOriginalImage();
        displayClassification(originalClassification, false);
        
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
            loadImage(event.target.result);
        };
        reader.readAsDataURL(file);
    }
});

document.querySelectorAll('.sample-img').forEach(img => {
    img.addEventListener('click', () => {
        loadImage(img.src);
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

console.log('%c🖼️ Image Attack Simulator with Gemini Vision', 'color: #00E8FF; font-size: 16px; font-weight: bold;');
console.log('%cUpload an image or select a sample to start attacking!', 'color: #C400FF;');
