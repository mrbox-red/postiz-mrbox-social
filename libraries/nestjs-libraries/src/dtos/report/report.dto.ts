import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ReportGenerateDto {
  @IsIn([15, 30, 90])
  days: number;
}

export class ReportChatDto {
  @IsIn([15, 30, 90])
  days: number;

  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message: string;
}
