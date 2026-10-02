const express = require('express');
const router = express.Router();
const DBManager = require('../services/dbManager');
const { sendOutreachEmail, getPersonalizedPitches } = require('../services/emailService');
const { runLeadScraper } = require('../services/scraperBridge');
const { runDailyFollowUpCycle } = require('../services/followUpCron');

// 1. GET ALL LEADS (Filtered)
router.get('/', async (req, res) => {
    try {
        const { source, status, search } = req.query;
        const leads = await DBManager.getLeads({ source, status, search });
        res.json({ success: true, count: leads.length, leads });
    } catch (err) {
        console.error('[API ERROR /api/leads]:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. GET DASHBOARD STATS
router.get('/stats', async (req, res) => {
    try {
        const stats = await DBManager.getStats();
        res.json({ success: true, stats });
    } catch (err) {
        console.error('[API ERROR /api/leads/stats]:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

const { huntLeadsWithoutWebsite } = require('../services/leadHunter');

// 3. EXTRACT LEADS WITH AI BOT (Supports global scraping & businesses without website)
router.post('/extract', async (req, res) => {
    try {
        const { industry, location, sourceName, maxCount, noWebsiteOnly } = req.body;
        console.log(`[API REQUEST] Extract leads for "${industry}" in "${location}" (No Website Filter: ${noWebsiteOnly})`);

        let extractedLeads = [];
        
        // If searching for businesses without a website or local cafes/classes/schools
        if (noWebsiteOnly || ['cafe', 'school', 'class', 'coaching'].some(k => (industry || '').toLowerCase().includes(k))) {
            extractedLeads = await huntLeadsWithoutWebsite({
                category: industry || 'cafe',
                city: location || 'Mumbai',
                maxCount: parseInt(maxCount || 10)
            });
        } else {
            extractedLeads = await runLeadScraper({
                industry: industry || 'Dental Clinics',
                location: location || 'Miami, FL',
                sourceName: sourceName || 'Google Maps Scraper',
                maxCount: parseInt(maxCount || 10)
            });
        }

        res.json({
            success: true,
            message: `Successfully extracted & imported ${extractedLeads.length} leads!`,
            leads: extractedLeads
        });
    } catch (err) {
        console.error('[API ERROR /api/leads/extract]:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3.1 MANUALLY ADD A LEAD
router.post('/manual', async (req, res) => {
    try {
        const {
            name,
            company,
            phone,
            email,
            industry,
            address,
            city,
            hasWebsite,
            website,
            source,
            notes
        } = req.body;

        if (!name || (!phone && !email)) {
            return res.status(400).json({
                success: false,
                error: 'Please provide at least a Business/Lead Name and a Phone Number or Email.'
            });
        }

        const businessName = name.trim();
        const businessCity = (city || 'Mumbai').trim();
        const businessIndustry = (industry || 'BUSINESS').toUpperCase();
        const isNoWebsite = !hasWebsite || !website;
        const sourceLabel = source && source.trim() ? source.trim() : (isNoWebsite ? `${businessCity} (No Website - Manual)` : 'Manual Entry');

        const queryStr = encodeURIComponent(`${businessName} ${address || ''} ${businessCity}`);
        const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${queryStr}`;

        const shareText = `📍 *${businessName}* (${businessIndustry})\n` +
            `📞 Phone: ${phone || 'N/A'}\n` +
            `✉️ Email: ${email || 'N/A'}\n` +
            `📍 Address: ${address || businessCity}\n` +
            `🌐 Website: ${isNoWebsite ? 'None (Unclaimed Business)' : website}\n` +
            `🗺️ Google Maps: ${googleMapsUrl}`;

        const newLead = {
            _id: `lead_manual_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            name: businessName,
            company: company || businessName,
            phone: phone ? phone.trim() : '',
            email: email && email.trim() ? email.trim() : `contact@${businessName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
            industry: businessIndustry,
            city: businessCity,
            country: 'India',
            address: address && address.trim() ? address.trim() : businessCity,
            lat: 19.0760,
            lon: 72.8777,
            source: sourceLabel,
            status: 'NEW',
            step: 0,
            googleMapsUrl,
            shareText,
            notes: notes || '',
            createdAt: new Date().toISOString(),
            history: [
                {
                    date: new Date().toISOString(),
                    action: 'MANUAL_ENTRY_CREATED',
                    type: 'MANUAL',
                    details: `Lead added manually to CRM by admin.${notes ? ' Notes: ' + notes : ''}`
                }
            ]
        };

        const saved = await DBManager.saveLead(newLead);
        res.json({
            success: true,
            message: `Lead "${businessName}" added successfully to CRM!`,
            lead: saved
        });
    } catch (err) {
        console.error('[API ERROR /api/leads/manual]:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. SEND INITIAL PITCH OR MANUAL STEP
router.post('/:id/send-pitch', async (req, res) => {
    try {
        const lead = await DBManager.findById(req.params.id);
        if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });

        const stepToSend = (!lead.step || lead.step === 0) ? 1 : lead.step + 1;
        const result = await sendOutreachEmail(lead, stepToSend);

        lead.step = stepToSend;
        lead.status = `STEP_${stepToSend}_SENT`;
        lead.lastContactDate = new Date().toISOString();

        // Schedule next follow-up in 3 days
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + 3);
        lead.nextFollowUpDate = nextDate.toISOString();

        if (!lead.history) lead.history = [];
        lead.history.push({
            date: new Date().toISOString(),
            action: `MANUAL_STEP_${stepToSend}_SENT`,
            type: 'EMAIL',
            subject: result.subject,
            details: `Manual outreach step ${stepToSend} triggered from admin panel.`
        });

        const updated = await DBManager.saveLead(lead);
        res.json({ success: true, message: `Step ${stepToSend} sent to ${lead.email}!`, lead: updated });
    } catch (err) {
        console.error('[API ERROR /api/leads/send-pitch]:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4.1 GET PERSONALIZED PITCHES (WhatsApp + Cold Email)
router.get('/:id/pitches', async (req, res) => {
    try {
        const lead = await DBManager.findById(req.params.id);
        if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });
        const pitches = getPersonalizedPitches(lead);
        res.json({ success: true, pitches });
    } catch (err) {
        console.error('[API ERROR /api/leads/pitches]:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4.2 LOG WHATSAPP OUTREACH
router.post('/:id/log-whatsapp', async (req, res) => {
    try {
        const { messageText, templateTitle } = req.body;
        const lead = await DBManager.findById(req.params.id);
        if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });

        const stepToSend = (!lead.step || lead.step === 0) ? 1 : lead.step + 1;
        lead.step = stepToSend;
        lead.status = `STEP_${stepToSend}_SENT`;
        lead.lastContactDate = new Date().toISOString();

        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + 3);
        lead.nextFollowUpDate = nextDate.toISOString();

        if (!lead.history) lead.history = [];
        lead.history.push({
            date: new Date().toISOString(),
            action: `WHATSAPP_PITCH_STEP_${stepToSend}_SENT`,
            type: 'WHATSAPP',
            subject: templateTitle || `WhatsApp Outreach Step ${stepToSend}`,
            details: messageText ? (messageText.substring(0, 180) + '...') : `WhatsApp pitch sent to ${lead.phone}`
        });

        const updated = await DBManager.saveLead(lead);
        res.json({ success: true, message: `WhatsApp outreach logged for ${lead.name}!`, lead: updated });
    } catch (err) {
        console.error('[API ERROR /api/leads/log-whatsapp]:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4.3 BULK WHATSAPP CAMPAIGN LOG
router.post('/bulk-whatsapp-log', async (req, res) => {
    try {
        const { leadIds, templateTitle } = req.body;
        if (!Array.isArray(leadIds) || leadIds.length === 0) {
            return res.status(400).json({ success: false, error: 'No lead IDs provided' });
        }

        let processedCount = 0;
        for (const id of leadIds) {
            const lead = await DBManager.findById(id);
            if (!lead) continue;

            const stepToSend = (!lead.step || lead.step === 0) ? 1 : lead.step + 1;
            lead.step = stepToSend;
            lead.status = `STEP_${stepToSend}_SENT`;
            lead.lastContactDate = new Date().toISOString();

            const nextDate = new Date();
            nextDate.setDate(nextDate.getDate() + 3);
            lead.nextFollowUpDate = nextDate.toISOString();

            if (!lead.history) lead.history = [];
            lead.history.push({
                date: new Date().toISOString(),
                action: `WHATSAPP_BULK_CAMPAIGN_STEP_${stepToSend}`,
                type: 'WHATSAPP',
                subject: templateTitle || 'Bulk WhatsApp Campaign Pitch',
                details: `Dispatched via Bulk WhatsApp runner to ${lead.phone || 'lead contact'}`
            });

            await DBManager.saveLead(lead);
            processedCount++;
        }

        res.json({
            success: true,
            message: `Bulk WhatsApp outreach successfully logged for ${processedCount} leads!`,
            count: processedCount
        });
    } catch (err) {
        console.error('[API ERROR /api/leads/bulk-whatsapp-log]:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5. UPDATE LEAD STATUS (e.g. Mark Replied, Converted)
router.patch('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const lead = await DBManager.findById(req.params.id);
        if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });

        lead.status = status;
        if (['REPLIED', 'CONVERTED', 'DO_NOT_CONTACT'].includes(status)) {
            lead.nextFollowUpDate = null; // Cancel automated follow-ups
        }

        if (!lead.history) lead.history = [];
        lead.history.push({
            date: new Date().toISOString(),
            action: `STATUS_CHANGED_TO_${status}`,
            type: 'SYSTEM',
            details: `Lead status updated to ${status} via admin dashboard.`
        });

        const updated = await DBManager.saveLead(lead);
        res.json({ success: true, lead: updated });
    } catch (err) {
        console.error('[API ERROR /api/leads/status]:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 6. TRIGGER DAILY FOLLOW-UP CYCLE ON DEMAND
router.post('/trigger-followup-now', async (req, res) => {
    try {
        const summary = await runDailyFollowUpCycle();
        res.json({ success: true, summary });
    } catch (err) {
        console.error('[API ERROR /api/leads/trigger-followup-now]:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 7. DELETE A LEAD
router.delete('/:id', async (req, res) => {
    try {
        await DBManager.deleteById(req.params.id);
        res.json({ success: true, message: 'Lead deleted successfully' });
    } catch (err) {
        console.error('[API ERROR /api/leads/delete]:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
