import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  color?: string;

  // Antes era MaxLength(10) — se dimensionó para claves cortas del Icon.tsx
  // interno (ej. "building"). Al integrar @mteherandev/colombia-icons-react los
  // ids pasan a `ci:ComponentName` (el más largo hoy: `ci:MascaraCarnavalBarranquilla`
  // ≈ 31 chars). 50 deja margen holgado para nuevos componentes de esa librería.
  @IsString()
  @IsOptional()
  @MaxLength(50)
  icon?: string;
}
