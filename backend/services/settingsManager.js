const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '..', 'data', 'settings.json');

const DEFAULT_SETTINGS = {
    brand: {
        companyName: 'Evolvia',
        tagline: 'Smart Software • Built on Logic',
        websiteUrl: 'http://localhost:4000',
        supportEmail: 'contact@evolvia.com',
        whatsappBusiness: '+91 98453 87889'
    },
    smtp: {
        configured: false,
        host: 'smtp.gmail.com',
        port: 587,
        user: '',
        pass: '',
        senderName: 'Evolvia Outreach Team'
    },
    whatsapp: {
        defaultCountryCode: '+91',
        enableAutoLog: true,
        defaultTemplate: 'no_website_audit'
    },
    leadHunter: {
        defaultCity: 'Mumbai',
        defaultBatchSize: 15,
        autoFilterNoWebsite: true,
        followUpIntervalDays: 3,
        cronSchedule: '0 9 * * *'
    },
    security: {
        adminUsername: 'admin',
        adminPassword: 'admin',
        sessionTimeoutMinutes: 120
    }
};

class SettingsManager {
    static getSettings() {
        try {
            if (fs.existsSync(SETTINGS_FILE)) {
                const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
                return { ...DEFAULT_SETTINGS, ...data };
            }
        } catch (err) {
            console.error('[SETTINGS] Error reading settings file, using defaults:', err.message);
        }
        return { ...DEFAULT_SETTINGS };
    }

    static saveSettings(newSettings) {
        try {
            const dir = path.dirname(SETTINGS_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

            const current = this.getSettings();
            const merged = {
                brand: { ...current.brand, ...(newSettings.brand || {}) },
                smtp: { ...current.smtp, ...(newSettings.smtp || {}) },
                whatsapp: { ...current.whatsapp, ...(newSettings.whatsapp || {}) },
                leadHunter: { ...current.leadHunter, ...(newSettings.leadHunter || {}) },
                security: { ...current.security, ...(newSettings.security || {}) }
            };

            // If new pass is empty or '••••••••', keep previous pass
            if (!newSettings.smtp?.pass || newSettings.smtp.pass === '••••••••') {
                merged.smtp.pass = current.smtp.pass;
            }

            // Check if SMTP is configured
            merged.smtp.configured = !!(merged.smtp.user && merged.smtp.pass);

            fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2), 'utf8');
            console.log('[SETTINGS] System settings updated successfully.');
            return merged;
        } catch (err) {
            console.error('[SETTINGS] Error saving settings:', err.message);
            throw err;
        }
    }

    static getMaskedSettings() {
        const settings = this.getSettings();
        return {
            ...settings,
            smtp: {
                ...settings.smtp,
                pass: settings.smtp.pass ? '••••••••' : ''
            },
            security: {
                adminUsername: settings.security.adminUsername,
                sessionTimeoutMinutes: settings.security.sessionTimeoutMinutes
                // Admin password hidden from public view
            }
        };
    }
}

module.exports = SettingsManager;
