#!/usr/bin/env bash
# Phase 11: aggregate-only provider-coverage evidence, never a deployment.
set -euo pipefail

if [[ -z "${MAINTAINEX_READONLY_DATABASE_URL:-}" ]]; then
  echo "ERROR: provide MAINTAINEX_READONLY_DATABASE_URL for a dedicated read-only account" >&2
  exit 2
fi
if [[ "${MAINTAINEX_READONLY_DATABASE_URL}" == "${DATABASE_URL:-}" ]]; then
  echo "ERROR: refusing DATABASE_URL; provide a separate read-only connection" >&2
  exit 2
fi
if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: PostgreSQL psql client is required" >&2
  exit 2
fi

# Enforce read-only transactions server-side, even for an overprivileged role.
export PGOPTIONS="${PGOPTIONS:+${PGOPTIONS} }-c default_transaction_read_only=on -c statement_timeout=30000"
echo "MaintainEX launch readiness: aggregate-only provider coverage"
echo "LK: all 25 districts. CA: City of Vancouver ONLY."
echo "District counts measure EXPLICIT named service-area declarations only."
echo "Market totals count eligible profiles; radius counts are separate."
echo "This is NOT proof of geospatial matchability, real availability or launch approval."
psql --dbname="$MAINTAINEX_READONLY_DATABASE_URL" --no-psqlrc --set=ON_ERROR_STOP=1 --pset=pager=off <<'SQL'
BEGIN TRANSACTION READ ONLY;
WITH
markets(market) AS (
  VALUES ('LK'::text), ('CA'::text)
),
districts(market, district) AS (
  VALUES
    ('LK','Ampara'), ('LK','Anuradhapura'), ('LK','Badulla'),
    ('LK','Batticaloa'), ('LK','Colombo'), ('LK','Galle'),
    ('LK','Gampaha'), ('LK','Hambantota'), ('LK','Jaffna'),
    ('LK','Kalutara'), ('LK','Kandy'), ('LK','Kegalle'),
    ('LK','Kilinochchi'), ('LK','Kurunegala'), ('LK','Mannar'),
    ('LK','Matale'), ('LK','Matara'), ('LK','Monaragala'),
    ('LK','Mullaitivu'), ('LK','Nuwara Eliya'), ('LK','Polonnaruwa'),
    ('LK','Puttalam'), ('LK','Ratnapura'), ('LK','Trincomalee'),
    ('LK','Vavuniya'), ('CA','Vancouver')
),
eligible AS (
  SELECT
    'INDIVIDUAL'::text AS provider_kind, t.id AS provider_id,
    t."countryCode" AS market, t."serviceAreas" AS service_areas,
    (t.latitude IS NOT NULL AND t.longitude IS NOT NULL
      AND t."serviceRadius" IS NOT NULL AND t."serviceRadius" > 0) AS has_radius
  FROM "TaskerProfile" t
  JOIN "User" u ON u.id = t."userId"
  WHERE u."countryCode" IN ('LK', 'CA')
    AND t."countryCode" = u."countryCode"
    AND u."isActive" = TRUE AND u."isSuspended" = FALSE
    AND u."isBanned" = FALSE AND u."identityStatus" = 'VERIFIED'
    AND t."isVerified" = TRUE AND t."verificationStatus" = 'VERIFIED'
    AND (
      EXISTS (
        SELECT 1
        FROM regexp_split_to_table(
          translate(COALESCE(t.skills, ''), '[]"{}', ''), ','
        ) AS capability(token)
        WHERE btrim(capability.token) <> ''
      )
      OR EXISTS (SELECT 1 FROM "TaskerSkill" ts WHERE ts."taskerId" = t.id)
    )
  UNION ALL
  SELECT
    'COMPANY'::text, c.id, c."countryCode", c."serviceAreas",
    (c.latitude IS NOT NULL AND c.longitude IS NOT NULL
      AND c."serviceRadius" IS NOT NULL AND c."serviceRadius" > 0)
  FROM "CompanyProfile" c
  JOIN "User" u ON u.id = c."userId"
  WHERE u."countryCode" IN ('LK', 'CA')
    AND c."countryCode" = u."countryCode"
    AND u."isActive" = TRUE AND u."isSuspended" = FALSE
    AND u."isBanned" = FALSE
    AND c."isVerified" = TRUE AND c."verificationStatus" = 'VERIFIED'
    AND c."subscriptionStatus" <> 'CANCELLED'
    AND (
      EXISTS (
        SELECT 1
        FROM regexp_split_to_table(
          translate(COALESCE(c.services, ''), '[]"{}', ''), ','
        ) AS capability(token)
        WHERE btrim(capability.token) <> ''
      )
      OR EXISTS (SELECT 1 FROM "CompanySpecialty" cs WHERE cs."companyId" = c.id)
    )
    AND EXISTS (
      SELECT 1 FROM "TeamMember" tm
      WHERE tm."companyId" = c.id
        AND tm.role = 'COMPANY_OWNER' AND tm.status = 'ACTIVE'
    )
),
declared AS (
  SELECT d.market, d.district, p.provider_kind, p.provider_id
  FROM districts d
  JOIN eligible p ON p.market = d.market
  WHERE EXISTS (
    SELECT 1
    FROM regexp_split_to_table(
      translate(COALESCE(p.service_areas, ''), '[]"{}', ''), ','
    ) AS named_area
    WHERE lower(btrim(named_area)) = lower(d.district)
  )
),
area_counts AS (
  SELECT 'DECLARED_DISTRICT'::text AS row_type, d.market,
    d.district AS area,
    COUNT(DISTINCT a.provider_id) FILTER (WHERE a.provider_kind = 'INDIVIDUAL') AS individual_count,
    COUNT(DISTINCT a.provider_id) FILTER (WHERE a.provider_kind = 'COMPANY') AS company_count,
    0::bigint AS individual_radius_count,
    0::bigint AS company_radius_count
  FROM districts d
  LEFT JOIN declared a ON a.market = d.market AND a.district = d.district
  GROUP BY d.market, d.district
),
market_counts AS (
  SELECT 'MARKET_TOTAL'::text AS row_type, m.market,
    'ALL_ELIGIBLE_PROFILES'::text AS area,
    COUNT(p.provider_id) FILTER (WHERE p.provider_kind = 'INDIVIDUAL') AS individual_count,
    COUNT(p.provider_id) FILTER (WHERE p.provider_kind = 'COMPANY') AS company_count,
    COUNT(p.provider_id) FILTER (WHERE p.provider_kind = 'INDIVIDUAL' AND p.has_radius) AS individual_radius_count,
    COUNT(p.provider_id) FILTER (WHERE p.provider_kind = 'COMPANY' AND p.has_radius) AS company_radius_count
  FROM markets m
  LEFT JOIN eligible p ON p.market = m.market
  GROUP BY m.market
)
SELECT row_type, market, area, individual_count, company_count,
  individual_radius_count, company_radius_count
FROM (
  SELECT * FROM area_counts
  UNION ALL
  SELECT * FROM market_counts
) results
ORDER BY market, row_type, area;
COMMIT;
SQL
