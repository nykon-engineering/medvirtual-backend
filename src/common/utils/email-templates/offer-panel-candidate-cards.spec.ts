import {
  isDarkColor,
  maskCandidateName,
  mixWithWhite,
  OfferPanelEmailCandidate,
  renderOfferPanelCandidateCards,
} from './offer-panel-candidate-cards';
import { EmailTheme } from './theme';

function makeTheme(overrides: Partial<EmailTheme> = {}): EmailTheme {
  return {
    primaryColor: '#01546B',
    primaryColorHover: '#013A4F',
    secondaryColor: '#F8F9FA',
    accentColor: '#00B2E2',
    companyName: 'MedVirtual',
    logoUrl: 'https://staging.medvirtual.ai/logo.png',
    layoutPreset: 'default',
    ...overrides,
  };
}

function makeCandidate(
  overrides: Partial<OfferPanelEmailCandidate> = {},
): OfferPanelEmailCandidate {
  return {
    id: 'c1',
    first_name: 'Ana',
    last_name: 'Silva',
    country: 'Brazil',
    avatar_url: 'https://medvirtual-avatar.s3.us-east-1.amazonaws.com/ana.png',
    employment_type: 'Full Time',
    approved_positions_pairing: ['Medical Assistant'],
    skills: [{ skill_name: 'EMR' }],
    languages: [{ name: 'English' }],
    bill_rate_monthly: 2500,
    ...overrides,
  };
}

