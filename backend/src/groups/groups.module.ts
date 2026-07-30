import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Group, GroupSchema } from './group.schema';
import { UserGroupMembership, UserGroupMembershipSchema } from './user-group-membership.schema';
import { FormsModule } from '../forms/forms.module';
import { UsersModule } from '../users/users.module';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Group.name, schema: GroupSchema },
      { name: UserGroupMembership.name, schema: UserGroupMembershipSchema },
    ]),
    FormsModule,
    UsersModule,
  ],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}