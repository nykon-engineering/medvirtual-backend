# Test Coverage Progress

Última atualização: 2026-05-12
Baseline medido em: 2026-05-11 — `npm run test:cov`

## Status por Fase

### Fase 1 — Quick Wins ✅ CONCLUÍDA (2026-05-12)
- [x] mail.service.ts (21% → **100%**) — criado: `src/mail/mail.service.spec.ts`
- [x] s3.service.ts (50% → **100%**) — criado: `src/s3/s3.service.spec.ts`
- [x] dashboard.service.ts (69% → **95.65%**) — editado: `src/dashboard/dashboard.service.spec.ts`
- [x] openai.service.ts (54% → **94.59%**) — editado: `src/openai/openai.service.spec.ts`
- [x] email-test.service.ts (0% → **96.42%**) — criado: `src/email-test/email-test.service.spec.ts`

### Fase 2 — Médios ✅ CONCLUÍDA (2026-05-12)
- [x] contacts.service.ts (10% → **94.82%**) — criado: `src/contacts/contacts.service.spec.ts`
- [x] googledrive.service.ts (10% → **91.58%**) — editado: `src/googledrive/googledrive.service.spec.ts`
- [x] talent-pool-leads.service.ts (63% → **95.08%**) — editado: `src/talent-pool-leads/talent-pool-leads.service.spec.ts`
- [x] referred-companies.service.ts (66% → **90.16%**) — editado: `src/med-alliance/referred-companies/referred-companies.service.spec.ts`

### Fase 3 — Médio-Grande
- [x] auth.service.ts (58% → **97.59%**) — editado: `src/auth/auth.service.spec.ts`
- [x] staff.service.ts (52% → **98.79%**) — editado: `src/staff/staff.service.spec.ts`
- [x] payout-requests.service.ts (50% → **99.66%**) — editado: `src/med-alliance/payout-requests/payout-requests.service.spec.ts`
- [x] cron.service.ts (38% → **100%**) — editado: `src/cron/cron.service.spec.ts`
- [x] notifications.service.ts (43% → **98.04%**) — editado: `src/notifications/notifications.service.spec.ts`
- [x] hubspot.service.ts (50% → **93.51%**) — editado: `src/hubspot/hubspot.service.spec.ts`

### Fase 4 — Monólitos
- [ ] ticket.service.ts (25% → meta 80%)
- [ ] candidates.service.ts (33% → meta 80%)
- [ ] affiliates.service.ts (32% → meta 80%)
- [ ] hire-request.service.ts (28% → meta 80%)
- [ ] organization.service.ts (20% → meta 80%)
- [ ] user.service.ts (5% → meta 80%)

## Cobertura Real (atualizar após cada service)

| Service | Antes | Depois | Data |
|---|---|---|---|
| email-test.service.ts | 0% | **96.42%** | 2026-05-12 |
| user.service.ts | 5.88% | — | — |
| googledrive.service.ts | 10.28% | **91.58%** | 2026-05-12 |
| contacts.service.ts | 10.34% | **94.82%** | 2026-05-12 |
| organization.service.ts | 20.67% | — | — |
| mail.service.ts | 21.73% | **100%** | 2026-05-12 |
| ticket.service.ts | 25.6% | — | — |
| hire-request.service.ts | 28.55% | — | — |
| affiliates.service.ts | 32.59% | — | — |
| candidates.service.ts | 33.19% | — | — |
| cron.service.ts | 38.5% | **100%** | 2026-05-12 |
| notifications.service.ts | 43.6% | **98.04%** | 2026-05-12 |
| s3.service.ts | 50% | **100%** | 2026-05-12 |
| hubspot.service.ts | 50.61% | **93.51%** | 2026-05-12 |
| payout-requests.service.ts | 50.83% | **99.66%** | 2026-05-12 |
| staff.service.ts | 52.41% | **98.79%** | 2026-05-12 |
| openai.service.ts | 54.05% | **94.59%** | 2026-05-12 |
| auth.service.ts | 58.23% | **97.59%** | 2026-05-12 |
| talent-pool-leads.service.ts | 63.93% | **95.08%** | 2026-05-12 |
| referred-companies.service.ts | 66.66% | **90.16%** | 2026-05-12 |
| dashboard.service.ts | 69.56% | **95.65%** | 2026-05-12 |

## Notas de Implementação

- Padrão de mock do projeto: `useValue` com `jest.fn()` inline por arquivo (sem factories compartilhadas)
- `jest.clearAllMocks()` no `beforeEach` de cada `describe`
- Erros esperados: `.rejects.toThrow('mensagem exata')` ou `.rejects.toThrow(ExceptionClass)`
- Para módulos externos (Resend, AWS SDK, OpenAI): `jest.mock('pacote')` no topo do arquivo
- Para services com DI: `Test.createTestingModule({ providers: [Service, { provide: Dep, useValue: mock }] })`

## Como Retomar em Nova Sessão

1. Ler este arquivo para ver onde parou
2. Ler o plano em `.claude/plans/atue-como-test-coverage-sunny-lynx.md` para detalhes dos testes
3. Continuar pelo próximo item `[ ]` na fase atual
