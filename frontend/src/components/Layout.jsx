import { NavLink, Outlet } from 'react-router-dom';
import { Home, MessageCircle, PlusSquare, Images, Settings } from 'lucide-react';

const items = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/chat', label: 'Chat', icon: MessageCircle },
  { to: '/publicar', label: 'Publicar', icon: PlusSquare },
  { to: '/album', label: 'Álbum', icon: Images },
  { to: '/config', label: 'Ajustes', icon: Settings },
];

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
      </span>
      <span className="brand-name">Uscial Media</span>
    </div>
  );
}

export default function Layout() {
  return (
    <div className="shell">
      <nav className="nav" aria-label="Secciones">
        <Brand />
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="nav-link">
            <Icon size={24} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
