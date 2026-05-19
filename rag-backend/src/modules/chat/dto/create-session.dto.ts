import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  title?: string;
}
