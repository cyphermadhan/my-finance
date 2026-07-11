'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Users, User, CreditCard, Briefcase, Target, Upload, Settings, Menu, LogOut } from 'react-feather';

const links = [
  { href: '/family', label: 'Family', Icon: Users },
  { href: '/personal', label: 'Personal', Icon: User },
  { href: '/accounts', label: 'Accounts', Icon: CreditCard },
  { href: '/holdings', label: 'Holdings', Icon: Briefcase },
  { href: '/goals', label: 'Goals', Icon: Target },
  { href: '/import', label: 'Import', Icon: Upload },
  { href: '/settings', label: 'Settings', Icon: Settings },
];

type Props = { user: { name: string; email: string; image: string | null } };

export function Nav({ user }: Props) {
  const path = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <nav className="nav">
      <div className="nav__brand">Wealth</div>
      <button
        className="nav__toggle"
        aria-label="Toggle navigation menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((o) => !o)}
      >
        <Menu size={18} />
      </button>
      <div className={`nav__links ${menuOpen ? 'nav__links--open' : ''}`}>
        {links.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={`nav__link ${path.startsWith(href) ? 'nav__link--active' : ''}`}
            onClick={() => setMenuOpen(false)}
          >
            <Icon size={15} /> {label}
          </Link>
        ))}
      </div>
      <div className="nav__user">
        <div className="nav__avatar" title={user.email}>
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" width={28} height={28} style={{ borderRadius: '50%' }} />
          ) : (
            (user.name || user.email).slice(0, 1).toUpperCase()
          )}
        </div>
        <button className="btn" onClick={() => signOut({ callbackUrl: '/login' })}><LogOut size={15} /> Sign out</button>
      </div>
    </nav>
  );
}
