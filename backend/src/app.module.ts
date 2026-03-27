import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { User } from './users/user.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5434'),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'Julian1030*',
      database: process.env.DB_DATABASE || 'soulformsdb',
      entities: [User],
      // synchronize crea/actualiza tablas automáticamente en desarrollo
      // EN PRODUCCIÓN debe ser false y usar migraciones
      synchronize: true,
    }),
    AuthModule,
    UsersModule,
  ],
})
export class AppModule {}
