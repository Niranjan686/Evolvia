const fs = require('fs');
const path = require('path');
const { lookupIp, parseUserAgent } = require('./geoService');
const DBManager = require('./dbManager');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const VISITORS_FILE = path.join(DATA_DIR, 'visitors.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readVisitors() {
    try {
        if (!fs.existsSync(VISITORS_FILE)) return [];
        const raw = fs.readFileSync(VISITORS_FILE, 'utf-8');
        return JSON.parse(raw || '[]');
    } catch (e) {
        return [];
    }
}

function writeVisitors(visitors) {
    fs.writeFileSync(VISITORS_FILE, JSON.stringify(visitors, null, 2), 'utf-8');
}

class VisitorManager {
    /**
     * Record a site visit anonymously with geo location & device info
     */
    static async recordVisit({ ip, userAgent, page = '/', referrer = '', screen = '' }) {
        const geo = await lookupIp(ip);
        const clientInfo = parseUserAgent(userAgent);
        const visitors = readVisitors();
        const now = new Date().toISOString();

        // Check if this visitor was active in the last 20 minutes (session deduplication)
        const recentWindow = Date.now() - (20 * 60 * 1000);
        const existingIdx = visitors.findIndex(v => 
            v.ip === geo.ip && 
            new Date(v.lastSeen).getTime() > recentWindow
        );

        let visitorRecord;

        if (existingIdx !== -1) {
            // Update existing session
            visitorRecord = visitors[existingIdx];
            visitorRecord.hitCount = (visitorRecord.hitCount || 1) + 1;
            visitorRecord.lastSeen = now;
            visitorRecord.lastPage = page;
            if (!visitorRecord.pagesVisited) visitorRecord.pagesVisited = [];
            if (!visitorRecord.pagesVisited.includes(page)) {
                visitorRecord.pagesVisited.push(page);
            }
            visitors[existingIdx] = visitorRecord;
        } else {
            // Create new visitor session
            visitorRecord = {
                _id: 'vis_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                ip: geo.ip,
                anonymizedIp: geo.anonymizedIp,
                city: geo.city,
                region: geo.region,
                country: geo.country,
                countryCode: geo.countryCode,
                flag: geo.flag,
                lat: geo.lat,
                lon: geo.lon,
                isp: geo.isp,
                org: geo.org,
                timezone: geo.timezone,
                browser: clientInfo.browser,
                os: clientInfo.os,
                device: clientInfo.device,
                screen: screen,
                referrer: referrer || 'Direct / Bookmark',
                firstSeen: now,
                lastSeen: now,
                lastPage: page,
                pagesVisited: [page],
                hitCount: 1,
                convertedToLead: false
            };
            visitors.unshift(visitorRecord);
        }

        // Keep last 1,000 visitors to avoid unbounded growth
        if (visitors.length > 1000) {
            visitors.splice(1000);
        }

        writeVisitors(visitors);
        return visitorRecord;
    }

    /**
     * Get visitors list
     */
    static async getVisitors({ limit = 50, search = '' } = {}) {
        let visitors = readVisitors();
        if (search) {
            const q = search.toLowerCase();
            visitors = visitors.filter(v => 
                (v.city && v.city.toLowerCase().includes(q)) ||
                (v.country && v.country.toLowerCase().includes(q)) ||
                (v.anonymizedIp && v.anonymizedIp.includes(q)) ||
                (v.isp && v.isp.toLowerCase().includes(q)) ||
                (v.browser && v.browser.toLowerCase().includes(q))
            );
        }
        return visitors.slice(0, limit);
    }

    /**
     * Get aggregated visitor stats
     */
    static async getVisitorStats() {
        const visitors = readVisitors();
        const totalVisits = visitors.reduce((sum, v) => sum + (v.hitCount || 1), 0);
        const uniqueVisitors = visitors.length;

        const cityCount = {};
        const countryCount = {};
        const deviceCount = {};

        visitors.forEach(v => {
            const c = v.city || 'Unknown';
            cityCount[c] = (cityCount[c] || 0) + 1;

            const co = v.country || 'Global';
            countryCount[co] = (countryCount[co] || 0) + 1;

            const d = v.device || 'Desktop';
            deviceCount[d] = (deviceCount[d] || 0) + 1;
        });

        // Top city and country
        const topCities = Object.entries(cityCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const topCountries = Object.entries(countryCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

        return {
            totalHits: totalVisits,
            uniqueVisitors,
            topCity: topCities[0] ? topCities[0][0] : 'Mumbai',
            topCountry: topCountries[0] ? topCountries[0][0] : 'India',
            topDevices: deviceCount,
            recentCount: visitors.filter(v => new Date(v.lastSeen).getTime() > Date.now() - 24 * 3600 * 1000).length
        };
    }

    /**
     * Convert an anonymous visitor into a CRM lead
     */
    static async convertToLead(visitorId) {
        const visitors = readVisitors();
        const visitor = visitors.find(v => v._id === visitorId);
        if (!visitor) throw new Error('Visitor not found');

        const cleanSlug = `${visitor.city.toLowerCase().replace(/[^a-z0-9]/g, '')}_${visitor._id.slice(-4)}`;
        const leadDoc = {
            name: `Web Visitor (${visitor.city})`,
            company: `${visitor.isp || 'Inbound Web Visitor'}`,
            email: `visitor@${cleanSlug}.inbound`,
            phone: 'Contact via live chat/email',
            industry: 'WEBSITE INBOUND LEAD',
            city: visitor.city,
            country: visitor.country,
            source: `Website Visitor (${visitor.city}, ${visitor.country})`,
            address: `${visitor.city}, ${visitor.region}, ${visitor.country}`,
            lat: visitor.lat,
            lon: visitor.lon,
            status: 'NEW',
            step: 0,
            history: [
                {
                    date: new Date().toISOString(),
                    action: 'CONVERTED_FROM_VISITOR',
                    type: 'SYSTEM',
                    details: `Automated Inbound Hit: Visitor landed from ${visitor.referrer} on ${visitor.os} • ${visitor.browser} (${visitor.device}). IP: ${visitor.anonymizedIp}. Viewed pages: ${visitor.pagesVisited.join(', ')}`
                }
            ]
        };

        const savedLead = await DBManager.saveLead(leadDoc);
        visitor.convertedToLead = true;
        visitor.convertedLeadId = savedLead._id;
        writeVisitors(visitors);

        return savedLead;
    }
}

module.exports = VisitorManager;
