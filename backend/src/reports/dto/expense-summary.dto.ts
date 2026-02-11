export class ExpenseSummaryDto {
  totalExpenses!: number;
  byCategory!: Record<string, number>;
}