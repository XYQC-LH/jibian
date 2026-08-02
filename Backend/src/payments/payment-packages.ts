export type CreditPackage = Readonly<{
  id: string;
  label: string;
  amountFen: number;
  credits: number;
  badge?: string;
}>;

export const creditPackages: readonly CreditPackage[] = [
  { id: "starter", label: "60 积分", amountFen: 599, credits: 60 },
  { id: "basic", label: "210 积分", amountFen: 1990, credits: 210 },
  { id: "value", label: "328 积分", amountFen: 2990, credits: 328, badge: "送25%" },
  { id: "plus", label: "560 积分", amountFen: 4990, credits: 560 },
  { id: "pro", label: "1150 积分", amountFen: 9900, credits: 1150 },
  { id: "max", label: "3588 积分", amountFen: 29900, credits: 3588, badge: "送35%" },
] as const;

export function findCreditPackage(packageId: string | undefined): CreditPackage | null {
  return creditPackages.find((item) => item.id === packageId) ?? null;
}
