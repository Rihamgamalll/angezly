import type { ReactNode } from 'react';

export function PageHeading({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow?: string;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <p className="text-sm font-bold text-brand-700">{eyebrow}</p>}
        <h1 className="mt-2 text-3xl font-extrabold leading-tight text-ink-900 sm:text-4xl">{title}</h1>
        {text && <p className="mt-3 text-base leading-relaxed text-ink-500">{text}</p>}
      </div>
      {action}
    </div>
  );
}
