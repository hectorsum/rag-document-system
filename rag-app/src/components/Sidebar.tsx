'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { FileText, MessageSquare, BarChart2, LogOut, Brain } from 'lucide-react';
import { authApi, getAnalyticsCosts } from '@/lib/api';

const navItems = [
  { label: 'Documents', href: '/documents', icon: FileText },
  { label: 'Chat', href: '/chat', icon: MessageSquare },
  { label: 'Analytics', href: '/analytics', icon: BarChart2 },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.me().then(r => r.data as { email: string; name?: string }),
    retry: false,
  });

  const { data: costs } = useQuery({
    queryKey: ['analytics', 'costs'],
    queryFn: () => getAnalyticsCosts().then(r => r.data as { totalSpent: number }),
    retry: false,
  });

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  return (
    <aside className="w-60 bg-gray-900 text-white flex flex-col shrink-0">
      <div className="p-5 border-b border-gray-800 flex items-center gap-2">
        <Brain size={20} className="text-blue-400" />
        <span className="font-bold text-sm">RAG Platform</span>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon size={16} />
              {label}
              {label === 'Analytics' && costs && (
                <span className="ml-auto text-[10px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded-full">
                  ${costs.totalSpent.toFixed(4)}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-gray-800 space-y-1">
        {user && (
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
              {(user.name ?? user.email)[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate">{user.name ?? 'User'}</p>
              <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white rounded-lg transition-colors"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
