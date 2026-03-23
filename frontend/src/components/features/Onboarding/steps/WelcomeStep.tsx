import { TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WelcomeStepProps {
  onNext: () => void;
}

export default function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <div className="flex flex-col items-center text-center gap-6">
      <div className="rounded-full bg-primary/10 p-6">
        <TrendingUp className="h-12 w-12 text-primary" />
      </div>
      <div>
        <h1 className="text-3xl font-bold mb-3">Welcome to FinPulse</h1>
        <p className="text-muted-foreground max-w-md">
          Your AI-powered personal finance tracker. Let's set you up in under 2 minutes.
        </p>
      </div>
      <Button size="lg" onClick={onNext} className="w-full sm:w-auto">
        Get Started
      </Button>
    </div>
  );
}
