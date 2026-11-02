// Small pieces shared by the Producción list and the run detail.
import { Pill } from '../../components/Pill';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import type { PrintRunReason, PrintRunView } from './api';

const L = es.screens.production;
export const REASON_TONE: Record<PrintRunReason, 'info' | 'warn' | ''> = { stock: 'info', test: 'warn', order: '' };
export const runName = (r: Pick<PrintRunView, 'reason' | 'text' | 'qty' | 'name'>) => (r.reason === 'test' ? r.text || L.testDefault : r.qty > 1 ? t('screens.production.times', { qty: r.qty, name: r.name }) : r.name);
export const reasonLabel = (r: Pick<PrintRunView, 'reason' | 'orderNumber'>) => (r.reason === 'order' && r.orderNumber ? t('screens.production.order', { folio: r.orderNumber }) : es.status.printRunReason[r.reason]);
export const ResultPill = ({ result }: { result: 'ok' | 'fail' }) => <Pill tone={result === 'ok' ? 'good' : 'bad'}>{result === 'ok' ? L.ok : L.fail}</Pill>;
export const orderHref = (id: string) => `/pedidos/pedido?id=${id}`;
