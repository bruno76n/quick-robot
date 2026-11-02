// Navigation by href, bound to the router at start (avoids importing the route tree from screens).
let navigate: (href: string, replace: boolean) => unknown = () => undefined;
export function setNavigator(fn: typeof navigate) { navigate = fn; }
export const go = (href: string, replace = false) => { void navigate(href, replace); };
