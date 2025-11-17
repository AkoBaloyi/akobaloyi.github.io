// ===== Data Poisoning Simulator =====

const datasetCanvas = document.getElementById('datasetCanvas');
const accuracyChart = document.getElementById('accuracyChart');
const dataCtx = datasetCanvas.getContext('2d');
const chartCtx = accuracyChart.getContext('2d');

let dataset = [];
let poisonedIndices = new Set();
let accuracyHistory = [100];
let baselineAccuracy = 100;

// Initialize clean dataset
function initializeDataset() {
    dataset = [];
    poisonedIndices.clear();
    
    // Generate 100 samples (50 per class)
    for (let i = 0; i < 50; i++) {
        // Class 0 (cyan)
        dataset.push({
            x: Math.random() * 150 + 50,
            y: Math.random() * 150 + 50,
            class: 0,
            poisoned: false
        });
        
        // Class 1 (purple)
        dataset.push({
            x: Math.random() * 150 + 200,
            y: Math.random() * 150 + 200,
            class: 1,
            poisoned: false
        });
    }
    
    drawDataset();
    updateStats();
}

function drawDataset() {
    dataCtx.clearRect(0, 0, datasetCanvas.width, datasetCanvas.height);
    
    // Draw decision boundary (diagonal line)
    dataCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    dataCtx.lineWidth = 2;
    dataCtx.setLineDash([5, 5]);
    dataCtx.beginPath();
    dataCtx.moveTo(0, 400);
    dataCtx.lineTo(400, 0);
    dataCtx.stroke();
    dataCtx.setLineDash([]);
    
    // Draw samples
    dataset.forEach((sample, idx) => {
        dataCtx.beginPath();
        dataCtx.arc(sample.x, sample.y, 5, 0, Math.PI * 2);
        
        if (sample.poisoned) {
            dataCtx.fillStyle = '#ff6b6b';
            dataCtx.strokeStyle = '#ff0000';
            dataCtx.lineWidth = 2;
        } else {
            dataCtx.fillStyle = sample.class === 0 ? '#00E8FF' : '#C400FF';
            dataCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            dataCtx.lineWidth = 1;
        }
        
        dataCtx.fill();
        dataCtx.stroke();
    });
}

function addPoison() {
    const poisonType = document.getElementById('poisonType').value;
    const poisonPercent = parseInt(document.getElementById('poisonPercent').value);
    const numPoison = Math.floor(dataset.length * poisonPercent / 100);
    
    // Reset previous poison
    dataset.forEach(sample => sample.poisoned = false);
    poisonedIndices.clear();
    
    if (poisonType === 'label-flip') {
        // Randomly flip labels
        for (let i = 0; i < numPoison; i++) {
            const idx = Math.floor(Math.random() * dataset.length);
            dataset[idx].class = 1 - dataset[idx].class;
            dataset[idx].poisoned = true;
            poisonedIndices.add(idx);
        }
    } else if (poisonType === 'backdoor') {
        // Add backdoor trigger (move samples to specific location)
        for (let i = 0; i < numPoison; i++) {
            const idx = Math.floor(Math.random() * dataset.length);
            dataset[idx].x = 350;
            dataset[idx].y = 50;
            dataset[idx].class = 1; // Force to class 1
            dataset[idx].poisoned = true;
            poisonedIndices.add(idx);
        }
    } else if (poisonType === 'feature-poison') {
        // Subtly shift features
        for (let i = 0; i < numPoison; i++) {
            const idx = Math.floor(Math.random() * dataset.length);
            dataset[idx].x += (Math.random() - 0.5) * 100;
            dataset[idx].y += (Math.random() - 0.5) * 100;
            dataset[idx].poisoned = true;
            poisonedIndices.add(idx);
        }
    }
    
    drawDataset();
    updateStats();
}

