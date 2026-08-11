import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { Form, FormSchema } from './form.schema';
import { UserFormAssignment, UserFormAssignmentSchema } from './user-form-assignment.schema';
import { PublicFormOtp, PublicFormOtpSchema } from './public-form-otp.schema';
import { Folder, FolderSchema } from '../folders/folder.schema';
import { FormsService } from './forms.service';
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
    ]),
    EmailModule,
    UsersModule,
    AdminAuditModule,
    // Mismo JWT_SECRET que AuthModule. Lo registramos también aquí porque el
    // FormsService firma/verifica tokens cortos de acceso a formularios
    // públicos verificados por email — son JWTs aparte del de sesión.
    JwtModule.register({ secret: JWT_SECRET }),
  ],
  controllers: [FormsController],
  providers: [FormsService, PermissionsGuard],
  exports: [FormsService, MongooseModule],
})
export class FormsModule {}
