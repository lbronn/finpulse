// Summary: Row of dots showing onboarding progress. Current step = wide dot,
// completed = small filled dot, future = small dim dot.

interface OnboardingProgressBarProps {
  currentStep: number; // 0-indexed, referring to steps 2-5 (profile through firstExpense)
  totalSteps: number;
}

export default function OnboardingProgressBar({ currentStep, totalSteps }: OnboardingProgressBarProps) {
  return (
    <div
      className="flex items-center gap-2 justify-center"
      role="progressbar"
      aria-valuenow={currentStep + 1}
      aria-valuemax={totalSteps}
    >
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all duration-300 ${
            i === currentStep
              ? 'w-6 bg-primary'
              : i < currentStep
              ? 'w-2 bg-primary'
              : 'w-2 bg-muted-foreground/30'
          }`}
        />
      ))}
    </div>
  );
}
