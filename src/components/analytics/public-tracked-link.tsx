'use client';

import type { MouseEventHandler, ReactNode } from 'react';
import Link, { type LinkProps } from 'next/link';
import { trackPublicEvent, type PublicEventProperties } from '@/lib/analytics/public-events';

type PublicTrackedLinkProps = LinkProps & {
  children: ReactNode;
  className?: string;
  eventName?: string;
  eventProps?: PublicEventProperties;
  target?: string;
  rel?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export function PublicTrackedLink({
  href,
  children,
  className,
  eventName,
  eventProps,
  target,
  rel,
  onClick,
  ...props
}: PublicTrackedLinkProps) {
  const handleClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
    if (eventName) {
      trackPublicEvent(eventName, {
        destination: typeof href === 'string' ? href : href.pathname || 'unknown',
        ...eventProps,
      });
    }
    onClick?.(event);
  };

  return (
    <Link
      {...props}
      href={href}
      className={className}
      target={target}
      rel={rel}
      onClick={handleClick}
    >
      {children}
    </Link>
  );
}
