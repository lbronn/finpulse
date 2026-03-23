import { useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DoneStepProps {
  onComplete: () => void;
}

export default function DoneStep({ onComplete }: DoneStepProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="flex flex-col items-center text-center gap-6">
      <div className="rounded-full bg-green-500/10 p-6">
        <CheckCircle2 className="h-12 w-12 text-green-500" />
      </div>
      <div>
        <h2 className="text-3xl font-bold mb-3">You're all set!</h2>
        <p className="text-muted-foreground">Taking you to your dashboard...</p>
      </div>
      <Button onClick={onComplete} variant="outline">
        Go to Dashboard
      </Button>
    </div>
  );
}
