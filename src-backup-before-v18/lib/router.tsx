import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from 'react';

export function navigate(to: string) {
  if (to === window.location.pathname + window.location.search) {
    return;
  }
  window.history.pushState(null, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0 });
}

export function useCurrentPath(): string {
  const [path, setPath] = useState(() => window.location.pathname + window.location.search);

  useEffect(() => {
    const sync = () => setPath(window.location.pathname + window.location.search);
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  return path;
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string };

export function getNextPath(fallback: string): string {
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}

export function Link({ to, onClick, ...rest }: LinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) {
      return;
    }
    event.preventDefault();
    navigate(to);
  };

  return <a href={to} {...rest} onClick={handleClick} />;
}
