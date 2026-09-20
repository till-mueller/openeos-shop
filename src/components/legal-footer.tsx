'use client';

import Link from 'next/link';
import type { ShopLegalTexts } from '@/lib/api';

const LINKS: { key: keyof ShopLegalTexts; href: string; label: string }[] = [
  { key: 'imprint', href: 'impressum', label: 'Impressum' },
  { key: 'privacy', href: 'datenschutz', label: 'Datenschutz' },
  { key: 'terms', href: 'agb', label: 'AGB' },
  { key: 'cancellation', href: 'widerruf', label: 'Widerruf' },
];

export function LegalFooter({ eventId, legal }: { eventId: string; legal: ShopLegalTexts | null | undefined }) {
  const available = LINKS.filter((l) => legal?.[l.key]);
  if (available.length === 0) return null;
  return (
    <footer style={{ marginTop: 48, padding: '16px 0', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 16, justifyContent: 'center', fontSize: 13 }}>
      {available.map((l) => (
        <Link key={l.key} href={`/${eventId}/legal/${l.href}`} style={{ color: '#6b7280' }}>
          {l.label}
        </Link>
      ))}
    </footer>
  );
}