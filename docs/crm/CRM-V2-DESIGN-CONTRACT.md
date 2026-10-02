# MaintainEX CRM V2 — Visual Design Contract

The approved reference image is the baseline for all CRM V2 pages.

## Color system
- Navigation/background dark: charcoal/near-black
- Main workspace: light neutral
- Surface/card: white
- Primary accent: MaintainEX amber/yellow
- Primary text: near-black
- Secondary text: slate/neutral gray
- Success: green
- Warning: amber
- Danger: red
- Information: blue
- Borders: soft neutral gray

Exact implementation tokens are defined once in Phase 1 and reused everywhere.

## Global layout
- fixed compact left rail
- sticky top operational bar
- centered/wide content canvas
- consistent page padding
- consistent card radii/borders/shadows
- consistent table density

## Navigation
Primary nav only. No large nested legacy accordion hierarchy.
Secondary module navigation belongs in page tabs/subnavigation.

## Page anatomy
Every operational page follows:
1. Page header
2. context/actions
3. key metrics/status
4. filters/tabs
5. main operational content
6. optional right action/insight rail
7. audit/metadata when appropriate

## Interaction patterns
Same components everywhere for:
- button
- destructive action
- sensitive financial action
- modal
- drawer
- table
- status badge
- filter
- search
- pagination
- form
- confirmation
- toast
- loading
- empty
- error
- permission denied

## Job 360 reference rule
Job 360 is the strongest reference implementation:
- identity/status header
- compact summary cards
- operational tabs
- main workspace
- right control rail
- lifecycle timeline
- payment/risk/SLA/internal notes panels

Other 360 pages should feel like the same product.

## Prohibited
- old CRM dark-page components
- isolated page-specific color systems
- random gradients
- inconsistent button colors
- different table styles per module
- old admin page reused without migration
- visual-only controls with no backend function
