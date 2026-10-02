const express = require('express');
const router = express.Router();
const SettingsManager = require('../services/settingsManager');
const nodemailer = require('nodemailer');

// 1. GET ALL CURRENT SETTINGS (Masked sensitive fields)
router.get('/', (req, res) => {
    try {
        const settings = SettingsManager.getMaskedSettings();
        res.json({ success: true, settings });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. SAVE UPDATED SETTINGS
router.post('/', (req, res) => {
    try {
        const updated = SettingsManager.saveSettings(req.body);
        res.json({
            success: true,
            message: 'Settings saved successfully!',
            settings: SettingsManager.getMaskedSettings()
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. TEST SMTP CONNECTION
router.post('/test-email', async (req, res) => {
    try {
        const { testEmail } = req.body;
        const settings = SettingsManager.getSettings();
        const smtp = settings.smtp;

        if (!smtp.user || !smtp.pass) {
            return res.json({
                success: true,
                simulated: true,
                message: `[SIMULATION] SMTP not fully configured. Simulated test dispatch to ${testEmail || 'admin'}. To send live emails, enter valid SMTP credentials above.`
            });
        }

        const transporter = nodemailer.createTransport({
            host: smtp.host || 'smtp.gmail.com',
            port: parseInt(smtp.port || 587),
            secure: parseInt(smtp.port) === 465,
            auth: {
                user: smtp.user,
                pass: smtp.pass
            }
        });

        // Verify transporter
        await transporter.verify();

        if (testEmail) {
            await transporter.sendMail({
                from: `"${smtp.senderName || 'Evolvia'}" <${smtp.user}>`,
                to: testEmail,
                subject: 'Evolvia CRM • SMTP Verification Test',
                text: 'Congratulations! Your SMTP email server is correctly configured and operational with Evolvia CRM.'
            });
        }

        res.json({
            success: true,
            simulated: false,
            message: `SMTP Connection verified successfully! Test email delivered to ${testEmail || smtp.user}.`
        });
    } catch (err) {
        console.error('[SMTP TEST ERROR]:', err.message);
        res.status(400).json({
            success: false,
            error: `SMTP Connection failed: ${err.message}`
        });
    }
});

// 4. UPDATE ADMIN PASSWORD
router.post('/change-password', (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const settings = SettingsManager.getSettings();

        if (settings.security.adminPassword !== currentPassword) {
            return res.status(401).json({
                success: false,
                error: 'Current password does not match.'
            });
        }

        if (!newPassword || newPassword.length < 4) {
            return res.status(400).json({
                success: false,
                error: 'New password must be at least 4 characters long.'
            });
        }

        settings.security.adminPassword = newPassword;
        SettingsManager.saveSettings(settings);

        res.json({
            success: true,
            message: 'Admin password changed successfully!'
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
