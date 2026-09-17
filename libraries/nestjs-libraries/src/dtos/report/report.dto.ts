import { IsIn, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ReportGenerateDto {
  @IsIn([15, 30, 90])
  days: number;
}

export class ReportAskDto {
  @IsUUID()
  sessionId: string;

  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  question: string;
}
