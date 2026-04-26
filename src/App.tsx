/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Game from './pages/Game';
import About from './pages/About';
import Privacy from './pages/Privacy';
import Contact from './pages/Contact';

type Page = 'home' | 'about' | 'privacy' | 'contact';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <Game />;
      case 'about':
        return <About />;
      case 'privacy':
        return <Privacy />;
      case 'contact':
        return <Contact />;
      default:
        return <Game />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 font-sans" dir="rtl">
      <Navbar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      
      {/* Main Content Area */}
      <main className="w-full h-full relative">
        {renderPage()}
      </main>
    </div>
  );
}

