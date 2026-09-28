import { applyTheme, colors, currentTheme, mapColor, paletteFor, themedStyles } from '..';

describe('theme', () => {
  afterEach(() => applyTheme('rose'));

  it('maps only the three accent colors', () => {
    const ocean = paletteFor('ocean');
    expect(mapColor('#e8607a', ocean)).toBe('#3e8ed0');
    expect(mapColor('#F5C6CE', ocean)).toBe('#bcdcf0');
    expect(mapColor('#f9ede6', ocean)).toBe('#e6f1f9');
    expect(mapColor('#2d1f2e', ocean)).toBe('#2d1f2e'); // текстийн өнгө хэвээр
    expect(mapColor(12, ocean)).toBe(12);
  });

  it('recolors registered styles in place and restores them', () => {
    const styles = themedStyles({
      button: { backgroundColor: '#e8607a', borderColor: '#f5c6ce', padding: 8 },
      text: { color: '#2d1f2e' },
    });

    expect(applyTheme('forest')).toBe(true);
    expect(currentTheme()).toBe('forest');
    expect(styles.button).toEqual({ backgroundColor: '#4fae7a', borderColor: '#c2e6d2', padding: 8 });
    expect(styles.text.color).toBe('#2d1f2e');
    expect(colors.rose).toBe('#4fae7a');

    expect(applyTheme('forest')).toBe(false); // өөрчлөлтгүй бол дахин зурахгүй

    applyTheme('rose');
    expect(styles.button.backgroundColor).toBe('#e8607a');
  });

  it('styles registered after a theme change get the current palette', () => {
    applyTheme('violet');
    const late = themedStyles({ badge: { color: '#e8607a' } });
    expect(late.badge.color).toBe('#9b6eb5');
  });

  it('falls back to rose for unknown themes', () => {
    applyTheme('neon');
    expect(currentTheme()).toBe('rose');
    expect(colors.rose).toBe('#e8607a');
  });
});
