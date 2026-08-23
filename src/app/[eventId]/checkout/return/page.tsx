'use client';

import { useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, XCircle, Loading02 } from '@untitledui/icons';

import { shopApi } from '@/lib/api';
import { useCartStore } from '@/stores/cart-store';

const cardStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: 32,
  borderRadius: 16,
  background: 'var(--paper-2)',
  border: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)',
};

const iconBubbleStyle: React.CSSProperties = {
  width: 72,
  height: 72,
  borderRadius: 999,
  margin: '0 auto 18px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export default function CheckoutReturnPage() {
  const params = useParams<{ eventId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const eventId = params.eventId;
  const checkoutId = search.get('checkoutId');
  const clearCart = useCartStore((s) => s.clear);

  const verifyQuery = useQuery({
    queryKey: ['shop-verify', checkoutId],
    queryFn: () => shopApi.verifyCheckout(checkoutId!),
    enabled: !!checkoutId,
    refetchInterval: (q) => {
      const status = q.state.data?.data.status;
      return status === 'pending' ? 2000 : false;
    },
  });

  const status = verifyQuery.data?.data.status;
  const orderNumber = verifyQuery.data?.data.orderNumber;
  const tse = verifyQuery.data?.data.tse;

  useEffect(() => {
    if (status === 'paid') {
      clearCart();
    }
  }, [status, clearCart]);

  let content: React.ReactNode;

  if (!checkoutId) {
    content = (
      <div className="empty">
        <h2>Ungültiger Link</h2>
        <p>Es fehlt eine Checkout-ID.</p>
      </div>
    );
  } else if (status === 'paid') {
    content = (
      <main className="shop-wrap" style={{ padding: '64px 0', maxWidth: 560 }}>
        <div style={cardStyle}>
          <div
            style={{
              ...iconBubbleStyle,
              background: 'color-mix(in oklab, var(--green-soft) 70%, var(--paper))',
            }}
          >
            <CheckCircle style={{ width: 36, height: 36, color: 'var(--green-ink)' }} />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Vielen Dank!</h1>
          <p style={{ color: 'var(--mute)', marginTop: 8 }}>
            Deine Bestellung wurde erfolgreich aufgenommen.
          </p>
          {orderNumber && (
            <p
              className="mono"
              style={{
                marginTop: 20,
                padding: '10px 14px',
                background: 'var(--paper)',
                border: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)',
                borderRadius: 10,
                display: 'inline-block',
                fontWeight: 700,
              }}
            >
              {orderNumber}
            </p>
          )}
          <p style={{ fontSize: 13, color: 'var(--mute)', marginTop: 20 }}>
            Eine Bestätigung wird per E-Mail verschickt.
          </p>
          {tse?.fiscalized && (
            <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 8 }}>
              Fiskalisiert (TSE-Transaktion {tse.transactionNumber})
            </p>
          )}
          <button
            type="button"
            className="btn btn--ghost"
            style={{ marginTop: 24 }}
            onClick={() => router.replace(`/${eventId}`)}
          >
            Zum Shop
          </button>
        </div>
      </main>
    );
  } else if (status === 'failed' || status === 'cancelled') {
    content = (
      <main className="shop-wrap" style={{ padding: '64px 0', maxWidth: 560 }}>
        <div style={cardStyle}>
          <div
            style={{
              ...iconBubbleStyle,
              background: 'color-mix(in oklab, var(--red) 12%, var(--paper))',
            }}
          >
            <XCircle style={{ width: 36, height: 36, color: 'var(--red)' }} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>
            {status === 'cancelled' ? 'Zahlung abgebrochen' : 'Zahlung fehlgeschlagen'}
          </h1>
          <p style={{ color: 'var(--mute)', marginTop: 8 }}>
            Dein Warenkorb ist noch da — versuch es einfach noch einmal.
          </p>
          <button
            type="button"
            className="btn btn--primary"
            style={{ marginTop: 24 }}
            onClick={() => router.replace(`/${eventId}/checkout`)}
          >
            Erneut bezahlen
          </button>
        </div>
      </main>
    );
  } else {
    content = (
      <main className="shop-wrap" style={{ padding: '64px 0', maxWidth: 560 }}>
        <div style={cardStyle}>
          <Loading02
            style={{
              width: 32,
              height: 32,
              color: 'var(--green-ink)',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 12px',
            }}
          />
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Zahlung wird verifiziert …</h1>
          <p style={{ color: 'var(--mute)', marginTop: 6 }}>
            Bitte warte einen Moment. Wir prüfen die Zahlung bei SumUp.
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    );
  }

  return (
    <>
      <div className="shop-logo-bar">
        <a href={`/${eventId}`} aria-label="OpenEOS Shop">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_dark.png" alt="OpenEOS" />
        </a>
      </div>
      {content}
    </>
  );
}
