const express = require('express');
const router = express.Router();
const VisitorManager = require('../services/visitorManager');

/**
 * Extract client IP correctly from headers or socket
 */
function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress || req.ip || '';
}

// 1. INBOUND BEACON / PING: Called automatically whenever a visitor loads the website
router.post('/ping', async (req, res) => {
    try {
        const ip = getClientIp(req);
        const userAgent = req.headers['user-agent'] || '';
        const { page, referrer, screen } = req.body;

        const visitor = await VisitorManager.recordVisit({
            ip,
            userAgent,
            page: page || '/',
            referrer: referrer || '',
            screen: screen || ''
        });

        res.json({
            success: true,
            message: 'Visit tracked anonymously',
            visitor: {
                id: visitor._id,
                city: visitor.city,
                country: visitor.country,
                flag: visitor.flag,
                anonymizedIp: visitor.anonymizedIp
            }
        });
    } catch (err) {
        console.error('[VISITOR PING ERROR]:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. GET RECENT VISITORS
router.get('/', async (req, res) => {
    try {
        const { limit, search } = req.query;
        const visitors = await VisitorManager.getVisitors({
            limit: parseInt(limit || 50),
            search
        });
        res.json({ success: true, count: visitors.length, visitors });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. GET VISITOR AGGREGATED STATS
router.get('/stats', async (req, res) => {
    try {
        const stats = await VisitorManager.getVisitorStats();
        res.json({ success: true, stats });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. CONVERT VISITOR TO CRM LEAD
router.post('/:id/convert-to-lead', async (req, res) => {
    try {
        const lead = await VisitorManager.convertToLead(req.params.id);
        res.json({
            success: true,
            message: `Visitor converted to Lead in CRM!`,
            lead
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
