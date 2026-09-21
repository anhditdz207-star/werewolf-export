import { useEffect, useState } from 'react';
import { CARD_CATALOG } from '../../data/cardCatalog';

interface CardGalleryProps {
  onClose: () => void;
}

const CLOSE_ANIMATION_MS = 220;

export function CardGallery({ onClose }: CardGalleryProps) {
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [isClosingCard, setIsClosingCard] = useState(false);

  function openCard(id: string) {
    setOpenCardId(id);
    setIsClosingCard(false);
  }

  function closeCard() {
    setIsClosingCard(true);
    setTimeout(() => {
      setOpenCardId(null);
      setIsClosingCard(false);
    }, CLOSE_ANIMATION_MS);
  }

  // Esc closes whichever layer is currently open (zoomed card first, then the gallery).
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (openCardId) closeCard();
      else onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [openCardId, onClose]);

  const openCardInfo = CARD_CATALOG.find((c) => c.id === openCardId);

  return (
    <div className="fixed inset-0 z-40 bg-night-950 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5">
          <h1 className="font-display text-3xl text-moon-400">Danh Sách Lá Bài</h1>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-mist-600/50 px-3 py-1.5 text-sm text-parchment-100 hover:border-moon-400"
          >
            Đóng
          </button>
        </div>
        <p className="text-sm text-mist-400 mb-5">
          Chạm vào một lá bài để phóng to và đọc mô tả vai trò. Chạm ra ngoài để thu nhỏ lại.
        </p>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {CARD_CATALOG.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => openCard(card.id)}
              className="group flex flex-col items-center gap-1.5 rounded-lg border border-mist-600/30 bg-night-800 p-1.5 transition-transform hover:-translate-y-0.5 hover:border-moon-400"
            >
              <img
                src={`/cards/thumb/${card.id}.jpg`}
                alt={card.title}
                loading="lazy"
                className="w-full aspect-[2/3] object-cover rounded"
              />
              <span className="text-xs text-parchment-100 text-center leading-tight pb-1">
                {card.title}
              </span>
            </button>
          ))}
        </div>
      </div>

      {openCardInfo && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 transition-opacity duration-200 ${
            isClosingCard ? 'opacity-0' : 'opacity-100'
          }`}
          onClick={closeCard}
        >
          <div
            className={`flex flex-col items-center gap-3 transition-transform duration-200 ${
              isClosingCard ? 'scale-75' : 'scale-100'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={`/cards/full/${openCardInfo.id}.jpg`}
              alt={openCardInfo.title}
              className="max-h-[65vh] rounded-xl border border-moon-400/50 shadow-[0_0_40px_rgba(244,213,141,0.25)]"
            />
            <p className="font-display text-2xl text-moon-400">{openCardInfo.title}</p>
            <p className="max-w-md text-center text-sm text-parchment-100/90 leading-relaxed px-2">
              {openCardInfo.description}
            </p>
            <p className="text-xs text-mist-400">Chạm ra ngoài để đóng</p>
          </div>
        </div>
      )}
    </div>
  );
}
