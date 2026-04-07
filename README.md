# Maintainex Website - Simple Guide

---

## What is This Website?

This is the website for **Maintainex** - a professional cleaning service company in Sri Lanka.

The website has two parts:
1. **Customer Website** - Where customers can see services and book cleaning
2. **Admin Panel** - Where you manage bookings, applications, and settings

---

## How to Start the Website

### Step 1: Open Terminal
Press `Cmd + Space` and search for "Terminal"

### Step 2: Go to Website Folder
```bash
cd ~/Documents/NEWM/maintainex
```

### Step 3: Start the Website
```bash
npm run dev
```

### Step 4: Open in Browser
Go to: **http://localhost:3000**

---

## How to Login

### For Super Admin (Full Access)
- **Email:** super@maintainex.com
- **Password:** super123

### For Branch Admin (Limited Access)
- **Email:** admin@maintainex.com
- **Password:** admin123

**Login Page:** http://localhost:3000/admin/login

---

## Website Pages (What Customers See)

| Page | What It Does |
|------|-------------|
| Homepage | Main page with company info |
| Services | Lists all cleaning services |
| Booking | Form to book cleaning service |
| Careers | Form to apply for jobs |
| Contact | Contact form and info |
| About | About the company |

---

## Admin Panel Pages (What You Manage)

| Page | What It Does |
|------|-------------|
| Dashboard | Shows all stats |
| Bookings | See and manage customer bookings |
| Applications | See job applications |
| Branches | Manage company branches |
| Admins | Manage admin users |
| Services | Add/edit services |
| Reports | View reports and export |
| Settings | Change company info |

---

## Common Tasks (No Coding Needed)

### Change Company Phone/Email/Address
1. Login as Super Admin
2. Click **Settings** in the menu
3. Change the info
4. Click **Save**

### Add New Service
1. Login as Super Admin or Branch Admin
2. Click **Services** in the menu
3. Click **Add Service**
4. Fill in:
   - Service Name (e.g., "Deep Cleaning")
   - Description
   - Price (e.g., 5000)
   - Select Category (Home Cleaning or Industrial Cleaning)
5. Click **Create**

### Add New Admin User
1. Login as Super Admin
2. Click **Branches** in the menu
3. Click **Profile** on any branch
4. Click **Admins** tab
5. Click **Add Admin**
6. Enter email, password, and name
7. Click **Create**

---

## Where Files Are Located

### Customer Website Pages
| Page | File Location |
|------|--------------|
| Homepage | `app/page.tsx` |
| Services | `app/(public)/services/page.tsx` |
| Booking | `app/(public)/booking/page.tsx` |
| Careers | `app/(public)/careers/page.tsx` |
| Contact | `app/(public)/contact/page.tsx` |
| About | `app/(public)/about/page.tsx` |

### Admin Panel Pages
| Page | File Location |
|------|--------------|
| Dashboard | `app/admin/dashboard/page.tsx` |
| Bookings | `app/admin/bookings/page.tsx` |
| Applications | `app/admin/applications/page.tsx` |
| Branches | `app/admin/branches/page.tsx` |
| Admins | `app/admin/admins/page.tsx` |
| Services | `app/admin/services/page.tsx` |
| Reports | `app/admin/reports/page.tsx` |
| Settings | `app/admin/settings/page.tsx` |

### Important Folders
| Folder | What It Contains |
|--------|-----------------|
| `app/` | All website pages |
| `components/` | Reusable parts (header, footer, buttons) |
| `prisma/` | Database setup |
| `lib/` | Helper functions |

---

## How to Change Photos

### Step 1: Find the Image URL
Look for lines starting with `src=` in the page file

### Step 2: Replace the URL
Copy a new image URL from Unsplash and replace the old one

### Example:
**Before:**
```
src="https://images.unsplash.com/photo-old"
```

**After:**
```
src="https://images.unsplash.com/photo-new"
```

### Where to Get Free Images
Go to: **https://unsplash.com**
Search for: "cleaning service", "home cleaning", "office cleaning"
Copy the image URL

---

## How the Branch System Works

The website has **9 branches** covering all of Sri Lanka:

| Branch Name | Districts Covered |
|-------------|------------------|
| Jaffna | Jaffna, Kilinochchi, Mannar, Vavuniya, Mullaitivu |
| Colombo | Colombo, Gampaha, Kalutara |
| Kandy | Kandy, Matale, Nuwara Eliya |
| Southern | Galle, Matara, Hambantota |
| Eastern | Trincomalee, Batticaloa, Ampara |
| North Western | Kurunegala, Puttalam |
| North Central | Anuradhapura, Polonnaruwa |
| Sabaragamuwa | Ratnapura, Kegalle |
| Uva | Badulla, Monaragala |

### How Bookings Work:
1. Customer selects their district when booking
2. System automatically assigns booking to the correct branch
3. Branch admin can only see bookings from their area

---

## Admin Permissions

### Super Admin (super@maintainex.com)
- Can see ALL bookings and applications from ALL branches
- Can add/edit/delete branches
- Can add/edit/delete admin users
- Can change company settings
- Can reassign bookings to different branches

### Branch Admin (admin@maintainex.com)
- Can only see bookings and applications from their branch
- Can update booking status
- Cannot change branches or settings

---

## Database (Where Data is Stored)

The website stores data in a file called `dev.db` in the `prisma` folder.

### Reset Database
If you need to start fresh:
```bash
npx prisma db push --force-reset
npm run db:seed
```

### Add Sample Data
```bash
npm run db:seed
```

---

## Troubleshooting

### Website won't load
1. Make sure you ran: `npm install`
2. Then run: `npm run dev`
3. Check if Node.js is installed

### Cannot login
1. Make sure you ran: `npm run db:seed`
2. Check email and password are correct
3. Default login: super@maintainex.com / super123

### Images not showing
1. Check if the image URL is correct
2. Make sure the URL starts with `https://`
3. Try a different image URL

### Build errors
Run this to check for errors:
```bash
npm run build
```

---

## Need to Change Something?

### If you need to change text on the website:
1. Find the page file (see table above)
2. Find the text you want to change
3. Change the text
4. Save the file
5. Refresh the website

### If you need to change colors:
1. Find the file: `tailwind.config.ts`
2. Change the color codes
3. Save the file
4. Refresh the website

---

## Contact for Help

If you need technical help, contact the developer who built this website.

---

**Built for Maintainex - Shine Beyond Expectations**
