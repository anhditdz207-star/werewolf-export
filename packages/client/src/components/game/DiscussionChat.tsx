import { FormEvent, useEffect, useRef, useState } from 'react';
import { ChatMessagePayload, ClientEvents } from '@werewolf/shared';
import { socket } from '../../lib/socket';
import { audioManager } from '../../lib/audio';

interface DiscussionChatProps {
  messages: ChatMessagePayload[];
  myPlayerId: string | null;
  onClose: () => void;
}

export function DiscussionChat({ messages, myPlayerId, onClose }: DiscussionChatProps) {
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    socket.emit(ClientEvents.CHAT_SEND, { text });
    audioManager.playSfx('click');
    setDraft('');
  }

  return (
    <div className="rm-chat-board-overlay" onClick={onClose}>
      <div className="rm-chat-board" onClick={(e) => e.stopPropagation()}>
        <div className="rm-chat-board-header">
          <span>Phòng chat</span>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rm-chat-board-close">
            ✕
          </button>
        </div>
        <div className="rm-chat-board-body">
          {messages.length === 0 && <p className="rm-chat-board-empty">Chưa có tin nhắn nào.</p>}
          {messages.map((m, i) => (
            <div key={i} className="rm-chat-board-msg">
              <span className={m.playerId === myPlayerId ? 'rm-chat-board-name is-me' : 'rm-chat-board-name'}>
                {m.nickname}
              </span>
              <span className="rm-chat-board-text">{m.text}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={handleSubmit} className="rm-chat-board-form">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Nhập tin nhắn..."
            maxLength={500}
            className="rm-chat-board-input"
            autoFocus
          />
          <button type="submit" className="rm-chat-board-send">
            Gửi
          </button>
        </form>
      </div>
    </div>
  );
}
