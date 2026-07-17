import { Module } from '@nestjs/common';
import { FormsModule } from '../forms/forms.module';
import { ConsentsSeeder } from './consents.seeder';

// Módulo del consentimiento de vacunación. Importa FormsModule (que exporta el
// modelo Form) y registra el seeder que asegura el formulario real en Mongo.
@Module({
  imports: [FormsModule],
  providers: [ConsentsSeeder],
})
export class ConsentsModule {}
