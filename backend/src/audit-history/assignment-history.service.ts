import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AssignmentHistory,
  AssignmentHistoryDocument,
} from './assignment-history.schema';

export type ArchiveAssignmentInput = {
  type: AssignmentHistory['type'];
  originalDocument: Record<string, unknown>;
  deletedById?: number | null;
  deletedReason?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Servicio central para archivar asignaciones que se desasignan.
 * Cada delete de asignación en el sistema debe llamar a `archive()`
 * ANTES de borrar el doc de su colección activa. Si el archivo falla,
 * lanza — mejor abortar el delete que perder la historia.
 */
@Injectable()
export class AssignmentHistoryService {
  private readonly logger = new Logger(AssignmentHistoryService.name);

  constructor(
    @InjectModel(AssignmentHistory.name)
    private readonly historyModel: Model<AssignmentHistoryDocument>,
  ) {}

  async archive(input: ArchiveAssignmentInput): Promise<void> {
    await this.historyModel.create({
      type: input.type,
      originalDocument: input.originalDocument,
      deletedById: input.deletedById ?? null,
      deletedReason: input.deletedReason ?? null,
      metadata: input.metadata ?? null,
    });
  }

  /**
   * Archiva en batch (para `PUT /assignments/tree` que reemplaza N docs
   * de una vez). Un solo doc de historia con `type: 'assignment_tree_reset'`
   * y toda la lista en `metadata.previousState`.
   */
  async archiveTreeReset(input: {
    subjectType: 'user' | 'group';
    subjectId: string | number;
    previousAssignments: Record<string, unknown>[];
    newAssignments: Record<string, unknown>[];
    deletedById: number | null;
  }): Promise<void> {
    await this.historyModel.create({
      type: 'assignment_tree_reset',
      originalDocument: {
        subjectType: input.subjectType,
        subjectId: input.subjectId,
      },
      deletedById: input.deletedById,
      deletedReason: null,
      metadata: {
        previousState: input.previousAssignments,
        newState: input.newAssignments,
      },
    });
  }
}
