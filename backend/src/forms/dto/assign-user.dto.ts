import { IsInt, IsPositive } from 'class-validator';

export class AssignUserDto {
  @IsInt()
  @IsPositive()
  userId: number;
}
