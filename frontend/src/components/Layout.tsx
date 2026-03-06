import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path ? "text-blue-600 font-bold" : "text-gray-600 hover:text-blue-500";

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
            HashThis 🛡️
          </Link>
          <nav className="flex gap-6">
            <Link to="/" className={isActive('/')}>Home</Link>
            <Link to="/submit" className={isActive('/submit')}>Anchor Hash</Link>
            <Link to="/verify" className={isActive('/verify')}>Verify</Link>
            <Link to="/history" className={isActive('/history')}>History</Link>
          </nav>
        </div>
      </header>
      
      <main className="flex-grow max-w-4xl mx-auto w-full p-4 py-8">
        {children}
      </main>

      <footer className="text-center py-6 text-gray-400 text-sm">
        <p>Built with Nervos CKB & Lumos SDK</p>
      </footer>
    </div>
  );
};