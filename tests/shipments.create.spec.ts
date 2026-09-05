import { writeTest as test, expect, testEnv, requireWriteMode } from './support/fixtures';
import { authenticate, deleteShipmentByNo, listShipments, newApiContext, AuthResult } from './support/api';
import { requireCreds } from './support/env';
import { expectToast, selectFirstRealOption } from './support/ui';

let adminAuth: AuthResult;
const createdNos = new Set<string>();

test.beforeEach(() => requireWriteMode());

test.beforeAll(async () => {
  if (!testEnv.allowWriteTests) return;
  const ctx = await newApiContext();
  adminAuth = await authenticate(ctx, requireCreds('admin'));
  await ctx.dispose();
});

test.afterEach(async () => {
  if (createdNos.size === 0) return;
  const ctx = await newApiContext();
  for (const no of createdNos) {
    try {
      await deleteShipmentByNo(ctx, adminAuth, no);
    } catch {
      /* best-effort cleanup */
    }
  }
  createdNos.clear();
  await ctx.dispose();
});

test.describe('Shipments (/orgin) — Create', () => {
  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto('/orgin');
    await adminPage.getByTestId('orgin-new-shipment-button').click();
    await expect(adminPage.getByTestId('orgin-new-shipment-modal')).toBeVisible();
  });

  test('required-field validation fires in order until the form is complete', async ({ adminPage }) => {
    const m = adminPage.getByTestId('orgin-new-shipment-modal');

    await m.getByTestId('orgin-modal-save-button').click();
    await expectToast(adminPage, 'Customer is required');

    await selectFirstRealOption(adminPage, 'orgin-modal-customer-select');
    await m.getByTestId('orgin-modal-save-button').click();
    await expectToast(adminPage, 'Route From is required');

    await selectFirstRealOption(adminPage, 'orgin-modal-route-from-select');
    await selectFirstRealOption(adminPage, 'orgin-modal-route-to-select');
    await m.getByTestId('orgin-modal-save-button').click();
    await expectToast(adminPage, 'Shipment No is required');

    await m.getByTestId('orgin-modal-shipment-no-input').fill(`${testEnv.testPrefix}VALIDATE-${Date.now()}`);
    await m.getByTestId('orgin-modal-save-button').click();
    await expectToast(adminPage, 'Vehicle No is required');

    await m.getByTestId('orgin-modal-vehicle-no-input').fill('E2E-VEH-9');
    await m.getByTestId('orgin-modal-save-button').click();
    await expectToast(adminPage, 'LR Date is required');

    await m.getByTestId('orgin-modal-lr-date-input').fill(new Date().toISOString().slice(0, 10));
    await m.getByTestId('orgin-modal-save-button').click();
    await expectToast(adminPage, 'Transporter is required');
  });

  test('duplicate shipment-no check warns on blur and blocks save', async ({ adminPage }) => {
    const ctx = await newApiContext();
    const existing = await listShipments(ctx, adminAuth, {
      loc_id: adminAuth.locId != null ? String(adminAuth.locId) : '',
      flag: 'O',
      status: [],
      fromDate: '2000-01-01',
      toDate: '2999-12-31',
    });
    await ctx.dispose();
    test.skip(existing.length === 0, 'no existing shipment to collide with');

    const dupNo = existing[0].shipment_no!;
    const m = adminPage.getByTestId('orgin-new-shipment-modal');
    await m.getByTestId('orgin-modal-shipment-no-input').fill(dupNo);
    await m.getByTestId('orgin-modal-shipment-no-input').blur();
    await expect(m.getByTestId('orgin-modal-shipment-no-dupwarning')).toBeVisible();

    await selectFirstRealOption(adminPage, 'orgin-modal-customer-select');
    await selectFirstRealOption(adminPage, 'orgin-modal-route-from-select');
    await selectFirstRealOption(adminPage, 'orgin-modal-route-to-select');
    await m.getByTestId('orgin-modal-vehicle-no-input').fill('E2E-VEH-9');
    await m.getByTestId('orgin-modal-lr-date-input').fill(new Date().toISOString().slice(0, 10));
    await m.getByTestId('orgin-modal-transporter-input').fill('E2E Transport');
    await m.getByTestId('orgin-modal-save-button').click();
    await expectToast(adminPage, /already exists/i);
  });

  test('happy path — creates a shipment and it appears in the list', async ({ adminPage }) => {
    const shipmentNo = `${testEnv.testPrefix}${Date.now()}`;
    createdNos.add(shipmentNo);
    const m = adminPage.getByTestId('orgin-new-shipment-modal');

    await selectFirstRealOption(adminPage, 'orgin-modal-customer-select');
    await selectFirstRealOption(adminPage, 'orgin-modal-vehicletype-select').catch(() => {});
    await selectFirstRealOption(adminPage, 'orgin-modal-route-from-select');
    await selectFirstRealOption(adminPage, 'orgin-modal-route-to-select');
    await m.getByTestId('orgin-modal-shipment-no-input').fill(shipmentNo);
    await m.getByTestId('orgin-modal-shipment-no-input').blur();
    await m.getByTestId('orgin-modal-vehicle-no-input').fill('E2E-VEH-1');
    await m.getByTestId('orgin-modal-lr-no-input').fill('E2E-LR-1');
    await m.getByTestId('orgin-modal-lr-date-input').fill(new Date().toISOString().slice(0, 10));
    await m.getByTestId('orgin-modal-transporter-input').fill('E2E Transport Co');
    await m.getByTestId('orgin-modal-transit-days-input').fill('2');

    await m.getByTestId('orgin-modal-save-button').click();
    await expectToast(adminPage, 'Shipment saved');
    await expect(m).toBeHidden();

    // widen the date window so a shipment dated today is definitely in range, then find it
    await adminPage.getByTestId('orgin-date-from').fill('2000-01-01');
    await adminPage.getByTestId('orgin-search-input').fill(shipmentNo);
    await expect(adminPage.getByTestId(`orgin-row-view-${shipmentNo}`)).toBeVisible({ timeout: 10000 });
  });
});
