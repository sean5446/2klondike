import { Card, GameState, Suit, Rank } from './types';

// Seeded random number generator
export const seededRandom = (seed: number) => {
  let x = seed;
  return () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
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

  return deck.sort(() => (rng ? rng() : Math.random()) - 0.5);
};

export const initializeGame = (seed?: number): GameState => {
  const actualSeed = seed ?? Math.floor(Math.random() * 1000000);
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
  };
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
  const deckEmpty = game.deck.length === 0;
  const wasteEmpty = game.waste.length === 0;

  const foundationAceCount = game.foundations.reduce((count, pile) =>
    count + pile.filter(card => card.rank === 'A').length,
  0);

  const tableauKingCount = game.tableau.reduce((count, pile) =>
    count + pile.filter(card => card.rank === 'K').length,
  0);

  return deckEmpty && wasteEmpty && foundationAceCount === 8 && tableauKingCount === 8;
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