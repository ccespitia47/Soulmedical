import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TotpService } from './totp.service';
import { JwtStrategy, JWT_SECRET } from './jwt.strategy';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    UsersModule,
    EmailModule,
    PassportModule,
    JwtModule.register({
      secret: JWT_SECRET,
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || '30m') as `${number}${'s' | 'm' | 'h' | 'd'}` },
    }),
  ],
  providers: [AuthService, JwtStrategy, TotpService],
  controllers: [AuthController],
  exports: [TotpService],
})
export class AuthModule {}