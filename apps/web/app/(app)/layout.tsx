import { requireFamily } from '@/auth/guards';
import { Nav } from '@/ui/Nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireFamily();
  return (
    <>
      <Nav user={{ name: session.user.name ?? session.user.email, email: session.user.email, image: session.user.image ?? null }} />
      {children}
    </>
  );
}
