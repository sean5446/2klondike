import type { Card, GameState, Suit, Rank } from './types';

// Seeded random number generator (mulberry32). It has a 32-bit state, unlike
// the previous LCG whose 233280-value state space caused many game IDs to map
// to the same deck.
export const seededRandom = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Generates a random 32-bit seed, preferring a cryptographic source.
export const randomSeed = (): number => {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return Math.floor(Math.random() * 0x100000000);
};

// Game IDs are a fixed-width base62 (0-9A-Za-z) encoding of the 32-bit seed.
// 62^6 > 2^32 so every seed round-trips through exactly six characters.
const ID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ID_LENGTH = 6;

export const encodeGameId = (seed: number): string => {
  let n = seed >>> 0;
  let id = '';
  for (let i = 0; i < ID_LENGTH; i++) {
    id = ID_ALPHABET[n % ID_ALPHABET.length] + id;
    n = Math.floor(n / ID_ALPHABET.length);
  }
  return id;
};

export const decodeGameId = (id: string): number | null => {
  if (!new RegExp(`^[0-9A-Za-z]{${ID_LENGTH}}$`).test(id)) return null;
  let n = 0;
  for (const char of id) {
    const index = ID_ALPHABET.indexOf(char);
    if (index === -1) return null;
    n = n * ID_ALPHABET.length + index;
  }
  const seed = n >>> 0;
  // Only accept canonical IDs (those the encoder could have produced), so a
  // hand-typed ID that overflows 32 bits isn't silently mapped to another game.
  return encodeGameId(seed) === id ? seed : null;
};

// Utility functions
export const createDeck = (numDecks: number = 1, rng?: () => number): Card[] => {
  const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck: Card[] = [];

  for (let deckNum = 0; deckNum < numDecks; deckNum++) {
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({
          suit,
          rank,
          id: `${rank}-${suit}-${deckNum}`,
          faceUp: false,
        });
      }
    }
  }

  // Fisher-Yates shuffle: makes exactly n-1 RNG calls in a fixed order,
  // so the same seed always produces the same deck regardless of JS engine
  // or version. Array.sort() with a random comparator is non-deterministic
  // because the number/order of comparisons is implementation-defined.
  const shuffled = [...deck];
  const rand = rng ?? Math.random;
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const initializeGame = (seed?: number): GameState => {
  const actualSeed = (seed ?? randomSeed()) >>> 0;
  const rng = seededRandom(actualSeed);
  const deck = createDeck(2, rng);
  const tableau: Card[][] = [];

  // Create tableau with 9 piles
  let deckIndex = 0;
  for (let i = 0; i < 9; i++) {
    tableau[i] = [];
    for (let j = 0; j <= i; j++) {
      const card = { ...deck[deckIndex++] };
      card.faceUp = j === i; // Only last card face up
      tableau[i].push(card);
    }
  }

  return {
    deck: deck.slice(deckIndex),
    waste: [],
    foundations: Array(8).fill(null).map(() => []),
    tableau,
    selectedCard: null,
    selectedFrom: null,
    seed: actualSeed,
    gameId: encodeGameId(actualSeed),
  };
};

export const cloneGameState = (game: GameState): GameState => {
  return structuredClone(game) as GameState;
};

export const findCardById = (game: GameState, cardId: string): Card | null => {
  const wasteCard = game.waste.find((card) => card.id === cardId);
  if (wasteCard) return wasteCard;

  for (const pile of game.tableau) {
    const tableauCard = pile.find((card) => card.id === cardId);
    if (tableauCard) return tableauCard;
  }

  for (const pile of game.foundations) {
    const foundationCard = pile.find((card) => card.id === cardId);
    if (foundationCard) return foundationCard;
  }

  return null;
};

export const getSuitColor = (suit: Suit): string => {
  return suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black';
};

export const getSuitSymbol = (suit: Suit): string => {
  const symbols: Record<Suit, string> = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠',
  };
  return symbols[suit];
};

const rankOrder: Record<Rank, number> = {
  A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13,
};

export const canMoveToFoundation = (card: Card, foundation: Card[]): boolean => {
  if (foundation.length === 0) {
    return card.rank === 'A';
  }
  const topCard = foundation[foundation.length - 1];
  return card.suit === topCard.suit && rankOrder[card.rank] === rankOrder[topCard.rank] + 1;
};

export const canMoveToTableau = (card: Card, tableauPile: Card[]): boolean => {
  if (tableauPile.length === 0) {
    return card.rank === 'K';
  }
  const topCard = tableauPile[tableauPile.length - 1];
  if (!topCard.faceUp) return false;
  const cardColor = getSuitColor(card.suit);
  const topColor = getSuitColor(topCard.suit);
  return cardColor !== topColor && rankOrder[card.rank] === rankOrder[topCard.rank] - 1;
};

