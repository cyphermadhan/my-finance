import { NextResponse } from 'next/server';
import { templateForKind } from '@/ingest/templates';

export async function GET(_req: Request, { params }: { params: { kind: string } }) {
  const kind = params.kind === 'holdings' ? 'holdings' : params.kind === 'transactions' ? 'transactions' : null;
  if (!kind) return new NextResponse('Not found', { status: 404 });
  const body = templateForKind(kind);
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${kind}.csv"`,
    },
  });
}
