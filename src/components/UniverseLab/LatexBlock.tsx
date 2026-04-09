import React, { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface Props {
  tex: string;
  display?: boolean;
  className?: string;
}

export default function LatexBlock({ tex, display = false, className = '' }: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    try {
      katex.render(tex, ref.current, {
        displayMode: display,
        throwOnError: false,
        trust: true,
      });
    } catch {
      if (ref.current) ref.current.textContent = tex;
    }
  }, [tex, display]);

  return <span ref={ref} className={className} />;
}
