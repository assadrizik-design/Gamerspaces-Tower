import React from 'react';

type Page = 'home' | 'about' | 'privacy' | 'contact';

interface NavbarProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
}

export default function Navbar({ currentPage, setCurrentPage }: NavbarProps) {
  const navItems: { id: Page; label: string }[] = [
    { id: 'home', label: 'اللعبة' },
    { id: 'about', label: 'من نحن' },
    { id: 'privacy', label: 'سياسة الخصوصية' },
    { id: 'contact', label: 'اتصل بنا' },
  ];

  return (
    <nav className="fixed top-0 w-full z-50 bg-slate-900/80 backdrop-blur-md border-b border-white/10 safe-top">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex-shrink-0 font-bold text-xl tracking-tight text-white flex items-center gap-2 cursor-pointer" onClick={() => setCurrentPage('home')}>
            <img src="https://img.sanishtech.com/u/fcd2c5fc16d776c77696c4416f266e43.png" alt="Gamerspaces Tower" className="h-8" />
            Gamerspaces Tower
          </div>
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4 space-x-reverse">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentPage === item.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="-mr-2 flex md:hidden">
            {/* Mobile menu button could go here, but keeping it simple with flex wrap for now */}
          </div>
        </div>
        {/* Mobile menu (always visible on small screens to avoid complex state here) */}
        <div className="md:hidden flex overflow-x-auto pb-2 gap-2 hide-scrollbar">
           {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  currentPage === item.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {item.label}
              </button>
            ))}
        </div>
      </div>
    </nav>
  );
}
