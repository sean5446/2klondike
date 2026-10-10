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
  const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  const completedGame = (): GameState => {
    const foundations: Card[][] = [];
    for (const suit of suits) {
      for (let deckNum = 0; deckNum < 2; deckNum++) {
        foundations.push(
          ranks.map((rank) => ({ suit, rank, id: `${rank}-${suit}-${deckNum}`, faceUp: true })),
        );
      }
    }
    return {
      deck: [],
      waste: [],
      foundations,
      tableau: Array.from({ length: 9 }, () => []),
      selectedCard: null,
      selectedFrom: null,
      seed: 0,
      gameId: encodeGameId(0),
    };
  };

  test('is true when all 104 cards are on the foundations', () => {
    expect(hasWon(completedGame())).toBe(true);
  });

  test('is false until every foundation is complete', () => {
    const game = completedGame();
    game.foundations[0].pop();
    expect(hasWon(game)).toBe(false);
  });
});
