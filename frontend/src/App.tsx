import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { SubmitPage } from './pages/Submit';
import { VerifyPage } from './pages/Verify';
import { HistoryPage } from './pages/History';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={
            <div className="text-center py-20">
              <h1 className="text-4xl font-bold mb-4">Immutable Proof of Existence</h1>
              <p className="text-gray-600 mb-8">Secure your data on the Nervos CKB Blockchain.</p>
              <a href="/submit" className="bg-blue-600 text-white px-6 py-3 rounded-full hover:bg-blue-700 font-bold shadow-lg transition-transform hover:-translate-y-1">
                Start Hashing Now
              </a>
            </div>
          } />
          <Route path="/submit" element={<SubmitPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;