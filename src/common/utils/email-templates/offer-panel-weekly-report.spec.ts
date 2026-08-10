import offerPanelWeeklyReport, {
  OfferPanelReportRow,
  OfferPanelWeeklyReportPayload,
} from './offer-panel-weekly-report';

function buildRow(
  overrides: Partial<OfferPanelReportRow> = {},
): OfferPanelReportRow {
  return {
    panelId: 'panel-1',
    title: 'Front Desk VA Panel',
    recipientLabel: 'Sunrise Clinic',
    recipientSub: 'dr.smith@sunrise.example',
    businessUnit: 'MedVirtual',
    status: 'viewed',
    isPublic: false,
    candidateCount: 3,
    createdAtLabel: 'Mon, Jul 27 · 9:14 AM ET',
    viewedAtLabel: 'Mon, Jul 27 · 11:28 AM ET',
    decidedAtLabel: null,
    timeToViewLabel: '2h 14m',
    timeToDecisionLabel: null,
    viewCount: 1,
    ...overrides,
  };
}

function buildPayload(
  overrides: Partial<OfferPanelWeeklyReportPayload> = {},
): OfferPanelWeeklyReportPayload {
  return {
    weekStartLabel: 'Jul 27, 2026',
    weekEndLabel: 'Jul 31, 2026',
    generatedAtLabel: 'Jul 31, 2026, 10:00 AM PDT',
    totalPanels: 2,
    totalCreators: 1,
    statusTotals: { sent: 1, viewed: 1, accepted: 0, declined: 0 },
    sections: [
      {
        creatorId: 'user-1',
        creatorName: 'Ana Souza',
        creatorEmail: 'ana@medvirtual.ai',
        panels: [buildRow(), buildRow({ panelId: 'panel-2', status: 'sent' })],
      },
    ],
    offScheduleNote: null,
    ...overrides,
  };
}

describe('offerPanelWeeklyReport', () => {
  // The shared footer interpolates FRONTEND_URL directly, so without this the
  // "no undefined" assertions would fail on that shared helper rather than on
  // anything this template renders.
  const originalFrontendUrl = process.env.FRONTEND_URL;

  beforeAll(() => {
    process.env.FRONTEND_URL = 'https://app.medvirtual.test';
  });

  afterAll(() => {
    process.env.FRONTEND_URL = originalFrontendUrl;
  });

  it('renders the week range, totals and creator section header', () => {
    const html = offerPanelWeeklyReport(buildPayload());

    expect(html).toContain('Jul 27, 2026');
    expect(html).toContain('Jul 31, 2026');
    expect(html).toContain('Ana Souza');
    expect(html).toContain('Sunrise Clinic');
  });

  it('never leaks unrendered values into the output', () => {
    const html = offerPanelWeeklyReport(
      buildPayload({
        sections: [
          {
            creatorId: 'user-1',
            creatorName: 'Ana Souza',
            creatorEmail: 'ana@medvirtual.ai',
            panels: [
              buildRow({
                viewedAtLabel: null,
                decidedAtLabel: null,
                timeToViewLabel: null,
                timeToDecisionLabel: null,
              }),
            ],
          },
        ],
      }),
    );

    expect(html).not.toContain('undefined');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Invalid Date');
    expect(html).not.toMatch(/>\s*null\s*</);
  });

  it('renders an em-dash for missing viewed and decided timestamps', () => {
    const html = offerPanelWeeklyReport(
      buildPayload({
        sections: [
          {
            creatorId: 'user-1',
            creatorName: 'Ana Souza',
            creatorEmail: 'ana@medvirtual.ai',
            panels: [
              buildRow({
                status: 'sent',
                viewedAtLabel: null,
                decidedAtLabel: null,
                timeToViewLabel: null,
                timeToDecisionLabel: null,
              }),
            ],
          },
        ],
      }),
    );

    // Rendered as the &mdash; entity so Outlook does not depend on charset.
    expect(html).toContain('&mdash;');
  });

  it('emits no literal placeholder tokens that MailService would strip', () => {
    const html = offerPanelWeeklyReport(buildPayload());
    expect(html).not.toMatch(/\{\{|\[\[/);
    expect(html).not.toMatch(/\[[A-Z][A-Za-z0-9_]*\](?!\()/);
  });

  it('HTML-escapes free-text fields sourced from the database', () => {
    const html = offerPanelWeeklyReport(
      buildPayload({
        sections: [
          {
            creatorId: 'user-1',
            creatorName: 'Smith & <Jones>',
            creatorEmail: 'a@b.example',
            panels: [
              buildRow({
                title: 'VA "Panel" & <script>alert(1)</script>',
                recipientLabel: 'Acme & <Group>',
              }),
            ],
          },
        ],
      }),
    );

    expect(html).not.toContain('<script>');
    expect(html).toContain('&amp;');
    expect(html).toContain('&lt;');
  });

  it('shows the repeat-view count when a panel was viewed more than once', () => {
    const html = offerPanelWeeklyReport(
      buildPayload({
        sections: [
          {
            creatorId: 'user-1',
            creatorName: 'Ana Souza',
            creatorEmail: 'ana@medvirtual.ai',
            panels: [buildRow({ viewCount: 4 })],
          },
        ],
      }),
    );

    expect(html).toContain('&times;4');
  });

  it('flags public-link panels', () => {
    const html = offerPanelWeeklyReport(
      buildPayload({
        sections: [
          {
            creatorId: 'user-1',
            creatorName: 'Ana Souza',
            creatorEmail: 'ana@medvirtual.ai',
            panels: [buildRow({ isPublic: true })],
          },
        ],
      }),
    );

    expect(html).toContain('Public link');
  });

  it('renders a no-activity message when no panels were created', () => {
    const html = offerPanelWeeklyReport(
      buildPayload({
        totalPanels: 0,
        totalCreators: 0,
        statusTotals: { sent: 0, viewed: 0, accepted: 0, declined: 0 },
        sections: [],
      }),
    );

    expect(html).toContain('No offer panels were created');
    expect(html).not.toContain('undefined');
  });

  it('renders the off-schedule note only when provided', () => {
    const withNote = offerPanelWeeklyReport(
      buildPayload({ offScheduleNote: 'Triggered on Wednesday' }),
    );
    const withoutNote = offerPanelWeeklyReport(buildPayload());

    expect(withNote).toContain('Triggered on Wednesday');
    expect(withoutNote).not.toContain('Triggered on Wednesday');
  });
});
