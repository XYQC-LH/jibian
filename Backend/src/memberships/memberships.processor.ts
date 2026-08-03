import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Job } from "bullmq";
import { MembershipsService } from "./memberships.service";

type RenewalJob = {
  subscriptionId: string;
};

@Injectable()
@Processor("membership-renewal")
export class MembershipsProcessor extends WorkerHost {
  constructor(private readonly memberships: MembershipsService) {
    super();
  }

  async process(job: Job<RenewalJob>) {
    await this.memberships.renewSubscription(job.data.subscriptionId);
  }
}