function trainModel() {
    const trainingProgress = document.getElementById('trainingProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    trainingProgress.style.display = 'block';
    
    let progress = 0;
    const interval = setInterval(() => {
        progress += 10;
        progressFill.style.width = progress + '%';
        progressText.textContent = `Training... ${progress}%`;
        
        if (progress >= 100) {
            clearInterval(interval);
            progressText.textContent = 'Training Complete!';
            setTimeout(() => {
                trainingProgress.style.display = 'none';
                calculateAccuracy();
            }, 500);
        }
    }, 200);
}

function calculateAccuracy() {
    const poisonPercent = parseInt(document.getElementById('poisonPercent').value);
    const poisonType = document.getElementById('poisonType').value;
    
    // Simulate accuracy drop based on poison
    let accuracyDrop = 0;
    
    if (poisonType === 'label-flip') {
        accuracyDrop = poisonPercent * 1.5; // More severe
    } else if (poisonType === 'backdoor') {
        accuracyDrop = poisonPercent * 0.5; // Subtle but dangerous
    } else {
        accuracyDrop = poisonPercent * 1.0;
    }
    
    const newAccuracy = Math.max(50, baselineAccuracy - accuracyDrop);
    accuracyHistory.push(newAccuracy);
    
    // Update metrics
    document.getElementById('accuracy').textContent = newAccuracy.toFixed(1) + '%';
    document.getElementById('accuracy').style.color = newAccuracy > 80 ? '#4ade80' : '#ff6b6b';
    
    const loss = (100 - newAccuracy) / 100 * 2;
    document.getElementById('loss').textContent = loss.toFixed(3);
    
    document.getElementById('accuracyDrop').textContent = accuracyDrop.toFixed(1) + '%';
    
    if (poisonType === 'backdoor') {
        document.getElementById('backdoorSuccess').textContent = poisonPercent > 10 ? 'High' : 'Medium';
        document.getElementById('backdoorSuccess').style.color = poisonPercent > 10 ? '#ff6b6b' : '#ffa500';
    } else {
        document.getElementById('backdoorSuccess').textContent = 'N/A';
    }
    
    const difficulty = poisonPercent < 10 ? 'High' : poisonPercent < 25 ? 'Medium' : 'Low';
    document.getElementById('detectionDiff').textContent = difficulty;
    document.getElementById('detectionDiff').style.color = 
        difficulty === 'High' ? '#ff6b6b' : difficulty === 'Medium' ? '#ffa500' : '#4ade80';
    
    drawAccuracyChart();
}

function drawAccuracyChart() {
    chartCtx.clearRect(0, 0, accuracyChart.width, accuracyChart.height);
    
    // Draw grid
    chartCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    chartCtx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = (accuracyChart.height / 4) * i;
        chartCtx.beginPath();
        chartCtx.moveTo(0, y);
        chartCtx.lineTo(accuracyChart.width, y);
        chartCtx.stroke();
    }
    
    // Draw accuracy line
    if (accuracyHistory.length > 1) {
        chartCtx.strokeStyle = '#00E8FF';
        chartCtx.lineWidth = 3;
        chartCtx.beginPath();
        
        const xStep = accuracyChart.width / (accuracyHistory.length - 1);
        accuracyHistory.forEach((acc, idx) => {
            const x = idx * xStep;
            const y = accuracyChart.height - (acc / 100 * accuracyChart.height);
            
            if (idx === 0) {
                chartCtx.moveTo(x, y);
            } else {
                chartCtx.lineTo(x, y);
            }
        });
        
        chartCtx.stroke();
        
        // Draw points
        accuracyHistory.forEach((acc, idx) => {
            const x = idx * xStep;
            const y = accuracyChart.height - (acc / 100 * accuracyChart.height);
            
            chartCtx.beginPath();
            chartCtx.arc(x, y, 5, 0, Math.PI * 2);
            chartCtx.fillStyle = '#00E8FF';
            chartCtx.fill();
        });
    }
    
    // Draw labels
    chartCtx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    chartCtx.font = '12px JetBrains Mono';
    chartCtx.fillText('100%', 5, 15);
    chartCtx.fillText('50%', 5, accuracyChart.height / 2);
    chartCtx.fillText('0%', 5, accuracyChart.height - 5);
}

function updateStats() {
    const cleanCount = dataset.filter(s => !s.poisoned).length;
    const poisonCount = dataset.filter(s => s.poisoned).length;
    
    document.getElementById('cleanCount').textContent = cleanCount;
    document.getElementById('poisonCount').textContent = poisonCount;
    document.getElementById('totalCount').textContent = dataset.length;
}

function resetDataset() {
    initializeDataset();
    accuracyHistory = [100];
    document.getElementById('accuracy').textContent = '100%';
    document.getElementById('accuracy').style.color = '#4ade80';
    document.getElementById('loss').textContent = '0.05';
    document.getElementById('accuracyDrop').textContent = '0%';
    document.getElementById('backdoorSuccess').textContent = 'N/A';
    document.getElementById('detectionDiff').textContent = 'Low';
    document.getElementById('poisonPercent').value = 0;
    document.getElementById('poisonPercentValue').textContent = '0%';
    drawAccuracyChart();
}

// Event Listeners
document.getElementById('poisonPercent').addEventListener('input', (e) => {
    document.getElementById('poisonPercentValue').textContent = e.target.value + '%';
});

document.getElementById('addPoison').addEventListener('click', addPoison);
document.getElementById('trainModel').addEventListener('click', trainModel);
document.getElementById('resetData').addEventListener('click', resetDataset);

// Initialize
initializeDataset();
drawAccuracyChart();

console.log('%c💉 Data Poisoning Simulator Loaded', 'color: #00E8FF; font-size: 16px; font-weight: bold;');
