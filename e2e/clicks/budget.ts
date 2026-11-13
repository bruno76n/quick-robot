// Click budget of each flow (mejoras/ronda-2.md §11–12, D42), measured at 1440 with the development seed by the
// specs of this folder (`countedPage`). `today` = clicks and taps (a native select costs 2: open and choose);
// `fieldsClicked` = text fields that had to be clicked to focus them before typing. Phase D lowers these numbers
// with each improvement; a regression breaks its spec. The report with the minimum of each flow is
// docs/mejoras/informe-ronda2-c.md.
import type { ClickCount } from './counted';

export const BUDGET = {
  // Productos
  newPieceFull: { today: 8, fieldsClicked: 2 },
  addFilamentToPiece: { today: 4, fieldsClicked: 0 },
  addSupplyToPiece: { today: 4, fieldsClicked: 0 },
  newVariant: { today: 2, fieldsClicked: 0 },
  quote: { today: 3, fieldsClicked: 0 },
  newCollection: { today: 6, fieldsClicked: 0 },
  // Ventas
  sellFromStock: { today: 2, fieldsClicked: 0 },
  sellFromProducts: { today: 2, fieldsClicked: 0 },
  saleSeveralItems: { today: 7, fieldsClicked: 1 },
  salePayment: { today: 2, fieldsClicked: 0 },
  salePaymentFromHome: { today: 2, fieldsClicked: 0 },
  returnSale: { today: 3, fieldsClicked: 0 },
  // Pedidos
  newOrderNewCustomer: { today: 6, fieldsClicked: 1 },
  acceptOrder: { today: 1, fieldsClicked: 0 },
  startProduction: { today: 2, fieldsClicked: 0 },
  markReady: { today: 1, fieldsClicked: 0 },
  orderPayment: { today: 4, fieldsClicked: 0 },
  deliverAndCharge: { today: 2, fieldsClicked: 0 },
  finishJob: { today: 1, fieldsClicked: 0 },
  // Existencias, Producción, Filamentos, Insumos, Compras
  printRun: { today: 4, fieldsClicked: 1 },
  printRunFromPiece: { today: 3, fieldsClicked: 0 },
  adjustStock: { today: 5, fieldsClicked: 1 },
  enableStock: { today: 4, fieldsClicked: 1 },
  addSpoolExisting: { today: 3, fieldsClicked: 0 },
  addSpoolHeader: { today: 6, fieldsClicked: 1 },
  filamentMovement: { today: 5, fieldsClicked: 1 },
  newSupply: { today: 4, fieldsClicked: 2 },
  supplyPurchase: { today: 3, fieldsClicked: 1 },
  supplyPurchaseFromPurchases: { today: 3, fieldsClicked: 1 },
  supplyUse: { today: 3, fieldsClicked: 0 },
  // Clientes, Gastos, Impresoras
  newCustomer: { today: 4, fieldsClicked: 1 },
  saleFromCustomer: { today: 4, fieldsClicked: 0 },
  newExpense: { today: 4, fieldsClicked: 1 },
  maintenanceDone: { today: 2, fieldsClicked: 0 },
  newPrinter: { today: 2, fieldsClicked: 1 },
} satisfies Record<string, ClickCount>;
