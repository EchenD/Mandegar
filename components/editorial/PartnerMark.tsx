export function PartnerMark({ index }: { index: number }) {
  const variant = index % 5;
  return (
    <svg viewBox="0 0 120 72" fill="currentColor" aria-hidden="true" focusable="false">
      {variant === 0 ? <><circle cx="46" cy="36" r="21" /><circle cx="75" cy="36" r="21" /></> : null}
      {variant === 1 ? <><path d="M27 51 60 13l33 38H75L60 34 45 51Z" /><circle cx="60" cy="52" r="7" /></> : null}
      {variant === 2 ? <><path d="M25 17h28v38H25zM67 17h28v38H67z" /><path d="m45 36 15-15 15 15-15 15Z" /></> : null}
      {variant === 3 ? <><circle cx="60" cy="36" r="25" fill="none" stroke="currentColor" strokeWidth="9" /><path d="M60 8v28h28" /></> : null}
      {variant === 4 ? <path d="M23 48c17-34 29-34 38 0 9-34 21-34 36 0" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" /> : null}
    </svg>
  );
}
