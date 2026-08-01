import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard";
import { AdminDispatchService } from "./admin-dispatch.service";

@Controller("v1/admin")
@UseGuards(AdminGuard)
export class AdminDispatchController {
  constructor(private readonly dispatch: AdminDispatchService) {}

  @Get("dispatch/routes")
  listDispatchRoutes() {
    return this.dispatch.listDispatchRoutes();
  }

  @Get("source-runtime-profiles")
  listSourceRuntimeProfiles() {
    return this.dispatch.listSourceRuntimeProfiles();
  }

  @Patch("source-runtime-profiles/:sourceId")
  patchSourceRuntimeProfile(
    @Param("sourceId") sourceId: string,
    @Body("is_enabled") isEnabled?: boolean,
  ) {
    return this.dispatch.patchSourceRuntimeProfile(sourceId, { is_enabled: isEnabled });
  }

  @Get("dispatch/source-stats")
  getSourceStats(
    @Query("hours") hours = "0",
    @Query("model_id") modelId?: string,
    @Query("source_id") sourceId?: string,
  ) {
    return this.dispatch.getSourceStats(Number(hours), { model_id: modelId, source_id: sourceId });
  }
}

@Controller("v1/model-management")
@UseGuards(AdminGuard)
export class AdminModelManagementController {
  constructor(private readonly dispatch: AdminDispatchService) {}

  @Get("models")
  listModels(
    @Query("page") page = "1",
    @Query("page_size") pageSize = "20",
    @Query("q") q?: string,
    @Query("model_types") modelTypes?: string,
  ) {
    return this.dispatch.listModels({
      page: Number(page),
      pageSize: Number(pageSize),
      q,
      modelTypes: modelTypes ? modelTypes.split(",") : [],
    });
  }
}
