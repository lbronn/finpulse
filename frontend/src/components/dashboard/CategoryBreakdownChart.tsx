import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ExpenseBreakdownResponse } from '@/types';

// Fallback palette if categories don't have their own colors
const FALLBACK_COLORS = [
  '#EF9F27', '#378ADD', '#1D9E75', '#D85A30', '#7F77DD',
  '#D4537E', '#E24B4A', '#5DCAA5', '#BA7517', '#639922', '#888780',
];

interface Props {
  data: ExpenseBreakdownResponse | null;
  loading: boolean;
  currency: string;
}

export default function CategoryBreakdownChart({ data, loading, currency }: Props) {
  if (loading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-1/3" /></CardHeader>
        <CardContent><Skeleton className="h-[200px] w-full" /></CardContent>
      </Card>
    );
  }

  const chartData = data?.breakdown.map((item, i) => ({
    name: item.category_name,
    value: item.amount,
    percentage: item.percentage,
    fill: FALLBACK_COLORS[i % FALLBACK_COLORS.length],
  })) ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Spending by Category</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
            No spending data yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [
                  new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(Number(value)),
                  name,
                ]}
                contentStyle={{ fontSize: 12 }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => {
                  const item = chartData.find((d) => d.name === value);
                  return (
                    <span style={{ fontSize: 12 }}>
                      {value} ({item?.percentage.toFixed(1)}%)
                    </span>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
