# Admin Panel Use Cases

## Actors & Hierarchy

```
Website SUPER ADMIN (Admin model - web panel)
  └── Manages: services, bookings, branches, customers, invoices, etc.
  └── Can CREATE/DELETE/SUSPEND App SUPER ADMINs
      └── App SUPER ADMIN (AdminUser model - marketplace panel)
            ├── Can CREATE/EDIT/DELETE App ADMINs (assigned countries)
            ├── Can CREATE/EDIT/DELETE MODERATORs (no finance)
            ├── Can CREATE/EDIT/DELETE SUPPORT (read-only)
            └── Full access to marketplace features

App ADMIN: assigned countries filter, no audit logs
App MODERATOR: no escrow/finance, can manage KYC/categories/jobs
App SUPPORT: read-only on users/KYC/jobs, no finance/categories/admins/audit
```

## Login Flow

```
POST /api/auth/login
  → Check Admin table (email)
    → Match → verify password → set cookie + localStorage → redirect /admin/dashboard
  → Check AdminUser table (email)
    → Match → verify password → set cookie + localStorage → redirect /admin/marketplace/dashboard
  → Neither → 401
```

## Use Cases

### UC1: Website SUPER ADMIN creates App SUPER ADMIN
- **Actor:** Website SUPER ADMIN
- **Precondition:** Logged in as SUPER_ADMIN in Admin table
- **Flow:**
  1. Navigate to `/admin/app-admins`
  2. Click "Create App Super Admin"
  3. Fill: email, name, password (auto-generated)
  4. Submit → creates AdminUser record with role=SUPER_ADMIN, parentId=null
  5. Show auto-generated password
- **Postcondition:** New App SUPER ADMIN can login via same login page

### UC2: App SUPER ADMIN manages sub-admins
- **Actor:** App SUPER ADMIN
- **Precondition:** Logged in as AdminUser with role SUPER_ADMIN
- **Flow:**
  1. Navigate to `/admin/marketplace/admin-users`
  2. View all sub-admins (parentId = current admin's id)
  3. Create new: assign role (ADMIN/MODERATOR/SUPPORT), countries, name, email, auto-generated password
  4. Edit: role, countries, active status
  5. Delete: soft-delete
- **Postcondition:** Sub-admin can login with same login page

### UC3: App admin logs in
- **Actor:** Any AdminUser
- **Precondition:** Account exists, isActive=true, deletedAt=null
- **Flow:**
  1. Go to `/admin/login`
  2. Enter email + password
  3. Server checks Admin table → no match
  4. Server checks AdminUser table → match
  5. Creates custom auth token (same format as Admin tokens, but with adminUser prefix)
  6. Sets cookie + localStorage
  7. Redirect to `/admin/marketplace/dashboard`
- **Postcondition:** Session active, marketplace sidebar visible

### UC4: View marketplace users list
- **Actor:** App SUPER ADMIN, ADMIN, MODERATOR, SUPPORT (read-only)
- **Flow:**
  1. Navigate to `/admin/marketplace/users`
  2. See paginated table with search/filter
  3. SUPER ADMIN/ADMIN/MODERATOR: can suspend/ban
  4. SUPPORT: view only

### UC5: Review KYC
- **Actor:** App SUPER ADMIN, ADMIN, MODERATOR
- **Flow:**
  1. Navigate to `/admin/marketplace/kyc`
  2. Filter by status (default PENDING)
  3. Click document → modal with image preview
  4. Approve or reject
  5. Audit log created

### UC6: Manage escrows
- **Actor:** App SUPER ADMIN, ADMIN
- **Flow:**
  1. Navigate to `/admin/marketplace/escrow`
  2. View escrows tab (filterable by status)
  3. Release (to provider) or Refund (to customer)
  4. View disputes tab

### UC7: Force cancel job
- **Actor:** App SUPER ADMIN, ADMIN
- **Flow:**
  1. Navigate to `/admin/marketplace/jobs`
  2. Click job → detail page
  3. Click "Force Cancel" → confirm → status=CANCELLED, isActive=false
  4. Audit log created

### UC8: Manage categories
- **Actor:** App SUPER ADMIN, ADMIN, MODERATOR
- **Flow:**
  1. Navigate to `/admin/marketplace/categories`
  2. List all with drag-order, color, countries
  3. Create/Edit/Soft-delete

### UC9: Update platform settings
- **Actor:** App SUPER ADMIN only
- **Flow:**
  1. Navigate to `/admin/marketplace/settings`
  2. Edit: platform fee (bps), min/max job amount, escrow release days, support email
  3. Save → audit log

### UC10: View audit logs
- **Actor:** App SUPER ADMIN, ADMIN
- **Flow:**
  1. Navigate to `/admin/marketplace/audit-logs`
  2. Filter by action, table
  3. Click row with diff → modal showing old/new JSON

### UC11: Export reports CSV
- **Actor:** App SUPER ADMIN, ADMIN, MODERATOR, SUPPORT
- **Flow:**
  1. Navigate to `/admin/marketplace/reports`
  2. Click "Export Users CSV" / "Export Jobs CSV" / "Export Transactions CSV"
  3. File downloads

## Role-Access Matrix (Marketplace Pages)

| Page | SUPER_ADMIN | ADMIN | MODERATOR | SUPPORT |
|------|:-----------:|:-----:|:---------:|:-------:|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Users List | ✅ | ✅ | ✅ | ✅ (read) |
| User Detail | ✅ | ✅ | ✅ (act) | ✅ (read) |
| KYC Review | ✅ | ✅ | ✅ | ❌ |
| KYC Approve/Reject | ✅ | ✅ | ✅ | ❌ |
| Jobs List | ✅ | ✅ | ✅ | ✅ (read) |
| Job Detail | ✅ | ✅ | ✅ | ✅ (read) |
| Force Cancel Job | ✅ | ✅ | ❌ | ❌ |
| Escrow List | ✅ | ✅ | ❌ | ❌ |
| Release/Refund | ✅ | ✅ | ❌ | ❌ |
| Disputes List | ✅ | ✅ | ❌ | ❌ |
| Categories CRUD | ✅ | ✅ | ✅ | ❌ |
| Reports | ✅ | ✅ | ✅ | ✅ (read) |
| CSV Export | ✅ | ✅ | ✅ | ✅ |
| Platform Settings | ✅ | ❌ | ❌ | ❌ |
| Admin Users (sub-admins) | ✅ | ❌ | ❌ | ❌ |
| Audit Logs | ✅ | ✅ | ❌ | ❌ |

## Implementation Order
1. Prisma: Add parentId to AdminUser → push DB
2. Auth: Update login API to check both tables
3. Website: Create /admin/app-admins page + API
4. Middleware: Handle mktplace routes
5. Sidebar: Add App Management for website SUPER ADMIN
6. Marketplace: Create layout + sidebar for app admins
7. Marketplace: Port API routes
8. Marketplace: Port pages
9. Cleanup: Remove apps/admin-web/
10. Verify: Build + check all routes
