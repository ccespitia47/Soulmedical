import { IsString, IsNotEmpty, IsUUID, MaxLength, IsOptional } from 'class-validator';

export class CreateFolderDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsUUID()
  projectId: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  color?: string;

  // Antes era MaxLength(10) — se dimensionó para claves cortas del Icon.tsx
  // interno (ej. "folder"). Al integrar @mteherandev/colombia-icons-react los
  // ids pasan a `ci:ComponentName` (el más largo hoy: `ci:MascaraCarnavalBarranquilla`
  // ≈ 31 chars). 50 deja margen holgado para nuevos componentes de esa librería.
  @IsString()
  @IsOptional()
  @MaxLength(50)
  icon?: string;
}
