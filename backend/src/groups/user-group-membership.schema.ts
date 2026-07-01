import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserGroupMembershipDocument = UserGroupMembership & Document;

@Schema({ timestamps: true, collection: 'user_group_memberships' })
export class UserGroupMembership {
  @Prop({ type: String, default: () => crypto.randomUUID() })
  _id: string;

  @Prop({ required: true, index: true })
  groupId: string;

  @Prop({ required: true, index: true })
  userId: number;
}

export const UserGroupMembershipSchema = SchemaFactory.createForClass(UserGroupMembership);

UserGroupMembershipSchema.index({ groupId: 1, userId: 1 }, { unique: true });

UserGroupMembershipSchema.set('toJSON', {
  virtuals: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});