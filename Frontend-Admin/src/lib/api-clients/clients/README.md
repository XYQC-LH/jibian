# Admin API Domain Clients

This directory contains domain-specific API clients extracted from the monolithic `apiClient.ts`.

## Structure

- `_base.ts` - Shared utilities (`ensureData`, `unwrapModelItems`, `isApiResponse`)
- `authClient.ts` - Authentication: login, register, logout, getCurrentUser
- `financeClient.ts` - Finance: dashboard, profit, transactions, recharge records
- `orderClient.ts` - Orders, order details, refunds, redemption codes
- `modelClient.ts` - Models: pricing, config, fields, logo assets
- `systemClient.ts` - System: health, monitoring, users
- `taskClient.ts` - Tasks and realtime tickets
- `dockerClient.ts` - Docker logs
- `moderationClient.ts` - Content moderation and governance
- `ossClient.ts` - Object storage
- `dispatchClient.ts` - Dispatch: routes, sources, runtime profiles, task requests
- `analyticsClient.ts` - Visits/analytics dashboard and online users

## Design Principles

1. Each client is a plain class with no internal state beyond the HTTP client
2. All clients share the same `AxiosInstance` via constructor injection
3. The main `ApiClient` composes all domain clients and delegates to them
4. No new public API surface is exposed; all existing methods are preserved
