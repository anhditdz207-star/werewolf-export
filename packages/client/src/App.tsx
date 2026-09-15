import { useEffect, useRef, useState } from 'react';
import { ClientEvents, FriendListPayload, RoomRejoinAck, ServerEvents } from '@werewolf/shared';
import { GameProvider, useGameDispatch, useGameState } from './store/GameContext';
import { useSocketConnection } from './hooks/useSocketConnection';
import { socket } from './lib/socket';
import { getDeviceId } from './lib/deviceId';
import { LoginPage } from './pages/LoginPage';
import { LobbyPage } from './pages/LobbyPage';
import { CreateRoomPage } from './pages/CreateRoomPage';
import { JoinRoomPage } from './pages/JoinRoomPage';
import { RoomPage } from './pages/RoomPage';
import { CardGallery } from './components/cards/CardGallery';
import { IntroScreen } from './components/common/IntroScreen';

const NICKNAME_STORAGE_KEY = 'masoi_nickname';
const AVATAR_STORAGE_KEY = 'masoi_avatar';
const ROOM_SESSION_STORAGE_KEY = 'masoi_room_session';
const DEFAULT_AVATAR = '/ui/avatars/mystery.jpg';

interface StoredRoomSession {
  roomId: string;
  playerId: string;
}

function readStoredRoomSession(): StoredRoomSession | null {
  try {
    const raw = localStorage.getItem(ROOM_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.roomId === 'string' && typeof parsed?.playerId === 'string') return parsed;
    return null;
  } catch {
    return null;
  }
}

function clearStoredRoomSession() {
  localStorage.removeItem(ROOM_SESSION_STORAGE_KEY);
}

