'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft } from '@untitledui/icons';
import Link from 'next/link';

import { shopApi, ShopApiError } from '@/lib/api';
import { useCartStore, useCartHydration, cartTotal, lineUnitPrice, type CartItem } from '@/stores/cart-store';
import { PaymentMethods } from '@/components/payment-methods';
import { LegalFooter } from '@/components/legal-footer';
import { formatPrice } from '@/lib/format';

interface FriendlyError {
  title: string;
  detail: string | null;
}

function mapCheckoutError(err: unknown): FriendlyError {
  if (err instanceof ShopApiError) {
    switch (err.code) {
      case 'SUMUP_NOT_CONFIGURED':
        return {
          title: 'Online-Bezahlung ist noch nicht eingerichtet',
          detail:
            'Bitte den Veranstalter kontaktieren — die SumUp-Online-Daten sind noch nicht hinterlegt.',
        };
      case 'INVALID_EMAIL':
        return { title: 'Ungültige E-Mail-Adresse', detail: 'Bitte prüfe deine Eingabe und versuche es erneut.' };
      case 'TABLE_NUMBER_REQUIRED':
        return { title: 'Tischnummer fehlt', detail: 'Bitte gib die Tischnummer ein, an die wir liefern sollen.' };
      case 'EMPTY_CART':
        return { title: 'Dein Warenkorb ist leer', detail: 'Lege zuerst Artikel in den Warenkorb.' };
      case 'INVALID_ITEMS':
        return {
          title: 'Mindestens ein Artikel ist nicht mehr verfügbar',
          detail: 'Bitte gehe zurück und prüfe deine Auswahl.',
        };
      case 'SHOP_NOT_FOUND':
        return {
          title: 'Shop ist nicht erreichbar',
          detail: 'Der Veranstalter hat den Shop ausgeschaltet oder die Öffnungszeiten sind vorbei.',
        };
      case 'INVALID_TOTAL':
        return {
          title: 'Gesamtbetrag ungültig',
          detail: 'Bitte gehe zurück und versuche es erneut.',
        };
    }
  }
  return {
    title: 'Etwas ist schiefgelaufen',
    detail: 'Bitte versuche es in einem Augenblick erneut.',
  };
}

