const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const LeadModel = require('../models/Lead');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const JSON_FILE = path.join(DATA_DIR, 'leads.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function enrichLeadLocation(lead) {
    if (!lead) return lead;

    // Detect locality from history or company name if available
    let areaDetail = '';
    if (lead.history && Array.isArray(lead.history)) {
        for (const h of lead.history) {
            if (h.details && h.details.includes('Area:')) {
                const match = h.details.match(/Area:\s*([^.]+)/i);
                if (match) {
                    areaDetail = match[1].trim();
                    break;
                }
            } else if (h.details && h.details.includes('Address:')) {
                const match = h.details.match(/Address:\s*([^.]+)/i);
                if (match) {
                    areaDetail = match[1].trim();
                    break;
                }
            }
        }
    }

    if (!lead.address) {
        lead.address = areaDetail 
            ? `${areaDetail}, ${lead.city || 'Mumbai'}` 
            : `${lead.name}, ${lead.city || 'Mumbai'}`;
    }

    // Default coordinates based on city and area
    if (!lead.lat || !lead.lon) {
        const cityLower = (lead.city || '').toLowerCase();
        let baseLat = 19.0760, baseLon = 72.8777; // Mumbai
        if (cityLower.includes('delhi')) { baseLat = 28.6139; baseLon = 77.2090; }
        else if (cityLower.includes('bangalore') || cityLower.includes('bengaluru')) { baseLat = 12.9716; baseLon = 77.5946; }
        else if (cityLower.includes('pune')) { baseLat = 18.5204; baseLon = 73.8567; }
        else if (cityLower.includes('miami')) { baseLat = 25.7617; baseLon = -80.1918; }
        else if (cityLower.includes('austin')) { baseLat = 30.2672; baseLon = -97.7431; }
        else if (cityLower.includes('san francisco')) { baseLat = 37.7749; baseLon = -122.4194; }
        else if (cityLower.includes('london')) { baseLat = 51.5074; baseLon = -0.1278; }

        // Specific Mumbai neighborhoods if found in address or name
        const addrLower = (lead.address + ' ' + (lead.name || '')).toLowerCase();
        if (addrLower.includes('bandra') || addrLower.includes('dominic')) { baseLat = 19.0596; baseLon = 72.8295; }
        else if (addrLower.includes('andheri')) { baseLat = 19.1136; baseLon = 72.8697; }
        else if (addrLower.includes('dadar')) { baseLat = 19.0178; baseLon = 72.8478; }
        else if (addrLower.includes('powai')) { baseLat = 19.1176; baseLon = 72.9060; }
        else if (addrLower.includes('borivali') || addrLower.includes('essel')) { baseLat = 19.2307; baseLon = 72.8567; }
        else if (addrLower.includes('thane')) { baseLat = 19.2183; baseLon = 72.9781; }
        else if (addrLower.includes('colaba') || addrLower.includes('fort') || addrLower.includes('churchgate')) { baseLat = 18.9322; baseLon = 72.8264; }
        else if (addrLower.includes('vashi') || addrLower.includes('navi mumbai')) { baseLat = 19.0771; baseLon = 72.9986; }

        // Deterministic offset so pins don't overlap exactly
        let hash = 0;
        const seedStr = (lead._id || lead.name || '') + '';
        for (let i = 0; i < seedStr.length; i++) {
            hash = ((hash << 5) - hash) + seedStr.charCodeAt(i);
            hash |= 0;
        }
        const jitterLat = ((Math.abs(hash) % 70) - 35) / 1000;
        const jitterLon = ((Math.abs(hash >> 3) % 70) - 35) / 1000;

        lead.lat = parseFloat((baseLat + jitterLat).toFixed(5));
        lead.lon = parseFloat((baseLon + jitterLon).toFixed(5));
    }

    if (!lead.googleMapsUrl) {
        lead.googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.name + ' ' + (lead.address || '') + ' ' + (lead.city || ''))}`;
    }

    lead.shareText = `📍 *${lead.name}* (${lead.industry || 'Business'})\n📞 Phone: ${lead.phone || 'N/A'}\n✉️ Email: ${lead.email}\n📍 Address: ${lead.address}, ${lead.city}\n🌐 Website: None (Unclaimed Business)\n🗺️ Google Maps: ${lead.googleMapsUrl}`;

    return lead;
}

function isMongoConnected() {
    return mongoose.connection.readyState === 1;
}

function readJsonLeads() {
    try {
        if (!fs.existsSync(JSON_FILE)) return [];
        const raw = fs.readFileSync(JSON_FILE, 'utf-8');
        const leads = JSON.parse(raw || '[]');
        return leads.map(enrichLeadLocation);
    } catch (err) {
        return [];
    }
}

function writeJsonLeads(leads) {
    fs.writeFileSync(JSON_FILE, JSON.stringify(leads, null, 2), 'utf-8');
}

class DBManager {
    static async getLeads({ source, status, search }) {
        if (isMongoConnected()) {
            let query = {};
            if (source && source !== 'ALL') query.source = source;
            if (status && status !== 'ALL') query.status = status;
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { company: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { phone: { $regex: search, $options: 'i' } },
                    { address: { $regex: search, $options: 'i' } }
                ];
            }
            const docs = await LeadModel.find(query).sort({ createdAt: -1 });
            return docs.map(d => enrichLeadLocation(d.toObject()));
        }

        // Fallback: Read from persistent JSON file
        let leads = readJsonLeads();
        if (source && source !== 'ALL') leads = leads.filter(l => l.source === source);
        if (status && status !== 'ALL') leads = leads.filter(l => l.status === status);
        if (search) {
            const q = search.toLowerCase();
            leads = leads.filter(l => 
                (l.name && l.name.toLowerCase().includes(q)) ||
                (l.company && l.company.toLowerCase().includes(q)) ||
                (l.email && l.email.toLowerCase().includes(q)) ||
                (l.phone && l.phone.includes(q)) ||
                (l.address && l.address.toLowerCase().includes(q)) ||
                (l.city && l.city.toLowerCase().includes(q))
            );
        }
        return leads;
    }

    static async getStats() {
        if (isMongoConnected()) {
            const total = await LeadModel.countDocuments();
            const newLeads = await LeadModel.countDocuments({ status: 'NEW' });
            const inSequence = await LeadModel.countDocuments({ status: { $in: ['STEP_1_SENT', 'STEP_2_SENT'] } });
            const replied = await LeadModel.countDocuments({ status: 'REPLIED' });
            const converted = await LeadModel.countDocuments({ status: 'CONVERTED' });
            const now = new Date();
            const followUpDue = await LeadModel.countDocuments({
                status: { $in: ['STEP_1_SENT', 'STEP_2_SENT'] },
                nextFollowUpDate: { $lte: now }
            });
            const sources = await LeadModel.distinct('source');

            return { total, newLeads, inSequence, followUpDue, replied, converted, sources };
        }

        // Fallback calculation from JSON
        const leads = readJsonLeads();
        const now = new Date();
        const sources = Array.from(new Set(leads.map(l => l.source).filter(Boolean)));
        return {
            total: leads.length,
            newLeads: leads.filter(l => l.status === 'NEW').length,
            inSequence: leads.filter(l => ['STEP_1_SENT', 'STEP_2_SENT'].includes(l.status)).length,
            followUpDue: leads.filter(l => ['STEP_1_SENT', 'STEP_2_SENT'].includes(l.status) && l.nextFollowUpDate && new Date(l.nextFollowUpDate) <= now).length,
            replied: leads.filter(l => l.status === 'REPLIED').length,
            converted: leads.filter(l => l.status === 'CONVERTED').length,
            sources
        };
    }

    static async findById(id) {
        if (isMongoConnected()) {
            const doc = await LeadModel.findById(id);
            return doc ? enrichLeadLocation(doc.toObject()) : null;
        }
        const leads = readJsonLeads();
        const lead = leads.find(l => l._id.toString() === id.toString());
        return lead ? enrichLeadLocation(lead) : null;
    }

    static async saveLead(leadData) {
        const enriched = enrichLeadLocation(leadData);

        if (isMongoConnected()) {
            if (enriched._id && mongoose.isValidObjectId(enriched._id)) {
                return await LeadModel.findByIdAndUpdate(enriched._id, enriched, { new: true });
            }
            return await LeadModel.create(enriched);
        }

        // Save in JSON
        const leads = readJsonLeads();
        if (enriched._id) {
            const idx = leads.findIndex(l => l._id.toString() === enriched._id.toString());
            if (idx !== -1) {
                leads[idx] = { ...leads[idx], ...enriched, updatedAt: new Date().toISOString() };
                writeJsonLeads(leads);
                return leads[idx];
            }
        }
        enriched._id = 'lead_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        enriched.createdAt = new Date().toISOString();
        leads.unshift(enriched);
        writeJsonLeads(leads);
        return enriched;
    }

    static async deleteById(id) {
        if (isMongoConnected()) {
            return await LeadModel.findByIdAndDelete(id);
        }
        let leads = readJsonLeads();
        leads = leads.filter(l => l._id.toString() !== id.toString());
        writeJsonLeads(leads);
        return true;
    }

    static async getDueFollowUps() {
        const now = new Date();
        if (isMongoConnected()) {
            return await LeadModel.find({
                status: { $in: ['STEP_1_SENT', 'STEP_2_SENT'] },
                nextFollowUpDate: { $lte: now }
            });
        }
        const leads = readJsonLeads();
        return leads.filter(l => 
            ['STEP_1_SENT', 'STEP_2_SENT'].includes(l.status) &&
            l.nextFollowUpDate &&
            new Date(l.nextFollowUpDate) <= now
        );
    }
}

module.exports = DBManager;
