import { App, Stack } from 'aws-cdk-lib';
import { RestApi } from 'aws-cdk-lib/aws-apigateway';
import { AttributeType } from 'aws-cdk-lib/aws-dynamodb';
import {
  $AWS,
  ApiGatewayInput,
  ApiRequest,
  AwsMethod,
  EventBus,
  Function,
  Table,
} from 'functionless';
import {
  Order,
  OrderAccepted,
  OrderPlaced,
  OrderRecord,
  OrderReference,
  PaymentSuccessful,
} from './types';

const app = new App();
const stack = new Stack(app, 'ebSaga');

const bus = new EventBus<OrderPlaced | OrderAccepted | PaymentSuccessful>(
  stack,
  'bus',
);
// log all events on the bus
bus.all().pipe(
  new Function(stack, 'handler', async (event) => {
    console.log(JSON.stringify(event, null, 2));
  }),
);

const Orders = new Table<OrderRecord, 'orderId'>(stack, 'orders', {
  partitionKey: {
    name: 'orderId',
    type: AttributeType.STRING,
  },
});

const api = new RestApi(stack, 'api');

interface PlaceOrder
  extends ApiRequest<{ id: string }, Omit<Order, 'orderId'>, {}, {}> {}

/**
 * Inspired by
 *
 * https://twitter.com/jeremy_daly/status/1151657527475654657
 */

/**
 * PUT https://{api_domain}/order/{orderId}
 * {
 * }
 */
const orderId = api.root.addResource('order').addResource('{id}');
new AwsMethod(
  {
    httpMethod: 'POST',
    resource: orderId,
  },
  async ($input: ApiGatewayInput<PlaceOrder>) => {
    return bus.putEvents({
      'source': 'API:PlaceOrder',
      'detail': {
        orderId: $input.params('id'),
        items: $input.data?.items!,
      },
      'detail-type': 'OrderPlaced',
    });
  },
  (result) => {
    return result.data;
  },
);

bus
  .when(
    'onNewOrder',
    (event): event is OrderPlaced => event['detail-type'] === 'OrderPlaced',
  )
  .map((event) => event.detail)
  .pipe(
    new Function(stack, 'newOrder', async (event: Order) => {
      console.log(`---validating order: ${event.orderId} ---`);
      // TODO handle errors as events
      if (event.items.length === 0) {
        throw new Error('Order must have at least 1 item');
      } else if (event.items.some((item) => item.quantity < 1)) {
        throw new Error('Item quantity must be a positive, non-zero number');
      }
      console.log(`---validate order complete: ${event.orderId} ---`);

      console.log(`---recording order: ${event.orderId} ---`);
      try {
        await $AWS.DynamoDB.PutItem({
          Table: Orders,
          Item: {
            orderId: { S: event.orderId },
            items: {
              L: event.items.map((item) => ({
                M: {
                  itemId: {
                    S: item.itemId,
                  },
                  quantity: { N: `${item.quantity}` as `${number}` },
                },
              })),
            },
          },
          ConditionExpression: 'attribute_not_exists(orderId)',
        });
      } catch (err) {
        // TODO: handle errors with events
        throw err;
      }
      console.log(`---recording order: ${event.orderId} ---`);
      await bus.putEvents({
        'detail-type': 'OrderAccepted',
        'detail': {
          orderId: event.orderId,
        },
        'source': 'API:PlaceOrder',
      });
    }),
  );

bus
  .when(
    'onAcceptedOrder',
    (event): event is OrderAccepted => event['detail-type'] === 'OrderAccepted',
  )
  .map((event) => event.detail)
  .pipe(
    new Function(stack, 'processPayment', async (event: OrderReference) => {
      const paymentId = `${Math.floor(Math.random() * 1000)}`;
      console.log(`---processing payment: ${event.orderId} ---`);
      await $AWS.DynamoDB.UpdateItem({
        Key: {
          orderId: { S: event.orderId },
        },
        Table: Orders,
        UpdateExpression: 'SET paymentResult = :paymentResult',
        ExpressionAttributeValues: {
          ':paymentResult': {
            M: {
              id: { S: paymentId },
            },
          },
        },
      });
      console.log(`---payment processing complete: ${event.orderId} ---`);
      await bus.putEvents({
        'detail-type': 'PaymentSuccessful',
        'source': 'API:PlaceOrder',
        'detail': {
          orderId: event.orderId,
        },
      });
    }),
  );
