import React from 'react';
import { Card } from '../types';
import CardComponent from './Card';
import './StockWaste.css';

interface StockWasteProps {
  deck: Card[];
  waste: Card[];
  pointerDragCardId: string | null;
  onDeckClick: () => void;
  onWasteDoubleClick: (card: Card) => void;
  onWastePointerDown: (e: React.PointerEvent<HTMLDivElement>, card: Card) => void;
}

const StockWaste: React.FC<StockWasteProps> = ({
  deck,
  waste,
  pointerDragCardId,
  onDeckClick,
  onWasteDoubleClick,
  onWastePointerDown,
}) => {
  return (
    <div className="stock-waste">
      <div className="stock">
        <CardComponent 
          card={null} 
          onClick={onDeckClick} 
          faceDown={deck.length > 0} 
        />
        <div className="stock-count">{deck.length}</div>
      </div>
      <div className="waste">
        <CardComponent
          card={waste[0] || null}
          onClick={() => {}}
          onDoubleClick={() => waste[0] && onWasteDoubleClick(waste[0])}
          draggable={!!waste[0]}
          onPointerDown={(e) => waste[0] && onWastePointerDown(e, waste[0])}
          isDragging={pointerDragCardId === waste[0]?.id}
        />
      </div>
    </div>
  );
};

export default StockWaste;
