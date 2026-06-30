const TOKEN_KEY = 'rc_auth_token';
const USER_KEY  = 'rc_auth_user';

export const getToken        = ()    => localStorage.getItem(TOKEN_KEY);
export const getUser         = ()    => localStorage.getItem(USER_KEY);
export const setAuth         = (token, username) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, username);
};
export const clearAuth       = ()    => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};
export const isAuthenticated = ()    => !!localStorage.getItem(TOKEN_KEY);
