import type { ReactNode } from 'react';

export const AUTH_HERO_COLUMN_CLASS =
  'relative hidden overflow-hidden border-s border-primary-700 bg-primary text-white lg:flex lg:flex-col lg:justify-between lg:p-6 lg:py-8';

export const AUTH_MAIN_COLUMN_CLASS =
  'relative flex min-h-screen items-center justify-center overflow-y-auto p-3 sm:p-6 lg:min-h-0';

export const AUTH_FORM_COLUMN_CLASS = 'my-auto w-full max-w-[460px] py-6';

interface AuthSplitLayoutProps {
  children: ReactNode;
}

export default function AuthSplitLayout({ children }: AuthSplitLayoutProps) {
  return (
    <div
      data-testid="auth-split-shell"
      className="min-h-screen bg-background lg:grid lg:h-screen lg:grid-cols-[minmax(560px,1.1fr)_minmax(480px,0.9fr)] lg:overflow-hidden"
    >
      {children}
    </div>
  );
}
