const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const leadRoutes = require('./routes/leadRoutes');
const visitorRoutes = require('./routes/visitorRoutes');
const VisitorManager = require('./services/visitorManager');
const { startCronScheduler } = require('./services/followUpCron');

const app = express();
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/evolvia_crm';

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Silence favicon 404
app.get('/favicon.ico', (req, res) => res.status(204).end());

// ====================================================================
// SERVER-LEVEL AUTO-TRACKER: CAPTURES IP & GEO DATA ON ANY HIT
// ====================================================================
app.use((req, res, next) => {
    const url = req.url.toLowerCase();
    const isAsset = url.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js|woff|woff2|ttf|map)$/i);
    const isApi = url.startsWith('/api/');

    if (!isAsset && !isApi) {
        const forwarded = req.headers['x-forwarded-for'];
        const ip = forwarded ? forwarded.split(',')[0].trim() : (req.socket.remoteAddress || req.ip || '');
        const userAgent = req.headers['user-agent'] || '';
        const referrer = req.headers['referer'] || '';

        // Asynchronously log the visitor hit without slowing down HTTP response
        VisitorManager.recordVisit({
            ip,
            userAgent,
            page: req.path || '/',
            referrer
        }).catch(err => console.error('[AUTO HIT TRACKER ERROR]:', err.message));
    }
    next();
});

// Serve static frontend assets with Global CDN caching & SEO headers
const publicDir = path.resolve(__dirname, '..', 'company_website');
app.use(express.static(publicDir, {
    maxAge: '1d',
    setHeaders: (res, filePath) => {
        // High-speed edge CDN headers
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
        } else if (filePath.match(/\.(png|jpg|jpeg|svg|ico|webp)$/i)) {
            res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        }
    }
}));

// API Routes
const settingsRoutes = require('./routes/settingsRoutes');
const SettingsManager = require('./services/settingsManager');

app.use('/api/leads', leadRoutes);
app.use('/api/visitors', visitorRoutes);
app.use('/api/settings', settingsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        brand: 'Evolvia Technologies',
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'mongodb_connected' : 'file_backed_active'
    });
});

// Admin Authentication endpoint
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    const settings = SettingsManager.getSettings();
    const adminUser = settings.security?.adminUsername || 'admin';
    const adminPass = settings.security?.adminPassword || 'admin';

    if (username === adminUser && password === adminPass) {
        return res.json({
            success: true,
            message: 'Authentication successful',
            token: 'evolvia_admin_token_secure_session',
            user: { username: adminUser, role: 'Super Admin' }
        });
    }
    return res.status(401).json({
        success: false,
        error: 'Invalid username or password.'
    });
});

// Admin Route redirect
app.get('/admin', (req, res) => {
    res.sendFile(path.join(publicDir, 'admin.html'));
});

// Settings Route redirect
app.get('/settings', (req, res) => {
    res.sendFile(path.join(publicDir, 'settings.html'));
});

// Connect to MongoDB & Start Server
async function startServer() {
    console.log('[SYSTEM] Attempting MongoDB connection at:', MONGODB_URI);
    try {
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 2000
        });
        console.log('[DATABASE] MongoDB connected successfully to database: evolvia_crm');
    } catch (err) {
        console.log('[DATABASE FALLBACK] MongoDB offline or not detected. Operating in High-Speed Resilient File-Backed DB mode (`evolvia_backend/data/leads.json`).');
    }

    // Start automated daily follow-up cron
    startCronScheduler();

    app.listen(PORT, () => {
        console.log(`\n======================================================`);
        console.log(`🚀 Evolvia Backend & Auto-IP Capture ACTIVE on port ${PORT}`);
        console.log(`📊 Admin Panel:   http://localhost:${PORT}/admin.html`);
        console.log(`🌐 Public Site:   http://localhost:${PORT}`);
        console.log(`🔌 API Endpoint:  http://localhost:${PORT}/api/leads`);
        console.log(`👁️ Visitor API:  http://localhost:${PORT}/api/visitors`);
        console.log(`======================================================\n`);
    });
}

startServer();
