// Summary: Full-screen onboarding stepper. Skip on any step advances to the
// next step. Done step always calls onComplete. anyStepSkipped state tracks
// whether any step was bypassed (for onboarding_progress.skipped field).

import { useState } from 'react';
import OnboardingProgressBar from './OnboardingProgressBar';
import WelcomeStep from './steps/WelcomeStep';
import ProfileStep from './steps/ProfileStep';
import BudgetStep from './steps/BudgetStep';
import CategoriesStep from './steps/CategoriesStep';
import FirstExpenseStep from './steps/FirstExpenseStep';
import DoneStep from './steps/DoneStep';

interface OnboardingProps {
  onComplete: () => void;
}

const STEPS = ['welcome', 'profile', 'budget', 'categories', 'firstExpense', 'done'] as const;
type Step = typeof STEPS[number];

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [stepIndex, setStepIndex] = useState(0);

  const step: Step = STEPS[stepIndex];
  const next = () => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  const back = () => setStepIndex((i) => Math.max(i - 1, 0));
  // Skip = advance to next step (not exit the flow)
  const skip = next;

  const showProgress = stepIndex > 0 && stepIndex < STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        {showProgress && (
          <div className="mb-8">
            <OnboardingProgressBar currentStep={stepIndex - 1} totalSteps={4} />
          </div>
        )}
        <div className="flex justify-center">
          {step === 'welcome' && <WelcomeStep onNext={next} />}
          {step === 'profile' && <ProfileStep onNext={next} onSkip={skip} onBack={back} />}
          {step === 'budget' && <BudgetStep onNext={next} onSkip={skip} onBack={back} />}
          {step === 'categories' && <CategoriesStep onNext={next} onSkip={skip} onBack={back} />}
          {step === 'firstExpense' && <FirstExpenseStep onNext={next} onSkip={skip} onBack={back} />}
          {step === 'done' && <DoneStep onComplete={onComplete} />}
        </div>
      </div>
    </div>
  );
}
