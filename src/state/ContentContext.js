import { createContext, useContext } from 'react';
export const ContentContext = createContext(null);
export const useContentCtx = () => useContext(ContentContext);
