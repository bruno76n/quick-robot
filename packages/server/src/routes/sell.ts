// Stock, customers, sales, orders, production, expenses, reports, purchases, home and search (docs/12 §6–9).
import {
  adjustStockInput, assignmentsInput, cancelInput, customerInput, customerPatch, deliverInput, enableStockInput, expenseInput, expenseQuery, orderInput,
  orderQuery, orderUpdateInput, pageQuery, paymentInput, printRunInput, printRunQuery, reportQuery, returnSaleInput, saleInput, salePatch, saleQuery,
  searchQuery, startProductionInput,
} from '@app/contract';
import { body, idParam, noContent, ok, query } from '../http';
import { createCustomer, customerDetail, customerList, deleteCustomer, removeCustomerLogo, restoreCustomer, updateCustomerUc } from '../usecases/sell/customers';
import {
  acceptOrder, cancelOrder, createOrder, deleteOrder, deleteOrderPayment, deliverOrder, markOrderReady, orderDetail, orderList,
  reassignPrinters, recordOrderPayment, restoreOrder, startProduction, updateOrderUc,
} from '../usecases/sell/orders';
import { deletePrintRun, finishQueueEntry, logPrintRun, printRunDetail, printRunList } from '../usecases/sell/production';
import { createExpense, deleteExpense, expenseList, home, purchases, report, restoreExpense, search, updateExpenseUc } from '../usecases/sell/reports';
import { createSale, deleteSale, deleteSalePayment, recordSalePayment, restoreSale, returnSale, saleDetail, saleList, updateSaleUc } from '../usecases/sell/sales';
import { adjustStock, enableStockTracking, stockDetail, stockList } from '../usecases/sell/stock';
import type { Router } from './router';

