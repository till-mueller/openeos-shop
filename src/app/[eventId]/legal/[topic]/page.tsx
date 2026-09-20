'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { shopApi, type ShopLegalTexts } from '@/lib/api';

const TOPICS: Record<string, { key: keyof ShopLegalTexts; title: string }> = {
  impressum: { key: 'imprint', title: 'Impressum' },
  datenschutz: { key: 'privacy', title: 'Datenschutzerklärung' },
  agb: { key: 'terms', title: 'Allgemeine Geschäftsbedingungen' },
  widerruf: { key: 'cancellation', title: 'Widerrufsbelehrung' },
};

export default function LegalPage() {
  const { eventId, topic } = useParams<{ eventId: string; topic: string }>();
  const config = TOPICS[topic];
  const { data, isLoading } = useQuery({
    queryKey: ['shop', eventId],
    queryFn: () => shopApi.getShop(eventId),
  });

  if (!config) return <main style={{ padding: 24 }}>Seite nicht gefunden.</main>;
  const text = data?.data?.legal?.[config.key];

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <Link href={`/${eventId}`}>← Zurück zum Shop</Link>
      <h1 style={{ margin: '16px 0' }}>{config.title}</h1>
      {isLoading ? (
        <p>Wird geladen …</p>
      ) : text ? (
        <article className="legal-markdown">
          <ReactMarkdown>{text}</ReactMarkdown>
        </article>
      ) : (
        <p>Dieser Text wurde vom Veranstalter noch nicht hinterlegt.</p>
      )}
    </main>
  );
}