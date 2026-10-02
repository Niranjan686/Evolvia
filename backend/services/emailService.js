const nodemailer = require('nodemailer');
require('dotenv').config();

const isConfigured = process.env.SMTP_USER && process.env.SMTP_USER !== 'your_email@gmail.com';

const transporter = isConfigured ? nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
}) : null;

const TEMPLATES = {
    1: {
        subject: (company, industry) => `Quick idea for ${company} - Turn local Google searches into customers`,
        body: (name, company, industry, city) => {
            const ind = (industry || '').toLowerCase();
            const cityName = city || 'your area';
            
            if (ind.includes('cafe') || ind.includes('restaurant')) {
                return `Hi ${name || 'Team'},

I was searching for great food & beverage spots in ${cityName} and noticed ${company} on Google Maps. You have great presence, but I noticed you don't have an official mobile website or direct WhatsApp customer inquiry channel linked to your listing.

Over 70% of local diners look up a business on their phone before visiting. Without a 1-tap website, customers often turn to competitors nearby.

At Evolvia, we engineer ultra-fast, mobile-friendly websites with:
• 1-Tap WhatsApp Inquiries & Table Reservations
• Interactive Digital Menu Showcase
• Automated Customer Review booster on Google

Would you be open to a free 60-second preview mockup we put together for ${company}?

Best regards,
Outreach Team • Evolvia
Smart Software • Built on Logic
https://evolvia.com`;
            }

            if (ind.includes('class') || ind.includes('coaching') || ind.includes('tuition')) {
                return `Hi ${name || 'Director'},

I was reviewing top coaching institutes in ${cityName} and came across ${company}. You clearly provide great coaching, but I noticed your Google profile lacks a dedicated admission landing page or automated WhatsApp inquiry form.

When parents and students search for coaching classes, they look for instant syllabus details, batch schedules, and a 1-click way to message you on WhatsApp.

At Evolvia, we build high-converting inquiry pages for coaching institutes that:
• Capture student phone numbers automatically
• Deliver course PDFs instantly via WhatsApp
• Send automated fee & batch reminders

Can I share a quick 90-second video walkthrough of how this would look for ${company}?

Warm regards,
Evolvia Technologies
Smart Software • Built on Logic`;
            }

            if (ind.includes('school')) {
                return `Hi ${name || 'Principal / Administrator'},

I noticed ${company} listed in ${cityName}. We noticed your Google Maps presence is missing an official modern web portal for prospective parents looking for admission criteria, fee structures, and campus highlights.

Evolvia engineers secure, fast, and modern portals for educational institutions with automated admission inquiry tracking and WhatsApp alerts for parents.

Would you be open to a 2-minute walkthrough showing how other schools in ${cityName} use this system?

Best regards,
Evolvia Technologies
Smart Software • Built on Logic`;
            }

            // General B2B / Local Business
            return `Hi ${name || 'there'},

I came across ${company} while searching for ${industry || 'local businesses'} in ${cityName}. I noticed you have active local visibility, but there is no official mobile website connected to your Google listing.

In today's market, over 60% of potential clients bounce to competitors if they can't see services, pricing, or WhatsApp booking within 10 seconds of searching.

At Evolvia (Smart Software, Built on Logic), we build high-converting 1-page websites and automated WhatsApp booking systems in under 24 hours.

Would you be open to seeing a quick concept mockup we prepared for ${company}?

Best regards,
Outreach Team • Evolvia
https://evolvia.com`;
        }
    },
    2: {
        subject: (company) => `Re: Quick idea for ${company}`,
        body: (name, company, industry, city) => `Hi ${name || 'there'},

Following up briefly on my note regarding ${company}.

I know running day-to-day operations keeps your schedule full. I put together a quick draft concept of how an official 1-page website with automated WhatsApp lead capture would bring ${company} 20-30 additional customer inquiries every month.

Should I send the quick 1-minute preview link over, or are you not taking on new customers right now?

Thanks,
Outreach Team • Evolvia
Smart Software • Built on Logic`
    },
    3: {
        subject: (company) => `Permission to close file? (${company})`,
        body: (name, company) => `Hi ${name || 'there'},

I don't want to clutter your inbox, so I assume setting up an official website & WhatsApp client acquisition system for ${company} isn't a top priority right now.

If you ever want to upgrade your digital presence or automate customer inquiries in the future, feel free to reach out anytime.

Wishing you and ${company} continued growth!

Best regards,
Evolvia Technologies
https://evolvia.com`
    }
};