function AppInner() {
  useSocketConnection();
  const dispatch = useGameDispatch();
  const { myPlayerId } = useGameState();
  const [showIntro, setShowIntro] = useState(() => !sessionStorage.getItem('masoi_intro_shown'));
  const [nickname, setNickname] = useState<string | null>(() => localStorage.getItem(NICKNAME_STORAGE_KEY));
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => localStorage.getItem(AVATAR_STORAGE_KEY) ?? DEFAULT_AVATAR);
  const [myId, setMyId] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [joiningRoom, setJoiningRoom] = useState(false);
  const [showCardGallery, setShowCardGallery] = useState(false);
  // While a stored session exists but we haven't heard back from the
  // server yet, hold off rendering the lobby — otherwise the user sees a
  // flash of "create/join room" before snapping back into their game.
  const [rejoinPending, setRejoinPending] = useState(() => readStoredRoomSession() !== null);
  const rejoinAttempted = useRef(false);

  useEffect(() => {
    if (!nickname) return;
    const identify = () =>
      socket.emit(ClientEvents.IDENTIFY, { deviceId: getDeviceId(), nickname, avatarUrl });
    identify();
    socket.on('connect', identify);
    return () => {
      socket.off('connect', identify);
    };
  }, [nickname, avatarUrl]);

  // Attempt to resume a previous room session (e.g. after a page reload)
  // exactly once per app load, as soon as the socket is connected.
  useEffect(() => {
    const stored = readStoredRoomSession();
    if (!stored) {
      setRejoinPending(false);
      return;
    }

    function attemptRejoin() {
      if (rejoinAttempted.current || !stored) return;
      rejoinAttempted.current = true;
      socket.emit(ClientEvents.ROOM_REJOIN, stored, (res: RoomRejoinAck) => {
        if (res.ok && res.roomId && res.playerId) {
          dispatch({ type: 'SET_MY_PLAYER_ID', playerId: res.playerId });
          setRoomId(res.roomId);
        } else {
          clearStoredRoomSession();
        }
        setRejoinPending(false);
      });
    }

    if (socket.connected) {
      attemptRejoin();
    } else {
      socket.on('connect', attemptRejoin);
    }
    return () => {
      socket.off('connect', attemptRejoin);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the persisted session in sync with whatever room we're currently in.
  useEffect(() => {
    if (roomId && myPlayerId) {
      localStorage.setItem(ROOM_SESSION_STORAGE_KEY, JSON.stringify({ roomId, playerId: myPlayerId }));
    }
  }, [roomId, myPlayerId]);

  useEffect(() => {
    const onFriendList = (payload: FriendListPayload) => {
      setMyId(payload.myFriendCode);
      setPendingCount(payload.pendingRequests.length);
    };
    socket.on(ServerEvents.FRIEND_LIST, onFriendList);
    return () => {
      socket.off(ServerEvents.FRIEND_LIST, onFriendList);
    };
  }, []);

  function handleLogin(name: string, googleAvatarUrl?: string | null) {
    localStorage.setItem(NICKNAME_STORAGE_KEY, name);
    setNickname(name);
    if (googleAvatarUrl) {
      localStorage.setItem(AVATAR_STORAGE_KEY, googleAvatarUrl);
      setAvatarUrl(googleAvatarUrl);
    }
  }

  function handleRenameNickname(name: string) {
    localStorage.setItem(NICKNAME_STORAGE_KEY, name);
    setNickname(name);
  }

  function handleAvatarChange(dataUrl: string) {
    try {
      localStorage.setItem(AVATAR_STORAGE_KEY, dataUrl);
    } catch {
      /* localStorage quota exceeded — keep the avatar in memory for this session only. */
    }
    setAvatarUrl(dataUrl);
    if (roomId) {
      socket.emit(ClientEvents.PLAYER_UPDATE_AVATAR, { avatarUrl: dataUrl });
    }
  }

  function handleLeaveRoom() {
    socket.emit(ClientEvents.ROOM_LEAVE);
    dispatch({ type: 'LEAVE_ROOM' });
    setRoomId(null);
    clearStoredRoomSession();
  }

  function handleLogout() {
    localStorage.removeItem(NICKNAME_STORAGE_KEY);
    clearStoredRoomSession();
    setRoomId(null);
    setCreatingRoom(false);
    setJoiningRoom(false);
    setNickname(null);
  }

  function renderScreen() {
    if (!nickname) return <LoginPage onLogin={handleLogin} />;
    if (roomId) {
      return <RoomPage roomId={roomId} onLeaveRoom={handleLeaveRoom} onOpenCardGallery={() => setShowCardGallery(true)} />;
    }
    if (creatingRoom) {
      return (
        <CreateRoomPage
          nickname={nickname}
          avatarUrl={avatarUrl}
          onRoomCreated={(id) => {
            setCreatingRoom(false);
            setRoomId(id);
          }}
          onCancel={() => setCreatingRoom(false)}
          onOpenCardGallery={() => setShowCardGallery(true)}
        />
      );
    }
    if (joiningRoom) {
      return (
        <JoinRoomPage
          nickname={nickname}
          avatarUrl={avatarUrl}
          onRoomJoined={(id) => {
            setJoiningRoom(false);
            setRoomId(id);
          }}
          onCancel={() => setJoiningRoom(false)}
          onOpenCardGallery={() => setShowCardGallery(true)}
        />
      );
    }
    return (
      <LobbyPage
        nickname={nickname}
        myId={myId}
        friendRequestCount={pendingCount}
        avatarUrl={avatarUrl}
        onRenameNickname={handleRenameNickname}
        onAvatarChange={handleAvatarChange}
        onOpenCreateRoom={() => setCreatingRoom(true)}
        onOpenJoinRoom={() => setJoiningRoom(true)}
        onLogout={handleLogout}
        onOpenCardGallery={() => setShowCardGallery(true)}
      />
    );
  }

  if (showIntro) {
    return (
      <IntroScreen
        onFinish={() => {
          sessionStorage.setItem('masoi_intro_shown', '1');
          setShowIntro(false);
        }}
      />
    );
  }

  if (rejoinPending) {
    // Brief, deliberately minimal beat while ROOM_REJOIN resolves — avoids
    // flashing the lobby/create-room UI before snapping back into an
    // in-progress game after a reload. Body already carries the app's dark
    // gradient (see index.css), so this just needs to fill the viewport
    // without introducing a stray white flash or layout shift.
    return <div className="fixed inset-0 bg-night-950" />;
  }

  return (
    <>
      {renderScreen()}
      {showCardGallery && <CardGallery onClose={() => setShowCardGallery(false)} />}
    </>
  );
}

export function App() {
  return (
    <GameProvider>
      <AppInner />
    </GameProvider>
  );
}
