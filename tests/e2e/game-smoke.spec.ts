import { expect, Page, test } from '@playwright/test';

interface FoundationMove {
  fromPile: number;
  foundationIndex: number;
}

async function findTopTableauAce(page: Page): Promise<FoundationMove> {
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

  if (fromPile < 0) {
    throw new Error('Unable to find a top-row ace for the provided seed');
  }

  return {
    fromPile,
    foundationIndex: 0,
  };
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

  test('new game prompts after a turn and resets on confirm', async ({ page }) => {
    await page.goto('/?400');

    const gameId = page.locator('.game-id-link');
    const before = (await gameId.innerText()).trim();

    await page.locator('.stock .card').click();
    await expect(page.getByText('Turn: 1')).toBeVisible();

    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('A turn has been played. Start a new game?');
      await dialog.dismiss();
    });

    await page.getByRole('button', { name: 'New Game' }).click();

    await expect(page.getByText('Turn: 1')).toBeVisible();
    const afterCancel = (await gameId.innerText()).trim();
    expect(afterCancel).toBe(before);

    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('A turn has been played. Start a new game?');
      await dialog.accept();
    });

    await page.getByRole('button', { name: 'New Game' }).click();

    await expect(page.getByText('Turn: 0')).toBeVisible();
    const after = (await gameId.innerText()).trim();
    expect(after).not.toBe(before);
  });

  test('ace moves to foundation using primary interaction (seed 649728)', async ({ page }, testInfo) => {

    await page.goto('/?649728');
    await expect(page.getByText('Game ID: 649728')).toBeVisible();

    const move = await findTopTableauAce(page);
    const sourceCard = page.locator(`.tableau-pile[data-drop-index="${move.fromPile}"] .card-face`).last();
    const foundationTarget = page.locator(`.foundation[data-drop-index="${move.foundationIndex}"]`);

    if (testInfo.project.name === 'mobile-chromium') {
      await sourceCard.dragTo(foundationTarget);
    } else {
      await sourceCard.dblclick();
    }

    await expect(page.getByText('Turn: 1')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();

    const foundationCardCount = await page.evaluate(() => {
      const foundationCards = document.querySelectorAll('.foundation .card-face');
      return foundationCards.length;
    });
    expect(foundationCardCount).toBe(1);
  });

  test('drag/drop moves ace to foundation (seed 649728)', async ({ page }) => {

    await page.goto('/?649728');
    await expect(page.getByText('Game ID: 649728')).toBeVisible();

    const move = await findTopTableauAce(page);

    const sourceCard = page.locator(`.tableau-pile[data-drop-index="${move.fromPile}"] .card-face`).last();
    const foundationTarget = page.locator(`.foundation[data-drop-index="${move.foundationIndex}"]`);
    await sourceCard.dragTo(foundationTarget);

    await expect(page.getByText('Turn: 1')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();

    const foundationCardCount = await page.evaluate(() => {
      const foundationCards = document.querySelectorAll('.foundation .card-face');
      return foundationCards.length;
    });
    expect(foundationCardCount).toBe(1);
  });
});
