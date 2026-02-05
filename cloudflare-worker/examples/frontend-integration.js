/**
 * Frontend Integration Examples
 * 
 * Replace your direct Gemini API calls with these Worker proxy calls
 */

// ===== Configuration =====
const WORKER_URL = 'https://gemini-proxy-worker.YOUR_SUBDOMAIN.workers.dev';
// For development with token:
// const DEV_TOKEN = 'your_dev_token_here';

// ===== Chat Attack Integration =====

/**
 * Call Gemini Pro for chat/text generation
 * Replace the existing callGeminiAPI function in chat-attack.js
 */
async function callGeminiAPI(userMessage, difficulty) {
    const systemPromptText = SYSTEM_PROMPTS[difficulty];
    
    // Build full prompt with system instructions
    const fullPrompt = `${systemPromptText}\n\nConversation:\n${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}\nUser: ${userMessage}\nAssistant:`;
    
    try {
        const response = await fetch(`${WORKER_URL}/api/gemini-pro`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // For development only (not needed from akobaloyi.github.io):
                // 'x-sandbox-token': DEV_TOKEN
            },
            body: JSON.stringify({
                model: 'gemini-pro',
                prompt: fullPrompt,
                options: {
                    temperature: 0.7,
                    maxOutputTokens: 500
                }
            })
        });

        const data = await response.json();
        
        if (!data.ok) {
            throw new Error(data.error || 'Failed to get response');
        }
        
        return data.text;
        
    } catch (error) {
        console.error('Worker API Error:', error);
        return "I'm having trouble connecting right now. Please try again in a moment.";
    }
}

// ===== Image Attack Integration =====

/**
 * Call Gemini Vision for image classification
 * Replace the existing classifyImageWithGemini function in image-attack.js
 */
async function classifyImageWithGemini(imageDataUrl) {
    try {
        // Remove data URL prefix to get base64
        const base64Image = imageDataUrl.split(',')[1];
        
        const response = await fetch(`${WORKER_URL}/api/gemini-pro`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // For development only:
                // 'x-sandbox-token': DEV_TOKEN
            },
            body: JSON.stringify({
                model: 'gemini-pro-vision',
                type: 'vision',
                prompt: [
                    {
                        text: "Classify this image in one or two words. What is the main object or subject? Be specific and concise. Format: 'Object (confidence: X%)'"
                    },
                    {
                        inline_data: {
                            mime_type: "image/jpeg",
                            data: base64Image
                        }
                    }
                ],
                options: {
                    temperature: 0.4,
                    maxOutputTokens: 100
                }
            })
        });

        const data = await response.json();
        
        if (!data.ok) {
            throw new Error(data.error || 'Classification failed');
        }
        
        // Parse the result
        const result = data.text;
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
            label: 'Error',
            confidence: 0.0,
            error: true
        };
    }
}

// ===== Error Handling =====

/**
 * Handle rate limiting gracefully
 */
async function callWithRetry(fetchFunction, maxRetries = 2) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetchFunction();
            const data = await response.json();
            
            // Handle rate limiting
            if (response.status === 429) {
                const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
                console.warn(`Rate limited. Retry after ${retryAfter} seconds`);
                
                if (attempt < maxRetries - 1) {
                    await sleep(retryAfter * 1000);
                    continue;
                }
                
                throw new Error('Rate limit exceeded. Please try again later.');
            }
            
            return data;
            
        } catch (error) {
            if (attempt === maxRetries - 1) {
                throw error;
            }
            await sleep(1000 * (attempt + 1)); // Exponential backoff
        }
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== Complete Example: Update chat-attack.js =====

/**
 * Full replacement for chat-attack.js API integration
 */

// Remove these lines:
// const GEMINI_API_KEY = window.GEMINI_API_KEY || '';
// const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

// Add this:
const WORKER_URL = 'https://gemini-proxy-worker.YOUR_SUBDOMAIN.workers.dev';

