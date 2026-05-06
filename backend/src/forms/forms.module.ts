import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Form, FormSchema } from './form.schema';
import { UserFormAssignment, UserFormAssignmentSchema } from './user-form-assignment.schema';
import { FormsService } from './forms.service';
import { FormsController } from './forms.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Form.name, schema: FormSchema },
      { name: UserFormAssignment.name, schema: UserFormAssignmentSchema },
    ]),
  ],
  controllers: [FormsController],
  providers: [FormsService],
  exports: [FormsService],
})
export class FormsModule {}
