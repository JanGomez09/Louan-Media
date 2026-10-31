import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Send } from 'lucide-react';
import { API_URL, api, getToken } from '../api';
import { useApp } from '../AppContext';
import { Avatar } from '../components/Media';

const hour = (d) => new Date(d).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
const day = (d) => new Date(d).toLocaleDateString('es', { dateStyle: 'long' });

export default function Chat() {
  const { profile, getPerson } = useApp();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [online, setOnline] = useState(false);
  const [error, setError] = useState('');
  const socketRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    let alive = true;
    api.get('/messages').then((m) => alive && setMessages(m)).catch((e) => setError(e.message));

    const socket = io(API_URL, {
      // Se lee el token guardado en cada (re)conexión
      auth: (cb) => cb({ token: getToken() }),
    });
    socketRef.current = socket;
    socket.on('connect', () => setOnline(true));
    socket.on('disconnect', () => setOnline(false));
    socket.on('connect_error', () => setOnline(false));
    socket.on('chat:message', (m) =>
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
    );
    return () => {
      alive = false;
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  function send(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t || !online) return;
    socketRef.current.emit('chat:send', t);
    setText('');
  }

  const other = getPerson(messages.find((m) => m.sender_uid !== profile.uid)?.sender_uid);

  return (
    <section className="page chat">
      <header className="chat-head">
        <h1>Chat</h1>
        <span className={`dot ${online ? 'on' : ''}`} title={online ? 'Conectado' : 'Reconectando…'} />
        <span className="muted small">{online ? 'Conectado' : 'Conectando…'}</span>
      </header>
      {error && <p className="notice">{error}</p>}
      <div className="chat-list">
        {messages.length === 0 && !error && <p className="muted center-text">Escribe el primer mensaje.</p>}
        {messages.map((m, i) => {
          const mine = m.sender_uid === profile.uid;
          const newDay = i === 0 || day(messages[i - 1].created_at) !== day(m.created_at);
          return (
            <div key={m.id}>
              {newDay && <div className="day-sep">{day(m.created_at)}</div>}
              <div className={`bubble-row ${mine ? 'mine' : ''}`}>
                {!mine && <Avatar person={getPerson(m.sender_uid)} size={28} />}
                <div className="bubble">
                  <span>{m.text}</span>
                  <time>{hour(m.created_at)}</time>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form className="chat-form" onSubmit={send}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={other?.username ? `Mensaje para ${other.username}` : 'Escribe un mensaje'}
          maxLength={2000}
        />
        <button className="btn round" disabled={!text.trim() || !online} aria-label="Enviar">
          <Send size={20} />
        </button>
      </form>
    </section>
  );
}
