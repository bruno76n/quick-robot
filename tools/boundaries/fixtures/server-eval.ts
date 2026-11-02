// NEGATIVE FIXTURE — security: eval in packages/server. Must be rejected.
export const broken = (code: string) => eval(code);
