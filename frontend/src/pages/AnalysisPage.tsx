import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  BarChart2,
  PiggyBank,
  Repeat,
  TrendingUp,
  Loader2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { ChatInterface } from '@/components/features/Chat/ChatInterface';
import { ChatSessionSidebar } from '@/components/features/Chat/ChatSessionSidebar';
import { useFinanceChat } from '@/hooks/useFinanceChat';
import type {
  ExpenseAnalysisResponse,
  BudgetRecommendationsResponse,
  AnalysisHistoryResponse,
  Insight,
  Recommendation,
  InsightType,
  InsightSeverity,
  AnalysisHistory,
} from '@/types';

// ---------------------------------------------------------------------------
// Icon and colour maps
// ---------------------------------------------------------------------------

const INSIGHT_ICONS: Record<InsightType, typeof TrendingUp> = {
  trend: TrendingUp,
  anomaly: AlertTriangle,
  pattern: Repeat,
  comparison: BarChart2,
  saving_opportunity: PiggyBank,
};

const SEVERITY_BADGE: Record<InsightSeverity, string> = {
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  success: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InsightCard({ insight }: { insight: Insight }) {
  const Icon = INSIGHT_ICONS[insight.type] ?? TrendingUp;
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-muted p-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <p className="font-semibold text-sm">{insight.title}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_BADGE[insight.severity]}`}
              >
                {insight.severity}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{insight.description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const isSaving = rec.suggested_goal < rec.current_goal;
  const diff = Math.abs(rec.suggested_goal - rec.current_goal).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
  });
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{rec.category}</p>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  isSaving ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                }`}
              >
                {isSaving ? `Save ${diff}` : `Increase ${diff}`}
              </span>
              <Badge variant="outline" className="text-xs">
                {rec.confidence} confidence
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              Current:{' '}
              <strong>
                {rec.current_goal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </strong>
            </span>
            <span>→</span>
            <span>
              Suggested:{' '}
              <strong
                className={isSaving ? 'text-green-700' : 'text-amber-700'}
              >
                {rec.suggested_goal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </strong>
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{rec.reasoning}</p>
          <p className="text-xs font-medium text-muted-foreground italic">{rec.impact}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-lg border bg-card p-5 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/3 rounded bg-muted" />
          <div className="h-3 w-full rounded bg-muted" />
          <div className="h-3 w-2/3 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

function HistoryItem({ record }: { record: AnalysisHistory }) {
  const [expanded, setExpanded] = useState(false);
  const isExpense = record.analysis_type === 'expense_analysis';
  const isDigest = record.analysis_type === 'weekly_digest';
  const result = record.result as Record<string, unknown>;

  return (
    <Card>
      <CardHeader
        className="cursor-pointer pb-3"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={isExpense ? 'default' : isDigest ? 'outline' : 'secondary'}>
              {isExpense ? 'Expense Analysis' : isDigest ? 'Weekly Digest' : 'Budget Recommendations'}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {record.created_at
                ? new Date(record.created_at).toLocaleDateString('en-PH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—'}
            </span>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {record.tokens_used?.toLocaleString() ?? '—'} tokens · {record.model_used}
        </p>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          {isExpense ? (
            <>
              {(result.insights as Insight[] | undefined)?.map((ins) => (
                <InsightCard key={ins.title} insight={ins} />
              ))}
              {result.summary && (
                <p className="mt-4 text-sm text-muted-foreground">{result.summary as string}</p>
              )}
            </>
          ) : isDigest ? (
            <div className="space-y-2">
              {result.headline && (
                <p className="font-semibold text-sm">{result.headline as string}</p>
              )}
              {result.body && (
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {result.body as string}
                </p>
              )}
            </div>
          ) : (
            <>
              {(result.recommendations as Recommendation[] | undefined)?.map((rec) => (
                <RecommendationCard key={rec.category} rec={rec} />
              ))}
              {result.overall_advice && (
                <p className="mt-4 text-sm text-muted-foreground">
                  {result.overall_advice as string}
                </p>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tab views
// ---------------------------------------------------------------------------

function ExpenseAnalysisTab({ onAnalysisComplete }: { onAnalysisComplete?: () => void }) {
  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = today.slice(0, 8) + '01';

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExpenseAnalysisResponse | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.post<ExpenseAnalysisResponse>('/analysis/expenses', {
        start_date: startDate,
        end_date: endDate,
      });
      setResult(data);
      onAnalysisComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardContent className="pt-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                max={today}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                max={today}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          {startDate && endDate && startDate > endDate && (
            <p className="mt-2 text-xs text-red-600">Start date must be before end date.</p>
          )}
          <Button
            className="mt-4 w-full sm:w-auto"
            onClick={handleAnalyze}
            disabled={loading || !startDate || !endDate || startDate > endDate}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing…
              </>
            ) : (
              'Analyze My Spending'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button
            className="ml-2 underline"
            onClick={handleAnalyze}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Prompt when idle */}
      {!result && !loading && !error && (
        <p className="text-center text-sm text-muted-foreground py-8">
          Select a date range and click "Analyze My Spending" to see insights.
        </p>
      )}

      {/* Results */}
      {result && !loading && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {result.insights.map((insight) => (
              <InsightCard key={insight.title} insight={insight} />
            ))}
          </div>
          {result.summary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Overall Assessment</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {result.summary}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {result.tokens_used.toLocaleString()} tokens · {result.model_used}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function BudgetRecommendationsTab({ onAnalysisComplete }: { onAnalysisComplete?: () => void }) {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BudgetRecommendationsResponse | null>(null);

  const handleRecommend = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.post<BudgetRecommendationsResponse>('/analysis/recommendations', {
        month,
      });
      setResult(data);
      onAnalysisComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recommendations failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardContent className="pt-5">
          <div className="space-y-1 max-w-xs">
            <Label htmlFor="month-picker">Month</Label>
            <Input
              id="month-picker"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
          <Button
            className="mt-4 w-full sm:w-auto"
            onClick={handleRecommend}
            disabled={loading || !month}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Getting Recommendations…
              </>
            ) : (
              'Get Recommendations'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button
            className="ml-2 underline"
            onClick={handleRecommend}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Prompt when idle */}
      {!result && !loading && !error && (
        <p className="text-center text-sm text-muted-foreground py-8">
          Select a month and click "Get Recommendations" to see advice.
        </p>
      )}

      {/* Results */}
      {result && !loading && (
        <>
          {result.recommendations.length === 0 && (
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">
                  No specific recommendations for this month — you appear to be on track!
                </p>
              </CardContent>
            </Card>
          )}
          <div className="space-y-3">
            {result.recommendations.map((rec) => (
              <RecommendationCard key={rec.category} rec={rec} />
            ))}
          </div>
          {result.overall_advice && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Overall Budget Advice</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {result.overall_advice}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {result.tokens_used.toLocaleString()} tokens · {result.model_used}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function HistoryTab() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AnalysisHistory[] | null>(null);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<AnalysisHistoryResponse>('/analysis/history?limit=20');
      setHistory(data.history);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history.');
    } finally {
      setLoading(false);
    }
  };

  // Load on first render
  useEffect(() => {
    loadHistory();
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Past analyses (most recent first)</p>
        <Button variant="ghost" size="sm" onClick={loadHistory} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {history && !loading && history.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <BarChart2 className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No analyses run yet</p>
              <p className="text-sm text-muted-foreground">Run your first analysis to see insights here</p>
            </div>
          </CardContent>
        </Card>
      )}

      {history && !loading && history.map((record) => (
        <HistoryItem key={record.id} record={record} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat tab
// ---------------------------------------------------------------------------

function ChatTab({ onMessageSent }: { onMessageSent?: () => void }) {
  const { messages, loading, sendMessage, sessionId, loadSession, startNewSession } = useFinanceChat();

  function handleSend(text: string) {
    sendMessage(text);
    onMessageSent?.();
  }

  return (
    <div className="flex gap-4">
      {/* Sidebar: hidden on mobile, visible on md+ */}
      <div className="hidden md:block w-52 shrink-0">
        <ChatSessionSidebar
          currentSessionId={sessionId}
          onSelectSession={loadSession}
        />
      </div>

      <div className="flex-1 min-w-0">
        <ChatInterface
          messages={messages}
          loading={loading}
          onSend={handleSend}
          onNewSession={startNewSession}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quota indicator
// ---------------------------------------------------------------------------

function QuotaIndicator({ label, used, limit, remaining }: { label: string; used: number; limit: number; remaining: number }) {
  return (
    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
      <span>{label}:</span>
      <span className={remaining === 0 ? 'text-destructive font-medium' : 'font-medium'}>
        {remaining}/{limit} remaining
      </span>
      {remaining === 0 && <span className="text-destructive">(limit reached)</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------

export default function AnalysisPage() {
  type QuotaData = {
    expense_analysis: { used: number; limit: number; remaining: number; allowed: boolean };
    budget_recommendation: { used: number; limit: number; remaining: number; allowed: boolean };
    chat: { used: number; limit: number; remaining: number; allowed: boolean };
  };

  const [quota, setQuota] = useState<QuotaData | null>(null);

  const refreshQuota = () => {
    api.get<QuotaData>('/analysis/quota').then(setQuota).catch(() => {});
  };

  useEffect(() => {
    refreshQuota();
  }, []);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">AI Analysis</h1>
        <p className="text-sm text-muted-foreground">
          AI-powered insights into your spending patterns and budget health.
        </p>
      </div>

      {quota && (
        <div className="flex flex-wrap gap-4 p-3 rounded-lg bg-muted/40 border border-border">
          <QuotaIndicator label="Analyses" used={quota.expense_analysis.used} limit={quota.expense_analysis.limit} remaining={quota.expense_analysis.remaining} />
          <QuotaIndicator label="Recommendations" used={quota.budget_recommendation.used} limit={quota.budget_recommendation.limit} remaining={quota.budget_recommendation.remaining} />
          <QuotaIndicator label="Chat messages" used={quota.chat.used} limit={quota.chat.limit} remaining={quota.chat.remaining} />
        </div>
      )}

      <Tabs defaultValue="chat">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="expenses">Insights</TabsTrigger>
          <TabsTrigger value="recommendations">Budget</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-4">
          <ChatTab onMessageSent={refreshQuota} />
        </TabsContent>

        <TabsContent value="expenses" className="mt-4">
          <ExpenseAnalysisTab onAnalysisComplete={refreshQuota} />
        </TabsContent>

        <TabsContent value="recommendations" className="mt-4">
          <BudgetRecommendationsTab onAnalysisComplete={refreshQuota} />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
