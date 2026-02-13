import { DiscountType } from '../../common/enums/discount-type.enum';
import { TaxMethod } from '../../common/enums/tax-method.enum';

import { clamp, roundMoney } from './money';

export interface PricingItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
  lineDiscountType?: DiscountType;
  lineDiscountValue?: number;
  taxRate?: number;
  taxMethod?: TaxMethod;
}

export interface InvoiceTaxOverrideInput {
  rate: number;
  method: TaxMethod;
}

export interface PricingRequest {
  items: PricingItemInput[];
  invoiceDiscountType?: DiscountType;
  invoiceDiscountValue?: number;
  invoiceTaxOverride?: InvoiceTaxOverrideInput | null;
}

export interface PricingLineResult {
  productId: string;
  quantity: number;
  unitPrice: number;
  lineBase: number;
  lineDiscountType: DiscountType;
  lineDiscountValue: number;
  lineDiscountAmount: number;
  invoiceDiscountAmount: number;
  taxRate: number;
  taxMethod: TaxMethod;
  lineTaxAmount: number;
  lineTotal: number;
}

export interface PricingResult {
  lines: PricingLineResult[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  invoiceDiscountType: DiscountType;
  invoiceDiscountValue: number;
  invoiceDiscountAmount: number;
  invoiceTaxOverride: InvoiceTaxOverrideInput | null;
}

const DEFAULT_TAX_RATE = 0;

function computeDiscountAmount(
  base: number,
  discountType: DiscountType,
  discountValue: number,
): number {
  if (discountType === DiscountType.PERCENT) {
    return roundMoney((base * clamp(discountValue, 0, 100)) / 100);
  }

  if (discountType === DiscountType.FIXED) {
    return roundMoney(clamp(discountValue, 0, base));
  }

  return 0;
}

export function computePricing(input: PricingRequest): PricingResult {
  if (input.items.length === 0) {
    return {
      lines: [],
      subtotal: 0,
      discountTotal: 0,
      taxTotal: 0,
      grandTotal: 0,
      invoiceDiscountType: DiscountType.NONE,
      invoiceDiscountValue: 0,
      invoiceDiscountAmount: 0,
      invoiceTaxOverride: null,
    };
  }

  const invoiceDiscountType = input.invoiceDiscountType ?? DiscountType.NONE;
  const invoiceDiscountValue = roundMoney(input.invoiceDiscountValue ?? 0);

  const seededLines = input.items.map((item) => {
    const quantity = item.quantity;
    const unitPrice = roundMoney(item.unitPrice);
    const lineBase = roundMoney(quantity * unitPrice);
    const lineDiscountType = item.lineDiscountType ?? DiscountType.NONE;
    const lineDiscountValue = roundMoney(item.lineDiscountValue ?? 0);
    const lineDiscountAmount = computeDiscountAmount(
      lineBase,
      lineDiscountType,
      lineDiscountValue,
    );

    return {
      productId: item.productId,
      quantity,
      unitPrice,
      lineBase,
      lineDiscountType,
      lineDiscountValue,
      lineDiscountAmount,
      invoiceDiscountAmount: 0,
      taxRate: roundMoney(
        input.invoiceTaxOverride?.rate ?? item.taxRate ?? DEFAULT_TAX_RATE,
      ),
      taxMethod: input.invoiceTaxOverride?.method ?? item.taxMethod ?? TaxMethod.EXCLUSIVE,
      lineTaxAmount: 0,
      lineTotal: 0,
    } satisfies PricingLineResult;
  });

  const subtotal = roundMoney(
    seededLines.reduce((sum, line) => sum + line.lineBase, 0),
  );

  const discountableBase = roundMoney(
    seededLines.reduce(
      (sum, line) => sum + (line.lineBase - line.lineDiscountAmount),
      0,
    ),
  );

  const invoiceDiscountAmount = computeDiscountAmount(
    discountableBase,
    invoiceDiscountType,
    invoiceDiscountValue,
  );

  const distributionWeight = discountableBase <= 0 ? 0 : invoiceDiscountAmount / discountableBase;
  let allocatedInvoiceDiscount = 0;

  for (let index = 0; index < seededLines.length; index += 1) {
    const line = seededLines[index];
    const lineNetBeforeInvoice = roundMoney(line.lineBase - line.lineDiscountAmount);

    const calculatedShare = roundMoney(lineNetBeforeInvoice * distributionWeight);
    const share = index === seededLines.length - 1
      ? roundMoney(invoiceDiscountAmount - allocatedInvoiceDiscount)
      : calculatedShare;

    line.invoiceDiscountAmount = clamp(share, 0, lineNetBeforeInvoice);
    allocatedInvoiceDiscount = roundMoney(
      allocatedInvoiceDiscount + line.invoiceDiscountAmount,
    );

    const taxableBase = roundMoney(lineNetBeforeInvoice - line.invoiceDiscountAmount);

    if (line.taxMethod === TaxMethod.INCLUSIVE) {
      const divisor = 100 + line.taxRate;
      line.lineTaxAmount = divisor <= 0
        ? 0
        : roundMoney((taxableBase * line.taxRate) / divisor);
      line.lineTotal = taxableBase;
    } else {
      line.lineTaxAmount = roundMoney((taxableBase * line.taxRate) / 100);
      line.lineTotal = roundMoney(taxableBase + line.lineTaxAmount);
    }
  }

  const lineDiscountTotal = roundMoney(
    seededLines.reduce((sum, line) => sum + line.lineDiscountAmount, 0),
  );

  const taxTotal = roundMoney(
    seededLines.reduce((sum, line) => sum + line.lineTaxAmount, 0),
  );

  const grandTotal = roundMoney(
    seededLines.reduce((sum, line) => sum + line.lineTotal, 0),
  );

  const discountTotal = roundMoney(lineDiscountTotal + invoiceDiscountAmount);

  return {
    lines: seededLines,
    subtotal,
    discountTotal,
    taxTotal,
    grandTotal,
    invoiceDiscountType,
    invoiceDiscountValue,
    invoiceDiscountAmount,
    invoiceTaxOverride: input.invoiceTaxOverride ?? null,
  };
}
