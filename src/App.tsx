import React, { useState, useEffect } from 'react';
import { User } from './types';
import { getStoredUser } from './services/auth';
import { Lobby } from './components/Lobby';
import { RoomDashboard } from './components/RoomDashboard';
import { AuthModal } from './components/AuthModal';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    setCurrentUser(user);

    // Check URL parameters for direct room joining
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setActiveRoomId(roomParam);
    }
  }, []);

  const handleJoinRoom = (roomId: string) => {
    setActiveRoomId(roomId);
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    window.history.pushState({}, '', url.toString());
  };

  const handleLeaveRoom = () => {
    setActiveRoomId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.pushState({}, '', url.toString());
  };

  if (!currentUser) {
    return <AuthModal onLogin={(u) => setCurrentUser(u)} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {activeRoomId ? (
        <RoomDashboard
          roomId={activeRoomId}
          currentUser={currentUser}
          onLeaveRoom={handleLeaveRoom}
        />
      ) : (
        <Lobby
          currentUser={currentUser}
          onJoinRoom={handleJoinRoom}
          onUpdateUser={(u) => setCurrentUser(u)}
        />
      )}
    </div>
  );
};

export default App;
