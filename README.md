# Rishiraj Media — Print Management Platform (Prinflow)

A high-performance, multi-tenant print project management system built for Rishiraj Media. Manages the complete lifecycle of print collateral — from client onboarding and tenant isolation to project requests, approvals, production, dispatch tracking, and final delivery.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-336791?logo=postgresql)

---

## 🚀 Key Modules & Architecture

### 1. Multi-Tenant Scoping Engine
- **Automated Database Isolation:** Configured via Prisma Client middleware hooks in `src/lib/prisma.ts`. Reads and writes are dynamically scoped to the logged-in Client Admin's `clientId` context.
- **Read-Only SuperAdmin Bounds:** API requests matching mutations (`POST`, `PATCH`, `DELETE`, `PUT`) triggered by a SuperAdmin are blocked with `403 Forbidden` errors to preserve tenant integrity.

### 2. SuperAdmin Administrative Suite (`/superadmin`)
- **Aggregated Executive Dashboard:** Global stats tracking (active client organizations, pending approvals, total transit volume, and aggregated multi-tenant spend).
- **Client Admin Onboarding:** Add new client organizations (stores billing settings, company pan, gst details, company logo to AWS S3, and sends customized Welcome Emails).
- **Organization Toggles:** Suspend/activate client organizations instantly.
- **Global Read-Only Views:** Monitor all active projects, pending approvals, and materials dispatches across all tenant organizations.
- **Advanced Spend Analytics:** Interactive location bar charts, funnel conversions, and branch spend metrics with CSV/Excel exports.

### 3. Client & POC Portal (`/(dashboard)`)
- **Project Requests:** Create and update print projects. Automatically handles item quantities, paper specifications, and dynamic rate card cost calculations.
- **Approval Pipeline:** Multi-level status approval triggers with dynamic Proforma Invoice (PI) PDF generation.
- **Real-Time Dispatch Logs:** Track active shipping orders with tracking IDs, bulk Excel upload matching, and S3-uploaded Proof of Delivery (POD) attachments.
- **Rate Management:** Dynamic client rate cards specifying item base costs and automatic tax compliance calculations (including 18% GST).

---

## 🛠 Tech Stack

- **Core** — [Next.js 16](https://nextjs.org/) (App Router, React Server Components)
- **Database** — [Neon PostgreSQL](https://neon.tech/) (Serverless Cloud Database)
- **ORM** — [Prisma 6](https://www.prisma.io/)
- **Auth** — [NextAuth.js v4](https://next-auth.js.org/) (Role-based: SuperAdmin, Admin, POC)
- **Design** — [Tailwind CSS v4](https://tailwindcss.com/) + Custom CSS
- **Assets** — [AWS S3](https://aws.amazon.com/s3/) (Invoices, logos, and Proofs of Delivery)
- **Real-time** — [Pusher](https://pusher.com/) (Live dashboard notifications)
- **Reports** — jsPDF (PI PDF engine) & ExcelJS (Bulk imports/exports)

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
cp .env.example .env
```

Configure the following variables in `.env`:
- `DATABASE_URL`: Your Neon PostgreSQL connection string
- `NEXTAUTH_SECRET`: Generate using `openssl rand -base64 32`
- `SUPERADMIN_EMAIL`: Initial email for SuperAdmin credentials (e.g. `superadmin@rishirajmedia.com`)
- `SUPERADMIN_PASSWORD`: Initial password for SuperAdmin (e.g. `Superadmin@123`)
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET`: Storage configurations
- `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`: Pusher configurations

### 3. Database Initialization

```bash
# Push schema changes to Neon
npx prisma db push

# Generate client types
npx prisma generate

# Seed initial data (Creates default SuperAdmin account and setup rates)
npm run db:seed
```

### 4. Launch

```bash
npm run dev
```

Visit `http://localhost:3000` to start. Login using your SuperAdmin credentials or registered client credentials.

---

## 📁 Project Structure

```bash
SuperAdmin-Printflow/
├── prisma/             # Schema & Seed Scripts
├── public/             # Branding Assets (Rishiraj Media Logos)
├── src/
│   ├── app/            # App Router (Next.js 16)
│   │   ├── (dashboard) # Client Admin Portal Layout & Pages
│   │   ├── superadmin/ # SuperAdmin Namespace Layout & Pages
│   │   ├── api/        # REST Endpoints (Scoping, Onboarding, Dispatch APIs)
│   │   └── login/      # Auth Entrance (Rishiraj Media Branded Page)
│   ├── components/     # UI, Layouts & Feature Components
│   │   ├── layout/     # Sidebars, TopBars, and Dashboard shells
│   │   ├── superadmin/ # Onboarding Forms & Filters
│   │   └── ui/         # Status badges and material components
│   ├── lib/            # Prisma engine, auth options, and email client configs
│   ├── types/          # TypeScript definitions
│   └── utils/          # Invoicing, calculations, and Excel helpers
└── .env.example        # Environment Template
```

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

MIT — Copyright (c) 2026 Rishiraj Media Print Management Team. Free to use and modify.
