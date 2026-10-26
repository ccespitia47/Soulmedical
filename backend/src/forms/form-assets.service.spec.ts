import { BadRequestException } from '@nestjs/common';
import { FormAssetsService } from './form-assets.service';

describe('FormAssetsService validation', () => {
  const service = new FormAssetsService({} as never);

  it('rechaza content-type que no sea image/*', async () => {
    await expect(
      service.upload(Buffer.from('x'), 'application/pdf', 1),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza buffer vacío', async () => {
    await expect(
      service.upload(Buffer.alloc(0), 'image/png', 1),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza buffer > 2 MB', async () => {
    const oversized = Buffer.alloc(2 * 1024 * 1024 + 1);
    await expect(
      service.upload(oversized, 'image/png', 1),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
