// Where to go after login/register: the page the user was trying to open
// (?next=/tool?module=hydrology), or the tool dashboard. Only same-site
// paths are accepted, so a crafted link can't redirect to another website.
export function afterLoginPath() {
  const next = new URLSearchParams(window.location.search).get('next') || '';
  const sameSite = next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\');
  return sameSite ? next : '/tool';
}
