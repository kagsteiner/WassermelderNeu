require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const OpenAI = require('openai');
const sharp = require('sharp');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration - Use /var/data on Render.com if disk is mounted, otherwise use project dir
const IS_RENDER = process.env.RENDER === 'true';
const RENDER_DISK_PATH = '/var/data';

// Determine data directory - check if Render disk is available
let DATA_DIR = __dirname;
if (IS_RENDER) {
    try {
        // Check if /var/data exists and is writable (disk is mounted)
        if (fs.existsSync(RENDER_DISK_PATH)) {
            fs.accessSync(RENDER_DISK_PATH, fs.constants.W_OK);
            DATA_DIR = RENDER_DISK_PATH;
            console.log('Using Render persistent disk at /var/data');
        } else {
            // Use project directory (data won't persist across deploys on free tier)
            console.log('No persistent disk found, using project directory (data may not persist)');
        }
    } catch (err) {
        console.log('Render disk not writable, using project directory');
    }
}

const DATA_FILE = path.join(DATA_DIR, 'data.json');
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const APP_PASSWORD = process.env.APP_PASSWORD || 'wasser2024';

// Ensure directories exist
if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Initialize data file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ readings: [] }, null, 2));
}

// OpenAI client - lazy initialization
let openai = null;
function getOpenAI() {
    if (!openai) {
        if (!process.env.OPENAI_TOKEN) {
            throw new Error('OpenAI API key not configured. Set OPENAI_TOKEN in environment variables.');
        }
        openai = new OpenAI({
            apiKey: process.env.OPENAI_TOKEN
        });
    }
    return openai;
}

// Multer configuration for image uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use('/images', express.static(IMAGES_DIR));
app.use(session({
    secret: process.env.SESSION_SECRET || 'wassermelder-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production' && process.env.RENDER ? true : false,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Auth middleware
const requireAuth = (req, res, next) => {
    if (req.session.authenticated) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

// Helper functions
function loadData() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { readings: [] };
    }
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function calculateStats(readings) {
    if (readings.length < 2) {
        return {
            lastInterval: null,
            yearStats: null,
            monthlyData: [],
            weeklyData: []
        };
    }

    // Sort readings by date
    const sorted = [...readings].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Last interval calculation
    const lastReading = sorted[sorted.length - 1];
    const prevReading = sorted[sorted.length - 2];
    const lastIntervalDays = (new Date(lastReading.date) - new Date(prevReading.date)) / (1000 * 60 * 60 * 24);
    const lastConsumption = (lastReading.value - prevReading.value) * 1000; // Convert m³ to liters
    const lastConsumptionPerDay = lastIntervalDays > 0 ? lastConsumption / lastIntervalDays : 0;

    const lastInterval = {
        days: Math.round(lastIntervalDays * 10) / 10,
        liters: Math.round(lastConsumption * 10) / 10,
        litersPerDay: Math.round(lastConsumptionPerDay * 10) / 10,
        startDate: prevReading.date,
        endDate: lastReading.date
    };

    // Year statistics
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const yearReadings = sorted.filter(r => new Date(r.date) >= startOfYear);

    let yearStats = null;
    if (yearReadings.length >= 2) {
        const firstYearReading = yearReadings[0];
        const lastYearReading = yearReadings[yearReadings.length - 1];
        const yearDays = (new Date(lastYearReading.date) - new Date(firstYearReading.date)) / (1000 * 60 * 60 * 24);
        const yearConsumption = (lastYearReading.value - firstYearReading.value) * 1000;

        yearStats = {
            totalLiters: Math.round(yearConsumption),
            avgLitersPerDay: yearDays > 0 ? Math.round((yearConsumption / yearDays) * 10) / 10 : 0,
            days: Math.round(yearDays)
        };
    }

    // Monthly data for the last 12 months
    const monthlyData = [];
    for (let i = 11; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

        const monthReadings = sorted.filter(r => {
            const d = new Date(r.date);
            return d >= monthDate && d <= monthEnd;
        });

        // Find readings that span this month
        const readingsBefore = sorted.filter(r => new Date(r.date) < monthDate);
        const readingsInOrBefore = sorted.filter(r => new Date(r.date) <= monthEnd);

        let consumption = 0;
        let days = 0;

        if (readingsBefore.length > 0 && readingsInOrBefore.length > readingsBefore.length) {
            const startReading = readingsBefore[readingsBefore.length - 1];
            const endReading = readingsInOrBefore[readingsInOrBefore.length - 1];

            if (new Date(endReading.date) > new Date(startReading.date)) {
                const totalDays = (new Date(endReading.date) - new Date(startReading.date)) / (1000 * 60 * 60 * 24);
                const totalConsumption = (endReading.value - startReading.value) * 1000;
                consumption = totalConsumption;
                days = totalDays;
            }
        }

        monthlyData.push({
            month: monthDate.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }),
            litersPerDay: days > 0 ? Math.round((consumption / days) * 10) / 10 : null
        });
    }

    // Weekly data for the last year (52 weeks)
    const weeklyData = [];
    const oneYear = 365 * 24 * 60 * 60 * 1000;
    const yearAgo = new Date(now.getTime() - oneYear);

    for (let i = 51; i >= 0; i--) {
        const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
        const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);

        // Find readings around this week
        const readingsBefore = sorted.filter(r => new Date(r.date) <= weekStart);
        const readingsAfter = sorted.filter(r => new Date(r.date) <= weekEnd);

        let litersPerDay = null;

        if (readingsBefore.length > 0 && readingsAfter.length > readingsBefore.length) {
            const startReading = readingsBefore[readingsBefore.length - 1];
            const endReading = readingsAfter[readingsAfter.length - 1];

            const days = (new Date(endReading.date) - new Date(startReading.date)) / (1000 * 60 * 60 * 24);
            const consumption = (endReading.value - startReading.value) * 1000;

            if (days > 0) {
                litersPerDay = Math.round((consumption / days) * 10) / 10;
            }
        }

        weeklyData.push({
            week: weekStart.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
            litersPerDay: litersPerDay
        });
    }

    return {
        lastInterval,
        yearStats,
        monthlyData,
        weeklyData
    };
}

