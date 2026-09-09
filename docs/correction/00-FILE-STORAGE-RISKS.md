# MaintainEX File Storage Risks

## Upload Routes

| Route | Auth | Storage | Max Size | Risk |
|---|---|---|---|---|
| `POST /api/upload/cv` | NONE | `uploads/cvs/` | 10MB | P0 — unauthenticated |
| `POST /api/upload/images` | YES | `uploads/images/` | varies | P2 — disk filling |
| `POST /api/upload/cv-company` | YES | `uploads/cvs/` | varies | P2 — disk filling |
| `POST /api/files/share` | YES | `uploads/shared/` or Cloudinary | varies | P2 — disk filling |

## Static File Serving

| Route | Auth | Traversal | Risk |
|---|---|---|---|
| `GET /api/files/[...path]` | NONE | **YES** | P0 — .env exfiltration |
| `GET /api/files/images/[...path]` | YES (admin) | No (regex check) | P2 |
| `GET /api/shared/[token]` | NONE (token) | Possible | P2 |

## Path Traversal Vulnerability (P0)

**File:** `app/api/files/[...path]/route.ts`

```typescript
const decodedPath = decodeURIComponent(params.path.join('/'))
// No validation! Craft URL: /api/files/../../.env
const filePath = path.join(process.cwd(), 'uploads', decodedPath)
// Resolves to: /app/../../.env → /app/.env
```

**Attack:** `GET /api/files/../../.env` exfiltrates:
- `DATABASE_URL` (with credentials)
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `NEXTAUTH_SECRET`
- `PASSWORD_PEPPER`
- `CRON_SECRET`

**Fix:** Validate `decodedPath` doesn't contain `..` or start with `/`.

## Client-Side Upload Functions

| Function | File | Auth | Traversal |
|---|---|---|---|
| `uploadFile()` | `lib/api.ts` | YES | No (uses API) |
| `uploadFilePublic()` | `lib/api.ts` | NO | No (uses API) |
| `cleanUpTempPhotos()` | `lib/api.ts` | YES | No (uses API) |

## Recommendations

1. **P0:** Add path traversal protection to `/api/files/[...path]`
2. **P0:** Add authentication to `/api/files/[...path]`
3. **P1:** Add file size limits per user (per-day)
4. **P1:** Add rate limiting to upload endpoints
5. **P2:** Consider moving uploads to cloud storage (S3/Cloudinary)
