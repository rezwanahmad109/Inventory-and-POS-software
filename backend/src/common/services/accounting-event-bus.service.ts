import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

export interface SaleInvoicedEvent {
  saleId: string;
  invoiceNumber: string;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  branchId: string | null;
  occurredAt: Date;
}

export interface SalePaymentReceivedEvent {
  saleId: string;
  amount: number;
  branchId: string | null;
  occurredAt: Date;
}

export interface PurchaseBilledEvent {
  purchaseId: string;
  invoiceNumber: string;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  branchId: string | null;
  occurredAt: Date;
}

export interface PurchasePaymentSentEvent {
  purchaseId: string;
  amount: number;
  branchId: string | null;
  occurredAt: Date;
}

export interface SalesReturnEvent {
  salesReturnId: string;
  totalRefund: number;
  branchId: string | null;
  occurredAt: Date;
}

export interface PurchaseReturnEvent {
  purchaseReturnId: string;
  totalRefund: number;
  branchId: string | null;
  occurredAt: Date;
}

type EventPayloadMap = {
  'sale.invoiced': SaleInvoicedEvent;
  'sale.payment_received': SalePaymentReceivedEvent;
  'purchase.billed': PurchaseBilledEvent;
  'purchase.payment_sent': PurchasePaymentSentEvent;
  'sales_return.created': SalesReturnEvent;
  'purchase_return.created': PurchaseReturnEvent;
};

type EventName = keyof EventPayloadMap;
type EventHandler<K extends EventName> = (payload: EventPayloadMap[K]) => void;

@Injectable()
export class AccountingEventBusService {
  private readonly emitter = new EventEmitter({ captureRejections: true });

  publish<K extends EventName>(eventName: K, payload: EventPayloadMap[K]): void {
    this.emitter.emit(eventName, payload);
  }

  subscribe<K extends EventName>(
    eventName: K,
    handler: EventHandler<K>,
  ): () => void {
    this.emitter.on(eventName, handler as (...args: unknown[]) => void);
    return () => this.emitter.off(eventName, handler as (...args: unknown[]) => void);
  }
}
