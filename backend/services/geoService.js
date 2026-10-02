const http = require('http');

// In-memory cache for IP geo lookups to prevent rate limiting
const ipCache = new Map();

/**
 * Convert ISO 2-letter country code into flag emoji
 */
function getCountryFlag(countryCode) {
    if (!countryCode || countryCode.length !== 2) return '🌐';
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
}

/**
 * Anonymize IP address for privacy regulations (e.g. 49.36.44.62 -> 49.36.xx.xx)
 */
function anonymizeIp(ip) {
    if (!ip) return '0.0.0.0';
    if (ip.includes('.')) {
        const parts = ip.split('.');
        if (parts.length === 4) {
            return `${parts[0]}.${parts[1]}.xx.xx`;
        }
    } else if (ip.includes(':')) {
        const parts = ip.split(':');
        return `${parts.slice(0, 2).join(':')}::xxxx`;
    }
    return ip;
}

/**
 * Simple User-Agent parser for OS, Browser and Device
 */
function parseUserAgent(ua = '') {
    let browser = 'Unknown Browser';
    let os = 'Unknown OS';
    let device = 'Desktop';

    // Device
    if (/mobile/i.test(ua)) device = 'Mobile';
    else if (/tablet|ipad/i.test(ua)) device = 'Tablet';

    // OS
    if (/windows nt 10/i.test(ua)) os = 'Windows 10/11';
    else if (/windows nt 6/i.test(ua)) os = 'Windows 7/8';
    else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
    else if (/android/i.test(ua)) os = 'Android';
    else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
    else if (/linux/i.test(ua)) os = 'Linux';

    // Browser
    if (/edg/i.test(ua)) browser = 'Edge';
    else if (/chrome/i.test(ua) && !/edg/i.test(ua)) browser = 'Chrome';
    else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
    else if (/firefox/i.test(ua)) browser = 'Firefox';

    return { browser, os, device, raw: ua };
}

/**
 * Look up IP Geolocation via ip-api.com (zero API key required)
 */
async function lookupIp(ip) {
    // Check in-memory cache first
    const cacheKey = ip || 'self';
    if (ipCache.has(cacheKey)) {
        return ipCache.get(cacheKey);
    }

    // Determine query URL. If local/private, look up self (public egress IP of machine)
    const isLocal = !ip || ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.');
    const url = isLocal ? 'http://ip-api.com/json/' : `http://ip-api.com/json/${encodeURIComponent(ip)}`;

    return new Promise((resolve) => {
        const req = http.get(url, { timeout: 3000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.status === 'success') {
                        const result = {
                            ip: parsed.query,
                            anonymizedIp: anonymizeIp(parsed.query),
                            city: parsed.city || 'Unknown City',
                            region: parsed.regionName || parsed.region || '',
                            country: parsed.country || 'Global',
                            countryCode: parsed.countryCode || 'GL',
                            flag: getCountryFlag(parsed.countryCode),
                            lat: parsed.lat,
                            lon: parsed.lon,
                            isp: parsed.isp || parsed.org || 'Local ISP',
                            org: parsed.org || parsed.isp || '',
                            timezone: parsed.timezone || 'UTC'
                        };
                        ipCache.set(cacheKey, result);
                        resolve(result);
                        return;
                    }
                } catch (e) {
                    // Fall through
                }
                resolve(getFallbackGeo(ip));
            });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve(getFallbackGeo(ip));
        });

        req.on('error', () => {
            resolve(getFallbackGeo(ip));
        });
    });
}

function getFallbackGeo(ip) {
    return {
        ip: ip || '127.0.0.1',
        anonymizedIp: anonymizeIp(ip || '127.0.0.1'),
        city: 'Mumbai',
        region: 'Maharashtra',
        country: 'India',
        countryCode: 'IN',
        flag: '🇮🇳',
        lat: 19.0760,
        lon: 72.8777,
        isp: 'Broadband Internet',
        org: 'Evolvia Local Network',
        timezone: 'Asia/Kolkata'
    };
}

module.exports = {
    lookupIp,
    parseUserAgent,
    anonymizeIp,
    getCountryFlag
};
