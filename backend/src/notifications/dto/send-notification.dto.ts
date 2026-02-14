import { IsEmail, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendNotificationDto {
  @IsString()
  @MaxLength(80)
  templateKey!: string;

  @IsEmail()
  to!: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}
