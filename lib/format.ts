// Shared JPY / ja-JP formatting helpers. Single source of truth — the English
// app had this fmtUSD logic copy-pasted into 6+ files; JP consolidates it
// here so currency/locale only needs fixing in one place.
//
// JPY has no minor currency unit in everyday display (no "¥1,234.56"), so
// `withCents` is accepted for call-site compatibility with the old USD API
// but is intentionally ignored — yen amounts always render as whole numbers.

export function fmtJPY(n: number, _withCents = false): string {
  return '¥' + Math.round(n).toLocaleString('ja-JP');
}

// Signed variant: "-¥1,234" / "+¥1,234" style is handled by the caller
// prefixing the sign; this just renders the unsigned magnitude.
export function fmtJPYAbs(n: number): string {
  return fmtJPY(Math.abs(n));
}

export function fmtDateShort(d: Date): string {
  return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function fmtDateLong(d: Date): string {
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}
