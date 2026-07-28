import {
  IsObject,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateSubmissionDto {
  @IsObject()
  @IsNotEmpty()
  data: Record<string, any>;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  // Nombre sugerido del PDF (opcional). El cliente puede pasarlo con
  // placeholders ya resueltos (`consentimiento_Juan_Perez.pdf`). Se valida
  // con regex estricta para prevenir CRLF injection en Content-Disposition
  // y path-traversal — cualquier caracter fuera del set queda rechazado
  // por el ValidationPipe global antes de tocar la BD.
  //
  // NOTA: templateSnapshot NO se acepta del cliente — se deriva server-side
  // del form.emailTemplate.pdfTemplate en SubmissionsService.submit() para
  // impedir que un atacante inyecte HTML/JS arbitrario que después corre
  // en Chrome (--no-sandbox) al generar el PDF.
  @IsString()
  @IsOptional()
  @MaxLength(120)
  @Matches(/^[\w\-. ñáéíóúüÑÁÉÍÓÚÜ]+\.pdf$/, {
    message:
      'pdfFilename inválido: sólo letras, números, espacios, guion, punto y underscore; debe terminar en .pdf',
  })
  pdfFilename?: string;
}
