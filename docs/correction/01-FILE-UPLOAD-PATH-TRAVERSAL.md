# MaintainEX File Upload & Path Traversal Audit

## Upload Routes

### 1. POST `/api/upload/cv` (P0)
**File:** `app/api/upload/cv/route.ts`
**Auth:** NONE
**Max size:** 10MB
**Types:** PDF only
**Storage:** Local filesystem `uploads/cvs/`
**Attack:** Anyone can upload unlimited files (no auth, no rate limit)
**CV validation:** Basic check — looks for "curriculum vitae" in text (bypassable)

### 2. POST `/api/upload/images` (P2)
**File:** `app/api/upload/images/route.ts`
**Auth:** YES (mobile JWT)
**Storage:** Local filesystem `uploads/images/`
**Attack:** Authenticated user can fill disk

### 3. POST `/api/upload/cv-company`
**File:** `app/api/upload/cv-company/route.ts`
**Storage:** `uploads/cvs/{filename}-{date}.pdf`
**Attack:** Unrestricted storage consumption

### 4. POST `/api/files/share`
**File:** `app/api/files/share/route.ts`
**Auth:** YES
**Storage:** Local `uploads/shared/` or Cloudinary
**Attack:** Authenticated user can store files

## Static File Serving — PATH TRAVERSAL (P0)

### GET `/api/files/[...path]` (P0)
**File:** `app/api/files/[...path]/route.ts`
**Auth:** NONE
**Storage:** `path.join(process.cwd(), 'uploads', decodedPath)`

**Path traversal vulnerability:**
```typescript
const decodedPath = decodeURIComponent(params.path.join('/'))
// No validation! Craft URL: /api/files/../../.env
// Decoded: ../../.env
// Full path: /app/../../.env → /app/.env
```

**Attack:** `GET /api/files/../../.env` exfiltrates:
- `DATABASE_URL` (with credentials)
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `NEXTAUTH_SECRET`
- `PASSWORD_PEPPER`
- `CRON_SECRET`

**This is the single most critical vulnerability in the entire application.**

### GET `/api/files/images/[...path]` (P1)
**File:** `app/api/files/images/[...path]/route.ts`
**Auth:** YES (admin)
**Storage:** `uploads/images/`
**Mitigation:** Has regex check `^[a-zA-Z0-9._-]+$` — blocks traversal

### GET `/api/shared/[token]` (P2)
**File:** `app/api/shared/[token]/route.ts`
**Auth:** NONE (token-based)
**Attack:** Read-only traversal possible (files served with MIME detection)

## Client-Side Upload Functions

| Function | File | Auth | Traversal |
|---|---|---|---|
| `uploadFile()` | `lib/api.ts` | YES | No (uses API) |
| `uploadFilePublic()` | `lib/api.ts` | NO | No (uses API) |
| `cleanUpTempPhotos()` | `lib/api.ts` | YES | No (uses API) |

## Recommendations

1. **P0:** Add path traversal protection to `/api/files/[...path]` — validate `decodedPath` doesn't contain `..` or starts with `/`
2. **P0:** Add authentication to `/api/files/[...path]` — at minimum require login
3. **P1:** Add file size limits per user (per-day) to prevent disk filling
4. **P1:** Add rate limiting to upload endpoints
5. **P2:** Consider moving uploads to cloud storage (S3/Cloudinary) entirely
