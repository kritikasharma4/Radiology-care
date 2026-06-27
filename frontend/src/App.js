import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import UploadPage from './pages/UploadPage';
import AnalysisPage from './pages/AnalysisPage';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <main className="flex-1">
          <Routes>
            <Route path="/"                  element={<Dashboard />} />
            <Route path="/upload"            element={<UploadPage />} />
            <Route path="/analysis/:caseId"  element={<AnalysisPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
