import { Test } from '@nestjs/testing';

import { JournalPostingService } from '../../src/finance/services/journal-posting.service';

describe('JournalPostingService (template)', () => {
  it.todo('posts balanced journal entry for invoice event (debits == credits)');

  it.todo('rejects unbalanced journal lines');

  it.todo('returns existing posted entry for duplicate idempotency key');

  it.todo('creates reversing entry instead of mutating posted history');

  it('wiring compiles in Nest testing module', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: JournalPostingService,
          useValue: {
            post: jest.fn(),
            reverse: jest.fn(),
          },
        },
      ],
    }).compile();

    const service = moduleRef.get<JournalPostingService>(JournalPostingService);
    expect(service).toBeDefined();
  });
});
