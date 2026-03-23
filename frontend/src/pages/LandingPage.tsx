// Summary: Public marketing page for FinPulse. Shown to unauthenticated users
// at the root URL. Static — no API calls. Sections: Nav, Hero, Features, How It Works, CTA, Footer.

import { Link } from 'react-router-dom';
import { TrendingUp, Zap, Target, ArrowRight, BarChart2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border max-w-6xl mx-auto">
        <div className="flex items-center gap-2 font-bold text-xl">
          <TrendingUp className="h-5 w-5 text-primary" />
          FinPulse
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Link to="/signup">
            <Button size="sm">Get Started</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
          Track smarter.<br />Spend wiser.
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          AI-powered expense tracking that understands your spending patterns
          and gives you advice that actually works.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/signup">
            <Button size="lg" className="w-full sm:w-auto gap-2">
              Get Started Free <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link to="/demo">
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              Try Demo
            </Button>
          </Link>
        </div>
        {/* Hero visual placeholder */}
        <div className="mt-16 rounded-xl border border-border bg-muted/40 h-64 md:h-96 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <BarChart2 className="h-16 w-16 mx-auto mb-4 opacity-40" />
            <p className="text-sm">Dashboard preview</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-muted/30 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Everything you need to stay on budget</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Zap,
                title: 'Quick Capture',
                description: 'Log an expense in 3 seconds. Just type what you spent — our AI parses the rest.',
              },
              {
                icon: MessageSquare,
                title: 'AI Insights',
                description: 'Get spending analysis grounded in your actual data, not generic tips.',
              },
              {
                icon: Target,
                title: 'Budget Tracking',
                description: 'Set goals, track progress, get recommendations to stay on track.',
              },
            ].map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-xl border border-border bg-background p-6">
                <div className="rounded-lg bg-primary/10 w-10 h-10 flex items-center justify-center mb-4">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">How it works</h2>
          <div className="grid md:grid-cols-3 gap-8 text-center">
            {[
              { step: '1', title: 'Track your expenses', description: "Log expenses instantly with natural language. \"Jollibee lunch 250\" — done." },
              { step: '2', title: 'AI analyzes your patterns', description: "FinPulse spots trends, anomalies, and habits you'd never catch on your own." },
              { step: '3', title: 'Get actionable recommendations', description: 'Real advice based on your actual data, updated every week.' },
            ].map(({ step, title, description }) => (
              <div key={step} className="flex flex-col items-center">
                <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg mb-4">
                  {step}
                </div>
                <h3 className="font-semibold text-lg mb-2">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary py-20 text-center text-primary-foreground">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-3xl font-bold mb-4">Start tracking for free</h2>
          <p className="opacity-90 mb-8">No credit card required. Set up in under 2 minutes.</p>
          <Link to="/signup">
            <Button size="lg" variant="secondary" className="gap-2">
              Create Your Account <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2 font-semibold text-foreground mb-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          FinPulse
        </div>
        <p>© 2026 FinPulse. Built for smarter spending.</p>
      </footer>
    </div>
  );
}