async function analyzeWaterMeterImage(imageBuffer) {
    try {
        const client = getOpenAI();
        const base64Image = imageBuffer.toString('base64');

        const response = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `This is a photo of a German water meter (Wasserzähler). Please read the current meter value in cubic meters (m³). 
                            
The meter shows a number that represents total water consumption. Look for the black/white digits that show the main reading.
Red digits or the circular dials on the right side are decimal fractions - include them for precision.

Respond with ONLY a JSON object in this exact format:
{"value": 123.456, "confidence": "high/medium/low", "notes": "any relevant observations"}

The value should be a number representing cubic meters with up to 3 decimal places.`
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Image}`
                            }
                        }
                    ]
                }
            ],
            max_tokens: 300
        });

        const content = response.choices[0].message.content;

        // Parse JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        throw new Error('Could not parse meter reading from response');
    } catch (error) {
        console.error('Error analyzing image:', error);
        throw error;
    }
}

// API Routes

// Check auth status
app.get('/api/auth/status', (req, res) => {
    res.json({ authenticated: !!req.session.authenticated });
});

// Login
app.post('/api/auth/login', (req, res) => {
    const { password } = req.body;

    if (password === APP_PASSWORD) {
        req.session.authenticated = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Invalid password' });
    }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Get all data and statistics
app.get('/api/data', requireAuth, (req, res) => {
    const data = loadData();
    const stats = calculateStats(data.readings);

    res.json({
        readings: data.readings,
        stats
    });
});

// Get all readings
app.get('/api/readings', requireAuth, (req, res) => {
    const data = loadData();
    res.json(data.readings);
});

// Upload and analyze new photo
app.post('/api/reading', requireAuth, upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No photo uploaded' });
        }

        // Process and save image
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        const filename = `photo_${dateStr}_${timeStr}.jpg`;
        const imagePath = path.join(IMAGES_DIR, filename);

        // Optimize image with sharp
        const optimizedBuffer = await sharp(req.file.buffer)
            .jpeg({ quality: 85 })
            .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
            .toBuffer();

        // Analyze with LLM
        const analysis = await analyzeWaterMeterImage(optimizedBuffer);

        if (!analysis.value || typeof analysis.value !== 'number') {
            return res.status(400).json({
                error: 'Could not read meter value from image',
                analysis
            });
        }

        // Save image to disk
        fs.writeFileSync(imagePath, optimizedBuffer);

        // Save reading to data
        const data = loadData();
        const newReading = {
            id: Date.now().toString(),
            date: now.toISOString(),
            value: analysis.value,
            confidence: analysis.confidence,
            notes: analysis.notes,
            image: filename
        };

        data.readings.push(newReading);
        saveData(data);

        // Calculate updated stats
        const stats = calculateStats(data.readings);

        res.json({
            success: true,
            reading: newReading,
            stats
        });

    } catch (error) {
        console.error('Error processing reading:', error);
        res.status(500).json({ error: error.message });
    }
});

// Manual reading entry (fallback if LLM fails)
app.post('/api/reading/manual', requireAuth, (req, res) => {
    const { value, date } = req.body;

    if (typeof value !== 'number' || value < 0) {
        return res.status(400).json({ error: 'Invalid value' });
    }

    const data = loadData();
    const newReading = {
        id: Date.now().toString(),
        date: date || new Date().toISOString(),
        value: value,
        confidence: 'manual',
        notes: 'Manually entered',
        image: null
    };

    data.readings.push(newReading);
    saveData(data);

    const stats = calculateStats(data.readings);

    res.json({
        success: true,
        reading: newReading,
        stats
    });
});

// Delete a reading
app.delete('/api/reading/:id', requireAuth, (req, res) => {
    const data = loadData();
    const readingIndex = data.readings.findIndex(r => r.id === req.params.id);

    if (readingIndex === -1) {
        return res.status(404).json({ error: 'Reading not found' });
    }

    const reading = data.readings[readingIndex];

    // Delete associated image if exists
    if (reading.image) {
        const imagePath = path.join(IMAGES_DIR, reading.image);
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }
    }

    data.readings.splice(readingIndex, 1);
    saveData(data);

    const stats = calculateStats(data.readings);

    res.json({ success: true, stats });
});

// Start server
app.listen(PORT, () => {
    console.log(`Wassermelder running on http://localhost:${PORT}`);
});
