export const defaultMembershipPlans = [
  { code: "month", name: "连续包月", amountFen: 1500, periodDays: 30, sortOrder: 1 },
  { code: "season", name: "连续包季", amountFen: 4000, periodDays: 90, sortOrder: 2 },
  { code: "year", name: "连续包年", amountFen: 10800, periodDays: 365, sortOrder: 3 },
] as const;

export type MembershipPlanCode = (typeof defaultMembershipPlans)[number]["code"];
