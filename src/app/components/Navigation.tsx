'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from './ThemeProvider';

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/schedule', label: 'Schedule' },
  { href: '/employees', label: 'Employees' },
];

export default function Navigation() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="glass-nav sticky top-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/kilroyslogo.png"
              alt="Kilroy's Bar & Grill"
              width={44}
              height={44}
              className="rounded-full"
            />
            <div>
              <div className="text-sm font-bold text-foreground">Kilroy&apos;s Auto-Scheduler</div>
              <div className="text-xs text-muted">Intelligent Staff Scheduling</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {links.map(link => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-500/20 text-brand-500'
                      : 'text-muted hover:bg-overlay-hover hover:text-foreground'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="rounded-lg p-2 text-muted hover:bg-overlay-hover hover:text-foreground transition-colors"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
              )}
            </button>
            <span className="rounded-full bg-brand-500/20 px-2.5 py-0.5 text-xs font-medium text-brand-500">
              DEMO MODE
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}
