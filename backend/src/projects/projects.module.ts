import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Project, ProjectSchema } from './project.schema';
import { FormsModule } from '../forms/forms.module';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { UsersModule } from '../users/users.module';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtOrApiKeyGuard } from '../auth/jwt-or-api-key.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
    ]),
    FormsModule,
    ApiKeysModule,
    UsersModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService, ApiKeyGuard, JwtAuthGuard, JwtOrApiKeyGuard],
  exports: [ProjectsService],
})
export class ProjectsModule {}