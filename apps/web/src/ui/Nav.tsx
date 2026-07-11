'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

const links = [
  { href: '/family', label: 'Family' },
  { href: '/personal', label: 'Personal' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/holdings', label: 'Holdings' },
  { href: '/goals', label: 'Goals' },
  { href: '/import', label: 'Import' },
  { href: '/settings', label: 'Settings' },
];

type Props = { user: { name: string; email: string; image: string | null } };

export function Nav({ user }: Props) {
  const path = usePathname();
  return (
    <nav className="nav">
      <div className="nav__brand">Wealth</div>
      <div className="nav__links">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={`nav__link ${path.startsWith(l.href) ? 'nav__link--active' : ''}`}>{l.label}</Link>
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
        <button className="btn" onClick={() => signOut({ callbackUrl: '/login' })}>Sign out</button>
      </div>
    </nav>
  );
}
