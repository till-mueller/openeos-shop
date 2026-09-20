'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { ShoppingCart01, AlertTriangle, Clock, Trash01, X } from '@untitledui/icons';

import {
  shopApi,
  type ShopProduct,
  type ShopCategory,
  type ShopMeta,
  type ShopEvent,
  type SelectedOption,
} from '@/lib/api';
import {
  useCartStore,
  useCartHydration,
  cartCount,
  cartTotal,
  lineUnitPrice,
  type CartItem,
} from '@/stores/cart-store';
import { ProductOptionsSheet } from './components/product-options-sheet';
import { APP_VERSION } from '@/lib/version';
import { ProductImage } from '@/components/product-image';
import { LegalFooter } from '@/components/legal-footer';
import { formatPrice } from '@/lib/format';

const WEEKDAY_LABELS: Record<string, string> = {
  mon: 'Mo',
  tue: 'Di',
  wed: 'Mi',
  thu: 'Do',
  fri: 'Fr',
  sat: 'Sa',
  sun: 'So',
};

function todaysWindow(meta: ShopMeta): string | null {
  if (!meta.openingHours) return null;
  const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
  const today = keys[new Date().getDay()];
  const window = meta.openingHours[today];
  if (!window) return null;
  return `${window.start} – ${window.end}`;
}

function weeklySchedule(meta: ShopMeta): { label: string; window: string }[] {
  if (!meta.openingHours) return [];
  return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    .map((k) => {
      const w = meta.openingHours?.[k as keyof typeof meta.openingHours];
      return {
        label: WEEKDAY_LABELS[k],
        window: w ? `${w.start} – ${w.end}` : 'geschlossen',
      };
    });
}

