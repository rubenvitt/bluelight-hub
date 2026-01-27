import { type IQuery, type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { IErinnerungKonfigurationRepository } from '@domain/erinnerung-konfiguration/repositories/erinnerung-konfiguration.repository.interface';
import { ErinnerungKonfiguration } from '@domain/erinnerung-konfiguration/entities/erinnerung-konfiguration.entity';

export class GetErinnerungKonfigurationQuery implements IQuery {}

@QueryHandler(GetErinnerungKonfigurationQuery)
export class GetErinnerungKonfigurationHandler implements IQueryHandler<GetErinnerungKonfigurationQuery> {
  constructor(
    @Inject(IErinnerungKonfigurationRepository)
    private readonly repository: IErinnerungKonfigurationRepository,
  ) {}

  async execute(_query: GetErinnerungKonfigurationQuery): Promise<ErinnerungKonfiguration> {
    const config = await this.repository.get();

    if (!config) {
      return ErinnerungKonfiguration.createDefault();
    }

    return config;
  }
}
