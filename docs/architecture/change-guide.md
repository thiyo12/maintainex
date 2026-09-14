# Change Guide

How to add new features, API routes, mobile screens, and admin pages to MaintainEX.

---

## Adding a New API Route

### Location

- Mobile API: `app/api/mobile/v2/[resource]/route.ts`
- Admin API: `app/api/admin/[resource]/route.ts`

### Step-by-Step

1. **Create the route file**:

```typescript
// app/api/mobile/v2/my-resource/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookie } from '@/lib/mobile-auth'
import { assertNotSuspended } from '@/lib/mobile-auth'

export async function GET(req: NextRequest) {
  const session = await getSessionFromCookie(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await assertNotSuspended(session.userId)

  // Business logic here
  const data = await prisma.myModel.findMany({
    where: { userId: session.userId },
  })

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookie(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await assertNotSuspended(session.userId)

  const body = await req.json()
  // Validate input (use Zod schema)
  // Create resource
  // Return created resource
}
```

2. **Add input validation** (Zod):

```typescript
import { z } from 'zod'

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  categoryId: z.string().cuid(),
})
```

3. **Add idempotency** (for write routes):

```typescript
const idempotencyKey = req.headers.get('Idempotency-Key')
if (!idempotencyKey) {
  return NextResponse.json({ error: 'Idempotency-Key required' }, { status: 400 })
}
```

4. **Add audit logging** (if modifying company data):

```typescript
import { writeCompanyAuditLog } from '@/lib/phase6/audit'

await writeCompanyAuditLog({
  companyId,
  actorId: session.userId,
  action: 'RESOURCE_CREATED',
  details: JSON.stringify({ resourceId: resource.id }),
})
```

5. **Add the route to `api-reference.md`**.

---

## Adding a New Mobile Screen

### Location

App screens live in `apps/mobile/app/` using Expo Router file-based routing.

### Step-by-Step

1. **Create the screen file**:

```
apps/mobile/app/(customer)/my-feature/
  _layout.tsx       # Layout with header, tab bar
  index.tsx         # Main screen
  detail/[id].tsx   # Detail screen with dynamic route
```

2. **Follow existing patterns**:

```tsx
// apps/mobile/app/(customer)/my-feature/index.tsx
import { View, Text, FlatList } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export default function MyFeatureScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-feature'],
    queryFn: () => api.get('/my-resource').then(r => r.data),
  })

  if (isLoading) return <LoadingSpinner />

  return (
    <FlatList
      data={data}
      renderItem={({ item }) => <FeatureCard item={item} />}
    />
  )
}
```

3. **Add navigation** from existing screens:

```tsx
import { router } from 'expo-router'

router.push('/(customer)/my-feature/detail/123')
```

4. **Add API client methods** if needed (in `apps/mobile/lib/api.ts`).

5. **Test on both iOS and Android** before merging.

---

## Adding a New Admin Page

### Location

Admin pages live in `app/admin/` using Next.js App Router.

### Step-by-Step

1. **Create the page directory**:

```
app/admin/my-feature/
  page.tsx          # Main page
  columns.tsx       # Table column definitions
  actions.tsx       # Server actions
```

2. **Follow existing patterns**:

```tsx
// app/admin/my-feature/page.tsx
import { getAdminSession } from '@/lib/admin-rbac'
import { redirect } from 'next/navigation'

export default async function MyFeaturePage() {
  const session = await getAdminSession()
  if (!session || !session.permissions.includes('my_feature:view')) {
    redirect('/admin')
  }

  return (
    <div>
      <h1>My Feature</h1>
      {/* Table, forms, etc. */}
    </div>
  )
}
```

3. **Add RBAC permission** to `lib/admin-types.ts`:

```typescript
// Add to ROLE_PERMISSIONS for each role that needs access
MANAGER: [
  // ... existing permissions
  'my_feature:view', 'my_feature:manage',
],
```

4. **Add admin API route** if the page needs data:

```
app/api/admin/my-feature/route.ts
```

5. **Add navigation link** in the admin sidebar.

---

## Adding a New Database Model

### Step-by-Step

1. **Add to `prisma/schema.prisma`**:

```prisma
model MyModel {
  id          String   @id @default(cuid())
  name        String
  status      String   @default("ACTIVE")  // UPPER_SNAKE_CASE enum
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId])
  @@index([status])
}
```

2. **Create migration**:

```bash
npx prisma migrate dev --name add_my_model
```

3. **Generate Prisma client**:

```bash
npx prisma generate
```

4. **Update domain logic** in `lib/domain/` if the model has state transitions.

5. **Add to `data-model.md`** documentation.

---

## Adding a New Matching Gate

### Step-by-Step

1. **Define the gate** in `lib/matching/types.ts`:

```typescript
export type MatchExclusionReason =
  | 'EXISTING_REASON'
  | 'NEW_GATE_REASON'  // Add here
```

2. **Implement the gate** in `lib/matching/eligibility.ts`:

```typescript
// Gate N: New condition
if (/* condition fails */) {
  gates.push({ gate: 'NEW_GATE_NAME', passed: false, reason: 'Description' })
  return buildIneligibleResult(gates)
}
gates.push({ gate: 'NEW_GATE_NAME', passed: true })
```

3. **Add unit tests** covering pass and fail scenarios.

4. **Update eligibility documentation** in `matching-engine.md`.

---

## Adding a New Pricing Modifier

### Step-by-Step

1. **Add modifier function** in `lib/pricing/fees.ts`:

```typescript
export function computeMyModifier(basePrice: bigint, params: MyParams): bigint {
  // Calculate modifier
  return modifierAmount
}
```

2. **Integrate** in `lib/pricing/engine.ts`:

```typescript
const myModifier = computeMyModifier(basePrice, input.myParams)
// Apply to total
```

3. **Add to `PriceBreakdown`** type in `lib/pricing/types.ts`.

4. **Update pricing documentation** in `pricing-engine.md`.

---

## Code Review Checklist

Before merging any feature:

- [ ] Input validation (Zod schemas for API routes)
- [ ] Auth check (`getSessionFromCookie` or `getAdminSession`)
- [ ] Suspension check (`assertNotSuspended` for mobile routes)
- [ ] RBAC check (admin routes verify permissions)
- [ ] Idempotency key (write routes)
- [ ] Audit logging (company-affecting operations)
- [ ] Error handling (structured error responses with reason codes)
- [ ] Unit tests for business logic
- [ ] Integration tests for API routes
- [ ] Documentation updated (api-reference.md, data-model.md, or relevant doc)
