import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { FoldersModule } from './folders/folders.module';
import { FormsModule } from './forms/forms.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { User } from './users/user.entity';

@Module({
  imports: [
    // PostgreSQL — solo para usuarios y autenticación
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5434'),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'Julian1030*',
      database: process.env.DB_DATABASE || 'soulformsdb',
      entities: [User],
      synchronize: true,
    }),
    // MongoDB — proyectos, carpetas, formularios y respuestas
    MongooseModule.forRoot(
      process.env.MONGO_URI || 'mongodb://localhost:27017/soulformsdb',
    ),
    AuthModule,
    UsersModule,
    ProjectsModule,
    FoldersModule,
    FormsModule,
    SubmissionsModule,
  ],
})
export class AppModule {}
