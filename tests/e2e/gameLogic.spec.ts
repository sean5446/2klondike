import { expect, test } from '@playwright/test';
import {
  createDeck,
  decodeGameId,
  encodeGameId,
  hasWon,
  seededRandom,
} from '../../src/gameLogic';
import type { Card, GameState, Rank, Suit } from '../../src/types';

const serializeDeck = (seed: number): string =>
  createDeck(2, seededRandom(seed)).map((card) => card.id).join(',');

test.describe('seeded RNG and game IDs', () => {
  test('mulberry32 is deterministic for a given seed', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const first = Array.from({ length: 128 }, () => a());
    const second = Array.from({ length: 128 }, () => b());
    expect(first).toEqual(second);
    expect(first.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  test('different seeds no longer collide at the old 233280 modulus', () => {
    // Under the old LCG, seed N and N + 233280 produced identical decks.
    expect(serializeDeck(5)).not.toBe(serializeDeck(5 + 233280));
    expect(serializeDeck(123)).not.toBe(serializeDeck(123 + 233280));
  });

  test('game IDs round-trip and are unique across many seeds', () => {
    for (const seed of [0, 1, 5, 233280, 649728, 0xffffffff]) {
      expect(decodeGameId(encodeGameId(seed))).toBe(seed);
    }

    const ids = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      ids.add(encodeGameId(i * 7919));
    }
    expect(ids.size).toBe(5000);
  });

  test('decodeGameId rejects invalid or non-canonical IDs', () => {
    expect(decodeGameId('!!!!!!')).toBeNull();
    expect(decodeGameId('12345')).toBeNull();
    expect(decodeGameId('zzzzzz')).toBeNull();
  });
});

test.describe('hasWon', () => {
  const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

  const card = (suit: Suit, rank: Rank, faceUp = true): Card => ({
    suit,
    rank,
    id: `${rank}-${suit}`,
    faceUp,
  });

  // Win state: stock and waste empty, all eight aces on the foundations, and
  // all eight kings face up in the tableau.
  const winningGame = (): GameState => {
    const foundations: Card[][] = [];
    for (const suit of suits) {
      foundations.push([card(suit, 'A')]);
      foundations.push([card(suit, 'A')]);
    }

    const tableau: Card[][] = Array.from({ length: 9 }, () => []);
    foundations.forEach((_, index) => {
      tableau[index].push(card(suits[index % suits.length], 'K'));
    });

    return {
      deck: [],
      waste: [],
      foundations,
      tableau,
      selectedCard: null,
      selectedFrom: null,
      seed: 0,
      gameId: encodeGameId(0),
    };
  };

  test('is true when stock/waste are empty, aces are home, and kings are face up in the tableau', () => {
    expect(hasWon(winningGame())).toBe(true);
  });

  test('is false when a tableau card is face down', () => {
    const game = winningGame();
    game.tableau[0][0].faceUp = false;
    expect(hasWon(game)).toBe(false);
  });

  test('is false when a king has been moved out of the tableau', () => {
    const game = winningGame();
    const king = game.tableau[0].pop()!;
    game.foundations[0].push(king);
    expect(hasWon(game)).toBe(false);
  });

  test('is false while the stock still has cards', () => {
    const game = winningGame();
    game.deck.push(card('spades', '2'));
    expect(hasWon(game)).toBe(false);
  });

  test('is false while the waste still has cards', () => {
    const game = winningGame();
    game.waste.push(card('spades', '2'));
    expect(hasWon(game)).toBe(false);
  });
});

