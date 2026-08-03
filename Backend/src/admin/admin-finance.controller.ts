import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard";
import {
  AdminFinanceService,
  type BatchCreateRedeemCodeInput,
  type CreateRedeemCodeInput,
  type UpdateRedeemCodeInput,
} from "./admin-finance.service";

@Controller("v1/admin")
@UseGuards(AdminGuard)
export class AdminFinanceController {
  constructor(private readonly finance: AdminFinanceService) {}

  @Get("redemption-codes")
  listRedeemCodes(
    @Query("page") page = "1",
    @Query("page_size") pageSize = "20",
    @Query("status") status?: string,
  ) {
    return this.finance.listRedeemCodes({
      page: Number(page),
      pageSize: Number(pageSize),
      status,
    });
  }

  @Post("redemption-codes")
  createRedeemCode(@Body() input: CreateRedeemCodeInput) {
    return this.finance.createRedeemCode(input);
  }

  @Post("redemption-codes/batch")
  batchCreateRedeemCodes(@Body() input: BatchCreateRedeemCodeInput) {
    return this.finance.batchCreateRedeemCodes(input);
  }

  @Put("redemption-codes/:id")
  updateRedeemCode(@Param("id") id: string, @Body() input: UpdateRedeemCodeInput) {
    return this.finance.updateRedeemCode(id, input);
  }

  @Post("redemption-codes/:id/disable")
  disableRedeemCode(@Param("id") id: string) {
    return this.finance.disableRedeemCode(id);
  }

  @Get("credits/ledger")
  listCreditLedger(
    @Query("page") page = "1",
    @Query("page_size") pageSize = "20",
    @Query("type") type?: string,
    @Query("user") user?: string,
    @Query("start_date") startDate?: string,
    @Query("end_date") endDate?: string,
  ) {
    return this.finance.listCreditLedger({
      page: Number(page),
      pageSize: Number(pageSize),
      type,
      user,
      startDate,
      endDate,
    });
  }

  @Get("credits/statistics")
  getCreditStatistics(@Query("days") days = "30") {
    return this.finance.getCreditStatistics(Number(days));
  }

  @Get("invites/statistics")
  getInviteStatistics(@Query("days") days = "30") {
    return this.finance.getInviteStatistics(Number(days));
  }

  @Get("recharge-records")
  listRechargeRecords(
    @Query("page") page = "1",
    @Query("page_size") pageSize = "20",
    @Query("user_email") userEmail?: string,
    @Query("start_date") startDate?: string,
    @Query("end_date") endDate?: string,
  ) {
    return this.finance.listRechargeRecords({
      page: Number(page),
      pageSize: Number(pageSize),
      userEmail,
      startDate,
      endDate,
    });
  }

  @Get("transactions")
  listTransactions(
    @Query("page") page = "1",
    @Query("page_size") pageSize = "20",
    @Query("transaction_type") transactionType?: string,
    @Query("user_email") userEmail?: string,
    @Query("start_date") startDate?: string,
    @Query("end_date") endDate?: string,
  ) {
    return this.finance.listTransactions({
      page: Number(page),
      pageSize: Number(pageSize),
      transactionType,
      userEmail,
      startDate,
      endDate,
    });
  }

  @Get("transactions/statistics")
  getTransactionStatistics(@Query("days") days = "30") {
    return this.finance.getTransactionStatistics(Number(days));
  }

}
