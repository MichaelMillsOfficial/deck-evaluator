// Astral · Component reference implementations
// Pure JSX, semantic tokens via CSS vars. Drop into a Babel-rendered host
// or copy-port to a Next.js codebase.
//
// All components below assume `tokens.css` is loaded.

const { useState } = React;

// ─── Eyebrow ─────────────────────────────────────────────────
function Eyebrow({ children, color }) {
  return <div style={{
    fontFamily: 'var(--font-mono)', fontSize: 'var(--text-eyebrow)',
    letterSpacing: 'var(--tracking-eyebrow)', textTransform: 'uppercase',
    color: color || 'var(--accent)', fontWeight: 'var(--weight-medium)',
  }}>{children}</div>;
}

// ─── Button ──────────────────────────────────────────────────
function DSButton({ variant = 'primary', size = 'md', disabled, children, onClick }) {
  const sizes = {
    sm: { padding: '6px 12px',  fontSize: 12, height: 32 },
    md: { padding: '10px 20px', fontSize: 13, height: 40 },
    lg: { padding: '14px 24px', fontSize: 14, height: 48 },
  }[size];
  const variants = {
    primary: {
      background: 'var(--accent-gradient)',
      color: 'var(--ink-on-accent)', border: 'none',
      boxShadow: 'var(--shadow-sm)',
    },
    secondary: {
      background: 'var(--surface-2)', color: 'var(--ink-primary)',
      border: '1px solid var(--border)',
    },
    ghost: {
      background: 'transparent', color: 'var(--accent)', border: 'none',
    },
    danger: {
      background: 'var(--status-warn-soft)',
      border: '1px solid rgba(255,134,160,0.3)',
      color: 'var(--status-warn)',
    },
  }[variant];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...sizes, ...variants,
      borderRadius: 'var(--btn-radius)',
      fontFamily: 'var(--font-sans)', fontWeight: 'var(--weight-semibold)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      transition: 'all var(--dur-base) var(--ease-out)',
      display: 'inline-flex', alignItems: 'center', gap: 8,
    }}>{children}</button>
  );
}

// ─── Input ───────────────────────────────────────────────────
function DSInput({ value, onChange, placeholder, mono = false, error }) {
  const [focus, setFocus] = useState(false);
  return (
    <input
      value={value} onChange={e => onChange?.(e.target.value)}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
      placeholder={placeholder}
      style={{
        width: '100%', padding: 'var(--input-padding)',
        background: 'var(--input-bg)',
        border: '1px solid ' + (error ? 'var(--status-warn)' : focus ? 'var(--accent)' : 'var(--input-border)'),
        borderRadius: 'var(--input-radius)',
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
        fontSize: 'var(--input-font-size)', color: 'var(--ink-primary)',
        outline: 'none', boxSizing: 'border-box',
        transition: 'border-color var(--dur-base) var(--ease-out)',
      }}
    />
  );
}

// ─── Card ────────────────────────────────────────────────────
function DSCard({ variant = 'surface', eyebrow, title, children, padding }) {
  const variants = {
    surface: { background: 'var(--card-bg)', border: '1px solid var(--card-border)' },
    accent:  { background: 'var(--accent-soft)', border: '1px solid var(--border-accent)' },
    outline: { background: 'transparent', border: '1px solid var(--border)' },
  }[variant];
  return (
    <div style={{
      ...variants, padding: padding ?? 'var(--card-padding)',
      borderRadius: 'var(--card-radius)',
      backdropFilter: 'blur(var(--blur-sm))',
    }}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      {title && <h3 className="serif" style={{ fontSize: 'var(--text-h3)', fontWeight: 'var(--weight-medium)', margin: '6px 0 14px' }}>{title}</h3>}
      {children}
    </div>
  );
}

// ─── Tag ─────────────────────────────────────────────────────
function DSTag({ variant = 'accent', children }) {
  const variants = {
    accent: { bg: 'var(--accent-soft)', bd: 'var(--border-accent)', fg: 'var(--accent)' },
    cyan:   { bg: 'rgba(136,231,255,0.10)', bd: 'rgba(136,231,255,0.40)', fg: 'var(--cyan-400)' },
    gold:   { bg: 'rgba(245,214,128,0.10)', bd: 'rgba(245,214,128,0.40)', fg: 'var(--gold-400)' },
    ok:     { bg: 'var(--status-ok-soft)', bd: 'rgba(134,239,172,0.4)', fg: 'var(--status-ok)' },
    warn:   { bg: 'var(--status-warn-soft)', bd: 'rgba(255,134,160,0.4)', fg: 'var(--status-warn)' },
    ghost:  { bg: 'transparent', bd: 'var(--border-hi)', fg: 'var(--ink-tertiary)' },
  }[variant];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: 'var(--tag-padding-y) var(--tag-padding-x)',
      borderRadius: 'var(--tag-radius)',
      fontFamily: 'var(--font-mono)', fontSize: 'var(--tag-font-size)',
      letterSpacing: 'var(--tag-tracking)', textTransform: 'uppercase',
      background: variants.bg, border: '1px solid ' + variants.bd, color: variants.fg,
      whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

// ─── StatTile ────────────────────────────────────────────────
function DSStatTile({ label, value, sub, accent }) {
  return (
    <div style={{
      padding: 'var(--space-7)', borderRadius: 'var(--radius-xl)',
      background: 'var(--surface-2)', border: '1px solid var(--border)',
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-caption)', letterSpacing: 'var(--tracking-eyebrow)', color: 'var(--ink-tertiary)', textTransform: 'uppercase' }}>{label}</div>
      <div className="serif" style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-h2)', fontWeight: 'var(--weight-medium)', color: accent ? 'var(--accent)' : 'var(--ink-primary)', marginTop: 4, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-tertiary)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── Sheet (bottom drawer) ───────────────────────────────────
function DSSheet({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'var(--surface-scrim)',
        backdropFilter: 'blur(var(--blur-sm))', zIndex: 50,
        animation: 'ds-fadein var(--dur-base) var(--ease-out)',
      }} />
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 51,
        padding: '14px 18px 28px',
        background: 'var(--sheet-bg)',
        borderTop: '1px solid var(--sheet-border)',
        borderRadius: 'var(--sheet-radius) var(--sheet-radius) 0 0',
        boxShadow: 'var(--sheet-shadow)',
        animation: 'ds-sheet-up var(--dur-slow) var(--ease-out)',
        maxHeight: '80vh', overflowY: 'auto',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', margin: '0 auto 14px' }} />
        {title && <h3 className="serif" style={{ fontSize: 'var(--text-h3)', fontWeight: 'var(--weight-medium)', margin: '0 0 12px' }}>{title}</h3>}
        {children}
      </div>
      <style>{`
        @keyframes ds-fadein { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ds-sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </>
  );
}

Object.assign(window, { Eyebrow, DSButton, DSInput, DSCard, DSTag, DSStatTile, DSSheet });
