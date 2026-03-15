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
  analysis_type: 'expense_analysis' | 'budget_recommendation';
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
