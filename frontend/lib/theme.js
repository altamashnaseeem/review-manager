export const THEME_STORAGE_KEY = 'repliq-theme';
export const validTheme = value => value === 'light' || value === 'dark';

// Static, synchronous head script: restore the preference before first paint.
export const themeBootstrap = `(function(){var t='dark';try{var s=localStorage.getItem('${THEME_STORAGE_KEY}');if(s==='light'||s==='dark')t=s}catch(e){}document.documentElement.setAttribute('data-theme',t)})()`;
