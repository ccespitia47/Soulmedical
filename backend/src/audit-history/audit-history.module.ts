import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AssignmentHistory,
  AssignmentHistorySchema,
} from './assignment-history.schema';
import { AssignmentHistoryService } from './assignment-history.service';

/**
 * Módulo global — cualquier service que borre una asignación puede
 * inyectar `AssignmentHistoryService` sin importar este módulo en el
 * suyo. Se marca @Global() porque son muchos los consumidores
 * (FormsService, GroupsService, ProjectsService, AssignmentsTreeService).
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AssignmentHistory.name, schema: AssignmentHistorySchema },
    ]),
  ],
  providers: [AssignmentHistoryService],
  exports: [AssignmentHistoryService],
})
export class AuditHistoryModule {}
