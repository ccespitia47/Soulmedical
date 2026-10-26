import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { Form, FormSchema } from './form.schema';
import { UserFormAssignment, UserFormAssignmentSchema } from './user-form-assignment.schema';
import { PublicFormOtp, PublicFormOtpSchema } from './public-form-otp.schema';
import { Folder, FolderSchema } from '../folders/folder.schema';
import { Project, ProjectSchema } from '../projects/project.schema';
import { Group, GroupSchema } from '../groups/group.schema';
import { FormsService } from './forms.service';
import { AssignmentsTreeService } from './assignments-tree.service';
import { FormsController } from './forms.controller';
import { FormAssetsService } from './form-assets.service';
import { FormAssetsController } from './form-assets.controller';
import { ExcelPreviewService } from './excel-preview.service';
import { ExcelPreviewController } from './excel-preview.controller';
import { PdfFillService } from './pdf-fill.service';
import { PdfFillController } from './pdf-fill.controller';
import { EmailModule } from '../email/email.module';
import { FilesModule } from '../files/files.module';
import { UsersModule } from '../users/users.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { PermissionsGuard } from '../auth/permissions.guard';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtOrApiKeyGuard } from '../auth/jwt-or-api-key.guard';
import { JWT_SECRET } from '../auth/jwt.strategy';
import { AdminAuditModule } from '../admin-audit/admin-audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Form.name, schema: FormSchema },
      { name: UserFormAssignment.name, schema: UserFormAssignmentSchema },
      { name: PublicFormOtp.name, schema: PublicFormOtpSchema },
      { name: Folder.name, schema: FolderSchema },
      // Registrado aquí (además de en ProjectsModule) para que
      // AssignmentsTreeService pueda validar existencia de proyectos sin
      // duplicar la definición del schema — @nestjs/mongoose reutiliza el
      // modelo ya compilado en la conexión cuando el mismo name+schema se
      // registra en más de un módulo (mismo patrón ya usado con Folder).
      { name: Project.name, schema: ProjectSchema },
      // Idem para Group: AssignmentsTreeService valida existencia/isActive
      // del subject `groupId` antes de escribir (ver validateSubjectExists).
      { name: Group.name, schema: GroupSchema },
    ]),
    EmailModule,
    // FilesModule expone FilesService para descargar binarios de GridFS
    // (firmas/fotos). Se usa en ExcelPreviewController.renderPdf para
    // resolver los valores `gridfs:xxx` que llegan de submissions ya
    // persistidas antes de anclarlos como imagen en la celda del Excel.
    FilesModule,
    // Ciclo: FormsModule necesita UsersModule (FormsService/OTP) y
    // UsersModule necesita FormsModule (AssignmentsTreeService en
    // users.controller). forwardRef() en ambos lados, mismo patrón que
    // AdminAuditModule <-> UsersModule.
    forwardRef(() => UsersModule),
    AdminAuditModule,
    // ApiKeysModule: FormsController ahora expone JwtOrApiKeyGuard en los
    // endpoints create/read para que el MCP y Power BI operen con API key.
    ApiKeysModule,
    // Mismo JWT_SECRET que AuthModule. Lo registramos también aquí porque el
    // FormsService firma/verifica tokens cortos de acceso a formularios
    // públicos verificados por email — son JWTs aparte del de sesión.
    JwtModule.register({ secret: JWT_SECRET }),
  ],
  controllers: [FormsController, FormAssetsController, ExcelPreviewController, PdfFillController],
  providers: [
    FormsService,
    AssignmentsTreeService,
    FormAssetsService,
    ExcelPreviewService,
    PdfFillService,
    PermissionsGuard,
    ApiKeyGuard,
    JwtAuthGuard,
    JwtOrApiKeyGuard,
  ],
  exports: [FormsService, AssignmentsTreeService, FormAssetsService, MongooseModule],
})
export class FormsModule {}
