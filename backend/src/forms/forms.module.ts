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
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';
import { PermissionsGuard } from '../auth/permissions.guard';
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
    // Ciclo: FormsModule necesita UsersModule (FormsService/OTP) y
    // UsersModule necesita FormsModule (AssignmentsTreeService en
    // users.controller). forwardRef() en ambos lados, mismo patrón que
    // AdminAuditModule <-> UsersModule.
    forwardRef(() => UsersModule),
    AdminAuditModule,
    // Mismo JWT_SECRET que AuthModule. Lo registramos también aquí porque el
    // FormsService firma/verifica tokens cortos de acceso a formularios
    // públicos verificados por email — son JWTs aparte del de sesión.
    JwtModule.register({ secret: JWT_SECRET }),
  ],
  controllers: [FormsController],
  providers: [FormsService, AssignmentsTreeService, PermissionsGuard],
  exports: [FormsService, AssignmentsTreeService, MongooseModule],
})
export class FormsModule {}
