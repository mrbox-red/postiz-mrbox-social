import { IsDefined, IsString, MaxLength, MinLength } from 'class-validator';

export class SubaccountDto {
  @IsDefined()
  @IsString()
  @MinLength(2)
  @MaxLength(128)
  name: string;
}
