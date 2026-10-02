const cron = require('node-cron');
const DBManager = require('./dbManager');
const { sendOutreachEmail } = require('./emailService');
require('dotenv').config();

const FOLLOW_UP_DAYS = parseInt(process.env.FOLLOW_UP_INTERVAL_DAYS || '3');

async function runDailyFollowUpCycle() {
    console.log(`\n[CRON TRIGGER] === Starting Daily Follow-Up Scan at ${new Date().toISOString()} ===`);
    const dueLeads = await DBManager.getDueFollowUps();
    console.log(`[FOLLOW-UP SCAN] Found ${dueLeads.length} leads due for next outreach step.`);

    let successCount = 0;
    let errorCount = 0;

    for (const lead of dueLeads) {
        try {
            const nextStep = (lead.step || 1) + 1;
            console.log(`  -> Following up with ${lead.name} (${lead.company}) - Step ${nextStep}...`);

            const result = await sendOutreachEmail(lead, nextStep);

            lead.step = nextStep;
            lead.status = nextStep === 2 ? 'STEP_2_SENT' : 'STEP_3_SENT';
            lead.lastContactDate = new Date().toISOString();

            if (nextStep < 3) {
                const futureDate = new Date();
                futureDate.setDate(futureDate.getDate() + FOLLOW_UP_DAYS);
                lead.nextFollowUpDate = futureDate.toISOString();
            } else {
                lead.nextFollowUpDate = null;
            }

            if (!lead.history) lead.history = [];
            lead.history.push({
                date: new Date().toISOString(),
                action: `FOLLOWUP_STEP_${nextStep}_SENT`,
                type: 'EMAIL',
                subject: result.subject,
                details: `Automated follow-up step ${nextStep} sent on schedule.`
            });

            await DBManager.saveLead(lead);
            successCount++;
        } catch (err) {
            console.error(`  [ERROR] Follow-up failed for ${lead.email}:`, err.message);
            errorCount++;
        }
    }

    console.log(`[CRON COMPLETE] Processed: ${dueLeads.length} | Sent: ${successCount} | Errors: ${errorCount}\n`);
    return { totalDue: dueLeads.length, success: successCount, errors: errorCount };
}

function startCronScheduler() {
    console.log('[CRON SERVICE] Initializing daily 9:00 AM follow-up scheduler...');
    cron.schedule('0 9 * * *', async () => {
        await runDailyFollowUpCycle();
    });
}

module.exports = { runDailyFollowUpCycle, startCronScheduler };
