import { render, screen } from '@testing-library/react-native';
import { useEffect } from 'react';

import { Text } from '@/components/ui';
import { ThemeProvider, useTheme } from '@/theme';

function SetScale({ scale }: { scale: number }) {
  const { setTextScale } = useTheme();
  useEffect(() => setTextScale(scale), [scale, setTextScale]);
  return null;
}

describe('Text size setting', () => {
  it('leaves text alone at the standard size', async () => {
    await render(
      <ThemeProvider initialPreference="light">
        <Text variant="body">Hello</Text>
      </ThemeProvider>,
    );
    expect(screen.getByText('Hello').props.style).toBeUndefined();
  });

  it('makes text bigger by the chosen scale', async () => {
    await render(
      <ThemeProvider initialPreference="light">
        <SetScale scale={1.3} />
        <Text variant="body">Hello</Text>
      </ThemeProvider>,
    );
    const style = [screen.getByText('Hello').props.style].flat().find(Boolean);
    expect(style).toMatchObject({ fontSize: 21, lineHeight: 31 });
  });
});