export default function ShopEventPage() {
  const params = useParams<{ eventId: string }>();
  const router = useRouter();
  const eventId = params.eventId;
  const items = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const decrement = useCartStore((s) => s.decrement);
  const remove = useCartStore((s) => s.remove);
  const setEventId = useCartStore((s) => s.setEventId);
  const cartHydrated = useCartHydration();

  const [optionsForProduct, setOptionsForProduct] = useState<ShopProduct | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [closing, setClosing] = useState(false);
  const dragStartY = useRef<number | null>(null);

  const closeMobileSheet = useCallback(() => {
    setClosing(true);
    setDragOffset(0);
    window.setTimeout(() => {
      setClosing(false);
      setMobileCartOpen(false);
    }, 200);
  }, []);

  const handleSheetTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  };
  const handleSheetTouchMove = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    setDragOffset(delta > 0 ? delta : 0);
  };
  const handleSheetTouchEnd = () => {
    if (dragStartY.current === null) return;
    if (dragOffset > 100) {
      closeMobileSheet();
    } else {
      setDragOffset(0);
    }
    dragStartY.current = null;
  };

  useEffect(() => {
    setEventId(eventId);
  }, [eventId, setEventId]);

  useEffect(() => {
    if (cartHydrated && items.length === 0) setMobileCartOpen(false);
  }, [cartHydrated, items.length]);

  const shopQuery = useQuery({
    queryKey: ['shop', eventId],
    queryFn: () => shopApi.getShop(eventId),
    enabled: !!eventId,
    retry: false,
  });

  const categoriesQuery = useQuery({
    queryKey: ['shop-categories', eventId],
    queryFn: () => shopApi.getCategories(eventId),
    enabled: shopQuery.isSuccess,
  });

  const productsQuery = useQuery({
    queryKey: ['shop-products', eventId],
    queryFn: () => shopApi.getProducts(eventId),
    enabled: shopQuery.isSuccess,
  });

  const products = productsQuery.data?.data ?? [];
  const categories = categoriesQuery.data?.data ?? [];
  const currency = shopQuery.data?.data.currency || 'EUR';
  const shopMeta = shopQuery.data?.data.shop;
  const isOpen = shopMeta?.isOpenNow ?? true;
  const isTest = shopMeta?.testMode ?? false;
  const serviceFee = shopMeta?.serviceFee ?? 0;
  const event = shopQuery.data?.data.event;

  const grouped = useMemo(() => {
    const byCat = new Map<string, { category: ShopCategory | null; items: ShopProduct[] }>();
    for (const c of categories) {
      byCat.set(c.id, { category: c, items: [] });
    }
    const uncategorised: ShopProduct[] = [];
    for (const p of products) {
      if (p.categoryId && byCat.has(p.categoryId)) {
        byCat.get(p.categoryId)!.items.push(p);
      } else {
        uncategorised.push(p);
      }
    }
    const list = Array.from(byCat.values()).filter((g) => g.items.length > 0);
    if (uncategorised.length) {
      list.push({ category: null, items: uncategorised });
    }
    return list;
  }, [categories, products]);

  if (shopQuery.isLoading) {
    return (
      <div className="empty">
        <h2>Shop wird geladen…</h2>
      </div>
    );
  }

  if (shopQuery.isError || !event) {
    return (
      <>
        <div className="shop-logo-bar">
          <a href="/" aria-label="OpenEOS Shop">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_dark.png" alt="OpenEOS" />
          </a>
        </div>
        <div className="empty">
          <h2>Shop nicht gefunden</h2>
          <p>Dieser Event-Shop ist nicht aktiviert oder die ID ist ungültig.</p>
        </div>
      </>
    );
  }

  const count = cartCount(items as CartItem[]);
  const itemsTotal = cartTotal(items as CartItem[]);
  const total = itemsTotal + (items.length > 0 ? serviceFee : 0);
  const vatExempt = shopQuery.data?.data.vatExempt !== false;

  const handleProductAdd = (product: ShopProduct) => {
    if (product.options?.groups && product.options.groups.length > 0) {
      setOptionsForProduct(product);
      return;
    }
    addItem({ productId: product.id, name: product.name, unitPrice: product.price });
  };

  const handleOptionsConfirm = (product: ShopProduct, options: SelectedOption[]) => {
    addItem({
      productId: product.id,
      name: product.name,
      unitPrice: product.price,
      options,
    });
    setOptionsForProduct(null);
  };

  return (
    <>
      {/* Logo bar */}
      <div className="shop-logo-bar">
        <a href="/" aria-label="OpenEOS Shop">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_dark.png" alt="OpenEOS" />
        </a>
      </div>

      {/* Context strip */}
      <header className="shop-header">
        <span className="shop-header__crumb">
          <b>{event.organizationName}</b> · Online-Shop
        </span>
        <span className="mono" style={{ color: 'var(--mute-2)' }}>
          {isTest ? 'TEST · ' : ''}LIVE
        </span>
      </header>

      <main className="shop-wrap">
        {/* Test mode banner */}
        {isTest && (
          <div className="shop-banner shop-banner--test">
            <AlertTriangle style={{ width: 18, height: 18, flexShrink: 0 }} />
            <span>
              <b>Test-Modus.</b> Bestellungen sind möglich, werden aber als Test-Bestellungen markiert.
            </span>
          </div>
        )}

        {/* Hero */}
        <section className="shop-hero">
          <div className="shop-hero__meta">
            <b>{event.organizationName}</b>
            {event.startDate && (
              <>
                <span style={{ opacity: 0.4 }}>·</span>
                <span>{new Date(event.startDate).toLocaleDateString('de-DE')}</span>
              </>
            )}
          </div>
          <h1>{event.name}</h1>
          {event.description && (
            <p style={{ color: 'var(--mute)', fontSize: 16, marginTop: 14, maxWidth: 720 }}>
              {event.description}
            </p>
          )}
        </section>

        {/* Closed-state */}
        {!isOpen && shopMeta && (
          <ClosedCard meta={shopMeta} event={event} />
        )}

        {/* Layout: products on the left, sticky cart on the right */}
        <div className="shop-layout">
          <div className="shop-layout__products">
            {grouped.length === 0 ? (
              <div className="empty">
                <h2>Keine Artikel</h2>
                <p>Noch sind keine Artikel verfügbar — schau später noch einmal vorbei.</p>
              </div>
            ) : (
              <>
                {grouped.length > 1 && (
                  <nav className="shop-cat-jumps" aria-label="Kategorien">
                    {grouped.map((group, idx) => {
                      const id = group.category?.id ?? `uncat-${idx}`;
                      return (
                        <a
                          key={id}
                          href={`#cat-${id}`}
                          className="shop-cat-jumps__chip"
                        >
                          {group.category?.icon && <span aria-hidden="true">{group.category.icon}</span>}
                          {group.category?.name ?? 'Sonstiges'}
                        </a>
                      );
                    })}
                  </nav>
                )}
                {grouped.map((group, idx) => {
                  const id = group.category?.id ?? `uncat-${idx}`;
                  return (
                    <section key={id} id={`cat-${id}`} className="shop-cat-section">
                      <h2 className="shop-cat-section__title">
                        {group.category?.icon && <span aria-hidden="true">{group.category.icon}</span>}
                        {group.category?.name ?? 'Sonstiges'}
                      </h2>
                      {group.category?.description && (
                        <p className="shop-cat-section__sub">{group.category.description}</p>
                      )}
                      <div className="products products--in-section">
                        {group.items.map((p) => (
                          <ProductCard
                            key={p.id}
                            product={p}
                            currency={currency}
                            disabled={!isOpen}
                            onAdd={() => handleProductAdd(p)}
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </>
            )}
          </div>

          {/* Sticky cart sidebar (md+) */}
          <aside className="shop-layout__cart">
            <div className="shop-cart">
              <div className="shop-cart__head">
                <h2 className="shop-cart__title">
                  <ShoppingCart01 style={{ width: 18, height: 18, color: 'var(--green-ink)' }} />
                  Warenkorb
                </h2>
                {count > 0 && <span className="shop-cart__count">{count}</span>}
              </div>
              {items.length === 0 ? (
                <p className="shop-cart__empty">Dein Warenkorb ist leer</p>
              ) : (
                <>
                  <div className="shop-cart__items">
                    {items.map((i) => (
                      <div key={i.signature ?? i.productId} className="shop-cart__row">
                        <div className="shop-cart__row-left">
                          <div style={{ minWidth: 0 }}>
                            <div className="shop-cart__name">{i.name}</div>
                            {i.options && i.options.length > 0 && (
                              <div className="shop-cart__opts">
                                {i.options.map((o) =>
                                  o.excluded ? `ohne ${o.option}` : `+ ${o.option}`,
                                ).join(' · ')}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="shop-cart__row-right">
                          <span className="shop-cart__price mono">
                            {formatPrice(lineUnitPrice(i) * i.quantity, currency)}
                          </span>
                          <div className="qty" style={{ borderRadius: 6, padding: 1 }}>
                            <button
                              type="button"
                              aria-label={`${i.name} weniger`}
                              onClick={() => i.signature && decrement(i.signature)}
                              style={{ width: 22, height: 22, borderRadius: 4 }}
                            >
                              −
                            </button>
                            <span style={{ minWidth: 16, fontSize: 12 }}>{i.quantity}</span>
                            <button
                              type="button"
                              aria-label={`${i.name} mehr`}
                              onClick={() => i.signature && addItem({ productId: i.productId, name: i.name, unitPrice: i.unitPrice, options: i.options })}
                              style={{ width: 22, height: 22, borderRadius: 4 }}
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            className="shop-cart__remove"
                            aria-label={`${i.name} entfernen`}
                            onClick={() => i.signature && remove(i.signature)}
                          >
                            <Trash01 style={{ width: 14, height: 14 }} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {serviceFee > 0 && (
                    <div className="shop-cart__fee-row">
                      <span>Zwischensumme</span>
                      <span className="mono">{formatPrice(itemsTotal, currency)}</span>
                    </div>
                  )}
                  {serviceFee > 0 && (
                    <div className="shop-cart__fee-row">
                      <span>Servicegebühr</span>
                      <span className="mono">{formatPrice(serviceFee, currency)}</span>
                    </div>
                  )}
                  <div className="shop-cart__total">
                    <span>Gesamt</span>
                    <span className="mono">{formatPrice(total, currency)}</span>
                  </div>
                  <p className="shop-cart__vat-note">
                    {vatExempt
                      ? 'Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen.'
                      : 'Alle Preise inkl. gesetzlicher MwSt.'}
                  </p>
                  <button
                    type="button"
                    className="btn btn--primary"
                    style={{ width: '100%', marginTop: 14, padding: '12px 16px' }}
                    disabled={!isOpen}
                    onClick={() => router.push(`/${eventId}/checkout`)}
                  >
                    Zur Kasse · {formatPrice(total, currency)}
                  </button>
                </>
              )}
              {!isOpen && (
                <p className="shop-cart__hint">Bestellungen sind außerhalb der Öffnungszeiten nicht möglich.</p>
              )}
            </div>
          </aside>
        </div>
      </main>

      <footer
        className="mono"
        style={{ textAlign: 'center', padding: '16px 0 24px', fontSize: 11, color: 'var(--mute-2)' }}
      >
        OpenEOS Shop v{APP_VERSION}
      </footer>

      <LegalFooter eventId={eventId} legal={shopQuery.data?.data.legal} />

      {/* Floating cart bar — mobile only */}
      {count > 0 && isOpen && (
        <button
          className="cart-bar shop-cart-bar--mobile"
          type="button"
          onClick={() => setMobileCartOpen(true)}
        >
          <span className="cart-bar__count">{count}</span>
          <ShoppingCart01 style={{ width: 18, height: 18, flexShrink: 0 }} />
          <span className="cart-bar__label">Warenkorb</span>
          <span className="cart-bar__total mono">{formatPrice(total, currency)}</span>
        </button>
      )}

      {mobileCartOpen && (
        <div className="cart-sheet__overlay" onClick={closeMobileSheet}>
          <div
            className={`cart-sheet${closing ? ' cart-sheet--closing' : ''}`}
            style={dragOffset > 0 && !closing ? { transform: `translateY(${dragOffset}px)`, animation: 'none' } : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="cart-sheet__handle"
              onTouchStart={handleSheetTouchStart}
              onTouchMove={handleSheetTouchMove}
              onTouchEnd={handleSheetTouchEnd}
              onTouchCancel={handleSheetTouchEnd}
              aria-hidden="true"
            />
            <div className="cart-sheet__head">
              <h2 className="cart-sheet__title">
                <ShoppingCart01 style={{ width: 18, height: 18, color: 'var(--green-ink)' }} />
                Warenkorb
              </h2>
              <button
                type="button"
                className="cart-sheet__close"
                aria-label="Warenkorb schließen"
                onClick={closeMobileSheet}
              >
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>
            <div className="cart-sheet__items">
              {items.map((i) => (
                <div key={i.signature ?? i.productId} className="shop-cart__row">
                  <div className="shop-cart__row-left">
                    <div style={{ minWidth: 0 }}>
                      <div className="shop-cart__name">{i.name}</div>
                      {i.options && i.options.length > 0 && (
                        <div className="shop-cart__opts">
                          {i.options
                            .map((o) => (o.excluded ? `ohne ${o.option}` : `+ ${o.option}`))
                            .join(' · ')}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="shop-cart__row-right">
                    <span className="shop-cart__price mono">
                      {formatPrice(lineUnitPrice(i) * i.quantity, currency)}
                    </span>
                    <div className="qty" style={{ borderRadius: 6, padding: 1 }}>
                      <button
                        type="button"
                        aria-label={`${i.name} weniger`}
                        onClick={() => i.signature && decrement(i.signature)}
                        style={{ width: 22, height: 22, borderRadius: 4 }}
                      >
                        −
                      </button>
                      <span style={{ minWidth: 16, fontSize: 12 }}>{i.quantity}</span>
                      <button
                        type="button"
                        aria-label={`${i.name} mehr`}
                        onClick={() => i.signature && addItem({ productId: i.productId, name: i.name, unitPrice: i.unitPrice, options: i.options })}
                        style={{ width: 22, height: 22, borderRadius: 4 }}
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      className="shop-cart__remove"
                      aria-label={`${i.name} entfernen`}
                      onClick={() => i.signature && remove(i.signature)}
                    >
                      <Trash01 style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {serviceFee > 0 && (
              <div className="shop-cart__fee-row">
                <span>Zwischensumme</span>
                <span className="mono">{formatPrice(itemsTotal, currency)}</span>
              </div>
            )}
            {serviceFee > 0 && (
              <div className="shop-cart__fee-row">
                <span>Servicegebühr</span>
                <span className="mono">{formatPrice(serviceFee, currency)}</span>
              </div>
            )}
            <div className="shop-cart__total">
              <span>Gesamt</span>
              <span className="mono">{formatPrice(total, currency)}</span>
            </div>
            <p className="shop-cart__vat-note">
              {vatExempt
                ? 'Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen.'
                : 'Alle Preise inkl. gesetzlicher MwSt.'}
            </p>
            <button
              type="button"
              className="btn btn--primary"
              style={{ width: '100%', marginTop: 14, padding: '12px 16px' }}
              disabled={items.length === 0}
              onClick={() => router.push(`/${eventId}/checkout`)}
            >
              Zur Kasse · {formatPrice(total, currency)}
            </button>
          </div>
        </div>
      )}

      {optionsForProduct && (
        <ProductOptionsSheet
          product={optionsForProduct}
          currency={currency}
          onClose={() => setOptionsForProduct(null)}
          onConfirm={(opts) => handleOptionsConfirm(optionsForProduct, opts)}
        />
      )}
    </>
  );
}

interface ProductCardProps {
  product: ShopProduct;
  currency: string;
  disabled: boolean;
  onAdd: () => void;
}

function ProductCard({ product, currency, disabled, onAdd }: ProductCardProps) {
  return (
    <div className="card" style={{ opacity: disabled ? 0.55 : 1 }}>
      <div className="card__image">
        <ProductImage imageUrl={product.imageUrl} productName={product.name} />
      </div>
      <div className="card__body">
        <h3 className="card__title">{product.name}</h3>
        {product.description && <p className="card__sub">{product.description}</p>}
      </div>
      <div className="card__foot">
        <span className="card__price">{formatPrice(product.price, currency)}</span>
        <button type="button" className="btn btn--primary" onClick={onAdd} disabled={disabled}>
          Hinzufügen
        </button>
      </div>
    </div>
  );
}

function ClosedCard({ meta, event }: { meta: ShopMeta; event: ShopEvent }) {
  const now = new Date();
  const start = event.startDate ? new Date(event.startDate) : null;
  const end = event.endDate ? new Date(event.endDate) : null;
  const fmt = (d: Date) => d.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });

  let title = 'Shop ist gerade geschlossen';
  let message: string;
  let showHours = true;

  if (start) {
    const startDay = new Date(start);
    startDay.setHours(0, 0, 0, 0);
    if (now < startDay) {
      title = 'Shop ist noch nicht geöffnet';
      message = `Bestellungen sind ab dem ${fmt(start)} möglich.`;
      showHours = false;
    } else if (end) {
      const endDay = new Date(end);
      endDay.setHours(23, 59, 59, 999);
      if (now > endDay) {
        title = 'Event ist beendet';
        message = `Das Event lief bis zum ${fmt(end)}. Es können keine Bestellungen mehr aufgegeben werden.`;
        showHours = false;
      } else {
        message = todaysWindow(meta)
          ? `Heute geöffnet: ${todaysWindow(meta)}. Bestellungen sind nur innerhalb der Öffnungszeiten möglich.`
          : 'Heute hat der Shop nicht geöffnet. Bestellungen sind nur innerhalb der Öffnungszeiten möglich.';
      }
    } else {
      message = todaysWindow(meta)
        ? `Heute geöffnet: ${todaysWindow(meta)}. Bestellungen sind nur innerhalb der Öffnungszeiten möglich.`
        : 'Heute hat der Shop nicht geöffnet. Bestellungen sind nur innerhalb der Öffnungszeiten möglich.';
    }
  } else {
    message = todaysWindow(meta)
      ? `Heute geöffnet: ${todaysWindow(meta)}. Bestellungen sind nur innerhalb der Öffnungszeiten möglich.`
      : 'Heute hat der Shop nicht geöffnet. Bestellungen sind nur innerhalb der Öffnungszeiten möglich.';
  }

  const week = showHours ? weeklySchedule(meta) : [];

  return (
    <div className="shop-banner shop-banner--closed" role="alert">
      <Clock style={{ width: 22, height: 22, flexShrink: 0, color: 'var(--green-ink)' }} />
      <div style={{ minWidth: 0 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--ink)' }}>{title}</h2>
        <p style={{ fontSize: 13, color: 'var(--mute)', margin: '4px 0 0' }}>{message}</p>
        {week.length > 0 && (
          <ul className="shop-hours-list">
            {week.map((d) => (
              <li key={d.label}>
                <span className="shop-hours-list__day">{d.label}</span>
                <span className="mono">{d.window}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
