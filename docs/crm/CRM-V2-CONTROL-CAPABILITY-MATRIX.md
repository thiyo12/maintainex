# MaintainEX CRM V2 — Control Capability Matrix

CRM V2 is an operational control plane, not a live source-code editor.

## Control classes

### FULL CONTROL
CRM can safely read and change canonical business state through authorized domain services.
Examples:
- suspend/reactivate account
- approve/reject KYC
- resolve dispute
- activate/deactivate service
- process authorized payout
- manage staff permissions

### CONFIG CONTROL
CRM changes configuration consumed by app/web runtime.
Examples:
- market availability
- service visibility
- operational banner
- pricing config
- promotion dates

### OBSERVE + ACTION
CRM observes system state and can trigger limited safe actions.
Examples:
- payment reconciliation
- failed notification retry
- session revocation
- risk investigation

### OBSERVE ONLY
CRM exposes safe diagnostic state but does not mutate the subsystem.
Examples:
- container health
- DB health
- application version
- cron status

### DEPLOYMENT REQUIRED
A source-code defect or architectural change cannot be safely fixed through CRM.
Examples:
- broken React screen
- invalid API implementation
- schema bug
- payment algorithm bug
- security vulnerability in code

Such issues require:
1. code fix
2. tests
3. CI
4. deployment
5. smoke verification

## Rule

No CRM page may claim a control is functional unless the corresponding runtime consumes the canonical state/configuration.
