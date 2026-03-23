/**
 * Public demo page at /demo.
 *
 * Fetches pre-seeded data from GET /api/demo/data (no auth required).
 * Renders a read-only dashboard with summary cards, a category pie chart,
 * budget progress bars, and a recent expenses list. Interactive features
 * are blocked with a sign-up prompt overlay. A top banner nudges visitors
 * to sign up.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatCurrency } from '@/lib/formatters';

const DEMO_API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

const CHART_COLORS = [
  '#EF9F27',
  '#378ADD',
  '#9B59B6',
  '#2ECC71',
  '#E74C3C',
  '#1ABC9C',
  '#F39C12',
];

interface DemoExpense {
  category_name: string;
  amount: number;
  description: string;
  expense_date: string;
}

interface DemoData {
  expenses: DemoExpense[];
  budget_goals: Array<{ category: string; goal: number; spent: number }>;
  monthly_summary: { total_spent: number; transaction_count: number; daily_average: number };
  category_breakdown: Array<{ category: string; amount: number; count: number }>;
}

// Overlay that blocks interaction and shows a sign-up prompt on hover.
function DemoBlocker({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative group">
      {children}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-[1px] rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <Link to="/signup">
          <Button size="sm" className="gap-1">
            Sign up to use this <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function DemoPage() {
  const [data, setData] = useState<DemoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${DEMO_API}/api/demo/data`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load demo data');
        return r.json() as Promise<DemoData>;
      })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Top sign-up banner */}
      <div className="sticky top-0 z-50 bg-primary text-primary-foreground py-3 px-4 text-center text-sm flex items-center justify-center gap-4">
        <span>You're viewing a demo. Sign up to track your own finances.</span>
        <Link to="/signup">
          <Button size="sm" variant="secondary" className="h-7 text-xs gap-1">
            Sign Up Free <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>

      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
            FinPulse
            <span className="text-xs font-normal text-muted-foreground ml-1">Demo</span>
          </div>
          <div className="flex gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive mb-6">
            {error}
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Spent ({new Date().toLocaleString('default', { month: 'long' })})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {formatCurrency(data?.monthly_summary.total_spent ?? 0, 'PHP')}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Transactions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{data?.monthly_summary.transaction_count}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Daily Average
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {formatCurrency(data?.monthly_summary.daily_average ?? 0, 'PHP')}
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Charts + budget */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Category breakdown chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Spending by Category</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={data?.category_breakdown}
                      dataKey="amount"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      animationDuration={800}
                    >
                      {data?.category_breakdown.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v, 'PHP')} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Budget goals */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Budget Goals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))
              ) : (
                data?.budget_goals.map((g) => {
                  const pct = g.goal > 0 ? Math.min(100, (g.spent / g.goal) * 100) : 0;
                  return (
                    <div key={g.category}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{g.category}</span>
                        <span className="text-muted-foreground">
                          {formatCurrency(g.spent, 'PHP')} / {formatCurrency(g.goal, 'PHP')}
                        </span>
                      </div>
                      <Progress
                        value={pct}
                        className={
                          pct >= 100
                            ? '[&>div]:bg-destructive'
                            : pct >= 80
                              ? '[&>div]:bg-yellow-500'
                              : ''
                        }
                      />
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent expenses */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base">Recent Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full mb-2" />
              ))
            ) : (
              <div className="divide-y divide-border">
                {data?.expenses.slice(0, 8).map((e, i) => (
                  <div key={i} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{e.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.category_name} · {e.expense_date}
                      </p>
                    </div>
                    <span className="text-sm font-semibold">
                      {formatCurrency(e.amount, 'PHP')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Blocked feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DemoBlocker>
            <Card className="cursor-not-allowed">
              <CardHeader>
                <CardTitle className="text-base">AI Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Get AI-powered insights into your spending patterns.
                </p>
                <Button className="mt-4" disabled>
                  Analyze My Expenses
                </Button>
              </CardContent>
            </Card>
          </DemoBlocker>
          <DemoBlocker>
            <Card className="cursor-not-allowed">
              <CardHeader>
                <CardTitle className="text-base">Finance Chat</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Ask your AI finance assistant anything.
                </p>
                <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground italic">
                  "How am I doing with food spending?"
                </div>
              </CardContent>
            </Card>
          </DemoBlocker>
        </div>

        {/* Back to landing */}
        <div className="text-center mt-12">
          <Link to="/">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              ← Back to home
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
