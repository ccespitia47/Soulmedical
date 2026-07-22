import { IsObject, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSubmissionDto {
  @IsObject()
  @IsNotEmpty()
  data: Record<string, any>;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  // HTML del pdfTemplate con placeholders ${label} SIN interpolar, capturado
  // por el frontend en el momento del envío. Peso típico 2-20 KB.
  @IsString()
  @IsOptional()
  templateSnapshot?: string;

  // Nombre del archivo PDF sugerido (puede incluir placeholders ya resueltos)
  @IsString()
  @IsOptional()
  pdfFilename?: string;
}