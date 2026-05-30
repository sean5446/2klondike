import React from 'react';
import { Card as CardType } from '../types';
import { getSuitColor, getSuitSymbol } from '../gameLogic';
import './Card.css';

// Card component
interface CardProps {
  card: CardType | null;
  onClick: () => void;
  onDoubleClick?: () => void;
  faceDown?: boolean;
  draggable?: boolean;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  isDragging?: boolean;
  isSelected?: boolean;
}

const CardComponent: React.FC<CardProps> = ({
  card,
  onClick,
  onDoubleClick,
  faceDown = false,
  draggable = false,
  onPointerDown,
  isDragging = false,
  isSelected = false,
}) => {
  const cardClasses = ['card', draggable ? 'is-draggable' : '', isDragging ? 'is-dragging' : '', isSelected ? 'is-selected' : '']
    .filter(Boolean)
    .join(' ');

  if (!card) {
    if (faceDown) {
      return (
        <div className={`${cardClasses} card-back`} onClick={onClick} onDoubleClick={onDoubleClick} draggable={false} onPointerDown={onPointerDown}>
          <div className="card-pattern" />
        </div>
      );
    }

    return (
      <div className={`${cardClasses} card-empty`} onClick={onClick} onDoubleClick={onDoubleClick} draggable={false} onPointerDown={onPointerDown} />
    );
  }

  if (faceDown) {
    return (
      <div className={`${cardClasses} card-back`} onClick={onClick} onDoubleClick={onDoubleClick} draggable={false} onPointerDown={onPointerDown}>
        <div className="card-pattern" />
      </div>
    );
  }

  return (
    <div
      className={`${cardClasses} card-face ${getSuitColor(card.suit)}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      draggable={false}
      onPointerDown={onPointerDown}
      data-card-id={card.id}
      data-rank={card.rank}
      data-suit={card.suit}
    >
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
