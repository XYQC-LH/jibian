import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard";
import { AdminDispatchService } from "./admin-dispatch.service";

@Controller("v1/admin")
@UseGuards(AdminGuard)
export class AdminDispatchController {
  constructor(private readonly dispatch: AdminDispatchService) {}

  @Get("model-routes")
  listModelRoutes(
    @Query("operation") operation?: string,
    @Query("model_id") modelId?: string,
    @Query("source_id") sourceId?: string,
    @Query("enabled") enabled?: string,
  ) {
    return this.dispatch.listModelRoutes({
      operation,
      model_id: modelId,
      source_id: sourceId,
      enabled: this.parseBoolean(enabled),
    });
  }

  @Get("dispatch/overview")
  getDispatchOverview(@Query("hours") hours = "24") {
    return this.dispatch.getDispatchOverview(Number(hours));
  }

  @Get("dispatch/source-stats")
  getSourceStats(
    @Query("hours") hours = "0",
    @Query("model_id") modelId?: string,
    @Query("source_id") sourceId?: string,
  ) {
    return this.dispatch.getSourceStats(Number(hours), { model_id: modelId, source_id: sourceId });
  }

  @Get("dispatch/routes")
  listDispatchRoutes(
    @Query("operation") operation?: string,
    @Query("model_id") modelId?: string,
    @Query("source_id") sourceId?: string,
    @Query("enabled") enabled?: string,
  ) {
    return this.dispatch.listDispatchRoutes({
      operation,
      model_id: modelId,
      source_id: sourceId,
      enabled: this.parseBoolean(enabled),
    });
  }

  @Get("dispatch/attempts")
  listDispatchAttempts(
    @Query("page") page = "1",
    @Query("page_size") pageSize?: string,
    @Query("limit") limit?: string,
    @Query("task_id") taskId?: string,
    @Query("source_id") sourceId?: string,
    @Query("status") status?: string,
    @Query("error_type") errorType?: string,
  ) {
    return this.dispatch.listDispatchAttempts({
      page: Number(page),
      page_size: pageSize ? Number(pageSize) : undefined,
      limit: limit ? Number(limit) : undefined,
      task_id: taskId,
      source_id: sourceId,
      status,
      error_type: errorType,
    });
  }

  @Get("source-providers")
  listSourceProviders(
    @Query("model_id") modelId?: string,
    @Query("source_id") sourceId?: string,
    @Query("vendor") vendor?: string,
    @Query("traffic_tier") trafficTier?: string,
    @Query("is_active") isActive?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.dispatch.listSourceProviders({
      model_id: modelId,
      source_id: sourceId,
      vendor,
      traffic_tier: trafficTier,
      is_active: this.parseBoolean(isActive),
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post("source-providers/sync-from-registry")
  syncSourceProvidersFromRegistry(
    @Query("bootstrap") bootstrap?: string,
    @Query("force_refresh") forceRefresh?: string,
  ) {
    return this.dispatch.syncSourceProvidersFromRegistry({
      bootstrap: this.parseBoolean(bootstrap, true),
      force_refresh: this.parseBoolean(forceRefresh, false),
    });
  }

  @Get("source-runtime-profiles")
  listSourceRuntimeProfiles() {
    return this.dispatch.listSourceRuntimeProfiles();
  }

  @Patch("source-runtime-profiles/:sourceId")
  patchSourceRuntimeProfile(
    @Param("sourceId") sourceId: string,
    @Body() body: { is_enabled?: boolean; weight?: number; priority?: number },
  ) {
    return this.dispatch.patchSourceRuntimeProfile(sourceId, body);
  }

  @Get("task-requests/overview")
  getTaskRequestOverview(
    @Query("status") status?: string,
    @Query("user") user?: string,
    @Query("model_id") modelId?: string,
    @Query("source") source?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.dispatch.getTaskRequestOverview({ status, user, model_id: modelId, source, from, to });
  }

  @Get("task-requests")
  listTaskRequests(
    @Query("page") page = "1",
    @Query("page_size") pageSize = "20",
    @Query("status") status?: string,
    @Query("user") user?: string,
    @Query("model_id") modelId?: string,
    @Query("source") source?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.dispatch.listTaskRequests({
      page: Number(page),
      page_size: Number(pageSize),
      status,
      user,
      model_id: modelId,
      source,
      from,
      to,
    });
  }

  @Get("task-requests/:requestId")
  getTaskRequest(@Param("requestId") requestId: string) {
    return this.dispatch.getTaskRequest(requestId);
  }

  @Get("dispatch/tasks/:taskId/timeline")
  getDispatchTaskTimeline(@Param("taskId") taskId: string) {
    return this.dispatch.getDispatchTaskTimeline(taskId);
  }

  private parseBoolean(value: string | undefined, fallback?: boolean): boolean | undefined {
    if (value === undefined || value === "") return fallback;
    return value === "true" || value === "1";
  }
}