export function sellRoutes(r: Router) {
  r.get('/stock', 'stock.read', async (c) => ok(c, await stockList(c.get('deps'), c.get('deps').db, c.get('ctx'), query(c, pageQuery).q)));
  r.get('/stock/:productId', 'stock.read', async (c) => ok(c, await stockDetail(c.get('deps'), c.get('deps').db, c.get('ctx'), idParam(c, 'productId', 'product'))));
  r.post('/stock/:productId/enable', 'stock.adjust', async (c) => ok(c, await enableStockTracking(c.get('deps'), c.get('ctx'), idParam(c, 'productId', 'product'), await body(c, enableStockInput))));
  r.post('/stock/:productId/adjust', 'stock.adjust', async (c) => ok(c, await adjustStock(c.get('deps'), c.get('ctx'), idParam(c, 'productId', 'product'), await body(c, adjustStockInput))));

  r.get('/customers', 'customer.read', async (c) => ok(c, await customerList(c.get('deps'), c.get('deps').db, c.get('ctx'), query(c, pageQuery).q)));
  r.get('/customers/:id', 'customer.read', async (c) => ok(c, await customerDetail(c.get('deps'), c.get('deps').db, c.get('ctx'), idParam(c, 'id', 'customer'))));
  r.post('/customers', 'customer.create', async (c) => ok(c, await createCustomer(c.get('deps'), c.get('ctx'), await body(c, customerInput)), 201));
  r.patch('/customers/:id', 'customer.update', async (c) => ok(c, await updateCustomerUc(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'customer'), await body(c, customerPatch))));
  r.delete('/customers/:id/logo', 'customer.update', async (c) => ok(c, await removeCustomerLogo(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'customer'))));
  r.delete('/customers/:id', 'customer.delete', async (c) => { await deleteCustomer(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'customer')); return noContent(c); });
  r.post('/customers/:id/restore', 'customer.delete', async (c) => ok(c, await restoreCustomer(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'customer'))));

  r.get('/sales', 'sale.read', async (c) => ok(c, await saleList(c.get('deps'), c.get('deps').db, c.get('ctx'), query(c, saleQuery))));
  r.get('/sales/:id', 'sale.read', async (c) => ok(c, await saleDetail(c.get('deps'), c.get('deps').db, c.get('ctx'), idParam(c, 'id', 'sale'))));
  r.post('/sales', 'sale.create', async (c) => ok(c, await createSale(c.get('deps'), c.get('ctx'), await body(c, saleInput)), 201));
  r.patch('/sales/:id', 'sale.update', async (c) => ok(c, await updateSaleUc(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'sale'), await body(c, salePatch))));
  r.delete('/sales/:id', 'sale.delete', async (c) => { await deleteSale(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'sale')); return noContent(c); });
  r.post('/sales/:id/restore', 'sale.delete', async (c) => ok(c, await restoreSale(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'sale'))));
  r.post('/sales/:id/payments', 'sale.payment', async (c) => ok(c, await recordSalePayment(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'sale'), await body(c, paymentInput)), 201));
  r.delete('/sales/:id/payments/:paymentId', 'sale.payment', async (c) => ok(c, await deleteSalePayment(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'sale'), idParam(c, 'paymentId', 'payment'))));
  r.post('/sales/:id/return', 'sale.return', async (c) => ok(c, await returnSale(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'sale'), await body(c, returnSaleInput))));

  r.get('/orders', 'order.read', async (c) => {
    const q = query(c, orderQuery);
    return ok(c, await orderList(c.get('deps'), c.get('deps').db, c.get('ctx'), { ...q, statuses: q.status === undefined ? undefined : Array.isArray(q.status) ? q.status : [q.status] }));
  });
  r.get('/orders/:id', 'order.read', async (c) => ok(c, await orderDetail(c.get('deps'), c.get('deps').db, c.get('ctx'), idParam(c, 'id', 'order'))));
  r.post('/orders', 'order.create', async (c) => { const x = await createOrder(c.get('deps'), c.get('ctx'), await body(c, orderInput)); return ok(c, x.data, 201, x.warnings); });
  r.put('/orders/:id', 'order.update', async (c) => { const x = await updateOrderUc(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'order'), await body(c, orderUpdateInput)); return ok(c, x.data, 200, x.warnings); });
  r.delete('/orders/:id', 'order.delete', async (c) => { await deleteOrder(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'order')); return noContent(c); });
  r.post('/orders/:id/restore', 'order.delete', async (c) => ok(c, await restoreOrder(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'order'))));
  r.post('/orders/:id/accept', 'order.update', async (c) => { const x = await acceptOrder(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'order')); return ok(c, x.data, 200, x.warnings); });
  r.post('/orders/:id/start-production', 'order.produce', async (c) => { const x = await startProduction(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'order'), await body(c, startProductionInput)); return ok(c, x.data, 200, x.warnings); });
  r.post('/orders/:id/reassign-printers', 'order.produce', async (c) => ok(c, await reassignPrinters(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'order'), await body(c, assignmentsInput))));
  r.post('/orders/:id/ready', 'order.produce', async (c) => ok(c, await markOrderReady(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'order'))));
  r.post('/orders/:id/deliver', 'order.deliver', async (c) => ok(c, await deliverOrder(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'order'), await body(c, deliverInput))));
  r.post('/orders/:id/cancel', 'order.cancel', async (c) => ok(c, await cancelOrder(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'order'), await body(c, cancelInput))));
  r.post('/orders/:id/payments', 'order.payment', async (c) => ok(c, await recordOrderPayment(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'order'), await body(c, paymentInput)), 201));
  r.delete('/orders/:id/payments/:paymentId', 'order.payment', async (c) => ok(c, await deleteOrderPayment(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'order'), idParam(c, 'paymentId', 'payment'))));
  r.post('/printers/:id/queue/:entryId/finish', 'order.produce', async (c) => {
    const x = await finishQueueEntry(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'printer'), idParam(c, 'entryId', 'queue_entry'));
    return ok(c, x.data, 200, x.warnings);
  });

  r.get('/print-runs', 'printRun.read', async (c) => ok(c, await printRunList(c.get('deps'), c.get('deps').db, c.get('ctx'), query(c, printRunQuery))));
  r.get('/print-runs/:id', 'printRun.read', async (c) => ok(c, await printRunDetail(c.get('deps'), c.get('deps').db, c.get('ctx'), idParam(c, 'id', 'print_run'))));
  r.post('/print-runs', 'printRun.create', async (c) => { const x = await logPrintRun(c.get('deps'), c.get('ctx'), await body(c, printRunInput)); return ok(c, x.data, 201, x.warnings); });
  r.delete('/print-runs/:id', 'printRun.delete', async (c) => {
    const w = await deletePrintRun(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'print_run'));
    return w.length ? ok(c, null, 200, w) : noContent(c);
  });

  r.get('/expenses', 'expense.read', async (c) => ok(c, await expenseList(c.get('deps'), c.get('deps').db, c.get('ctx'), query(c, expenseQuery))));
  r.post('/expenses', 'expense.create', async (c) => ok(c, await createExpense(c.get('deps'), c.get('ctx'), await body(c, expenseInput)), 201));
  r.patch('/expenses/:id', 'expense.update', async (c) => ok(c, await updateExpenseUc(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'expense'), await body(c, expenseInput))));
  r.delete('/expenses/:id', 'expense.delete', async (c) => { await deleteExpense(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'expense')); return noContent(c); });
  r.post('/expenses/:id/restore', 'expense.delete', async (c) => ok(c, await restoreExpense(c.get('deps'), c.get('ctx'), idParam(c, 'id', 'expense'))));

  r.get('/reports', 'report.read', async (c) => ok(c, await report(c.get('deps'), c.get('deps').db, c.get('ctx'), query(c, reportQuery))));
  r.get('/purchases', 'purchase.read', async (c) => ok(c, await purchases(c.get('deps'), c.get('deps').db, c.get('ctx'))));
  r.get('/home', 'home.read', async (c) => ok(c, await home(c.get('deps'), c.get('deps').db, c.get('ctx'))));
  r.get('/search', 'search.read', async (c) => ok(c, await search(c.get('deps'), c.get('deps').db, c.get('ctx'), query(c, searchQuery).q)));
}
