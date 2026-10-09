

const colors = {
  light: {
    text: '#24382D',
    tint: '#397A5B',

    // Core surfaces
    background: '#F4F6EF',
    foreground: '#24382D',

    // Cards / elevated surfaces
    card: '#FFFFFF',
    cardForeground: '#24382D',

    // Primary action color (buttons, links, active states)
    primary: '#397A5B',
    primaryForeground: '#FFFFFF',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#E6EFE8',
    secondaryForeground: '#315441',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#EDF1EA',
    mutedForeground: '#68786D',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#F3E3D6',
    accentForeground: '#80533C',

    // Destructive actions (delete, error states)
    destructive: '#B84943',
    destructiveForeground: '#FFFFFF',

    // Borders and input outlines
    border: '#DCE5DC',
    input: '#DCE5DC',
  },
  dark: {
    text: '#EFF5EF',
    tint: '#A7D1B2',
    background: '#11231B',
    foreground: '#EFF5EF',
    card: '#1A3025',
    cardForeground: '#EFF5EF',
    primary: '#A7D1B2',
    primaryForeground: '#173324',
    secondary: '#294536',
    secondaryForeground: '#E5F1E7',
    muted: '#20382A',
    mutedForeground: '#AABBAE',
    accent: '#4B382D',
    accentForeground: '#F0C7A8',
    destructive: '#F08D83',
    destructiveForeground: '#311A18',
    border: '#365142',
    input: '#365142',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 18,
};

export default colors;
