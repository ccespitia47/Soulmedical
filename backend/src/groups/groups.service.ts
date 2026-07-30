import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Group, GroupDocument } from './group.schema';
import { UserGroupMembership, UserGroupMembershipDocument } from './user-group-membership.schema';
import { UserFormAssignment, UserFormAssignmentDocument } from '../forms/user-form-assignment.schema';
import { UsersService } from '../users/users.service';

@Injectable()
export class GroupsService {
  constructor(
    @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
    @InjectModel(UserGroupMembership.name) private readonly membershipModel: Model<UserGroupMembershipDocument>,
    @InjectModel(UserFormAssignment.name) private readonly assignmentModel: Model<UserFormAssignmentDocument>,
    private readonly usersService: UsersService,
  ) {}

  async findAll(): Promise<GroupDocument[]> {
    return this.groupModel.find({ isActive: true }).sort({ createdAt: -1 });
  }

  async findOne(id: string): Promise<GroupDocument> {
    const group = await this.groupModel.findById(id);
    if (!group || !group.isActive) throw new NotFoundException(`Grupo ${id} no encontrado`);
    return group;
  }

  async create(dto: { name: string; description?: string; color?: string; icon?: string }): Promise<GroupDocument> {
    const group = new this.groupModel({
      name: dto.name,
      description: dto.description ?? '',
      color: dto.color ?? '#6366f1',
      icon: dto.icon ?? '👥',
    });
    return group.save();
  }

  async update(id: string, dto: { name?: string; description?: string; color?: string; icon?: string }): Promise<GroupDocument> {
    const group = await this.findOne(id);
    Object.assign(group, dto);
    return group.save();
  }

  async remove(id: string): Promise<void> {
    const group = await this.findOne(id);
    group.isActive = false;
    await group.save();
    // Remove all memberships
    await this.membershipModel.deleteMany({ groupId: id });
    // Remove all assignments
    await this.assignmentModel.deleteMany({ groupId: id });
  }

  // ── Memberships ────────────────────────────────────────────────────────────

  async getMembers(groupId: string): Promise<UserGroupMembershipDocument[]> {
    return this.membershipModel.find({ groupId });
  }

  async addMember(groupId: string, userId: number): Promise<UserGroupMembershipDocument> {
    await this.findOne(groupId);
    const exists = await this.membershipModel.findOne({ groupId, userId });
    if (exists) throw new ConflictException('El usuario ya es miembro de este grupo');
    return this.membershipModel.create({ groupId, userId });
  }

  async removeMember(groupId: string, userId: number): Promise<void> {
    await this.membershipModel.deleteOne({ groupId, userId });
  }

  /**
   * Busca miembros del grupo por nombre o email (case-insensitive). Usado por
   * el widget "search" (fuente "group") para autocompletar. Reutiliza
   * getMembers() + UsersService.findByIds() en vez de duplicar la consulta.
   */
  async searchMembers(
    groupId: string,
    q: string,
  ): Promise<Array<{ id: number; name: string; email: string }>> {
    const query = q.trim().toLowerCase();
    if (!query) return [];

    const memberships = await this.getMembers(groupId);
    if (memberships.length === 0) return [];

    const userIds = memberships.map((m) => m.userId);
    const usersById = await this.usersService.findByIds(userIds);

    const results: Array<{ id: number; name: string; email: string }> = [];
    for (const userId of userIds) {
      const user = usersById[userId];
      if (!user) continue;
      if (
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
      ) {
        results.push({ id: userId, name: user.name, email: user.email });
        if (results.length >= 50) break;
      }
    }
    return results;
  }

  async getGroupsOfUser(userId: number): Promise<string[]> {
    const memberships = await this.membershipModel.find({ userId });
    return memberships.map((m) => m.groupId);
  }

  // ── Group assignments (projects + forms) ──────────────────────────────────

  async getGroupAssignments(groupId: string): Promise<UserFormAssignmentDocument[]> {
    return this.assignmentModel.find({ groupId });
  }

  async assignProjectToGroup(groupId: string, projectId: string): Promise<UserFormAssignmentDocument> {
    await this.findOne(groupId);
    const exists = await this.assignmentModel.findOne({ groupId, projectId, formId: null });
    if (exists) throw new ConflictException('El proyecto ya está asignado a este grupo');
    return this.assignmentModel.create({ groupId, projectId, userId: null });
  }

  async unassignProjectFromGroup(groupId: string, projectId: string): Promise<void> {
    await this.assignmentModel.deleteOne({ groupId, projectId, formId: null });
  }

  async assignFormToGroup(groupId: string, formId: string): Promise<UserFormAssignmentDocument> {
    await this.findOne(groupId);
    const exists = await this.assignmentModel.findOne({ groupId, formId });
    if (exists) throw new ConflictException('El formulario ya está asignado a este grupo');
    return this.assignmentModel.create({ groupId, formId, userId: null });
  }

  async unassignFormFromGroup(groupId: string, formId: string): Promise<void> {
    await this.assignmentModel.deleteOne({ groupId, formId });
  }
}