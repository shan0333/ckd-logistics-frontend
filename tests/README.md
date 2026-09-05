# CKD Logistics — E2E (Playwright)

CRUD coverage for every use case in the app, driven through the real UI via the
`data-testid` hooks, against a locally-served frontend + the real Logistics-backend.

## What's covered

| Spec | Area | CRUD |
| --- | --- | --- |
| `auth.spec.ts` | Login / route guard / logout | route protection, valid + invalid login, session teardown |
| `shipments.read.spec.ts` | Shipments `/orgin` | list, status-pill filter, date filter, search, paging, View modal, Images modal, create-modal render |
| `shipments.create.spec.ts` | Shipments `/orgin` | required-field validation chain, duplicate shipment-no check, happy-path create + appears-in-list |
| `shipments.delete.spec.ts` | Shipments `/orgin` | admin delete via row menu + confirm dialog (+ server-side soft-delete check), cancel keeps row |
| `permissions.spec.ts` | Role gating | non-admin cannot see Delete, admin can, all nav routes reachable |
| `receiving.read.spec.ts` | Receiving `/destination` | list, flag=D filter, search, View modal, Images modal |
| `receiving.update.spec.ts` | Receiving `/destination` | Receive→Save (work-in-progress), Receive→Submit (locks row), locked-state / Enable-Edit |
| `dashboard.spec.ts` | Dashboard | one `shipmentGraphInfo` call, 5 stat tiles, 6 chart cards render |
| `report.spec.ts` | Report | status/transporter/date filters, Excel download + `filter` header shape |

`shipments.create`, `shipments.delete`, `receiving.update` **mutate backend data** and only
run when `ALLOW_WRITE_TESTS=1`. Everything else is read-only.

## Setup

1. **Backend up** on `:5000`:
   ```
   cd C:\Users\admin\Logistics-backend\spaceage-app
   mvn spring-boot:run
   ```
   (Add `-Dspring-boot.run.profiles=dev` to hit local MySQL instead of the shared prod RDS.)

2. **Credentials**: `cp .env.test.example .env.test` and fill in:
   - `E2E_ADMIN_USERNAME` / `E2E_ADMIN_PASSWORD` — a user with role `ADMIN` or `SUPER ADMIN`
   - `E2E_USER_USERNAME` / `E2E_USER_PASSWORD` — a normal user (for role-gating specs)

3. Playwright browser (already installed here; if not): `npx playwright install chromium`

## Run

```
npm run test:e2e            # read-only suite (safe against any backend)
npm run test:e2e:ui         # interactive UI mode
npm run test:e2e:report     # open the last HTML report
```

Enable the write specs by setting `ALLOW_WRITE_TESTS=1` in `.env.test`.

## Safety notes (live backend)

- With the default backend profile, writes go to the shared **production `Spaceage` RDS**
  (`orgin` + `image` tables).
- Every shipment a test creates is prefixed `E2ETEST-` (`E2E_TEST_PREFIX`) and
  **soft-deleted** (`status=0`) in an `afterEach` — it stays in the table, flagged inactive.
- `receiving.update` first creates its own `E2ETEST-` shipment, operates on that, then
  deletes it — it never touches real inbound shipments. If a freshly created shipment does
  not appear on the current user's Destination list, that test self-skips.
- `global-setup.ts` fails fast if the backend is unreachable or credentials are wrong.
