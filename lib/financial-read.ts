import { prisma } from './prisma';

export interface CanonicalWalletBalance {
  walletId: string;
  walletType: 'PROVIDER' | 'CUSTOMER';
  // Canonical public/read-layer amounts are always minor units.
  balance: bigint;
  availableBalance: bigint;
  pendingBalance: bigint;
  version: number;
}

function majorNumberToMinor(value: number): bigint {
  if (!Number.isFinite(value)) throw new Error('Invalid wallet balance');
  return BigInt(Math.round(value * 100));
}

async function queryWalletBalance(
  userId: string,
  walletType: string
): Promise<CanonicalWalletBalance | null> {
  const table = walletType === 'PROVIDER' ? 'ProviderWallet' : 'CustomerWallet';
  const rows = await prisma.$queryRawUnsafe<Array<{
    walletId: string;
    walletType: string;
    balance: number;
    availableBalance: number;
    pendingBalance: number;
    version: number;
  }>>(
    `SELECT wb."walletId", wb."walletType", wb.balance, wb."availableBalance", wb."pendingBalance", wb.version
     FROM "WalletBalance" wb
     INNER JOIN "${table}" w ON w.id = wb."walletId"
     WHERE w."userId" = $1 AND wb."walletType" = $2
     LIMIT 1`,
    userId, walletType
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    walletId: row.walletId,
    walletType: row.walletType as 'PROVIDER' | 'CUSTOMER',
    balance: majorNumberToMinor(row.balance),
    availableBalance: majorNumberToMinor(row.availableBalance),
    pendingBalance: majorNumberToMinor(row.pendingBalance),
    version: row.version,
  };
}

export async function readCanonicalProviderBalance(
  userId: string
): Promise<CanonicalWalletBalance | null> {
  return queryWalletBalance(userId, 'PROVIDER');
}

export async function readCanonicalCustomerBalance(
  userId: string
): Promise<CanonicalWalletBalance | null> {
  return queryWalletBalance(userId, 'CUSTOMER');
}

export async function readLegacyProviderBalance(userId: string): Promise<number | null> {
  const wallet = await prisma.providerWallet.findUnique({
    where: { userId },
    select: { availableBalance: true, pendingBalance: true },
  });
  return wallet ? wallet.availableBalance : null;
}

export async function readLegacyCustomerBalance(userId: string): Promise<number | null> {
  const wallet = await prisma.customerWallet.findUnique({
    where: { userId },
    select: { balance: true },
  });
  return wallet ? wallet.balance : null;
}

export function legacyToCanonicalMinor(legacyBalance: number): bigint {
  return majorNumberToMinor(legacyBalance);
}

export async function reconcileWalletBalance(
  userId: string,
  walletType: 'PROVIDER' | 'CUSTOMER'
): Promise<{
  canonical: CanonicalWalletBalance | null;
  legacy: number | null;
  canonicalMinor: bigint;
  legacyMinor: bigint;
  matched: boolean;
}> {
  const canonical = walletType === 'PROVIDER'
    ? await readCanonicalProviderBalance(userId)
    : await readCanonicalCustomerBalance(userId);

  const legacy = walletType === 'PROVIDER'
    ? await readLegacyProviderBalance(userId)
    : await readLegacyCustomerBalance(userId);

  const canonicalMinor = canonical ? canonical.balance : 0n;
  const legacyMinor = legacy !== null ? legacyToCanonicalMinor(legacy) : 0n;

  return {
    canonical,
    legacy,
    canonicalMinor,
    legacyMinor,
    matched: canonicalMinor === legacyMinor,
  };
}
