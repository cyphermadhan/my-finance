import NextAuth from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import Google from 'next-auth/providers/google';
import { db, schema } from '@/db/client';
import { eq } from 'drizzle-orm';

export type AppJWT = JWT & {
  userId?: string;
  familyId?: string | null;
  mfaEnabled?: boolean;
  mfaVerifiedAt?: number;
};

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      familyId?: string | null;
      mfaEnabled: boolean;
      mfaVerified: boolean;
    };
  }
}

const MFA_TTL_SECONDS = 60 * 60 * 12; // 12h — re-challenge after that

export const { handlers, auth, signIn, signOut, unstable_update: updateSession } = NextAuth({
  session: { strategy: 'jwt' },
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== 'google' || !user.email || !account.providerAccountId) return false;
      if (!db) return true; // dev: allow sign-in without DB, guards handle rest
      const providerAccountId = account.providerAccountId;
      const email = user.email;
      const [existing] = await db.select().from(schema.users).where(eq(schema.users.googleSub, providerAccountId));
      if (existing) {
        await db
          .update(schema.users)
          .set({ name: user.name ?? existing.name, image: user.image ?? existing.image })
          .where(eq(schema.users.id, existing.id));
      } else {
        await db.insert(schema.users).values({
          googleSub: providerAccountId,
          email,
          name: user.name ?? null,
          image: user.image ?? null,
        });
      }
      return true;
    },
    async jwt({ token, account, trigger, session }) {
      const t = token as AppJWT;
      // On first sign-in, resolve user + family
      if (account && typeof t.email === 'string' && db) {
        const [row] = await db.select().from(schema.users).where(eq(schema.users.email, t.email));
        if (row) {
          t.userId = row.id;
          t.mfaEnabled = !!row.totpEnabledAt;
          const [mem] = await db
            .select()
            .from(schema.familyMember)
            .where(eq(schema.familyMember.userId, row.id))
            .limit(1);
          t.familyId = mem?.familyId ?? null;
        }
      }
      // Manual updates from server actions (e.g. after MFA verification, family join)
      if (trigger === 'update' && session && typeof session === 'object') {
        const s = session as Partial<AppJWT>;
        if (typeof s.mfaVerifiedAt === 'number') t.mfaVerifiedAt = s.mfaVerifiedAt;
        if (typeof s.familyId === 'string' || s.familyId === null) t.familyId = s.familyId;
        if (typeof s.mfaEnabled === 'boolean') t.mfaEnabled = s.mfaEnabled;
      }
      return t;
    },
    async session({ session, token }) {
      const t = token as AppJWT;
      const now = Math.floor(Date.now() / 1000);
      const verifiedAt = typeof t.mfaVerifiedAt === 'number' ? t.mfaVerifiedAt : 0;
      // Type cast — our Session augmentation adds the extra fields
      (session as unknown as { user: Record<string, unknown> }).user = {
        id: t.userId ?? '',
        email: typeof t.email === 'string' ? t.email : '',
        emailVerified: null,
        name: typeof t.name === 'string' ? t.name : null,
        image: typeof t.picture === 'string' ? t.picture : null,
        familyId: t.familyId ?? null,
        mfaEnabled: !!t.mfaEnabled,
        mfaVerified: verifiedAt > 0 && now - verifiedAt < MFA_TTL_SECONDS,
      };
      return session;
    },
    async authorized({ auth: session, request }) {
      const url = new URL(request.url);
      const path = url.pathname;
      const publicPaths = ['/login', '/mfa-challenge', '/mfa-enroll', '/onboarding', '/api', '/_next', '/favicon.ico'];
      if (publicPaths.some((p) => path.startsWith(p))) return true;
      if (!session) return Response.redirect(new URL('/login', request.url));
      if (!session.user.mfaVerified) return Response.redirect(new URL('/mfa-challenge', request.url));
      if (!session.user.familyId) return Response.redirect(new URL('/onboarding', request.url));
      return true;
    },
  },
});
