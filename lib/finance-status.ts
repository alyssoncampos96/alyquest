export type FinanceStatus = 'planned' | 'posted' | 'settled';

export function financeStatus(value: string | null | undefined, occurredOn: string, today: string): FinanceStatus {
  if (value === 'planned' || value === 'posted' || value === 'settled') return value;
  return occurredOn > today ? 'planned' : 'posted';
}

export function financeStatusLabel(status: FinanceStatus, kind: string): string {
  if (status === 'planned') return 'Previsto';
  if (status === 'posted') return 'Lançado';
  return kind === 'income' ? 'Recebido' : 'Pago';
}

export function financeTotals(entries: Array<{ amount: number | string; kind: string; status: FinanceStatus }>) {
  return entries.reduce((totals, entry) => {
    const amount = Number(entry.amount);
    if (!Number.isFinite(amount)) return totals;
    const sign = entry.kind === 'income' ? 1 : -1;
    totals.projected += amount * sign;
    if (entry.status === 'settled') totals.settled += amount * sign;
    else totals.open += amount * sign;
    return totals;
  }, { projected: 0, settled: 0, open: 0 });
}