describe('renderOfferPanelCandidateCards', () => {
  // The value is injected into the template body, which renderHtml then runs
  // `.replace(/\n/g, '<br>')` over — a newline here becomes a stray <br>.
  it('never emits a newline', () => {
    const html = renderOfferPanelCandidateCards(
      [makeCandidate(), makeCandidate({ id: 'c2', first_name: 'Bruno' })],
      makeTheme(),
      true,
    );

    expect(html).not.toContain('\n');
  });

  it('returns an empty string when there are no candidates', () => {
    expect(renderOfferPanelCandidateCards([], makeTheme(), false)).toBe('');
    expect(renderOfferPanelCandidateCards(null, makeTheme(), false)).toBe('');
    expect(
      renderOfferPanelCandidateCards(undefined, makeTheme(), false),
    ).toBe('');
  });

  // Placeholder values are injected raw, and names come from HubSpot.
  it('escapes interpolated candidate data', () => {
    const html = renderOfferPanelCandidateCards(
      [
        makeCandidate({
          first_name: '<script>alert(1)</script>',
          last_name: null,
          country: 'A & B "quoted"',
        }),
      ],
      makeTheme(),
      false,
    );

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('A &amp; B &quot;quoted&quot;');
  });

  describe('promo pricing', () => {
    it('strikes the original and shows the promo price above the threshold', () => {
      const html = renderOfferPanelCandidateCards(
        [makeCandidate({ bill_rate_monthly: 2500 })],
        makeTheme(),
        true,
      );

      expect(html).toContain('line-through');
      expect(html).toContain('$2,500');
      expect(html).toContain('$1,760');
    });

    // A promo must never present as a price increase.
    it('leaves a rate at or below the promo price unstruck', () => {
      const html = renderOfferPanelCandidateCards(
        [makeCandidate({ bill_rate_monthly: 1500 })],
        makeTheme(),
        true,
      );

      expect(html).not.toContain('line-through');
      expect(html).toContain('$1,500');
      expect(html).not.toContain('$1,760');
    });

    it('shows the plain rate when the panel has no promo', () => {
      const html = renderOfferPanelCandidateCards(
        [makeCandidate({ bill_rate_monthly: 2500 })],
        makeTheme(),
        false,
      );

      expect(html).not.toContain('line-through');
      expect(html).toContain('$2,500');
    });

    it('derives a monthly rate from the hourly one when missing', () => {
      const html = renderOfferPanelCandidateCards(
        [makeCandidate({ bill_rate_monthly: null, bill_rate_hourly: 20 })],
        makeTheme(),
        false,
      );

      expect(html).toContain('$3,520'); // 20 * 176
    });

    it('omits the rate block entirely when no rate is known', () => {
      const html = renderOfferPanelCandidateCards(
        [makeCandidate({ bill_rate_monthly: null, bill_rate_hourly: null })],
        makeTheme(),
        false,
      );

      expect(html).not.toContain('/mo');
    });
  });

  describe('avatars', () => {
    it('renders the S3 image when the URL is absolute', () => {
      const html = renderOfferPanelCandidateCards(
        [makeCandidate()],
        makeTheme(),
        false,
      );

      expect(html).toContain('<img src="https://medvirtual-avatar.s3');
    });

    // showAvatar()'s fallback is root-relative and resolves against the mail
    // client's origin, so a relative src must never reach an inbox.
    it('falls back to an initials tile instead of a relative path', () => {
      const relative = renderOfferPanelCandidateCards(
        [makeCandidate({ avatar_url: '/avatar_default.png' })],
        makeTheme(),
        false,
      );
      const missing = renderOfferPanelCandidateCards(
        [makeCandidate({ avatar_url: null })],
        makeTheme(),
        false,
      );

      for (const html of [relative, missing]) {
        expect(html).not.toContain('<img');
        expect(html).toContain('AS'); // Ana Silva
      }
    });
  });

  describe('name masking', () => {
    it('masks the surname the way the platform does for non-system viewers', () => {
      expect(maskCandidateName({ first_name: 'Ana', last_name: 'Silva' })).toBe(
        'Ana S.',
      );
    });

    it('masks the denormalized name column too', () => {
      expect(
        maskCandidateName({ name: 'Carlos Eduardo Mendes' }),
      ).toBe('Carlos Eduardo M.');
    });

    it('never emits a full surname in the rendered card', () => {
      const html = renderOfferPanelCandidateCards(
        [makeCandidate({ first_name: 'Ana', last_name: 'Silva' })],
        makeTheme(),
        false,
      );

      expect(html).toContain('Ana S.');
      expect(html).not.toContain('Silva');
    });

    it('degrades to a placeholder when there is no name at all', () => {
      expect(maskCandidateName({})).toBe('Candidate');
    });
  });

  describe('business-unit neutrality', () => {
    // This is the test that fails if anyone reintroduces a hardcoded brand.
    it('carries an arbitrary brand that matches no known business unit', () => {
      const html = renderOfferPanelCandidateCards(
        [makeCandidate()],
        makeTheme({
          primaryColor: '#123456',
          companyName: 'Some Future BU',
          logoUrl: 'https://cdn.example.com/future-bu.png',
        }),
        false,
      );

      expect(html).toContain('#123456');
      expect(html).toContain('https://cdn.example.com/future-bu.png');
      // and none of the incumbent brand colours leaked in
      expect(html).not.toContain('#FD7171');
      expect(html).not.toContain('#01546B');
    });

    it('renders the logo as a watermark, and omits it when absent', () => {
      const withLogo = renderOfferPanelCandidateCards(
        [makeCandidate()],
        makeTheme(),
        false,
      );
      const withoutLogo = renderOfferPanelCandidateCards(
        [makeCandidate()],
        makeTheme({ logoUrl: undefined }),
        false,
      );

      expect(withLogo).toContain('background-image:url(');
      expect(withoutLogo).not.toContain('background-image:url(');
    });

    // Pins the derivation to the hand-authored design token rather than an
    // approximation: Berry's #ffeeee in tokens.css.
    it('derives the pill tint to match the existing design tokens', () => {
      expect(mixWithWhite('#FD7171', 0.88)).toBe('rgb(255, 238, 238)');
    });

    it('flips button text colour on a light brand colour', () => {
      expect(isDarkColor('#01546B')).toBe(true);
      expect(isDarkColor('#FFE600')).toBe(false);
    });

    it('survives a malformed brand colour rather than throwing', () => {
      expect(() =>
        renderOfferPanelCandidateCards(
          [makeCandidate()],
          makeTheme({ primaryColor: 'not-a-color' }),
          false,
        ),
      ).not.toThrow();
    });
  });

  describe('capping', () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      makeCandidate({ id: `c${i}`, first_name: `Cand${i}` }),
    );

    it('caps the cards and links the remainder to the panel', () => {
      const html = renderOfferPanelCandidateCards(
        many,
        makeTheme(),
        false,
        'https://app.medvirtual.ai/panel/abc',
      );

      // 6 rendered, 3 summarized — Gmail clips messages past ~102KB.
      expect(html.match(/border-radius:12px 12px 0 0/g)).toHaveLength(6);
      expect(html).toContain('+3 more candidates');
      expect(html).toContain('https://app.medvirtual.ai/panel/abc');
    });

    it('still reports the remainder without a panel URL', () => {
      const html = renderOfferPanelCandidateCards(many, makeTheme(), false);

      expect(html).toContain('+3 more candidates');
      expect(html).not.toContain('<a href');
    });
  });
});
