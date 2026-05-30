import { expect, Page, test } from '@playwright/test';

interface FoundationMove {
  fromPile: number;
  foundationIndex: number;
}

async function findSeedWithAceMove(page: Page): Promise<{ seed: number; move: FoundationMove }> {
  for (let seed = 1; seed <= 120; seed++) {
    await page.goto(`/?${seed}`);

    const fromPile = await page.evaluate(() => {
      const piles = Array.from(document.querySelectorAll<HTMLElement>('.tableau-pile'));
      for (let index = 0; index < piles.length; index++) {
        const cards = Array.from(piles[index].querySelectorAll<HTMLElement>('.card-face'));
        const top = cards[cards.length - 1];
        if (top?.dataset.rank === 'A') {
          return index;
        }
      }
      return -1;
    });

    if (fromPile >= 0) {
      return {
        seed,
        move: {
          fromPile,
          foundationIndex: 0,
        },
      };
    }
  }

  throw new Error('Unable to find a seed with a top-row ace in first 120 seeds');
}

test.describe('Double Klondike smoke tests', () => {
  test('renders core controls and header info', async ({ page }) => {
    await page.goto('/?12345');

    await expect(page.getByRole('heading', { name: 'Double Klondike' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Game' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Stats' })).toBeVisible();
    await expect(page.getByText('Game ID: 12345')).toBeVisible();
    await expect(page.getByText('Turn: 0')).toBeVisible();
  });

  test('drawing from stock increments turn and enables undo', async ({ page }) => {
    await page.goto('/?100');

    const stockCount = page.locator('.stock-count');
    const undoButton = page.getByRole('button', { name: 'Undo' });

    const initialStockText = await stockCount.innerText();
    const initialStock = Number.parseInt(initialStockText, 10);

    await expect(undoButton).toBeDisabled();

    await page.locator('.stock .card').click();

    await expect(page.getByText('Turn: 1')).toBeVisible();
    await expect(undoButton).toBeEnabled();

    const nextStockText = await stockCount.innerText();
    const nextStock = Number.parseInt(nextStockText, 10);
    expect(nextStock).toBe(initialStock - 1);
  });

  test('undo restores previous state after drawing from stock', async ({ page }) => {
    await page.goto('/?200');

    const stockCount = page.locator('.stock-count');
    const initialStock = Number.parseInt(await stockCount.innerText(), 10);

    await page.locator('.stock .card').click();
    await page.getByRole('button', { name: 'Undo' }).click();

    await expect(page.getByText('Turn: 0')).toBeVisible();
    const restoredStock = Number.parseInt(await stockCount.innerText(), 10);
    expect(restoredStock).toBe(initialStock);
  });

  test('stats modal opens and closes', async ({ page }) => {
    await page.goto('/?300');

    await page.getByRole('button', { name: 'Stats' }).click();
    await expect(page.getByRole('heading', { name: 'Stats' })).toBeVisible();
    await expect(page.getByText('Played')).toBeVisible();

    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('heading', { name: 'Stats' })).not.toBeVisible();
  });

  test('new game changes game id and resets turn', async ({ page }) => {
    await page.goto('/?400');

    const gameId = page.locator('.game-id-link');
    const before = (await gameId.innerText()).trim();

    await page.locator('.stock .card').click();
    await expect(page.getByText('Turn: 1')).toBeVisible();

    await page.getByRole('button', { name: 'New Game' }).click();

    await expect(page.getByText('Turn: 0')).toBeVisible();
    const after = (await gameId.innerText()).trim();
    expect(after).not.toBe(before);
  });

  test.skip('desktop drag/drop moves ace to foundation', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop drag/drop is validated in desktop Chromium only.');

    const { move } = await findSeedWithAceMove(page);

    await page.evaluate(({ fromPile, foundationIndex }) => {
      const sourceCards = Array.from(document.querySelectorAll<HTMLElement>(`.tableau-pile[data-drop-index="${fromPile}"] .card-face`));
      const source = sourceCards[sourceCards.length - 1];
      const target = document.querySelector<HTMLElement>(`.foundation[data-drop-index="${foundationIndex}"]`);
      if (!source || !target) {
        throw new Error('Missing source or target for desktop pointer drag test');
      }

      const sourceRect = source.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();

      const startX = sourceRect.left + sourceRect.width / 2;
      const startY = sourceRect.top + sourceRect.height / 2;
      const endX = targetRect.left + targetRect.width / 2;
      const endY = targetRect.top + targetRect.height / 2;

      source.dispatchEvent(new PointerEvent('pointerdown', {
        pointerId: 101,
        pointerType: 'mouse',
        button: 0,
        buttons: 1,
        clientX: startX,
        clientY: startY,
        bubbles: true,
        cancelable: true,
      }));

      window.dispatchEvent(new PointerEvent('pointermove', {
        pointerId: 101,
        pointerType: 'mouse',
        button: 0,
        buttons: 1,
        clientX: endX,
        clientY: endY,
        bubbles: true,
        cancelable: true,
      }));

      target.dispatchEvent(new PointerEvent('pointerup', {
        pointerId: 101,
        pointerType: 'mouse',
        button: 0,
        buttons: 0,
        clientX: endX,
        clientY: endY,
        bubbles: true,
        cancelable: true,
      }));
    }, move);

    await expect(page.getByText('Turn: 1')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });

  test.skip('mobile touch drag/drop moves ace to foundation', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'Touch drag/drop is validated in mobile Chromium only.');

    const { move } = await findSeedWithAceMove(page);

    const points = await page.evaluate(({ fromPile, foundationIndex }) => {
      const sourceCards = Array.from(document.querySelectorAll<HTMLElement>(`.tableau-pile[data-drop-index="${fromPile}"] .card-face`));
      const source = sourceCards[sourceCards.length - 1];
      const target = document.querySelector<HTMLElement>(`.foundation[data-drop-index="${foundationIndex}"]`);
      if (!source || !target) {
        throw new Error('Missing source or target for touch drag test');
      }

      const sourceRect = source.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();

      const startX = sourceRect.left + sourceRect.width / 2;
      const startY = sourceRect.top + sourceRect.height / 2;
      const endX = targetRect.left + targetRect.width / 2;
      const endY = targetRect.top + targetRect.height / 2;
      return { startX, startY, endX, endY };
    }, move);

    await page.touchscreen.tap(points.startX, points.startY);
    await page.touchscreen.tap(points.endX, points.endY);

    await expect(page.getByText('Turn: 1')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });
});
