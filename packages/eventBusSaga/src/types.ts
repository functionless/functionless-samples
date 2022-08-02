import { Event } from 'functionless';

export interface OrderReference {
  orderId: string;
}

export interface Order extends OrderReference {
  items: { itemId: string; quantity: number }[];
}

const PlaceOrderApiSource = 'API:PlaceOrder';

/**
 * Collection of data about the order.
 */
export interface OrderRecord extends Order {
  payment?: PaymentResult;
}

/**
 * Add more order details here
 */
export interface PaymentResult {
  id: string;
}

export interface OrderApiEvent<
  E extends OrderReference = OrderReference,
  DetailType extends string = string
> extends Event<E, DetailType, typeof PlaceOrderApiSource> {}

/**
 * User sends an order to the API.
 */
export interface OrderPlaced extends OrderApiEvent<Order, 'OrderPlaced'> {}

/**
 * System validates and accepts the order.
 */
export interface OrderAccepted
  extends OrderApiEvent<OrderReference, 'OrderAccepted'> {}

export interface PaymentSuccessful
  extends OrderApiEvent<OrderReference, 'PaymentSuccessful'> {}
