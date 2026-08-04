import { Module } from '@nestjs/common';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';
import { GraphTokenService } from './graph-token.service';

@Module({
  controllers: [EmailController],
  providers: [EmailService, GraphTokenService],
  exports: [EmailService, GraphTokenService],
})
export class EmailModule {}