async function sendOutreachEmail(lead, stepNumber = 1) {
    const template = TEMPLATES[stepNumber] || TEMPLATES[1];
    const company = lead.company || lead.name;
    const subject = typeof template.subject === 'function' ? template.subject(company, lead.industry) : template.subject;
    const body = template.body(lead.name, company, lead.industry, lead.city);

    if (!transporter) {
        console.log(`[SIMULATION EMAIL] Step ${stepNumber} -> To: ${lead.email} | Subject: "${subject}"`);
        return { success: true, simulated: true, subject, body };
    }

    try {
        const info = await transporter.sendMail({
            from: `"${process.env.SENDER_NAME || 'Evolvia'}" <${process.env.SMTP_USER}>`,
            to: lead.email,
            subject: subject,
            text: body
        });
        console.log(`[EMAIL SENT] Step ${stepNumber} delivered to ${lead.email} (MsgID: ${info.messageId})`);
        return { success: true, simulated: false, messageId: info.messageId, subject, body };
    } catch (err) {
        console.error(`[EMAIL ERROR] Failed sending to ${lead.email}:`, err.message);
        throw err;
    }
}

// Generate Personalized Pitches for WhatsApp & Cold Email
function getPersonalizedPitches(lead) {
    const company = lead.company || lead.name;
    const city = lead.city || 'your area';
    const industry = (lead.industry || 'Business').toLowerCase();

    // 1. WhatsApp Templates
    const whatsappTemplates = [
        {
            id: 'no_website_audit',
            title: '1. No Website Google Maps Audit (Recommended)',
            text: `Hello *${company}* team! 👋\n\nI was searching for top ${lead.industry || 'local businesses'} in ${city} and found your profile on Google Maps.\n\nI noticed you don't have an official website or direct WhatsApp customer inquiry channel linked to your listing. Because of this, many prospective clients end up choosing competitors nearby.\n\nWe at *Evolvia* built a quick mobile-ready website concept for *${company}* with 1-tap WhatsApp consultation & inquiries.\n\nWould you like me to send you the preview link?`
        },
        {
            id: 'special_offer_24h',
            title: '2. Special Offer: 24h Setup & WhatsApp Inquiry Hub',
            text: `Hi! Hope you are having a productive week.\n\nWe help ${lead.industry || 'local establishments'} in ${city} get 30+ new customer inquiries every month with an ultra-fast 1-page mobile website & automated WhatsApp inquiries.\n\nCan I send a 60-second video demo showing how this would work specifically for *${company}*?`
        },
        {
            id: 'direct_quick_question',
            title: '3. Short & Direct Casual Inquiry',
            text: `Hi *${company}*, are you currently accepting new client inquiries? I came across your Google listing and noticed you don't have a website attached. We can build and launch one for you in 24 hours. Let me know if you'd like to see a draft!`
        }
    ];

    // 2. Email Templates
    const emailTemplates = [
        {
            step: 1,
            title: 'Step 1: Initial Hook & Audit Pitch',
            subject: TEMPLATES[1].subject(company, lead.industry),
            body: TEMPLATES[1].body(lead.name, company, lead.industry, city)
        },
        {
            step: 2,
            title: 'Step 2: Quick Follow-up & 60s Demo',
            subject: TEMPLATES[2].subject(company, lead.industry),
            body: TEMPLATES[2].body(lead.name, company, lead.industry, city)
        },
        {
            step: 3,
            title: 'Step 3: Permission to Close File',
            subject: TEMPLATES[3].subject(company, lead.industry),
            body: TEMPLATES[3].body(lead.name, company, lead.industry, city)
        }
    ];

    return {
        leadId: lead._id,
        company,
        phone: lead.phone,
        email: lead.email,
        whatsappTemplates,
        emailTemplates
    };
}

module.exports = { sendOutreachEmail, TEMPLATES, getPersonalizedPitches };

