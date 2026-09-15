import { useEffect, useState } from 'react';

interface TimerProps {
  seconds: number;
  onExpire?: () => void;
}

/** Simple client-side countdown, started fresh whenever `seconds` changes. */
export function Timer({ seconds, onExpire }: TimerProps) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    setRemaining(seconds);
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onExpire?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);

  const isUrgent = remaining <= 5;

  return (
    <span
      className={`font-mono text-lg tabular-nums ${isUrgent ? 'text-blood-500' : 'text-moon-400'}`}
    >
      {remaining}s
    </span>
  );
}