export const canMoveSequenceToTableau = (cards: Card[], tableauPile: Card[]): boolean => {
  if (cards.length === 0) return false;
  const firstCard = cards[0];
  if (tableauPile.length === 0) {
    return firstCard.rank === 'K';
  }
  const topCard = tableauPile[tableauPile.length - 1];
  if (!topCard.faceUp) return false;
  const cardColor = getSuitColor(firstCard.suit);
  const topColor = getSuitColor(topCard.suit);
  return cardColor !== topColor && rankOrder[firstCard.rank] === rankOrder[topCard.rank] - 1;
};

export const isValidSequence = (cards: Card[]): boolean => {
  if (cards.length <= 1) return true;
  for (let i = 0; i < cards.length - 1; i++) {
    const curr = cards[i];
    const next = cards[i + 1];
    if (getSuitColor(curr.suit) === getSuitColor(next.suit)) return false;
    if (rankOrder[curr.rank] !== rankOrder[next.rank] + 1) return false;
  }
  return true;
};

export const hasWon = (game: GameState): boolean => {
  // The player wins once the draw pile and waste are clear, every tableau
  // card is face up, all eight aces are on the foundations, and all eight
  // kings remain in the tableau. The face-up tableau stacks can be finished
  // without the player having to move them onto the foundations.
  if (game.deck.length > 0 || game.waste.length > 0) return false;

  const foundationAceCount = game.foundations.reduce(
    (count, pile) => count + pile.filter((card) => card.rank === 'A').length,
    0,
  );
  if (foundationAceCount !== 8) return false;

  const tableauCards = game.tableau.flat();
  const tableauKingCount = tableauCards.filter((card) => card.rank === 'K').length;
  if (tableauKingCount !== 8) return false;

  return tableauCards.every((card) => card.faceUp);
};

export const playDeckTurn = (game: GameState): GameState => {
  if (game.deck.length === 0) {
    return {
      ...game,
      deck: game.waste.map((card) => ({ ...card, faceUp: false })).reverse(),
      waste: [],
    };
  }

  return {
    ...game,
    deck: game.deck.slice(1),
    waste: [{ ...game.deck[0], faceUp: true }, ...game.waste],
    selectedCard: null,
    selectedFrom: null,
  };
};

export const findFoundationMoveIndex = (game: GameState, card: Card): number => {
  return game.foundations.findIndex((foundation) => canMoveToFoundation(card, foundation));
};

export const moveCard = (gameState: GameState, fromType: string, fromIndex: number | string, toType: string, toIndex: number | string, cardId: string): GameState => {
  // Clone arrays and card objects so mutations produce new instances
  const newState: GameState = {
    ...gameState,
    foundations: gameState.foundations.map(pile => pile.map(card => ({ ...card }))),
    tableau: gameState.tableau.map(pile => pile.map(card => ({ ...card }))),
    waste: gameState.waste.map(card => ({ ...card })),
    deck: gameState.deck.map(card => ({ ...card })),
  };

  let cards: Card[] = [];

  // Remove cards from source
  if (fromType === 'waste') {
    if (newState.waste.length > 0 && newState.waste[0].id === cardId) {
      cards = newState.waste.slice(0, 1);
      newState.waste = newState.waste.slice(1);
    }
  } else if (fromType === 'tableau') {
    const pile = newState.tableau[fromIndex as number];
    const cardIndex = pile.findIndex(c => c.id === cardId);
    if (cardIndex !== -1 && pile[cardIndex].faceUp) {
      cards = pile.slice(cardIndex);
      const newPile = pile.slice(0, cardIndex);
      // Flip the new top card if face down
      if (newPile.length > 0 && !newPile[newPile.length - 1].faceUp) {
        newPile[newPile.length - 1].faceUp = true;
      }
      newState.tableau[fromIndex as number] = newPile;
    }
  } else if (fromType === 'foundation') {
    const pile = newState.foundations[fromIndex as number];
    const cardIndex = pile.findIndex(c => c.id === cardId);
    if (cardIndex !== -1) {
      cards = pile.slice(cardIndex);
      newState.foundations[fromIndex as number] = pile.slice(0, cardIndex);
    }
  }

  if (cards.length === 0) return gameState; // Invalid move

  if (!isValidSequence(cards)) return gameState; // Sequence not valid

  const card = cards[0];

  // Add to destination
  if (toType === 'foundation') {
    const index = toIndex as number;
    if (cards.length === 1 && canMoveToFoundation(card, newState.foundations[index])) {
      newState.foundations[index] = [...newState.foundations[index], card];
    } else {
      return gameState; // Invalid
    }
  } else if (toType === 'tableau') {
    const pile = newState.tableau[toIndex as number];
    if (canMoveSequenceToTableau(cards, pile)) {
      newState.tableau[toIndex as number] = [...pile, ...cards];
    } else {
      return gameState; // Invalid
    }
  }

  return newState;
};