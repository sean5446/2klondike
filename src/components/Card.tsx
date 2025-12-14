import React from 'react';
import { Card as CardType } from '../types';
import { getSuitColor, getSuitSymbol } from '../gameLogic';

// Card component
interface CardProps {
  card: CardType | null;
  onClick: () => void;
  faceDown?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}

const CardComponent: React.FC<CardProps> = ({ card, onClick, faceDown = false, draggable = false, onDragStart }) => {
  if (!card) {
    if (faceDown) {
      return (
        <div className="card card-back" onClick={onClick} draggable={draggable} onDragStart={onDragStart}>
          <div className="card-pattern" />
        </div>
      );
    } else {
      return (
        <div className="card card-empty" onClick={onClick} draggable={draggable} onDragStart={onDragStart} />
      );
    }
  }

  if (faceDown) {
    return (
      <div className="card card-back" onClick={onClick} draggable={draggable} onDragStart={onDragStart}>
        <div className="card-pattern" />
      </div>
    );
  }

  return (
    <div className={`card card-face ${getSuitColor(card.suit)}`} onClick={onClick} draggable={draggable} onDragStart={onDragStart}>
      <div className="card-corner top-left">
        <div className="card-rank card-rank-large">{card.rank}</div>
        <div className="card-suit-large">{getSuitSymbol(card.suit)}</div>
      </div>
      <div className="card-center">{getSuitSymbol(card.suit)}</div>
      <div className="card-corner bottom-right">
        <div className="card-rank">{card.rank}</div>
        <div className="card-suit">{getSuitSymbol(card.suit)}</div>
      </div>
    </div>
  );
};

export default CardComponent;