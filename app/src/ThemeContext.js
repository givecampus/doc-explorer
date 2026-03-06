import { createContext, useContext } from 'react';

export const ThemeContext = createContext({ themeId: 'warm' });

export const useThemeId = () => useContext(ThemeContext).themeId;
