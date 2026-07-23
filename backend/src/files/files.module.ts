import { Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtOrApiKeyGuard } from '../auth/jwt-or-api-key.guard';

@Module({
  imports: [ApiKeysModule],
  controllers: [FilesController],
  providers: [FilesService, ApiKeyGuard, JwtAuthGuard, JwtOrApiKeyGuard],
  exports: [FilesService],
})
export class FilesModule {}
