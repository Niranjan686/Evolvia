# Evolvia Backend & Autonomous CRM Engine

A full-stack Node.js + Express + MongoDB CRM backend with automated AI lead extraction, source tracking, and daily multi-step follow-up scheduling.

---

## 🚀 Key Features

1. **MongoDB Database Architecture**:
   - Stores leads with: `Name`, `Company`, `Email`, `Phone`, `Source Name`, `Status`, `Pipeline Step`, `Last Contact Date`, `Next Follow-Up Date`, and a complete historical interaction audit log.
2. **AI Lead Extraction in Admin Panel**:
   - Form in the Admin UI allows you to specify target `Industry`, `Location`, `Source Name Tag` (e.g., *Google Maps Miami*, *Apollo.io*, *Website Inbound*), and lead count.
   - Extracts verified business contacts and saves them straight into MongoDB with deduplication.
3. **Automated Daily Follow-Up Engine (node-cron)**:
   - Runs automatically every morning at 09:00 AM (or on-demand with one click).
   - Scans leads where `nextFollowUpDate <= today`, sends Step 2 or Step 3 follow-ups, and logs interactions to the audit trail.
4. **Interactive Vue.js Admin Dashboard (`admin.html`)**:
   - Filter leads by **Source Name** and **Status**.
   - Live KPI cards: Total Leads, Active Sequences, Due Today, Replied.
   - Manual controls: Send Pitch, Mark Replied, View Interaction History.

---

## 🛠️ Getting Started

### 1. Start MongoDB
Make sure MongoDB is running locally:
```powershell
mongod
```
*(Or set `MONGODB_URI` in `.env` to your free MongoDB Atlas cloud cluster).*

### 2. Configure Email (Optional)
In `.env`:
```env
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
```
*(If left as default, the server runs in safe **Simulation Mode**—logging emails to the console and MongoDB without sending real messages).*

### 3. Start the Backend Server
```powershell
cd evolvia_backend
npm start
```

### 4. Access the Dashboard
- **Admin Command Center**: [http://localhost:4000/admin.html](http://localhost:4000/admin.html)
- **Public Company Website**: [http://localhost:4000](http://localhost:4000)
- **REST API Endpoints**: [http://localhost:4000/api/leads](http://localhost:4000/api/leads)