export default function CheckoutPage() {
  const params = useParams<{ eventId: string }>();
  const router = useRouter();
  const eventId = params.eventId;

  const items = useCartStore((s) => s.items);
  const cartHydrated = useCartHydration();

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [fulfillment, setFulfillment] = useState<'counter_pickup' | 'table_service'>('counter_pickup');
  const [tableNumber, setTableNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [legalAccepted, setLegalAccepted] = useState(false);

  const shopQuery = useQuery({
    queryKey: ['shop', eventId],
    queryFn: () => shopApi.getShop(eventId),
    enabled: !!eventId,
    retry: false,
  });

  useEffect(() => {
    if (cartHydrated && items.length === 0) {
      router.replace(`/${eventId}`);
    }
  }, [cartHydrated, items.length, eventId, router]);

  useEffect(() => {
    const isOpen = shopQuery.data?.data.shop.isOpenNow;
    if (isOpen === false) {
      router.replace(`/${eventId}`);
    }
  }, [shopQuery.data, eventId, router]);

  const currency = shopQuery.data?.data.currency || 'EUR';
  const serviceFee = shopQuery.data?.data.shop.serviceFee ?? 0;
  const itemsTotal = cartTotal(items as CartItem[]);
  const total = itemsTotal + (items.length > 0 ? serviceFee : 0);
  const vatExempt = shopQuery.data?.data.vatExempt !== false;
  const shop = shopQuery.data?.data;
  const legalRequired = Boolean(shop?.legal?.terms || shop?.legal?.cancellation);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const nameValid = firstName.trim().length >= 2 && lastName.trim().length >= 2;
  const tableValid = fulfillment !== 'table_service' || tableNumber.trim().length > 0;
  const canSubmit =
    emailValid && nameValid && tableValid && items.length > 0 && !submitting && (!legalRequired || legalAccepted);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const response = await shopApi.createCheckout(eventId, {
        email: email.trim(),
        customerName: { firstName: firstName.trim(), lastName: lastName.trim() },
        fulfillmentType: fulfillment,
        tableNumber: fulfillment === 'table_service' ? tableNumber.trim() : undefined,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          options: i.options && i.options.length > 0 ? i.options : undefined,
        })),
      });
      const url = response.data.sumupCheckoutUrl;
      // Cart is intentionally NOT cleared here — only clear on confirmed payment.
      window.location.href = url;
    } catch (err) {
      setSubmitting(false);
      setError(mapCheckoutError(err));
    }
  };

  return (
    <>
      <div className="shop-logo-bar">
        <a href={`/${eventId}`} aria-label="OpenEOS Shop">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_dark.png" alt="OpenEOS" />
        </a>
      </div>
    <main className="shop-wrap" style={{ paddingTop: 24, paddingBottom: 80 }}>
      <Link href={`/${eventId}`} className="checkout-back">
        <ArrowLeft style={{ width: 16, height: 16 }} />
        Zurück zur Produktauswahl
      </Link>
      <h1 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, letterSpacing: '-0.02em', margin: '12px 0 0' }}>
        Kasse
      </h1>
      <p style={{ color: 'var(--mute)', marginTop: 8 }}>
        E-Mail ist Pflicht. Name + Anschrift sind freiwillig — wir nutzen sie nur für deinen Beleg.
      </p>

      <div className="checkout-layout">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <section
            style={{
              padding: 20,
              borderRadius: 14,
              background: 'var(--paper-2)',
              border: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)',
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px' }}>Wie möchtest du deine Bestellung erhalten?</h2>
            <div className="checkout-fulfillment">
              <label className={`checkout-fulfillment__opt${fulfillment === 'counter_pickup' ? ' is-selected' : ''}`}>
                <input
                  type="radio"
                  name="fulfillment"
                  value="counter_pickup"
                  checked={fulfillment === 'counter_pickup'}
                  onChange={() => setFulfillment('counter_pickup')}
                />
                <div>
                  <div className="checkout-fulfillment__title">Abholung (To Go)</div>
                  <div className="checkout-fulfillment__sub">Du holst deine Bestellung an der Abholstation ab.</div>
                </div>
              </label>
              <label className={`checkout-fulfillment__opt${fulfillment === 'table_service' ? ' is-selected' : ''}`}>
                <input
                  type="radio"
                  name="fulfillment"
                  value="table_service"
                  checked={fulfillment === 'table_service'}
                  onChange={() => setFulfillment('table_service')}
                />
                <div>
                  <div className="checkout-fulfillment__title">An den Tisch</div>
                  <div className="checkout-fulfillment__sub">Wir bringen die Bestellung direkt an deinen Tisch.</div>
                </div>
              </label>
            </div>
            {fulfillment === 'table_service' && (
              <label className="field" style={{ marginTop: 14 }}>
                <span>
                  Tischnummer <span style={{ color: 'var(--red)' }}>*</span>
                </span>
                <input
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="z. B. 12"
                  inputMode="numeric"
                  required
                  maxLength={50}
                />
              </label>
            )}
          </section>

          <section
            style={{
              padding: 20,
              borderRadius: 14,
              background: 'var(--paper-2)',
              border: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)',
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px' }}>Kontakt</h2>
            <label className="field">
              <span>
                E-Mail <span style={{ color: 'var(--red)' }}>*</span>
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="du@beispiel.de"
                autoComplete="email"
              />
            </label>
          </section>

          <section
            style={{
              padding: 20,
              borderRadius: 14,
              background: 'var(--paper-2)',
              border: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)',
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>Dein Name *</h2>
            <p style={{ fontSize: 12, color: 'var(--mute)', margin: '0 0 14px' }}>
              Steht auf deiner Bestellung — so finden wir dich bei der Ausgabe.
            </p>
            <div className="checkout-row checkout-row--name">
              <label className="field">
                <span>Vorname *</span>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" required />
              </label>
              <label className="field">
                <span>Nachname *</span>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" required />
              </label>
            </div>
          </section>

          {error && (
            <div
              role="alert"
              style={{
                display: 'flex',
                gap: 12,
                padding: '14px 16px',
                borderRadius: 12,
                background: 'color-mix(in oklab, var(--red) 8%, var(--paper))',
                color: 'var(--ink)',
                border: '1px solid color-mix(in oklab, var(--red) 30%, transparent)',
              }}
            >
              <AlertCircle style={{ width: 20, height: 20, color: 'var(--red)', flexShrink: 0, marginTop: 2 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--red)' }}>{error.title}</div>
                {error.detail && (
                  <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4 }}>{error.detail}</div>
                )}
              </div>
            </div>
          )}

          <PaymentMethods />

          {legalRequired && (
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: 'var(--ink-2)' }}>
              <input
                type="checkbox"
                checked={legalAccepted}
                onChange={(e) => setLegalAccepted(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <span>
                Ich akzeptiere die{' '}
                {shop?.legal?.terms && <Link href={`/${eventId}/legal/agb`} target="_blank">AGB</Link>}
                {shop?.legal?.terms && shop?.legal?.cancellation && ' und habe die '}
                {shop?.legal?.cancellation && <Link href={`/${eventId}/legal/widerruf`} target="_blank">Widerrufsbelehrung</Link>}
                {' '}zur Kenntnis genommen.
              </span>
            </label>
          )}

          <button type="submit" className="btn btn--primary" disabled={!canSubmit} style={{ padding: '14px 22px', fontSize: 15 }}>
            {submitting ? 'Wird verbunden …' : 'Zahlungspflichtig bestellen'}
          </button>
        </form>

        <aside className="checkout-summary">
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px' }}>Bestellung</h2>
          <div
            style={{
              fontSize: 12,
              color: 'var(--mute)',
              padding: '8px 10px',
              marginBottom: 12,
              borderRadius: 8,
              background: 'var(--paper)',
              border: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)',
            }}
          >
            {fulfillment === 'table_service'
              ? `An den Tisch${tableNumber.trim() ? ` ${tableNumber.trim()}` : ''}`
              : 'Abholung (To Go)'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((i) => (
              <div
                key={i.signature ?? i.productId}
                style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}
              >
                <div style={{ minWidth: 0 }}>
                  <span style={{ color: 'var(--ink-2)' }}>
                    {i.quantity} × {i.name}
                  </span>
                  {i.options && i.options.length > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 1 }}>
                      {i.options
                        .map((o) => (o.excluded ? `ohne ${o.option}` : `+ ${o.option}`))
                        .join(' · ')}
                    </div>
                  )}
                </div>
                <span className="mono">{formatPrice(lineUnitPrice(i) * i.quantity, currency)}</span>
              </div>
            ))}
          </div>
          {serviceFee > 0 && (
            <div
              style={{
                marginTop: 14,
                paddingTop: 12,
                borderTop: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                fontSize: 13,
                color: 'var(--ink-2)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Zwischensumme</span>
                <span className="mono">{formatPrice(itemsTotal, currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Servicegebühr</span>
                <span className="mono">{formatPrice(serviceFee, currency)}</span>
              </div>
            </div>
          )}
          <div
            style={{
              marginTop: 16,
              paddingTop: 14,
              borderTop: '1px solid color-mix(in oklab, var(--ink) 10%, transparent)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
              Gesamt
            </span>
            <span className="mono" style={{ fontSize: 22, fontWeight: 700 }}>
              {formatPrice(total, currency)}
            </span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 12 }}>
            {vatExempt
              ? 'Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen.'
              : 'Alle Preise inkl. gesetzlicher MwSt.'}
          </p>
          <p style={{ fontSize: 11, color: 'var(--mute)', marginTop: 12 }}>
            Bezahlung erfolgt sicher über SumUp. Erst nach erfolgreicher Zahlung wird die Bestellung erstellt.
          </p>
        </aside>
      </div>
    </main>
    <LegalFooter eventId={eventId} legal={shopQuery.data?.data.legal} />
    </>
  );
}
