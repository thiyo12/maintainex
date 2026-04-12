# Maintainex Website - Complete Guide

---

## About This Website

This is the official website for **Maintainex** - a professional cleaning service company in Sri Lanka.

**Website:** https://maintainex.lk
**Tagline:** Shine Beyond Expectations

The website includes:
- **Public Website** - Customer-facing pages for booking services
- **Admin Panel** - Backend management for bookings, applications, and settings

---

## Quick Start (Development)

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager

### Installation

```bash
# Navigate to project directory
cd ~/Documents/NEWM/maintainex

# Install dependencies
npm install

# Start development server
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## Deployment to Vercel (Recommended)

### Step 1: Prepare for Production

1. Push your code to GitHub:
   ```bash
   cd ~/Documents/NEWM/maintainex
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/username/maintainex.git
   git push -u origin main
   ```

2. Create a Vercel account at https://vercel.com

3. Click "Import Project" and select your GitHub repository

### Step 2: Configure Environment Variables

In Vercel dashboard, add these environment variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `DATABASE_URL` | Your production database URL | PostgreSQL/MySQL connection string |
| `NEXTAUTH_SECRET` | Generate a secure key | Run: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Your production URL | e.g., `https://maintainex.lk` |

### Step 3: Deploy

1. Click "Deploy"
2. Wait for build to complete
3. Your site will be live at the provided URL

### Step 4: Connect Custom Domain

1. Go to Vercel Dashboard → Settings → Domains
2. Add your domain (e.g., `maintainex.lk`)
3. Update DNS records as instructed by Vercel

---

## Deployment to Netlify

### Step 1: Build the Project

```bash
npm run build
```

### Step 2: Deploy

1. Go to https://netlify.com
2. Drag and drop the `out` folder to deploy

**Note:** For database functionality, you'll need a server-side hosting solution like Vercel.

---

## Environment Variables

For production, create a `.env.production` file:

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/maintainex"

# Authentication
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="https://maintainex.lk"

# Optional: Cloudinary for CV uploads
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
```

---

## Admin Access

### Super Admin
- Full access to all features
- Can manage branches, admins, and settings
- Access: `/admin/login`

### Branch Admin
- Limited to their assigned branch
- Can manage bookings and applications for their branch
- Access: `/admin/login`

**Contact the Super Admin to get your login credentials.**

---

## Website Pages

### Public Pages
| Page | URL | Description |
|------|-----|-------------|
| Homepage | `/` | Hero, services overview, stats |
| Services | `/services` | All cleaning services |
| Booking | `/booking` | Book a cleaning service |
| Careers | `/careers` | Job applications |
| Contact | `/contact` | Contact form |
| About | `/about` | Company information |

### Admin Pages
| Page | URL | Description |
|------|-----|-------------|
| Dashboard | `/admin/dashboard` | Stats overview |
| Bookings | `/admin/bookings` | Manage bookings |
| Applications | `/admin/applications` | Job applications |
| Branches | `/admin/branches` | Branch management |
| Admins | `/admin/admins` | Admin user management |
| Services | `/admin/services` | Service catalog |
| Reports | `/admin/reports` | Reports & analytics |
| Settings | `/admin/settings` | Site settings |

---

## Branch Coverage

The system covers all districts across Sri Lanka:

| Branch | Districts |
|--------|-----------|
| Colombo | Colombo, Gampaha, Kalutara |
| Kandy | Kandy, Matale, Nuwara Eliya |
| Southern | Galle, Matara, Hambantota |
| Eastern | Trincomalee, Batticaloa, Ampara |
| Northern | Jaffna, Kilinochchi, Mannar, Vavuniya, Mullaitivu |
| North Western | Kurunegala, Puttalam |
| North Central | Anuradhapura, Polonnaruwa |
| Sabaragamuwa | Ratnapura, Kegalle |
| Uva | Badulla, Monaragala |

---

## Features

### Customer Features
- [x] Browse cleaning services
- [x] Book services online
- [x] Apply for jobs
- [x] Contact form
- [x] WhatsApp integration
- [x] Mobile responsive design

### Admin Features
- [x] Dashboard with stats
- [x] Booking management
- [x] Application tracking
- [x] Branch-based access control
- [x] Service management
- [x] Review moderation
- [x] Reports & analytics
- [x] Maintenance mode toggle
- [x] Super Admin controls

---

## Database Reset

To reset the database with sample data:

```bash
# Reset database schema
npx prisma db push --force-reset

# Seed with sample data
npm run db:seed
```

---

## Troubleshooting

### Website won't load
1. Make sure Node.js is installed
2. Run `npm install`
3. Run `npm run dev`
4. Check for error messages in terminal

### Cannot login to admin
1. Verify credentials are correct
2. Clear browser cache
3. Check if maintenance mode is enabled
4. Contact Super Admin for account issues

### Images not showing
1. Check image URL is correct
2. Ensure image file exists in `/public/uploads/`
3. Verify URL starts with `/` for local files

### Build errors
```bash
# Clear Next.js cache
rm -rf .next

# Rebuild
npm run build
```

---

## File Structure

```
maintainex/
├── app/                    # Next.js app directory
│   ├── (public)/           # Public pages
│   ├── admin/             # Admin panel
│   ├── api/                # API routes
│   └── maintenance/        # Maintenance page
├── components/             # React components
│   ├── admin/              # Admin components
│   ├── layout/             # Header, Footer
│   └── ui/                 # UI components
├── lib/                    # Utilities
│   ├── prisma.ts           # Database client
│   └── auth.ts             # Auth configuration
├── prisma/                 # Database
│   ├── schema.prisma       # Database schema
│   ├── seed.ts             # Sample data
│   └── dev.db              # SQLite database
└── public/                 # Static files
    ├── uploads/            # User uploads
    └── logo.JPEG           # Company logo
```

---

## Security

This website implements security best practices:

- **Authentication:** NextAuth.js with secure session handling
- **Authorization:** Role-based access control (RBAC)
- **Input Validation:** Server-side validation for all forms
- **CSRF Protection:** SameSite cookies
- **Rate Limiting:** Built-in to API routes

### Security Recommendations for Production

1. **Use HTTPS** - Enable SSL on your domain
2. **Environment Variables** - Never commit secrets to git
3. **Database Security** - Use strong database passwords
4. **Regular Updates** - Keep dependencies updated
5. **Monitor Logs** - Check for unusual activity

---

## Contact

For technical support, contact the development team.

---

**Maintainex** - Shine Beyond Expectations
