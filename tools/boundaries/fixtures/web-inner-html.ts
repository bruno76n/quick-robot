// NEGATIVE FIXTURE — security: innerHTML in apps/web. Must be rejected.
export function broken(el: HTMLElement, s: string) {
  el.innerHTML = s;
}
