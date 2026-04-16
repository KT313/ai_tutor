import DOMPurify from 'dompurify';
import { useMemo } from 'react';

interface TooltipProps {
  label: string;
  tooltipHtml: string;
  variant?: 'default' | 'extra';
}

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: ['strong', 'em', 'b', 'i', 'br', 'code'],
  ALLOWED_ATTR: [],
};

export function Tooltip({ label, tooltipHtml, variant = 'default' }: TooltipProps) {
  const borderColor = variant === 'extra' ? 'border-[#52b788]' : 'border-accent-blue';
  const textColor = variant === 'extra' ? 'text-[#2d6a4f]' : 'text-accent-blueDark';

  const safeHtml = useMemo(() => DOMPurify.sanitize(tooltipHtml, SANITIZE_CONFIG), [tooltipHtml]);

  return (
    <span
      className={`group relative inline cursor-help border-b-2 border-dotted ${borderColor} font-semibold ${textColor} hover:z-[999]`}
    >
      {label}
      <span
        className="invisible absolute bottom-[135%] left-0 z-[100] w-[350px] translate-y-2 rounded-lg bg-surface-tooltipBg p-4 text-left text-[9.5pt] font-normal leading-snug text-surface-tooltipText opacity-0 shadow-[0_8px_25px_rgba(0,0,0,0.3)] transition-[opacity,transform] duration-300 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100"
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    </span>
  );
}
