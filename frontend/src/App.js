import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import UploadPage from './pages/UploadPage';
import AnalysisPage from './pages/AnalysisPage';
import ReportPage from './pages/ReportPage';
import LoginPage from './pages/LoginPage';
import { isAuthenticated } from './utils/auth';

function PrivateRoute({ children }) {
  return isAuthenticated() ? children : <Navigate to="/login" replace />;
}

function Shell() {
  const { pathname } = useLocation();
  const isViewer = pathname.startsWith('/analysis');
  const isReport = pathname.startsWith('/cases') && pathname.endsWith('/report');

  // Full-screen no-chrome pages (analysis + report)
  if (isViewer || isReport) {
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-gray-900">
        <main className="flex-1 min-h-0 overflow-hidden">
          <Routes>
            <Route path="/analysis/:caseId"     element={<PrivateRoute><AnalysisPage /></PrivateRoute>} />
            <Route path="/cases/:caseId/report" element={<PrivateRoute><ReportPage /></PrivateRoute>} />
          </Routes>
        </main>
      </div>
    );
  }

  // Full-width header + sidebar + content layout
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Full-width top header */}
      <Header />
      {/* Below header: sidebar + main content */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-slate-50">
          <Routes>
            <Route path="/"       element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/upload" element={<PrivateRoute><UploadPage /></PrivateRoute>} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*"     element={<Shell />} />
      </Routes>
    </BrowserRouter>
  );
}
