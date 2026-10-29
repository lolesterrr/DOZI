import { parseFeedbackUrl } from '../feedback';

describe('parseFeedbackUrl', () => {
  it('accepts an https link', () => {
    expect(parseFeedbackUrl(' https://forms.gle/abc123 ')).toBe('https://forms.gle/abc123');
    expect(parseFeedbackUrl('https://docs.google.com/forms/d/e/x/viewform')).toContain(
      'docs.google.com',
    );
  });

  it('shows nothing for a missing or unsafe value', () => {
    expect(parseFeedbackUrl(undefined)).toBeNull();
    expect(parseFeedbackUrl('')).toBeNull();
    expect(parseFeedbackUrl('http://forms.gle/abc')).toBeNull();
    expect(parseFeedbackUrl('javascript:alert(1)')).toBeNull();
    expect(parseFeedbackUrl('forms.gle/abc')).toBeNull();
    expect(parseFeedbackUrl('https://localhost')).toBeNull();
  });
});
