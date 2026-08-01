import { IsString, IsUUID } from "class-validator";

export class CreateTaskDto {
  @IsString()
  template_id!: string;

  @IsUUID()
  input_asset_id!: string;
}
