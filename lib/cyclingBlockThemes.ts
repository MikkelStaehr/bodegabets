export interface BlockTheme {
  bg: string;
  bgDark: string;
  accent: string;
  accentBg: string;
  stripes?: string[];
}

export const BLOCK_THEMES: Record<string, BlockTheme> = {
  'Flandern-klassikerne': {
    bg: '#1C1000',
    bgDark: '#2A1800',
    accent: '#E8A020',
    accentBg: 'rgba(232,160,32,0.13)',
  },
  'Ardennerne-klassikerne': {
    bg: '#1E3A5F',
    bgDark: '#162D4A',
    accent: '#4A9EFF',
    accentBg: 'rgba(74,158,255,0.12)',
  },
  "Giro d'Italia": {
    bg: '#2A0D1E',
    bgDark: '#3D0D28',
    accent: '#E8409A',
    accentBg: 'rgba(232,64,154,0.15)',
  },
  'Tour de France': {
    bg: '#1A1600',
    bgDark: '#2A2400',
    accent: '#C9A84C',
    accentBg: 'rgba(201,168,76,0.13)',
  },
  'Vuelta a España': {
    bg: '#2A0800',
    bgDark: '#3D0D00',
    accent: '#E84030',
    accentBg: 'rgba(232,64,48,0.15)',
  },
  'Paris-Nice': {
    bg: '#051828',
    bgDark: '#072340',
    accent: '#2BAEE0',
    accentBg: 'rgba(43,174,224,0.15)',
  },
  'Tirreno-Adriatico': {
    bg: '#1A0A1E',
    bgDark: '#260D2A',
    accent: '#C060E0',
    accentBg: 'rgba(192,96,224,0.15)',
  },
  'Volta a Catalunya': {
    bg: '#0A1A10',
    bgDark: '#0D2416',
    accent: '#40C070',
    accentBg: 'rgba(64,192,112,0.13)',
  },
  'Itzulia Basque Country': {
    bg: '#1A1000',
    bgDark: '#261800',
    accent: '#E06830',
    accentBg: 'rgba(224,104,48,0.15)',
  },
  'Tour de Romandie': {
    bg: '#0A1820',
    bgDark: '#0D2230',
    accent: '#60B8D0',
    accentBg: 'rgba(96,184,208,0.13)',
  },
  'Critérium du Dauphiné': {
    bg: '#0D1F15',
    bgDark: '#102A1A',
    accent: '#3D9B62',
    accentBg: 'rgba(61,155,98,0.15)',
  },
  'Tour de Suisse': {
    bg: '#0F0F2A',
    bgDark: '#161640',
    accent: '#9999EE',
    accentBg: 'rgba(153,153,238,0.15)',
  },
  'World Championships': {
    bg: '#0A0A0A',
    bgDark: '#141414',
    accent: '#E8E8E8',
    accentBg: 'rgba(232,232,232,0.10)',
    stripes: ['#1A9FE0', '#E40521', '#000000', '#FCB131', '#009B48'],
  },
  'European Championships': {
    bg: '#00051A',
    bgDark: '#050A30',
    accent: '#4060E0',
    accentBg: 'rgba(64,96,224,0.18)',
    stripes: ['#003399', '#FFCC00', '#003399', '#FFCC00', '#003399', '#FFCC00', '#003399'],
  },
  'Il Lombardia': {
    bg: '#1A0A00',
    bgDark: '#261000',
    accent: '#D04820',
    accentBg: 'rgba(208,72,32,0.15)',
  },
  'Eschborn-Frankfurt': {
    bg: '#0A1400',
    bgDark: '#0F1E00',
    accent: '#70B030',
    accentBg: 'rgba(112,176,48,0.13)',
  },
  'San Sebastián': {
    bg: '#1E1428',
    bgDark: '#2A1A38',
    accent: '#A870D0',
    accentBg: 'rgba(168,112,208,0.15)',
  },
  'Bretagne Classic': {
    bg: '#0A1818',
    bgDark: '#0D2222',
    accent: '#40B8A0',
    accentBg: 'rgba(64,184,160,0.13)',
  },
  'GP Québec': {
    bg: '#1A1000',
    bgDark: '#261800',
    accent: '#C89030',
    accentBg: 'rgba(200,144,48,0.13)',
  },
  'GP Montréal': {
    bg: '#1A1000',
    bgDark: '#261800',
    accent: '#C89030',
    accentBg: 'rgba(200,144,48,0.13)',
  },
}

export const DEFAULT_BLOCK_THEME: BlockTheme = {
  bg: '#1E3A5F',
  bgDark: '#162D4A',
  accent: '#4A9EFF',
  accentBg: 'rgba(74,158,255,0.12)',
}

export function getBlockTheme(blockName?: string | null): BlockTheme {
  if (!blockName) return DEFAULT_BLOCK_THEME
  return BLOCK_THEMES[blockName] ?? DEFAULT_BLOCK_THEME
}
