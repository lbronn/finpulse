// Mirrors database-schema exactly

export interface UserProfile {
  id: string; // UUID — matches auth.users.id
  display_name: string;
  currency: string; // ISO 4217, default 'PHP'
  monthly_budget_goal: number | null;
  created_at: string; // ISO 8601
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string | null; // null for default categories
  name: string;
  icon: string | null;
  color: string | null; // hex, e.g. '#EF9F27'
  is_default: boolean;
  created_at: string;
}

export interface Expense {
  id: string;
  user_id: string;
  category_id: string;
  amount: number;
  description: string;
  notes: string | null;
  expense_date: string; // ISO date string 'YYYY-MM-DD'
  created_at: string;
  updated_at: string;
  // Joined from categories table when fetched with select('*, categories(*)')
  categories?: Pick<Category, 'name' | 'icon' | 'color'>;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  title: string;
  content: string;
  tags: string[];
  entry_date: string; // 'YYYY-MM-DD'
  created_at: string;
  updated_at: string;
}

export interface BudgetGoal {
  id: string;
  user_id: string;
  category_id: string;
  amount: number;
  month: string; // 'YYYY-MM-DD' — always first day of month
  created_at: string;
  updated_at: string;
}

export interface AnalysisHistory {
  id: string;
  user_id: string;
  analysis_type: 'expense_analysis' | 'budget_recommendation' | 'weekly_digest';
  input_summary: Record<string, unknown>;
  result: Record<string, unknown>;
  model_used: string;
  tokens_used: number | null;
  created_at: string;
}

// Form input types (no id/timestamps — used for create/update)
export type ExpenseFormData = Pick<Expense, 'amount' | 'description' | 'category_id' | 'expense_date' | 'notes'>;
export type JournalEntryFormData = Pick<JournalEntry, 'title' | 'content' | 'tags' | 'entry_date'>;

// Filter types
export interface ExpenseFilters {
  categoryId?: string;
  startDate?: string;
  endDate?: string;
}

// Budget goal with joined category (for Supabase reads with select('*, categories(...)'))
export interface BudgetGoalWithCategory extends BudgetGoal {
  categories: Pick<Category, 'name' | 'icon' | 'color'>;
}

export type BudgetGoalFormData = Pick<BudgetGoal, 'category_id' | 'amount' | 'month'>;

// Django API response types

export interface BudgetCategorySummary {
  category_id: string;
  category_name: string;
  icon: string | null;
  color: string | null;
  goal: number | null;
  spent: number;
  remaining: number | null;
  percentage: number | null;
}

export interface BudgetSummaryResponse {
  month: string;
  overall: {
    goal: number | null;
    spent: number;
    remaining: number | null;
    percentage: number | null;
  };
  categories: BudgetCategorySummary[];
}

export interface MonthlyTrendMonth {
  month: string; // 'YYYY-MM'
  total: number;
  categories: { category_name: string; amount: number }[];
}

export interface ExpenseTrendsResponse {
  months: MonthlyTrendMonth[];
}

export interface ExpenseBreakdownResponse {
  start_date: string;
  end_date: string;
  total: number;
  breakdown: { category_name: string; amount: number; percentage: number }[];
}

// ---------------------------------------------------------------------------
// Analysis API types (Phase 3)
// ---------------------------------------------------------------------------

export type InsightType = 'trend' | 'anomaly' | 'pattern' | 'comparison' | 'saving_opportunity';
export type InsightSeverity = 'info' | 'success' | 'warning' | 'critical';
export type RecommendationConfidence = 'high' | 'medium' | 'low';

export interface Insight {
  type: InsightType;
  title: string;
  description: string;
  severity: InsightSeverity;
}

export interface Recommendation {
  category: string;
  current_goal: number;
  suggested_goal: number;
  reasoning: string;
  confidence: RecommendationConfidence;
  impact: string;
}

export interface ExpenseAnalysisResponse {
  insights: Insight[];
  summary: string;
  tokens_used: number;
  model_used: string;
  history_id: string;
}

export interface BudgetRecommendationsResponse {
  recommendations: Recommendation[];
  overall_advice: string;
  tokens_used: number;
  model_used: string;
  history_id: string;
}

export interface AnalysisHistoryResponse {
  history: AnalysisHistory[];
}

export interface TokenUsageSummary {
  total_tokens: number;
  analysis_count: number;
  estimated_cost_usd: number;
}

// ---------------------------------------------------------------------------
// Phase 5 — Quick Capture types
// ---------------------------------------------------------------------------

export interface ParsedExpense {
  amount: number | null;
  description: string;
  category_id: string | null;
  category_name: string | null;
  expense_date: string;
  confidence: 'high' | 'medium' | 'low';
  raw_text: string;
}

export interface AutoCategorizeResult {
  category_id: string | null;
  category_name: string | null;
  method: 'pattern' | 'llm' | 'fallback';
  confidence: 'high' | 'medium' | 'low';
}

// ---------------------------------------------------------------------------
// Phase 6 — Chat and Weekly Digest types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  isError?: boolean;
}

export interface ChatResponse {
  session_id: string;
  response: string;
  tokens_used: number;
}

export interface ChatSession {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeeklyDigestKeyStat {
  label: string;
  value: string;
  detail: string;
}

export type DigestMood = 'on_track' | 'needs_attention' | 'over_budget' | 'great_week';

export interface WeeklyDigest {
  headline: string;
  body: string;
  key_stat: WeeklyDigestKeyStat;
  mood: DigestMood;
}

export interface WeeklyDigestResponse {
  digest: WeeklyDigest | null;
  generated_at: string | null;
}
