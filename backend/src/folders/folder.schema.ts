import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FolderDocument = Folder & Document;

@Schema({ timestamps: true, collection: 'folders' })
export class Folder {
  @Prop({ type: String, default: () => crypto.randomUUID() })
  _id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ default: '#00c2a8' })
  color: string;

  @Prop({ default: '📁' })
  icon: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ required: true, index: true })
  projectId: string;
}

export const FolderSchema = SchemaFactory.createForClass(Folder);

FolderSchema.set('toJSON', {
  virtuals: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});
