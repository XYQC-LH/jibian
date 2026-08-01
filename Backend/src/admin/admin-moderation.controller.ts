import { Body, Controller, Get, Put, Query, UseGuards } from "@nestjs/common";
import { IsBoolean } from "class-validator";
import { AdminGuard } from "../auth/admin.guard";
import { AdminModerationService } from "./admin-moderation.service";

export class UpdateModerationConfigDto {
  @IsBoolean()
  enabled!: boolean;
}

@Controller("v1/admin/moderation")
@UseGuards(AdminGuard)
export class AdminModerationController {
  constructor(private readonly moderation: AdminModerationService) {}

  @Get("overview")
  overview(@Query("range") range = "24") {
    return { success: true, data: this.moderation.overview(this.toHours(range)) };
  }

  @Get("dashboard")
  dashboard(@Query("limit") limit = "200") {
    return { success: true, data: this.moderation.dashboard(this.toLimit(limit)) };
  }

  @Get("events")
  events(
    @Query("range") range = "24",
    @Query("page") page = "1",
    @Query("page_size") pageSize = "50",
    @Query("phase") phase?: string,
    @Query("decision") decision?: string,
    @Query("ok") ok?: string,
    @Query("provider") provider?: string,
    @Query("reason") reason?: string,
    @Query("task_id") taskId?: string,
    @Query("user_email") userEmail?: string,
  ) {
    return {
      success: true,
      data: this.moderation.events({
        rangeHours: this.toHours(range),
        page: this.toInt(page, 1),
        pageSize: this.toInt(pageSize, 50),
        phase,
        decision,
        provider,
        reason,
        taskId,
        userEmail,
        ok: ok === undefined ? undefined : ok === "true",
      }),
    };
  }

  @Put("config")
  updateConfig(@Body() dto: UpdateModerationConfigDto) {
    return { success: true, data: this.moderation.updateConfig(dto.enabled) };
  }

  private toHours(value: string | undefined) {
    const hours = Math.floor(Number(value ?? ""));
    if (!Number.isFinite(hours) || hours <= 0) return 24;
    return Math.min(hours, 720);
  }

  private toLimit(value: string | undefined) {
    const limit = Math.floor(Number(value ?? ""));
    if (!Number.isFinite(limit) || limit <= 0) return 200;
    return Math.min(limit, 500);
  }

  private toInt(value: string | undefined, fallback: number) {
    const parsed = Math.floor(Number(value ?? ""));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
