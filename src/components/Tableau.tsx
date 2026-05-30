import React from 'react';
import { Card } from '../types';
import CardComponent from './Card';
import './Tableau.css';

interface TableauProps {
  tableau: Card[][];
  pointerDragCardId: string | null;
  onTableauDoubleClick: (card: Card, pileIndex: number) => void;
  onTableauPointerStart: (e: React.PointerEvent<HTMLDivElement>, card: Card, pileIndex: number) => void;
  onTableauPointerDrop: (pileIndex: number) => void;
}

const Tableau: React.FC<TableauProps> = ({
  tableau,
  pointerDragCardId,
  onTableauDoubleClick,
  onTableauPointerStart,
  onTableauPointerDrop,
}) => {
  return (
    <div className="tableau">
      {tableau.map((pile, index) => (
        <div
          key={index}
          className="tableau-pile"
          data-drop-type="tableau"
          data-drop-index={index}
          onPointerUp={(e) => {
            e.preventDefault();
            onTableauPointerDrop(index);
          }}
        >
          {pile.length === 0 ? (
            <div className="tableau-empty-slot" />
          ) : (
            pile.map((card, cardIndex) => (
              <div
                key={card.id}
                className="tableau-card"
                style={{ transform: `translateY(calc(${cardIndex} * var(--tableau-offset)))` }}
              >
                <CardComponent
                  card={card}
                  onClick={() => {}}
                  onDoubleClick={() => card.faceUp && onTableauDoubleClick(card, index)}
                  faceDown={!card.faceUp}
                  draggable={card.faceUp}
                  onPointerDown={(e) => card.faceUp && onTableauPointerStart(e, card, index)}
                  isDragging={pointerDragCardId === card.id}
                />
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  );
};

export default Tableau;
