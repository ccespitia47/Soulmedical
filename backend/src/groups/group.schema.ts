import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GroupDocument = Group & Document;

@Schema({ timestamps: true, collection: 'groups' })
export class Group {
  @Prop({ type: String, default: () => crypto.randomUUID() })
  _id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: '#6366f1' })
  color: string;

  @Prop({ default: '👥' })
  icon: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const GroupSchema = SchemaFactory.createForClass(Group);

GroupSchema.set('toJSON', {
  virtuals: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});