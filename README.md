# Axis Management — Print Lifecycle Platform

A high-performance print project management system built for Axis. Manages the complete lifecycle of print collateral — from initial request and multi-level approval to production, dispatch tracking, and final delivery.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-336791?logo=postgresql)

---

## 🚀 Features

| Module | Description |
|---|---|
| **Authentication** | Secure role-based access (Admin / POC) via NextAuth.js |
| **Project Engine** | Full CRUD for print projects with support for multiple collateral types per project |
| **Approval Workflow** | Streamlined review process with status tracking and automated reminders |
| **Smart Dispatch** | Bulk courier data integration via Excel, real-time tracking IDs, and POD management |
| **Digital Vault** | AWS S3-powered storage for POs, Challans, and Tax Invoices |
| **Dynamic Rate Card** | Real-time pricing management for different paper types and print quantities |
| **Team Hub** | Centralized user management with status toggles and role assignments |
| **Advanced Analytics** | Interactive Recharts visualizations for spend analysis and volume trends |
| **Export Engine** | Professional PDF reports and Excel exports with branded headers |
| **Tax Compliance** | Automatic 18% GST calculation and formatted invoicing logic |

---

## 🛠 Tech Stack

- **Core** — [Next.js 16](https://nextjs.org/) (App Router, React Server Components)
- **Database** — [Neon PostgreSQL](https://neon.tech/) (Serverless)
- **ORM** — [Prisma 6](https://www.prisma.io/)
- **Auth** — [NextAuth.js v4](https://next-auth.js.org/)
- **Design** — [Tailwind CSS v4](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/)
- **Assets** — [AWS S3](https://aws.amazon.com/s3/) (Documents & PODs)
- **Real-time** — [Pusher](https://pusher.com/) (Notifications)
- **Reports** — jsPDF & ExcelJS

---

## 🏁 Getting Started

### Prerequisites

- Node.js 18+ (Node 20+ recommended)
- A Neon PostgreSQL instance
- An AWS S3 Bucket and IAM credentials

### 1. Clone & Install

```bash
git clone https://github.com/YawarHussain672/SuperAdmin-Printflow.git
cd SuperAdmin-Printflow
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env.local
```

Configure the following in `.env.local`:
- `DATABASE_URL`: Your Neon connection string
- `NEXTAUTH_SECRET`: Generate using `openssl rand -base64 32`
- `AWS_*`: Your S3 bucket and IAM credentials
- `PUSHER_*`: (Optional) For real-time updates

### 3. Database Initialization

```bash
# Push schema to database
npx prisma db push

# Generate Prisma client
npx prisma generate

# Seed initial data (Admin, POCs, Rates)
npm run db:seed
```

### 4. Launch

```bash
npm run dev
```

Visit `http://localhost:3000` to start.

---

## 📁 Project Structure

```bash
SuperAdmin-Printflow/
├── prisma/             # Schema & Seeding
├── public/             # Static Assets & Templates
├── src/
│   ├── app/            # App Router (Next.js 16)
│   │   ├── (dashboard) # Protected Layout
│   │   ├── api/        # REST Endpoints
│   │   └── login/      # Auth Entrance
│   ├── components/     # UI & Feature Components
│   ├── lib/            # Shared Configurations
│   ├── types/          # TypeScript Definitions
│   └── utils/          # Logic Helpers & Formatters
└── .env.example        # Environment Template
```

---

## 🚢 Deployment

### Vercel Integration

1. Connect this repo to [Vercel](https://vercel.com).
2. The `postinstall` script handles Prisma generation automatically.
3. Configure Environment Variables in the Vercel Dashboard.
4. Set `NEXTAUTH_URL` to your production domain.

---

## 📊 Excel Dispatch Format

Ensure your Excel file follows this structure for bulk dispatch uploads:

| Column | Required | Example |
|---|---|---|
| Project ID | ✅ | `PRJ-2026-100` |
| Courier | ✅ | `Blue Dart` |
| Tracking ID | ✅ | `BD123456789` |
| Tracking URL | ⬜ | `https://bluedart.com/tracking` |
| Dispatch Date | ⬜ | `2026-04-17` |
| Expected Delivery | ⬜ | `2026-04-20` |
| Notes | ⬜ | `Handle with care` |

*Note: Column headers are case-insensitive. Template available in the Dispatch module. Supports `.xlsx`, `.xls`, and `.csv`.*

---

## 📄 License

MIT — Copyright (c) 2026 Axis Print Management Team. Free to use and modify.
