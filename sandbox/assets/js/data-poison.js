// ===== Data Poisoning Simulator =====

const datasetCanvas = document.getElementById('datasetCanvas');
const accuracyChart = document.getElementById('accuracyChart');
const dataCtx = datasetCanvas.getContext('2d');
const chartCtx = accuracyChart.getContext('2d');

let dataset = [];
let poisonedIndices = new Set();
let accuracyHistory = [];
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

// ===== Real Neural Network Training with TF.js =====
// Architecture: 2 inputs (x, y) -> 8 hidden (relu) -> 2 outputs (softmax)
// This is a tiny 2-layer net, but it's REAL training with backprop, loss
// curves, and decision-boundary shifts based on the (poisoned) data.

let trainedModel = null;

async function trainModel() {
    if (typeof tf === 'undefined') {
        alert('TensorFlow.js failed to load. Check your network connection.');
        return;
    }

    const trainingProgress = document.getElementById('trainingProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    trainingProgress.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = 'Building model...';

    // Build a fresh model so retraining starts from scratch.
    const model = tf.sequential();
    model.add(tf.layers.dense({ inputShape: [2], units: 8, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 2, activation: 'softmax' }));
    model.compile({
        optimizer: tf.train.adam(0.01),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
    });

    // Normalize coordinates to roughly [0, 1] so training is stable.
    const xs = tf.tensor2d(dataset.map(s => [s.x / 400, s.y / 400]));
    const ys = tf.tensor2d(dataset.map(s => s.class === 0 ? [1, 0] : [0, 1]));

    const epochs = 30;
    let lastAccuracy = 1.0;

    await model.fit(xs, ys, {
        epochs,
        batchSize: 16,
        shuffle: true,
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                const pct = Math.round(((epoch + 1) / epochs) * 100);
                progressFill.style.width = pct + '%';
                progressText.textContent = `Training epoch ${epoch + 1}/${epochs} · loss ${logs.loss.toFixed(3)} · acc ${(logs.acc * 100).toFixed(1)}%`;
                lastAccuracy = logs.acc;
                accuracyHistory.push(logs.acc * 100);
                drawAccuracyChart();
            }
        }
    });

    // Evaluate on a held-out clean test set so backdoor success is meaningful.
    const cleanTestPoints = generateCleanTestSet(40);
    const testXs = tf.tensor2d(cleanTestPoints.map(p => [p.x / 400, p.y / 400]));
    const preds = model.predict(testXs);
    const predLabels = await preds.argMax(1).data();
    let correct = 0;
    cleanTestPoints.forEach((p, i) => {
        if (predLabels[i] === p.class) correct++;
    });
    const cleanAccuracy = (correct / cleanTestPoints.length) * 100;

    // For backdoor: test the trigger location (350, 50) — it should classify
    // as class 1 if the backdoor took.
    let backdoorRate = null;
    if (document.getElementById('poisonType').value === 'backdoor') {
        const triggerXs = tf.tensor2d([[350 / 400, 50 / 400]]);
        const triggerPred = model.predict(triggerXs);
        const triggerLabel = (await triggerPred.argMax(1).data())[0];
        backdoorRate = triggerLabel === 1 ? 100 : 0;
        triggerXs.dispose();
        triggerPred.dispose();
    }

    // Cleanup tensors.
    xs.dispose();
    ys.dispose();
    testXs.dispose();
    preds.dispose();

    trainedModel = model;

    // Update metrics with REAL numbers from real training.
    const lossValue = (1 - lastAccuracy);
    document.getElementById('accuracy').textContent = cleanAccuracy.toFixed(1) + '%';
    document.getElementById('accuracy').style.color = cleanAccuracy > 80 ? '#4ade80' : '#ff6b6b';
    document.getElementById('loss').textContent = lossValue.toFixed(3);

    const baselineAccuracy = 100;
    const accuracyDrop = Math.max(0, baselineAccuracy - cleanAccuracy);
    document.getElementById('accuracyDrop').textContent = accuracyDrop.toFixed(1) + '%';

    if (backdoorRate !== null) {
        document.getElementById('backdoorSuccess').textContent = backdoorRate + '%';
        document.getElementById('backdoorSuccess').style.color = backdoorRate > 50 ? '#ff6b6b' : '#4ade80';
    } else {
        document.getElementById('backdoorSuccess').textContent = 'N/A';
        document.getElementById('backdoorSuccess').style.color = '';
    }

    const poisonPercent = parseInt(document.getElementById('poisonPercent').value);
    const difficulty = poisonPercent < 10 ? 'High' : poisonPercent < 25 ? 'Medium' : 'Low';
    document.getElementById('detectionDiff').textContent = difficulty;
    document.getElementById('detectionDiff').style.color =
        difficulty === 'High' ? '#ff6b6b' : difficulty === 'Medium' ? '#ffa500' : '#4ade80';

    progressText.textContent = `Training complete · clean accuracy ${cleanAccuracy.toFixed(1)}%`;
    setTimeout(() => {
        trainingProgress.style.display = 'none';
    }, 1500);
}

function generateCleanTestSet(n) {
    // Generate n clean (un-poisoned) samples in the same distribution as
    // the original training data. Used to measure clean accuracy honestly.
    const points = [];
    for (let i = 0; i < n / 2; i++) {
        points.push({ x: Math.random() * 150 + 50, y: Math.random() * 150 + 50, class: 0 });
        points.push({ x: Math.random() * 150 + 200, y: Math.random() * 150 + 200, class: 1 });
    }
    return points;
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
    accuracyHistory = [];
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
