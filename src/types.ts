export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string;
  faceUp: boolean;
}

export interface GameState {
  deck: Card[];
  waste: Card[];
  foundations: Card[][];
  tableau: Card[][];
  selectedCard: Card | null;
  selectedFrom: string | null;
  seed: number;
}