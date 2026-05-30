import React from 'react';
import { Card } from '../types';
import CardComponent from './Card';
import './Foundations.css';

interface FoundationsProps {
  foundations: Card[][];
  pointerDragCardId: string | null;
  onFoundationDoubleClick: (card: Card, foundationIndex: number) => void;
  onFoundationPointerDrop: (foundationIndex: number) => void;
}

const Foundations: React.FC<FoundationsProps> = ({
  foundations,
  pointerDragCardId,
  onFoundationDoubleClick,
  onFoundationPointerDrop,
}) => {
  return (
    <div className="foundations">
      {Array.from({ length: 8 }, (_, index) => (
        <div
          key={index}
          className="foundation"
          data-drop-type="foundation"
          data-drop-index={index}
          onPointerUp={(e) => {
            e.preventDefault();
            onFoundationPointerDrop(index);
          }}
        >
          <CardComponent
            card={foundations[index][foundations[index].length - 1] || null}
            onClick={() => {}}
            onDoubleClick={() => {
              const topCard = foundations[index][foundations[index].length - 1];
              if (topCard) onFoundationDoubleClick(topCard, index);
            }}
          />
        </div>
      ))}
    </div>
  );
};

export default Foundations;
