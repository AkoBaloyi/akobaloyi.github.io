// Simple Express.js Backend Proxy for Gemini API
// This keeps your API key secure on the server side

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting (optional but recommended)
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Gemini Pro endpoint (for chat attacks)
app.post('/api/gemini-pro', async (req, res) => {
    try {
        const { prompt } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 500,
                    }
                })
            }
        );

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

// Gemini Vision endpoint (for image attacks)
app.post('/api/gemini-vision', async (req, res) => {
    try {
        const { image, prompt } = req.body;
        
        if (!image || !prompt) {
            return res.status(400).json({ error: 'Image and prompt are required' });
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            {
                                inline_data: {
                                    mime_type: "image/jpeg",
                                    data: image
                                }
                            }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.4,
                        maxOutputTokens: 100,
                    }
                })
            }
        );

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error calling Gemini Vision API:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`🚀 Backend proxy server running on port ${PORT}`);
    console.log(`📡 Gemini Pro endpoint: http://localhost:${PORT}/api/gemini-pro`);
    console.log(`📡 Gemini Vision endpoint: http://localhost:${PORT}/api/gemini-vision`);
});
