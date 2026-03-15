import { MD3LightTheme } from 'react-native-paper';

export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#AD263A', // carmine red
    secondary: '#DB457B', // rose punch
    background: '#260C1A', // midnight violet
    surface: '#BCB8B1', // silver
    text: '#F4F3EE', // parchement
    error: '#B00020',
  },

  spacing: {
    small: 8,
    medium: 16,
    large: 24,
  },

  roundness: 8,
};
