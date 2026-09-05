import { Page, expect } from '@playwright/test';

/** Wait for a react-hot-toast message containing `text` to appear. */
export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 8000 });
}

/** The shipment numbers currently visible in a DataTable (desktop table view). */
export async function visibleShipmentNos(page: Page, tableTestId: string): Promise<string[]> {
  const table = page.getByTestId(tableTestId);
  await expect(table).toBeVisible();
  // shipment-no cells are rendered as a <button> with testid `<area>-row-view-<no>`
  const buttons = table.locator('button[data-testid*="-row-view-"]');
  const n = await buttons.count();
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = (await buttons.nth(i).textContent())?.trim();
    if (t) out.push(t);
  }
  return out;
}

/** Whether the DataTable currently shows the empty-state row. */
export async function tableIsEmpty(page: Page, tableTestId: string): Promise<boolean> {
  const table = page.getByTestId(tableTestId);
  return (await table.getByText('No records found').count()) > 0;
}

/** Open the row action menu for a given shipment number and return its testid prefix area. */
export async function openRowMenu(page: Page, area: 'orgin' | 'destination', shipmentNo: string) {
  await page.getByTestId(`${area}-row-actions-${shipmentNo}`).click();
}

/** Pick the first non-placeholder <option> of a <select> located by testid. */
export async function selectFirstRealOption(page: Page, selectTestId: string): Promise<string> {
  const sel = page.getByTestId(selectTestId);
  const values = await sel.locator('option').evaluateAll((opts) =>
    (opts as HTMLOptionElement[]).map((o) => ({ value: o.value, label: o.textContent })),
  );
  const real = values.find((v) => v.value !== '');
  if (!real) throw new Error(`<select ${selectTestId}> has no selectable option`);
  await sel.selectOption(real.value);
  return real.value;
}
