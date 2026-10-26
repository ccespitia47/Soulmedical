import { Module, forwardRef } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { UsersModule } from '../users/users.module';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtOrApiKeyGuard } from '../auth/jwt-or-api-key.guard';

// UsersModule: ApiKeyGuard inyecta UsersService para resolver el owner de la
// key (populate req.user) — necesario para que endpoints con guard JwtOrApiKey
// vean el mismo shape que con JWT.
//
// forwardRef(UsersModule): existe el ciclo
//   UsersModule → forwardRef(FormsModule) → FilesModule → UsersModule.
// Sin forwardRef aquí, al evaluar FilesModule.imports[1] UsersModule aún
// está parcialmente definido y Nest lo recibe como `undefined`, abortando
// el bootstrap ("The module at index [1] of the FilesModule imports array
// is undefined").
@Module({
  imports: [ApiKeysModule, forwardRef(() => UsersModule)],
  controllers: [FilesController],
  providers: [FilesService, ApiKeyGuard, JwtAuthGuard, JwtOrApiKeyGuard],
  exports: [FilesService],
})
export class FilesModule {}
