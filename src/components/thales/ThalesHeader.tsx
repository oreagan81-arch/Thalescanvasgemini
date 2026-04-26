import React from 'react';
import { cn } from '@/lib/utils';

interface ThalesHeaderProps {
  title: string;
  subtitle?: string;
  level?: 2 | 3;
  className?: string;
}

/**
 * ThalesHeader: Enforces Rule #1 of Thales Posting Rules.
 * Standardizes the top-level visual hierarchy for Canvas exports.
 */
export function ThalesHeader({ title, subtitle, level = 2, className }: ThalesHeaderProps) {
  const HeaderTag = level === 2 ? 'h2' : 'h3';
  
  // Thales Styles: Modern, professional, clean.
  // Note: Canvas sanitizes some CSS, so we use standard structural tags
  // but style them with Tailwind for our preview.
  return (
    <div className={cn("mb-6 border-l-4 border-amber-500 pl-4 py-1", className)}>
      <HeaderTag className="text-2xl font-bold tracking-tight text-white m-0 leading-tight">
        {title}
      </HeaderTag>
      {subtitle && (
        <p className="text-sm font-medium text-slate-400 mt-1 uppercase tracking-widest">
          {subtitle}
        </p>
      )}
    </div>
  );
}
