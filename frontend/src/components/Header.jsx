import { Link, useLocation } from 'react-router-dom';

export default function Header() {
  const { pathname } = useLocation();

  return (
    <header className="bg-gray-900 text-white px-6 py-3 flex items-center justify-between shadow-lg">
      <Link to="/" className="flex items-center gap-2">
        <span className="text-blue-400 text-2xl font-bold">☰</span>
        <div>
          <p className="font-bold text-lg leading-tight">RadiologyAI</p>
          <p className="text-xs text-gray-400 leading-tight">Mammography Assistance System</p>
        </div>
      </Link>
      <nav className="flex gap-4 text-sm">
        <Link
          to="/"
          className={`px-3 py-1 rounded ${pathname === '/' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
        >
          Dashboard
        </Link>
        <Link
          to="/upload"
          className={`px-3 py-1 rounded ${pathname === '/upload' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
        >
          New Case
        </Link>
      </nav>
    </header>
  );
}
