import { useNavigate } from 'react-router-dom';
import { clearAuth, getUser } from '../utils/auth';

export default function Header() {
  const navigate = useNavigate();
  const user     = getUser() || 'radiologist';

  return (
    <header className="w-full bg-gray-900 border-b border-gray-800 px-6 h-14 flex items-center justify-between flex-shrink-0 z-10">

      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.3 24.3 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23-.693L5 14.5m14.8.8 1.402 1.402c1 1 .03 2.798-1.442 2.798H4.24c-1.47 0-2.441-1.798-1.442-2.798L4.2 15.3" />
          </svg>
        </div>
        <div>
          <p className="text-white font-semibold text-sm leading-tight">RadiologyAI</p>
          <p className="text-gray-500 text-[10px] leading-tight">Mammography Platform</p>
        </div>
      </div>

      {/* Right side — user + logout */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <div className="w-7 h-7 rounded-full bg-blue-700 flex items-center justify-center">
            <span className="text-[11px] font-bold text-white uppercase">{user[0]}</span>
          </div>
          <span className="text-gray-300 text-xs font-medium">{user}</span>
          <span className="text-gray-600 text-xs">· Radiologist</span>
        </div>
        <div className="w-px h-5 bg-gray-700" />
        <button
          onClick={() => { clearAuth(); navigate('/login', { replace: true }); }}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-gray-800"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
          </svg>
          Sign out
        </button>
      </div>
    </header>
  );
}
