import { App, Stack } from 'aws-cdk-lib';
import { RestApi } from 'aws-cdk-lib/aws-apigateway';
import { AwsMethod, Event, EventBus, Function } from 'functionless';

const app = new App();
const stack = new Stack(app, 'functionlessEventBridge');

/**
 * Lambda Functions which implement our business logic.
 */
const receipt = new Function(stack, 'receipt', async () => {
  console.log('receipt sent!');
});
const shipping = new Function(stack, 'shipping', async () => {
  console.log('item shipped');
});

interface Order {
  id: number;
  name: string;
  items: { id: string; name: string; price: number }[];
}

interface OrderEvent extends Event<Order, 'Order', 'myEvent'> {}

// The event bus which will receive and broadcast events.
const bus = new EventBus<OrderEvent>(stack, 'OrdersBus');

// An event bus rule for new orders.
const whenOrder = bus.when(
  'rule1',
  (event) => event.source === 'myEvent' && event['detail-type'] === 'Order',
);

whenOrder.pipe(receipt);
whenOrder.pipe(shipping);

/**
 * A REST API which can be used to create events.
 */
const api = new RestApi(stack, 'FLEventBusApi');
const order = api.root.addResource('order');

new AwsMethod(
  { httpMethod: 'POST', resource: order },
  async () =>
    // send events directly from api gateway to our event bus!
    bus.putEvents({
      'detail-type': 'Order',
      'source': 'myEvent',
      'detail': {
        id: 123,
        name: 'My order',
        items: [{ id: '1', name: 'my Item', price: 10 }],
      },
    }),
  () => {
    return 'done';
  },
);