// Replace callGeminiAPI function with:
async function callGeminiAPI(userMessage, difficulty) {
    const systemPromptText = SYSTEM_PROMPTS[difficulty];
    const fullPrompt = `${systemPromptText}\n\nConversation:\n${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}\nUser: ${userMessage}\nAssistant:`;
    
    try {
        const response = await fetch(`${WORKER_URL}/api/gemini-pro`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gemini-pro',
                prompt: fullPrompt,
                options: {
                    temperature: 0.7,
                    maxOutputTokens: 500
                }
            })
        });

        const data = await response.json();
        
        if (!data.ok) {
            throw new Error(data.error);
        }
        
        return data.text;
    } catch (error) {
        console.error('Worker API Error:', error);
        return "I'm having trouble connecting. Please try again.";
    }
}

// ===== Complete Example: Update image-attack.js =====

/**
 * Full replacement for image-attack.js API integration
 */

// Remove these lines:
// const GEMINI_API_KEY = window.GEMINI_API_KEY || '';
// const GEMINI_VISION_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent';

// Add this:
const WORKER_URL = 'https://gemini-proxy-worker.YOUR_SUBDOMAIN.workers.dev';

// Replace classifyImageWithGemini function with:
async function classifyImageWithGemini(imageDataUrl) {
    try {
        const base64Image = imageDataUrl.split(',')[1];
        
        const response = await fetch(`${WORKER_URL}/api/gemini-pro`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gemini-pro-vision',
                type: 'vision',
                prompt: [
                    { text: "Classify this image in one or two words. What is the main object or subject? Be specific and concise. Format: 'Object (confidence: X%)'" },
                    {
                        inline_data: {
                            mime_type: "image/jpeg",
                            data: base64Image
                        }
                    }
                ],
                options: {
                    temperature: 0.4,
                    maxOutputTokens: 100
                }
            })
        });

        const data = await response.json();
        
        if (!data.ok) {
            return { label: 'Error', confidence: 0.0, error: true };
        }
        
        const result = data.text;
        const match = result.match(/(.+?)\s*\(confidence:\s*(\d+)%\)/i);
        
        if (match) {
            return {
                label: match[1].trim(),
                confidence: parseInt(match[2]) / 100
            };
        }
        
        return {
            label: result.split('\n')[0].trim(),
            confidence: 0.85
        };
        
    } catch (error) {
        console.error('Gemini Vision API Error:', error);
        return { label: 'Error', confidence: 0.0, error: true };
    }
}

// ===== Testing =====

/**
 * Test the Worker locally or in production
 */
async function testWorker() {
    console.log('Testing Worker...');
    
    // Test 1: Simple text generation
    try {
        const response = await fetch(`${WORKER_URL}/api/gemini-pro`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gemini-pro',
                prompt: 'Say hello in one sentence',
                options: { temperature: 0.7, maxOutputTokens: 50 }
            })
        });
        
        const data = await response.json();
        console.log('Test 1 - Text:', data.ok ? '✅ PASS' : '❌ FAIL', data);
    } catch (error) {
        console.error('Test 1 - Text: ❌ FAIL', error);
    }
    
    // Test 2: Rate limiting (make 61 requests quickly)
    console.log('Test 2 - Rate Limiting: Making 61 requests...');
    let rateLimited = false;
    for (let i = 0; i < 61; i++) {
        try {
            const response = await fetch(`${WORKER_URL}/api/gemini-pro`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gemini-pro',
                    prompt: `Test ${i}`,
                    options: { maxOutputTokens: 10 }
                })
            });
            
            if (response.status === 429) {
                rateLimited = true;
                console.log(`Test 2 - Rate Limiting: ✅ PASS (limited at request ${i + 1})`);
                break;
            }
        } catch (error) {
            console.error(`Request ${i} failed:`, error);
        }
    }
    
    if (!rateLimited) {
        console.log('Test 2 - Rate Limiting: ⚠️ WARNING (not triggered - KV may not be configured)');
    }
}

// Run tests (uncomment to test)
// testWorker();
