import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Folder, FolderSchema } from './folder.schema';
import { Form, FormSchema } from '../forms/form.schema';
import { FoldersService } from './folders.service';
import { FoldersController } from './folders.controller';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { UsersModule } from '../users/users.module';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtOrApiKeyGuard } from '../auth/jwt-or-api-key.guard';
import { PermissionsGuard } from '../auth/permissions.guard';

// ApiKeysModule + UsersModule: necesarios para que JwtOrApiKeyGuard resuelva
// la key y popule req.user con el owner (ver api-key.guard.ts).
// Form schema: FoldersService usa un $lookup para devolver, en el mismo
// request de list-folders, un resumen liviano de los forms de cada carpeta
// (elimina el patrón N+1 del sidebar — ver findByProjectWithForms).
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Folder.name, schema: FolderSchema },
      { name: Form.name, schema: FormSchema },
    ]),
    ApiKeysModule,
    UsersModule,
  ],
  controllers: [FoldersController],
  providers: [FoldersService, ApiKeyGuard, JwtAuthGuard, JwtOrApiKeyGuard, PermissionsGuard],
  exports: [FoldersService],
})
export class FoldersModule {}
